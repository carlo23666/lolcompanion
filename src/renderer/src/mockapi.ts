import type { GameState } from '@shared/gamestate'
import type { IpcEventChannels, RendererApi } from '@shared/ipc'
import type { ChampSelectState } from '@shared/schemas/lcu'
import midGameState from '../../../fixtures/gamestate/mid.json'

/**
 * BROWSER PREVIEW MODE (design tool, dev only). The renderer normally runs
 * inside Electron with window.api injected by the preload; opened in a plain
 * browser (http://localhost:5173) there is no preload, so this mock fills
 * window.api with canned fixture data. That makes every screen reviewable —
 * and screenshotable by tooling — without Electron or a running game.
 *
 * URL params: ?phase=idle|champSelect|inGame|postGame (default inGame)
 *             ?theme=neon|abismo|anime (default neon)
 *             ?lang=en|es  (default es; drives locale + the canned copy below)
 * Never active in production: main.tsx only loads this when window.api is
 * missing, which cannot happen under the preload.
 */

const params = new URLSearchParams(window.location.search)
const phase = params.get('phase') ?? 'inGame'
const theme = params.get('theme') ?? 'neon'
const lang: 'en' | 'es' = params.get('lang') === 'en' ? 'en' : 'es'

const mid = midGameState as unknown as GameState

/**
 * The dev icon cache on a given machine only holds the subset of assets the
 * app has fetched so far. Remap the streamed fixture onto champions/items that
 * are reliably cached so preview screenshots never show broken icons. This is
 * a preview-only concern — the packaged app caches every asset on demand.
 */
const CHAMP_REMAP: Record<string, { id: string; name: string }> = {
  Malphite: { id: 'Garen', name: 'Garen' },
  LeeSin: { id: 'MasterYi', name: 'Master Yi' }
}
// Fixture item ids known NOT to be in the sparse preview cache.
const UNCACHED_ITEMS = new Set([3086, 3340, 3107, 3020, 6692, 3068, 3153])
function cacheFriendly(state: GameState): GameState {
  const clone = structuredClone(state)
  for (const p of [clone.self, ...clone.allies, ...clone.enemies]) {
    const remap = CHAMP_REMAP[p.championId]
    if (remap) {
      p.championId = remap.id
      p.championName = remap.name
    }
    p.items = (p.items ?? []).filter((it) => !UNCACHED_ITEMS.has(it.id))
  }
  return clone
}
const streamState = cacheFriendly(mid)

/**
 * Canned copy per language. The preview harness is bilingual so both the
 * English and Spanish landing-page screenshots come from the same source of
 * truth. Item names mirror Data Dragon; reasons/tips are illustrative.
 */
