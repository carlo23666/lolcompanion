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
  'shell.tagline': 'tu coach local',
  'phase.idle': 'Cliente cerrado',
  'phase.clientOpen': 'Cliente abierto',
  'phase.champSelect': 'Selección de campeones',
  'phase.inGame': 'En partida',
  'phase.postGame': 'Partida terminada',

  // --- Live view (in-game) ---
  'live.curveTitle': 'Tu media con {champion} ({games} partidas): {cs10} CS @10, {cs15} CS @15',
  'live.csVsAvg': 'CS {cs} · tu media {avg}',
  'live.goldTitle': 'Oro estimado por equipo (modelo documentado en normalize.ts)',
  'live.gold': 'oro',
  'live.onMap': 'en el mapa',
  'live.dragonIn': 'en {time}',
  'live.baronIn': 'Barón en {time}',
  'live.baronOnMap': 'Barón en el mapa',
  'live.deadGold': '{gold} oro sin gastar — planea base',
  'live.overlayHint':
    'Tu mascota puede acompañarte dentro del juego con un overlay (LoL en ventana o sin bordes).',
  'live.overlayEnable': 'Actívalo en Ajustes',
  'live.waitingClient': 'Esperando al cliente de League…',
  'live.loadingGame': 'Cargando partida…',
  'live.notInGame': 'No hay partida en curso',
  'live.recommendation': 'Recomendación',
  'live.alternatives': 'Alternativas',
  'live.score': 'puntuación {score}',
  'live.history': 'historial',
  'live.yourTeam': 'Tu equipo',
  'live.enemies': 'Enemigos',
  'live.allies': 'Aliados',
  'live.enemyAnalysis': 'Análisis del equipo enemigo',
  'live.physicalDmg': 'Daño físico {pct}',
  'live.magicDmg': 'Mágico {pct}',
  'live.tankiness': 'Tanquismo',
  'live.healShield': 'Curación/escudos:',
  'live.considerAntiheal': 'considera antiheal',
  'live.enemyDmgSplit': 'Reparto de daño enemigo',
  'live.ehpAbbrev': 'HP ef.',
  'live.stat.time': 'Tiempo',
  'live.stat.gold': 'Oro',
  'live.stat.kda': 'KDA',
  'live.stat.cs': 'CS',
  'live.levelAbbr': 'nivel {n}',
  'live.patch': 'parche {patch}',
  'live.gamePlan': 'Plan de partida',
  'live.gameOverBanner': 'Fin de la partida',
  'live.compareHistory': 'Ver en historial — compara con tus otras partidas',
  'live.loadingTitle': 'Cargando partida',
  'live.loadingHint':
    'La pantalla de carga está en marcha; los datos llegan al aparecer en la Grieta.',
  'live.connectingTitle': 'Conectando con la partida',
  'live.connectingHint': 'Leyendo datos del juego (puerto 2999)…',
  'action.prioritize': 'COMPRA YA',
  'action.add': 'añade',
  'action.delay': 'espera',
  'action.replace': 'reemplaza',
  'rec.action.prioritize': 'COMPRA YA',
  'rec.action.add': 'PRÓXIMA COMPRA',
  'rec.action.delay': 'ESPERA',
  'rec.action.replace': 'VENDE Y CAMBIA',
  'rec.hideHistory': 'ocultar historial',
  'rec.showHistory': 'historial ({n})',

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
    'en Master+ con {champion}: {wr}% WR llevando este objeto ({games} partidas)',

  // --- Stats: weakness insights (WP-016) ---
  'weakness.deaths.early.finding': 'Mueres {avg} veces por partida antes del minuto 14',
  'weakness.deaths.early.advice':
    'Juega la fase de líneas más atrás: cada muerte temprana regala la línea y la ventaja de nivel',
  'weakness.deaths.mid.finding': 'Mueres {avg} veces por partida entre el minuto 14 y el 25',
  'weakness.deaths.mid.advice':
    'En mid game muere quien camina solo: muévete con tu equipo y no cruces el río sin visión',
  'weakness.deaths.late.finding': 'Mueres {avg} veces por partida pasado el minuto 25',
  'weakness.deaths.late.advice':
    'En late game cada muerte son 40+ segundos fuera: no pelees sin tu equipo ni defiendas líneas sin escape',
  'weakness.gankable.finding':
    'El jungla enemigo participa en {avg} de tus muertes tempranas por partida',
  'weakness.gankable.advice':
    'Eres un objetivo fácil de gankeo: guarda visión en el río, mira el minimapa al empujar y respeta las desapariciones',
  'weakness.vision.finding':
    'Tu visión media es {vision}/min, por debajo del suelo de tu rol ({floor}/min)',
  'weakness.vision.advice':
    'Compra guardianes rosas cada base y usa el trinket al salir de línea: la visión es la estadística más barata de mejorar',
  'weakness.objectives.finding':
    'El {pct}% de los objetivos enemigos caen justo después de una muerte tuya',
  'weakness.objectives.advice':
    'Antes de que salga dragón o barón, juega a no morir: tu muerte abre el objetivo aunque no estés cerca',
  'weakness.participation.finding':
    'Participas en el {pct}% de las kills de tu equipo (suelo: {floor}%)',
  'weakness.participation.advice':
    'La partida está pasando lejos de ti: rota a las jugadas de tu equipo aunque pierdas un poco de farmeo',

  // --- Champ select: role labels + pick reasons + comp tips ---
  'cs.role.top': 'top',
  'cs.role.jungle': 'jungla',
  'cs.role.mid': 'mid',
  'cs.role.adc': 'ADC',
  'cs.role.support': 'support',
  'cs.role.default': 'tus partidas',
  'cs.pick.metaBase':
    '{wr}% WR en Master+ este parche ({games} partidas) — la base de la sugerencia',
  'cs.pick.ownAdjust': '{wr}% de victorias en {games} partidas como {role} (tus datos, ajustan)',
  'cs.pick.ownBase':
    '{wr}% de victorias en {games} partidas como {role} (tus datos — la meta aún no tiene muestra de este campeón)',
  'cs.pick.versusOwn': 'contra campeones de esta comp: {wins} de {total} ganadas',
  'cs.pick.versusMeta': 'en Master+ contra {names}: {wr}% WR ({games} partidas)',
  'cs.pick.addsMagic': 'aporta el daño mágico que le falta a tu equipo',
  'cs.pick.addsPhysical': 'aporta el daño físico que le falta a tu equipo',
  'cs.pick.frontline': 'tu equipo no tiene frontline y este pick la aporta',
  'cs.pick.tankVsAssassins': '{n} asesinos enfrente: aguantas mejor sus entradas',
  'cs.pick.mobilityVsAssassins':
    '{n} asesinos enfrente: tu movilidad te deja reposicionarte cuando saltan',
  'cs.pick.immobileVsAssassins':
    'ojo: pick inmóvil contra {n} asesinos — dependerás del peel de tu equipo',
  'cs.pick.antiTankStrong': '{n} tanques enfrente: tu daño por % de vida los derrite',
  'cs.pick.antiTankWeak':
    '{n} tanques enfrente y a este pick le cuesta matarlos — plantéate un anti-tanques',
  'cs.pick.inPool': 'está en tu pool: build baseline lista',
  'cs.tip.heavyAP': 'Comp enemiga muy AP ({n} de {total})',
  'cs.tip.heavyAD': 'Comp enemiga muy AD ({n} de {total})',
  'cs.tip.carryMr':
    '{heavy}: como carry no compres RM de tanque — {items} encajan contigo ({cheap} es la pieza barata)',
  'cs.tip.planMr': '{heavy}: planea resistencia mágica — {cheap} es la pieza barata',
  'cs.tip.carryArmor':
    '{heavy}: como carry no compres armadura de tanque — {items} encaja contigo ({cheap} es la pieza barata)',
  'cs.tip.planArmor': '{heavy}: planea armadura — {cheap} es la pieza barata',
  'cs.tip.mixed': 'Daño enemigo mixto: la vida rinde más que apilar una sola resistencia',
  'cs.tip.healers': 'Curación enemiga a la vista ({names}): reserva hueco para heridas graves',
  'cs.tip.teamAllAd':
    'Tu equipo es casi todo AD: al rival le renta apilar armadura — el daño mágico que aportes vale doble',
  'cs.tip.teamAllAp':
    'Tu equipo es casi todo AP: al rival le renta apilar RM — el daño físico que aportes vale doble'
}
