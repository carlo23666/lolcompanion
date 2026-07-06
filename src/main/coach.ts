import { z } from 'zod'
import type { ChampSelectInsights } from '@shared/champselect'
import type { PostGameReport } from '@shared/report'

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

const tagsSchema = z.object({
  models: z.array(z.object({ name: z.string() }))
})
const generateSchema = z.object({ response: z.string() })

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
export function buildCoachPrompt(report: PostGameReport): string {
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
    'Eres Hexi, el espíritu hextech que acompaña a un jugador de League of Legends.',
    'Analiza SU partida usando EXCLUSIVAMENTE los datos del JSON siguiente.',
    'PROHIBIDO inventar cifras, objetos o eventos que no estén en los datos.',
    '',
    `DATOS: ${JSON.stringify(facts)}`,
    '',
    'Escribe en español, tono cercano y directo (tutéale), SIN markdown, máximo 5 frases:',
    '1-2 frases sobre lo mejor y lo peor comparado con sus medias personales,',
    '1 frase sobre si siguió las recomendaciones de compra,',
    'y cierra con UN consejo concreto y accionable para la próxima partida.'
  ].join('\n')
}

/** Champ-select facts (comp analysis + ranked picks), anti-hallucination framed. */
export function buildDraftPrompt(insights: ChampSelectInsights): string {
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
    'Eres Hexi, el espíritu hextech que acompaña a un jugador de League of Legends.',
    'El jugador está en la selección de campeones. Usa EXCLUSIVAMENTE los datos del JSON.',
    'PROHIBIDO mencionar campeones, objetos o cifras que no aparezcan en los datos.',
    '',
    `DATOS: ${JSON.stringify(facts)}`,
    '',
    'Escribe en español, tono cercano (tutéale), SIN markdown, máximo 4 frases:',
    'si hay picks sugeridos, cuál encaja mejor con esta partida y por qué (apóyate en las razones);',
    'después la amenaza o plan de compra más importante según los avisos automáticos.'
  ].join('\n')
}

export async function generateCoachAdvice(
  model: string,
  prompt: string,
  url: string = OLLAMA_URL
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
      return { ok: false, error: `Ollama respondió HTTP ${String(response.status)}` }
    }
    const parsed = generateSchema.safeParse(await response.json())
    if (!parsed.success) return { ok: false, error: 'Respuesta de Ollama no válida' }
    const text = parsed.data.response.trim()
    if (text === '') return { ok: false, error: 'Ollama devolvió una respuesta vacía' }
    return { ok: true, text }
  } catch (error) {
    return {
      ok: false,
      error: `No se pudo hablar con Ollama: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