const COPY = {
  es: {
    itemIE: 'Filo Infinito',
    itemKraken: 'Aniquilador de Kraken',
    itemGA: 'Ángel de la Guarda',
    itemDominik: 'Recuerdos de Lord Dominik',
    recReasons: [
      'Filo Infinito es el 2º objeto de tu build de Kai’Sa',
      'Puedes completarlo YA: te cuesta 1250 de oro y llevas 1430',
      'en Master+ con Kai’Sa: 58% WR llevando este objeto (812 partidas)'
    ],
    krakenReason: '2 tanques enfrente: daño por % de vida que los derrite',
    gaReason: 'El 68% del daño enemigo estimado es físico',
    insightsTips: [
      'Comp enemiga muy AD (3 de 4): como carry no compres armadura de tanque — Ángel de la Guarda encaja contigo (Cota de mallas es la pieza barata)',
      'Curación enemiga a la vista (Soraka): reserva hueco para heridas graves'
    ],
    coachTip: 'Su jungla está muerto y el dragón sale en 40s: forzadlo ya, ez.',
    coachDirection:
      'Vais 0.9k por detrás pero tu bot está fuerte: juega con Leona, no te acerques a Zed sin visión y agrupad para el dragón del minuto 16. Si cae, empujad mid con el heraldo.',
    coachDraft:
      'Kai’Sa es tu pick aquí: destrozas a sus tanques y su comp es puro AD, así que Ángel de la Guarda y a bailar. GG.',
    coachAnalyze:
      'Buen farmeo, 0.8 CS/min sobre tu media. Ojo a la visión: 14 frente a tu media de 16.',
    csTips: [
      'Comp enemiga muy AD (3 de 4): como carry, prioriza Ángel de la Guarda antes que armadura pura',
      'Enfrente hay 2 tanques: tu daño por % de vida de Kai’Sa los funde'
    ],
    kaisaReasons: [
      '58% de victorias en 24 partidas como ADC (tus datos)',
      'contra campeones de esta comp: 5 de 7 ganadas',
      '47% WR en Master+ este parche (1809 partidas)',
      '2 tanques enfrente: tu daño por % de vida los derrite'
    ],
    jinxReasons: [
      '52% de victorias en 31 partidas como ADC (tus datos)',
      '49% WR en Master+ este parche (1160 partidas)',
      'ojo: pick inmóvil contra 2 asesinos — dependerás del peel de tu equipo'
    ],
    reportSummary: [
      'Farmeaste 0.7 CS/min por encima de tu media — GG de granja',
      'Seguiste 2 de 3 recomendaciones de objeto: buen timing en el Filo Infinito',
      'Visión 18 frente a tu media de 16 — vas mejorando ahí'
    ],
    weaknesses: [
      {
        key: 'deaths-early',
        severity: 'high',
        finding: 'Mueres pronto: 1.8 muertes de media antes del minuto 14 (media de tu rango: 1.1)',
        advice: 'Juega la fase de líneas más segura hasta el primer objeto: respeta el nivel 2 rival.',
        games: 42
      },
      {
        key: 'gankable',
        severity: 'medium',
        finding: 'Te matan mucho en emboscadas: 38% de tus muertes son ganks del jungla enemigo',
        advice: 'Coloca visión en el río hacia el minuto 3 y empuja solo con el jungla localizado.',
        games: 42
      },
      {
        key: 'low-vision',
        severity: 'medium',
        finding: 'Visión por debajo del suelo de tu rol: 0.6/min frente al 0.9/min recomendado para ADC',
        advice: 'Compra un pink al volver de base y gasta el tránsito del soporte antes de empezar la pelea.',
        games: 42
      }
    ]
  },
  en: {
    itemIE: 'Infinity Edge',
    itemKraken: 'Kraken Slayer',
    itemGA: 'Guardian Angel',
    itemDominik: "Lord Dominik's Regards",
    recReasons: [
      'Infinity Edge is the 2nd item in your Kai’Sa build',
      'You can finish it NOW: it costs 1250 gold and you have 1430',
      'in Master+ on Kai’Sa: 58% WR carrying this item (812 games)'
    ],
    krakenReason: '2 tanks on the enemy side: %max-health damage melts them',
    gaReason: '68% of the enemy’s estimated damage is physical',
    insightsTips: [
      'Very AD enemy comp (3 of 4): as a carry, skip tank armor — Guardian Angel fits you (Chain Vest is the cheap piece)',
      'Enemy healing on the board (Soraka): save a slot for grievous wounds'
    ],
    coachTip: 'Their jungler is dead and dragon spawns in 40s: force it now, ez.',
    coachDirection:
      'You’re 0.9k behind but your bot lane is strong: play around Leona, don’t step near Zed without vision, and group for the 16-minute dragon. If it falls, push mid with Herald.',
    coachDraft:
      'Kai’Sa is your pick here: you shred their tanks and their comp is all AD, so grab Guardian Angel and dance. GG.',
    coachAnalyze:
      'Nice farm, 0.8 CS/min above your average. Watch your vision: 14 vs your average of 16.',
    csTips: [
      'Very AD enemy comp (3 of 4): as a carry, prioritize Guardian Angel over pure armor',
      '2 tanks across from you: Kai’Sa’s %max-health damage melts them'
    ],
    kaisaReasons: [
      '58% win rate over 24 games as ADC (your data)',
      'against champions in this comp: 5 of 7 won',
      '47% WR in Master+ this patch (1809 games)',
      '2 tanks on the enemy side: your %max-health damage melts them'
    ],
    jinxReasons: [
      '52% win rate over 31 games as ADC (your data)',
      '49% WR in Master+ this patch (1160 games)',
      'heads up: immobile pick into 2 assassins — you’ll depend on your team’s peel'
    ],
    reportSummary: [
      'You farmed 0.7 CS/min above your average — clean farming game',
      'You followed 2 of 3 item recommendations: good timing on Infinity Edge',
      'Vision 18 vs your average of 16 — you’re improving there'
    ],
    weaknesses: [
      {
        key: 'deaths-early',
        severity: 'high',
        finding: 'You die early: 1.8 deaths on average before minute 14 (your rank’s average: 1.1)',
        advice: 'Play the laning phase safer until your first item: respect the enemy’s level-2 spike.',
        games: 42
      },
      {
        key: 'gankable',
        severity: 'medium',
        finding: 'You get caught by ganks: 38% of your deaths come from the enemy jungler',
        advice: 'Ward the river around minute 3 and only push once the jungler is accounted for.',
        games: 42
      },
      {
        key: 'low-vision',
        severity: 'medium',
        finding: 'Vision below your role’s floor: 0.6/min vs the 0.9/min recommended for ADC',
        advice: 'Buy a control ward on each back and spend the support’s roam before the fight starts.',
        games: 42
      }
    ]
  }
} as const

