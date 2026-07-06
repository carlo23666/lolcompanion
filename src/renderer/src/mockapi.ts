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
 *             ?theme=recreativa|sakura|cabina (default recreativa)
 * Never active in production: main.tsx only loads this when window.api is
 * missing, which cannot happen under the preload.
 */

const params = new URLSearchParams(window.location.search)
const phase = params.get('phase') ?? 'inGame'
const theme = params.get('theme') ?? 'recreativa'

const mid = midGameState as unknown as GameState

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
    { cellId: 6, championId: 64 },
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
      itemName: 'Filo Infinito',
      category: null,
      action: 'prioritize' as const,
      score: 88,
      reasons: [
        'Filo Infinito es el 2º objeto de tu build de Kai’Sa',
        'Puedes completarlo YA: te cuesta 1250 de oro y llevas 1430',
        'en Master+ con Kaisa: 58% WR llevando este objeto (812 partidas)'
      ]
    },
    {
      itemId: 3153,
      itemName: 'Filo de la Noche… no, de Ruina',
      category: null,
      action: 'add' as const,
      score: 61,
      reasons: ['2 tanques enfrente: daño por % de vida']
    },
    {
      itemId: 3026,
      itemName: 'Ángel de la Guarda',
      category: 'armadura',
      action: 'add' as const,
      score: 55,
      reasons: ['El 68% del daño enemigo estimado es físico']
    }
  ]
}

const MOCK_INSIGHTS_TIPS = [
  'Comp enemiga muy AD (3 de 4): como carry no compres armadura de tanque — Ángel de la Guarda encaja contigo (Cota de mallas es la pieza barata)',
  'Curación enemiga a la vista (Soraka): reserva hueco para heridas graves'
]

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
            64: { id: 'LeeSin', name: 'Lee Sin', damageType: 'physical' },
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
          return respond({
            ok: true,
            text: 'Kai’Sa es tu pick aquí: destrozas a sus tanques y su comp es puro AD, así que Ángel de la Guarda y a bailar. GG.'
          })
        case 'coach:analyze':
          return respond({
            ok: true,
            text: 'Buen farmeo, 0.8 CS/min sobre tu media. Ojo a la visión: 14 frente a tu media de 16.'
          })
        case 'champselect:insights':
          return respond({
            enemySplit: { physical: 3, magic: 1, mixed: 0, picked: 4 },
            allySplit: { physical: 2, magic: 1, mixed: 0, picked: 3 },
            tips: MOCK_INSIGHTS_TIPS,
            picks: [
              {
                championId: 'Kaisa',
                name: "Kai'Sa",
                games: 24,
                winratePct: 58,
                reasons: [
                  '58% de victorias en 24 partidas como ADC (tus datos)',
                  'contra campeones de esta comp: 5 de 7 ganadas',
                  '47% WR en Master+ este parche (1809 partidas)',
                  '2 tanques enfrente: tu daño por % de vida los derrite'
                ]
              },
              {
                championId: 'Jinx',
                name: 'Jinx',
                games: 31,
                winratePct: 52,
                reasons: [
                  '52% de victorias en 31 partidas como ADC (tus datos)',
                  '49% WR en Master+ este parche (1160 partidas)',
                  'ojo: pick inmóvil contra 2 asesinos — dependerás del peel de tu equipo'
                ]
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
              items: [3031, 3006, 3153, 3036, 3026, 0]
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
              champ('Samira', 14, 43, 2.6)
            ],
            streaks: { current: 3, bestWin: 6, worstLoss: -4 },
            durations: [],
            firstDragon: null,
            worstMatchups: [],
            bestMatchups: [],
            weekdays: []
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
                { itemId: 3031, itemName: 'Filo Infinito', followed: true },
                { itemId: 3036, itemName: 'Recordatorio Mortal', followed: true },
                { itemId: 3026, itemName: 'Ángel de la Guarda', followed: false }
              ],
              summary: ['Farmeaste 0.7 CS/min por encima de tu media — GG de granja']
            }
          })
        case 'stats:curve':
        case 'history:detail':
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
      emit('gamestate:update', mid)
      emit('gamestate:recommendations', MOCK_RECOMMENDATIONS)
      setTimeout(
        () => emit('coach:tip', { gameTimeS: mid.gameTimeS, text: 'Su jungla está muerto y el dragón sale en 40s: forzadlo ya, ez.' }),
        2500
      )
      emit('coach:direction', {
        gameTimeS: mid.gameTimeS,
        text: 'Vais 0.9k por detrás pero tu bot está fuerte: juega con Leona, no te acerques a Zed sin visión y agrupad para el dragón del minuto 16. Si cae, empujad mid con el heraldo.'
      })
    }
    if (phase === 'champSelect') emit('session:champselect', MOCK_CHAMP_SELECT)
  }, 300)
}
