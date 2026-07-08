import type { Catalog } from './types'

/**
 * Spanish catalog. Must define every key in en.ts — the `Catalog` type makes
 * a missing key a compile error, so translations can never silently drift.
 */
export const es: Catalog = {
  // --- Settings / language ---
  'settings.language': 'Idioma',
  'settings.language.hint': 'Se aplica al instante en toda la app.',

  // --- App shell / navigation ---
  'nav.live': 'Live',
  'nav.history': 'Historial',
  'nav.settings': 'Ajustes',

  // --- Engine: shared words + ordinals + categories ---
  'engine.word.physical': 'físico',
  'engine.word.magic': 'mágico',
  'engine.word.thisItem': 'Este objeto',
  'engine.word.theAlternative': 'la alternativa',
  'engine.ordinal.1': '1º',
  'engine.ordinal.2': '2º',
  'engine.ordinal.3': '3º',
  'engine.ordinal.4': '4º',
  'engine.ordinal.5': '5º',
  'engine.ordinal.6': '6º',
  'engine.cat.armor': 'armadura',
  'engine.cat.mr': 'resistencia mágica',
  'engine.cat.antitank': 'anti-tanque',
  'engine.cat.survival': 'supervivencia',

  // --- Engine: antiheal ---
  'engine.antiheal.index':
    'Índice de curación enemiga {index}{healers} — heridas graves reduce su curación un 40%',
  'engine.antiheal.buy':
    '{item} cuesta {cost} de oro y llevas {gold}: cómpralo en la próxima base',
  'engine.antiheal.short': '{item} cuesta {cost} de oro, te faltan {missing}',
  'engine.antiheal.allyHas':
    'Un aliado ya lleva antiheal; menos urgente pero cubre tus propios objetivos',

  // --- Engine: armor vs MR ---
  'engine.armorMr.dealerItems': '{champion} con {count} objetos de daño',
  'engine.armorMr.physical': 'El {pct} del daño enemigo estimado es físico ({dealers})',
  'engine.armorMr.magic': 'El {pct} del daño enemigo estimado es mágico ({dealers})',
  'engine.armorMr.prioArmor': 'Prioriza armadura: {items} encajan con tu campeón',
  'engine.armorMr.prioMr': 'Prioriza resistencia mágica: {items} encajan con tu campeón',
  'engine.armorMr.preFirst':
    'Aún sin tu primer objeto: prioriza tu build y deja esta defensa para después',

  // --- Engine: anti-tank ---
  'engine.antitank.teamEhp':
    'HP efectiva media enemiga {ehp} (esperada a este minuto: ~{baseline})',
  'engine.antitank.boss':
    '{champion} acumula {ehp} de HP efectiva (nivel {level} + {items} objetos)',
  'engine.antitank.penPhysical': 'Penetración/daño % con {items}',
  'engine.antitank.penMagic': 'Penetración mágica con {items}',

  // --- Engine: anti-burst ---
  'engine.antiburst.threat':
    '{kda} va fed (+{diff}) y su burst {type} te mata sin respuesta',
  'engine.antiburst.window':
    '{item} te da una ventana de supervivencia contra su patrón de entrada',
  'engine.antiburst.more': 'Amenazas adicionales: {threats}',

  // --- Engine: spike-now ---
  'engine.spike.now': 'Puedes completar {item} YA: te cuesta {cost} de oro y llevas {gold}',
  'engine.spike.nowExplain':
    'Completar un objeto es casi siempre mejor spike que acumular componentes sueltos',
  'engine.spike.close':
    'Te faltan solo {shortfall} de oro para {item} ({remaining} restantes, llevas {gold})',
  'engine.spike.closeExplain':
    'Espera una oleada más antes de basear: completarlo vale más que comprar piezas pequeñas',
  'engine.spike.target':
    '{item} está a {cost} de oro de completarse; tenlo como objetivo de la próxima base',

  // --- Engine: next-buy + endgame ---
  'engine.nextbuy.labelPool': '{ordinal} objeto de tu build de {champion}',
  'engine.nextbuy.labelMeta':
    '{ordinal} objeto más comprado en Master+ con {champion} este parche',
  'engine.nextbuy.bootsPaused': 'Botas en pausa: Calzado Mágico (runa) te las dará gratis',
  'engine.nextbuy.isLabel': '{item} es el {label}',
  'engine.nextbuy.canFinishNow':
    'Puedes completarlo YA: te cuesta {cost} de oro y llevas {gold}',
  'engine.nextbuy.component': '{component} ({cost} de oro) avanza el {label}: {target}',
  'engine.nextbuy.componentGold': 'A {target} le faltan {missing} de oro en total; llevas {gold}',
  'engine.nextbuy.saveFor': 'Guarda oro para {target} ({label}): te faltan {missing}',
  'engine.nextbuy.noPiece':
    'Ninguna pieza suelta merece la pena ahora mismo (llevas {gold} de oro)',
  'engine.endgame.situPool': '{item} es tu situacional',
  'engine.endgame.situMeta': '{item} es compra habitual en Master+ con {champion}',
  'engine.endgame.coreDone':
    'Tu build principal de {champion} está completa y te queda hueco: {situational}',
  'engine.endgame.buyNow': 'Puedes comprarlo YA: te cuesta {cost} de oro y llevas {gold}',
  'engine.endgame.shortGold': 'Te faltan {missing} de oro (cuesta {cost} y llevas {gold})',
  'engine.endgame.sellStarter':
    'Inventario lleno pero sigues llevando {starter}: véndelo para liberar hueco',
  'engine.endgame.thenBuy': 'Con el hueco libre, compra {item} ({cost} de oro; llevas {gold})',

  // --- Engine: meta-items + exclusivity + recommend ---
  'engine.meta.pickReason':
    '{item} es lo que compran los Master+ con {champion} en este caso ({games} partidas, {wr}% WR)',
  'engine.meta.suggestion':
    'Pocos Master+ con {champion} lo compran: sugerencia situacional, no prioridad',
  'engine.exclusivity.over':
    'Antes que {other}: no se pueden llevar a la vez (comparten {group})',
  'engine.recommend.situPool': '{item} está en tus situacionales de {champion}',
  'engine.recommend.metaWr':
    'en Master+ con {champion}: {wr}% WR llevando este objeto ({games} partidas)'
}