const C = COPY[lang]

const MOCK_CHAMP_SELECT: ChampSelectState = {
  localPlayerCellId: 3,
  ownPosition: 'bottom',
  myTeam: [
    { cellId: 0, championId: 266, championPickIntent: 0, position: 'top' },
    { cellId: 1, championId: 104, championPickIntent: 0, position: 'jungle' },
    { cellId: 2, championId: 103, championPickIntent: 0, position: 'middle' },
    { cellId: 3, championId: 0, championPickIntent: 145, position: 'bottom' },
    { cellId: 4, championId: 89, championPickIntent: 0, position: 'utility' }
  ],
  theirTeam: [
    { cellId: 5, championId: 122 },
    { cellId: 6, championId: 11 },
    { cellId: 7, championId: 238 },
    { cellId: 8, championId: 119 },
    { cellId: 9, championId: 16 }
  ],
  bans: { mine: [157], theirs: [222] },
  timerPhase: 'BAN_PICK'
}

const MOCK_RECOMMENDATIONS = {
  gameTimeS: mid.gameTimeS,
  recommendations: [
    {
      itemId: 3031,
      itemName: C.itemIE,
      category: null,
      action: 'prioritize' as const,
      score: 88,
      reasons: [...C.recReasons]
    },
    {
      itemId: 6672,
      itemName: C.itemKraken,
      category: null,
      action: 'add' as const,
      score: 61,
      reasons: [C.krakenReason]
    },
    {
      itemId: 3026,
      itemName: C.itemGA,
      category: 'armor',
      action: 'add' as const,
      score: 55,
      reasons: [C.gaReason]
    }
  ]
}

type Listener = (payload: unknown) => void

