import { z } from 'zod'
import type { ChampSelectInsights } from '@shared/champselect'
import type { PostGameReport } from '@shared/report'
import { t as translators, type Translator } from '@shared/i18n'

/**
 * Optional local-AI coach over Ollama (https://ollama.com): turns the
 * structured facts of a post-game report into short Spanish coaching prose.
 * Strictly narrative — the rules engine remains the only source of
 * recommendations, and the prompt forbids inventing data. Everything runs
 * against localhost; nothing leaves the machine. Degrades to "no disponible"
 * when Ollama isn't installed/running.
 */

const OLLAMA_URL = 'http://127.0.0.1:11434'
export const DEFAULT_COACH_MODEL = 'gemma3:4b'

/**
 * Shared product voice. The champion in the data is always THE PLAYER; the
 * model addresses them directly without introducing or role-playing itself.
 */
export function buildPersona(name: string, t: Translator = translators.es): string {
  return t('coach.persona', { name })
}

const tagsSchema = z.object({
  models: z.array(z.object({ name: z.string() }))
})
const generateSchema = z.object({ response: z.string() })

/**
 * Last-mile guard for small local models that ignore voice instructions.
 * Removes decorative emoji and a leading mascot/coach introduction while
 * preserving the actual analysis that follows it.
 */
export function sanitizeCoachText(raw: string): string {
  let text = raw
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'«]+|["'»]+$/g, '')
    .trim()
  const introduction =
    /^(?:(?:hola|hello|hi)[,.!;:\s-]*)?(?:(?:soy|me llamo|i['’]?m|i am)\s+[\p{L}\p{N}_-]+|(?:como|as)\s+(?:(?:tu|your)\s+)?(?:coach|mascota|acompañante|asistente|companion|mascot|assistant))[^.!?;:]{0,100}[.!?;:]\s*/iu
  const nameHere = /^[\p{L}\p{N}_-]+\s+(?:aquí|al habla|here)[,.!;:\s-]*/iu
  text = text.replace(introduction, '').replace(nameHere, '').trim()
  return text.replace(/\s+/g, ' ')
}

export interface OllamaStatus {
  available: boolean
  models: string[]
}

export async function ollamaStatus(url: string = OLLAMA_URL): Promise<OllamaStatus> {
  try {
    const response = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(1500) })
    if (!response.ok) return { available: false, models: [] }
    const parsed = tagsSchema.safeParse(await response.json())
    if (!parsed.success) return { available: false, models: [] }
    return { available: true, models: parsed.data.models.map((model) => model.name) }
  } catch {
    return { available: false, models: [] }
  }
}

/** The report's facts, serialized for the model, with an anti-hallucination frame. */
export function buildCoachPrompt(
  report: PostGameReport,
  personaName = 'Hexi',
  t: Translator = translators.es
): string {
  const facts = {
    campeon: report.champion,
    resultado: report.win ? 'victoria' : 'derrota',
    duracionMin: Math.round(report.durationS / 60),
    kda: `${String(report.kills)}/${String(report.deaths)}/${String(report.assists)}`,
    csPorMin: report.csPerMin,
    mediaPersonalCsPorMin: report.avgCsPerMin,
    oroPorMin: report.goldPerMin,
    mediaPersonalOroPorMin: report.avgGoldPerMin,
    porcentajeDanoDelEquipo: report.damageSharePct,
    mediaPersonalDano: report.avgDamageSharePct,
    muertes: report.deaths,
    mediaPersonalMuertes: report.avgDeaths,
    vision: report.visionScore,
    mediaPersonalVision: report.avgVisionScore,
    recomendacionesDeCompra: report.recommendedItems.map((item) => ({
      objeto: item.itemName ?? String(item.itemId),
      comprado: item.followed
    })),
    conclusionesAutomaticas: report.summary
  }
  return [
    buildPersona(personaName, t),
    t('coach.report.frame'),
    '',
    `${t('coach.dataLabel')}: ${JSON.stringify(facts)}`,
    '',
    t('coach.report.output')
  ].join('\n')
}

/** Champ-select facts (comp analysis + ranked picks), anti-hallucination framed. */
export function buildDraftPrompt(
  insights: ChampSelectInsights,
  personaName = 'Hexi',
  t: Translator = translators.es
): string {
  const facts = {
    danoEnemigo: insights.enemySplit,
    danoAliado: insights.allySplit,
    avisosAutomaticos: insights.tips,
    picksSugeridos: insights.picks.map((pick) => ({
      campeon: pick.name,
      winratePropio: `${pick.winratePct.toFixed(0)}% en ${String(pick.games)} partidas`,
      razones: pick.reasons
    })),
    buildPlaneada: insights.ownPlan
      ? {
          campeon: insights.ownPlan.championId,
          core: insights.ownPlan.core.map((item) => item.name),
          situacionales: insights.ownPlan.situational.map((item) => item.name)
        }
      : null
  }
  return [
    buildPersona(personaName, t),
    t('coach.draft.frame'),
    '',
    `${t('coach.dataLabel')}: ${JSON.stringify(facts)}`,
    '',
    t('coach.draft.output')
  ].join('\n')
}

/**
 * The saved model when it's still installed, otherwise the first available
 * one — heals the "deleted the model the settings point at" state without
 * user action. Falls back to the saved name when Ollama lists nothing.
 */
export function resolveModel(saved: string, available: string[]): string {
  if (available.includes(saved)) return saved
  return available[0] ?? saved
}

/** generateCoachAdvice, with the model resolved against what Ollama has NOW. */
export async function generateWithInstalledModel(
  savedModel: string,
  prompt: string,
  url?: string,
  t: Translator = translators.es
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const status = await ollamaStatus(url)
  return generateCoachAdvice(resolveModel(savedModel, status.models), prompt, url, t)
}

export async function generateCoachAdvice(
  model: string,
  prompt: string,
  url: string = OLLAMA_URL,
  t: Translator = translators.es
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const response = await fetch(`${url}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        // Low temperature: narrate facts, don't get creative with numbers.
        options: { temperature: 0.4, num_predict: 400 }
      }),
      // Local models on modest hardware can take a while on first load.
      signal: AbortSignal.timeout(120_000)
    })
    if (!response.ok) {
      return { ok: false, error: t('coach.err.http', { status: String(response.status) }) }
    }
    const parsed = generateSchema.safeParse(await response.json())
    if (!parsed.success) return { ok: false, error: t('coach.err.invalid') }
    const text = sanitizeCoachText(parsed.data.response)
    if (text === '') return { ok: false, error: t('coach.err.empty') }
    return { ok: true, text }
  } catch (error) {
    return {
      ok: false,
      error: t('coach.err.unreachable', {
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }
}