export function installMockApi(): void {
  const listeners = new Map<string, Listener[]>()
  const emit = <C extends keyof IpcEventChannels>(channel: C, payload: IpcEventChannels[C]): void => {
    for (const listener of listeners.get(channel) ?? []) listener(payload)
  }

  const api: RendererApi = {
    invoke: (channel: string, ...args: unknown[]): Promise<never> => {
      void args
      const respond = (value: unknown): Promise<never> => Promise.resolve(value as never)
      switch (channel) {
        case 'app:ping':
          return respond({ pong: true, version: 'preview' })
        case 'session:get':
          return respond(phase)
        case 'settings:get':
          return respond({
            riotId: 'PLAYER_1#EUW',
            platform: 'euw1',
            recordLive: false,
            soundsEnabled: false,
            soundVolume: 60,
            soundCategories: { recommendation: true, spike: true, objective: true },
            overlayEnabled: true,
            theme,
            locale: lang,
            apiKeySet: true
          })
        case 'staticdata:championMeta':
          return respond({
            266: { id: 'Aatrox', name: 'Aatrox', damageType: 'physical' },
            103: { id: 'Ahri', name: 'Ahri', damageType: 'magic' },
            119: { id: 'Draven', name: 'Draven', damageType: 'physical' },
            104: { id: 'Graves', name: 'Graves', damageType: 'physical' },
            222: { id: 'Jinx', name: 'Jinx', damageType: 'physical' },
            145: { id: 'Kaisa', name: "Kai'Sa", damageType: 'physical' },
            11: { id: 'MasterYi', name: 'Master Yi', damageType: 'physical' },
            89: { id: 'Leona', name: 'Leona', damageType: 'magic' },
            122: { id: 'Darius', name: 'Darius', damageType: 'physical' },
            16: { id: 'Soraka', name: 'Soraka', damageType: 'magic' },
            157: { id: 'Yasuo', name: 'Yasuo', damageType: 'physical' },
            238: { id: 'Zed', name: 'Zed', damageType: 'physical' }
          })
        case 'coach:status':
          return respond({
            enabled: true,
            available: true,
            models: ['gemma3:12b'],
            model: 'gemma3:12b',
            liveEnabled: true
          })
        case 'coach:draft':
          return respond({ ok: true, text: C.coachDraft })
        case 'coach:analyze':
          return respond({ ok: true, text: C.coachAnalyze })
        case 'champselect:insights':
          return respond({
            enemySplit: { physical: 3, magic: 1, mixed: 0, picked: 4 },
            allySplit: { physical: 2, magic: 1, mixed: 0, picked: 3 },
            tips: [...C.csTips],
            picks: [
              {
                championId: 'Kaisa',
                name: "Kai'Sa",
                games: 24,
                winratePct: 58,
                reasons: [...C.kaisaReasons]
              },
              {
                championId: 'Jinx',
                name: 'Jinx',
                games: 31,
                winratePct: 52,
                reasons: [...C.jinxReasons]
              }
            ],
            ownPlan: null
          })
        case 'history:list':
          return respond(
            Array.from({ length: 6 }, (_, index) => ({
              matchId: `EUW1_${String(7000000100 + index)}`,
              champion: ['Kaisa', 'Jinx', 'Samira', 'Kaisa', 'Twitch', 'Ezreal'][index],
              win: index % 3 !== 1,
              kills: 8 + index,
              deaths: 4,
              assists: 6,
              csPerMin: 7.2,
              durationS: 1800 + index * 120,
              patch: '16.13',
              gameCreation: Date.now() - index * 86_400_000,
              queueId: 420,
              role: 'BOTTOM',
              items: [3031, 3006, 6672, 3026, 3031, 0]
            }))
          )
        case 'history:aggregates':
          return respond({ games: 20, wins: 12, winratePct: 60, csPerMin: 7.1 })
        case 'history:champions':
          return respond(['Kaisa', 'Jinx', 'Samira'])
        case 'stats:overview': {
          const champ = (
            champion: string,
            games: number,
            winratePct: number,
            kda: number
          ): Record<string, unknown> => ({
            champion,
            games,
            winratePct,
            kda,
            csPerMin: 7.1,
            goldPerMin: 410,
            damageSharePct: 29,
            visionPerMin: 0.6,
            deathsPerGame: 4.6,
            visionPerGame: 16
          })
          return respond({
            totalGames: 87,
            champions: [
              champ('Kaisa', 24, 58, 3.4),
              champ('Jinx', 31, 52, 3.1),
              champ('Samira', 14, 43, 2.6),
              champ('Twitch', 11, 55, 3.0),
              champ('Ezreal', 7, 43, 2.4)
            ],
            streaks: {
              current: 3,
              longestWin: 6,
              longestLoss: 4,
              sessionFirstWrPct: 61,
              sessionLaterWrPct: 44,
              sessionLaterGames: 27
            },
            durations: [
              { bucket: 'corta', games: 22, winratePct: 64 },
              { bucket: 'media', games: 41, winratePct: 54 },
              { bucket: 'larga', games: 24, winratePct: 46 }
            ],
            firstDragon: { withGames: 39, withWrPct: 62, withoutGames: 48, withoutWrPct: 44 },
            worstMatchups: [
              { enemyChampion: 'Draven', role: 'BOTTOM', games: 6, winratePct: 33 },
              { enemyChampion: 'Caitlyn', role: 'BOTTOM', games: 5, winratePct: 40 }
            ],
            bestMatchups: [
              { enemyChampion: 'Aphelios', role: 'BOTTOM', games: 5, winratePct: 80 },
              { enemyChampion: 'Varus', role: 'BOTTOM', games: 4, winratePct: 75 }
            ],
            weekdays: [
              { weekday: 1, games: 12, winratePct: 58 },
              { weekday: 3, games: 15, winratePct: 47 },
              { weekday: 5, games: 21, winratePct: 62 },
              { weekday: 6, games: 24, winratePct: 50 }
            ],
            weaknesses: C.weaknesses
          })
        }
        case 'report:last':
          return respond({
            kind: 'report',
            report: {
              matchId: 'EUW1_7000000123',
              champion: 'Kaisa',
              win: true,
              durationS: 1927,
              kills: 11,
              deaths: 3,
              assists: 8,
              csPerMin: 7.8,
              goldPerMin: 445,
              damageSharePct: 33,
              visionScore: 18,
              avgCsPerMin: 7.1,
              avgGoldPerMin: 410,
              avgDamageSharePct: 29,
              avgDeaths: 4.6,
              avgVisionScore: 16,
              recommendedItems: [
                { itemId: 3031, itemName: C.itemIE, followed: true },
                { itemId: 6672, itemName: C.itemKraken, followed: true },
                { itemId: 3026, itemName: C.itemGA, followed: false }
              ],
              summary: [...C.reportSummary]
            }
          })
        case 'history:detail':
          return respond({
            matchId: String(args[0]),
            champion: 'Kaisa',
            role: 'BOTTOM',
            win: true,
            kills: 9,
            deaths: 4,
            assists: 6,
            cs: 216,
            gold: 14500,
            damage: 28900,
            vision: 14,
            durationS: 1860,
            patch: '16.13',
            items: [3031, 3006, 6672, 3026, 3031],
            goldCurve: [500, 1400, 2600, 4100, 5900, 8200, 10800, 12900, 14500],
            laneOpponent: 'Jinx',
            metaBuild: {
              patch: '16.13',
              games: 1809,
              items: [
                { itemId: 3031, games: 1490, wins: 810 },
                { itemId: 3006, games: 1380, wins: 745 },
                { itemId: 6672, games: 1120, wins: 620 },
                { itemId: 3026, games: 840, wins: 470 },
                { itemId: 3089, games: 660, wins: 350 },
                { itemId: 3157, games: 480, wins: 265 }
              ]
            }
          })
        case 'stats:curve':
          return respond(null)
        case 'dev:enabled':
          return respond(false)
        case 'meta:status':
          return respond({
            running: false,
            processed: 0,
            stored: 0,
            seedsDone: 0,
            seedsTotal: 0,
            error: null,
            patches: [{ patch: '16.13', matches: 13835 }]
          })
        default:
          return respond({})
      }
    },
    on: (channel, listener) => {
      const list = listeners.get(channel) ?? []
      list.push(listener as Listener)
      listeners.set(channel, list)
      return () => void 0
    }
  }

  window.api = api

  // ddicon:// is an Electron protocol — in the browser, serve the SAME image
  // files from the app's icon cache, copied into public/ddcache by the
  // preview setup (see docs: copy %APPDATA%/lol-companion/staticdata/icons).
  const PATCH = '16.13.1'
  const rewrite = (img: HTMLImageElement): void => {
    const src = img.getAttribute('src') ?? ''
    if (!src.startsWith('ddicon://')) return
    const [, kind, file] = /^ddicon:\/\/([a-z]+)\/(.+)$/.exec(src) ?? []
    if (kind === undefined || file === undefined) return
    img.src =
      kind === 'splash' ? `/ddcache/shared/splash/${file}` : `/ddcache/${PATCH}/${kind}/${file}`
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLImageElement) rewrite(node)
        else if (node instanceof HTMLElement) node.querySelectorAll('img').forEach(rewrite)
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true })

  // Stream the fixture so the in-game views come alive.
  setTimeout(() => {
    emit('session:phase', phase as IpcEventChannels['session:phase'])
    if (phase === 'inGame') {
      emit('live:state', 'polling')
      emit('gamestate:update', streamState)
      emit('gamestate:recommendations', MOCK_RECOMMENDATIONS)
      // `nocoach` keeps the overlay capture free of the coach walk-in + its
      // recent-alert line (which StrictMode's double-mounted listener dupes).
      if (!params.has('nocoach')) {
        setTimeout(() => emit('coach:tip', { gameTimeS: mid.gameTimeS, text: C.coachTip }), 2500)
        emit('coach:direction', { gameTimeS: mid.gameTimeS, text: C.coachDirection })
      }
    }
    if (phase === 'champSelect') emit('session:champselect', MOCK_CHAMP_SELECT)
  }, 300)
}
