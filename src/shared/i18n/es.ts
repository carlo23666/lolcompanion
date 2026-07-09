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
  'live.obj.dragons': 'dragones',
  'live.obj.barons': 'barones',
  'live.obj.heralds': 'heraldos',
  'live.obj.towers': 'torres',
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

  // --- Home dashboard (idle / client open) ---
  'home.tip.1': 'El dragón aparece en el minuto 5: pide visión del río antes.',
  'home.tip.2': 'Con 2500 de oro sin gastar estás jugando con desventaja — planea la base.',
  'home.tip.3': 'Heridas graves reduce la curación enemiga un 40%: no la compres tarde.',
  'home.tip.4':
    'Tu racha de derrotas pesa: después de 2 seguidas, un descanso rinde más que otra cola.',
  'home.tip.5': 'Los picos de nivel 6/11/16 enemigos aparecen en el feed: respétalos.',
  'home.tip.6': 'Farmear 8 CS/min vale más que perseguir kills que no llegan.',
  'home.tip.7':
    'Mira tu Historial: los datos de tus propias partidas mandan más que cualquier guía.',
  'home.firstRun.greeting': '¡Hola! Soy {mascot}, tu coach de la Grieta',
  'home.firstRun.body':
    'Configura tu Riot ID y sincroniza el historial: a partir de ahí analizo tus campeones, tus builds y tus partidas en directo.',
  'home.firstRun.cta': 'Empezar en Ajustes',
  'home.ready.title': '¡Lista para la cola!',
  'home.idle.title': 'Descansando el cristal…',
  'home.ready.body':
    'Cliente detectado. Entra en cola: la selección de campeones y la partida se activan solas.',
  'home.idle.body': 'Abre el cliente de League of Legends; lo detecto automáticamente.',
  'home.metric.games': 'Partidas',
  'home.metric.streak': 'Racha',
  'home.metric.wr': 'WR {champion}',
  'home.champCard': '{games} partidas · KDA {kda} · {cs} CS/min',
  'home.lastGame': 'Última partida',
  'home.win': 'Victoria',
  'home.loss': 'Derrota',
  'home.withChampion': 'con {champion}',
  'home.noGame': 'Aún no hay ninguna partida enlazada — juega una y el informe aparecerá aquí.',

  // --- History view ---
  'hist.tab.games': 'Partidas',
  'hist.tab.stats': 'Estadísticas',
  'hist.summary.games': 'Partidas',
  'hist.summary.winrate': 'Winrate',
  'hist.summary.kda': 'KDA',
  'hist.summary.cs': 'CS/min',
  'hist.summary.streak': 'Racha',
  'hist.summary.form': 'Forma',
  'hist.summary.formTitle': 'Últimas 10 (izquierda = más reciente)',
  'hist.win': 'Victoria',
  'hist.loss': 'Derrota',
  'hist.winLower': 'victoria',
  'hist.lossLower': 'derrota',
  'hist.goldCurveLabel': 'Curva de oro por minuto',
  'hist.finalBuild': 'Build final',
  'hist.detailGold': '{gold}k oro',
  'hist.perMin': '({value}/min)',
  'hist.damageVision': '{dmg}k daño · visión {vision}',
  'hist.laneOpponent': 'Rival de carril',
  'hist.viewReport': 'Ver informe',
  'hist.metaBuild': 'Build Master+ ({champion} · parche {patch} · {games} partidas) — coincides en',
  'hist.masterPctTitle': '{pct}% de las builds Master+',
  'hist.alsoYours': ' · también en la tuya',
  'hist.goldPerMin': 'Oro por minuto',
  'hist.noReport': 'No hay informe disponible para esta partida.',
  'hist.filter.champion': 'Filtrar por campeón',
  'hist.allChampions': 'Todos los campeones',
  'hist.filter.result': 'Filtrar por resultado',
  'hist.result.all': 'Todas',
  'hist.result.wins': 'Victorias',
  'hist.result.losses': 'Derrotas',
  'hist.filter.role': 'Filtrar por rol',
  'hist.allRoles': 'Todos los roles',
  'hist.filter.queue': 'Filtrar por cola',
  'hist.allQueues': 'Todas las colas',
  'hist.filter.patch': 'Filtrar por parche',
  'hist.allPatches': 'Todos los parches',
  'hist.patchLabel': 'parche {patch}',
  'hist.queuePrefix': 'cola {id}',
  'hist.sort': 'Ordenar',
  'hist.sortAria': 'Ordenar partidas',
  'hist.sort.date': 'Fecha',
  'hist.sort.kda': 'KDA',
  'hist.sort.cs': 'CS/min',
  'hist.sort.duration': 'Duración',
  'hist.filterBy': 'Filtrar por {champion}',
  'hist.aggGames': '{n}p',
  'hist.empty.none': 'Sin partidas guardadas',
  'hist.empty.noMatch': 'Ninguna partida cumple el filtro',
  'hist.empty.noneHint':
    'Sincroniza tu historial en Ajustes o termina una partida: aparecerá aquí sola.',
  'hist.empty.noMatchHint': 'Relaja algún filtro para volver a ver partidas.',
  'hist.itemAlt': 'objeto {id}',

  // --- Stats view ---
  'stats.calculating': 'Calculando estadísticas…',
  'stats.noData': 'Sin datos todavía — sincroniza tu historial en Ajustes.',
  'stats.streaks': 'Rachas y sesiones',
  'stats.currentStreak': 'racha actual',
  'stats.bestStreak': 'Mejor racha:',
  'stats.wins': '{n} victorias',
  'stats.worstStreak': 'Peor racha:',
  'stats.losses': '{n} derrotas',
  'stats.gamesAnalyzed': '{n} partidas analizadas',
  'stats.session12': 'Partidas 1-2 de sesión:',
  'stats.session3': 'Partida 3 en adelante:',
  'stats.tilt':
    'Tu winrate cae {n} puntos a partir de la 3ª partida — considera sesiones más cortas',
  'stats.weakTitle': 'Puntos débiles detectados',
  'stats.weakSample': '({n}p)',
  'stats.byChampion': 'Por campeón',
  'stats.th.champion': 'Campeón',
  'stats.th.games': 'P',
  'stats.th.wr': 'WR',
  'stats.th.kda': 'KDA',
  'stats.th.csmin': 'CS/min',
  'stats.th.goldmin': 'Oro/min',
  'stats.th.dmgPct': '% daño',
  'stats.th.visionMin': 'Visión/min',
  'stats.matchupTitle': '{role} · {games} partidas',
  'stats.curves': 'Tu curva de farmeo (medias personales)',
  'stats.th.gold10': 'Oro @10',
  'stats.th.gold15': 'Oro @15',
  'stats.durationTitle': 'Winrate por duración de partida',
  'stats.firstDragon': 'Primer dragón',
  'stats.dragonTaken': 'tu equipo lo coge ({n})',
  'stats.dragonLost': 'lo pierde ({n})',
  'stats.worstMatchups': 'Peores matchups (misma línea)',
  'stats.bestMatchups': 'Mejores matchups (misma línea)',
  'stats.byWeekday': 'Winrate por día de la semana',
  'stats.wd.0': 'Dom',
  'stats.wd.1': 'Lun',
  'stats.wd.2': 'Mar',
  'stats.wd.3': 'Mié',
  'stats.wd.4': 'Jue',
  'stats.wd.5': 'Vie',
  'stats.wd.6': 'Sáb',

  // --- Post-game report ---
  'report.coachTitle': 'Análisis de {mascot} (IA local)',
  'report.coachThinking': '{mascot} está pensando… (modelo local, dale unos segundos)',
  'report.coachPreparing': 'Preparando análisis…',
  'report.unknownError': 'error desconocido',
  'report.avg': 'media {value}',
  'report.practiceTool': 'Herramienta de práctica',
  'report.thisMode': 'este modo',
  'report.waiting': 'El informe aparecerá en cuanto Riot publique la partida (1-3 min)…',
  'report.unsupportedMode':
    'Las partidas de {mode} no aparecen en el historial de Riot, así que no hay informe para esta partida.',
  'report.stat.deaths': 'Muertes',
  'report.stat.vision': 'Visión',
  'report.engineRecs': 'Recomendaciones del motor ({followed}/{total} seguidas)',
  'report.sum.deathsHigh':
    'Has muerto {deaths} veces, por encima de tu media de {avg} con {champion} — revisa qué muertes eran evitables',
  'report.sum.deathsLow': 'Solo {deaths} muertes (tu media: {avg}) — buen control del riesgo',
  'report.sum.visionLow':
    'Visión baja: {score} puntos frente a tu media de {avg} — compra algún pink más y usa el trinket al salir de base',
  'report.sum.visionGood': 'Buena visión: {score} puntos frente a tu media de {avg}',
  'report.sum.csLow':
    'Farmeo flojo: {cs} CS/min frente a tu media de {avg} — prioriza oleadas entre jugadas',
  'report.sum.dmgHigh':
    'Has cargado con el daño del equipo: {pct}% frente a tu media de {avg}%',
  'report.sum.buildConsistent':
    'Build consistente: has seguido {followed} de {total} recomendaciones del motor',
  'report.sum.buildFew':
    'Solo has seguido {followed} de {total} recomendaciones del motor — compara tu build final con las sugerencias de abajo',
  'report.sum.metaHigh':
    'Tu build final coincide en {overlap} de {total} objetos con lo más comprado en Master+ con {champion}',
  'report.sum.metaLow':
    'Tu build final solo coincide en {overlap} de {total} objetos con lo más comprado en Master+ — compara tu itemización',

  // --- Champ select panel ---
  'csp.coachTitle': '{mascot} analiza el draft',
  'csp.recalculating': 'recalculando…',
  'csp.thinking': 'Pensando…',
  'csp.waitingDraft': 'Esperando cambios en el draft…',
  'csp.championFallback': 'campeón {id}',
  'csp.unpicked': 'sin elegir',
  'csp.buyPlan': 'Plan de compra contra esta comp',
  'csp.yourPlan': 'Tu plan con {champion} (de tus propias partidas)',
  'csp.situational': 'situacionales:',
  'csp.inProgress': 'Selección de campeones en curso',
  'csp.waitingData': 'Esperando datos de la selección…',
  'csp.title': 'Selección de campeones',
  'csp.yourPosition': 'tu posición: {pos}',
  'csp.noPicks': 'Sin picks visibles todavía',
  'csp.bans': 'Baneos',
  'csp.whatPick': '¿Qué te pego? · tus partidas + Master+ + kit',
  'csp.inGames': 'en {games} partidas',
  'csp.footer': 'Consejos derivados solo de los campeones visibles en pantalla.',

  // --- Settings view ---
  'set.account': 'Cuenta',
  'set.riotId': 'Riot ID (nombre#TAG)',
  'set.riotIdPlaceholder': 'Ejemplo#EUW',
  'set.apiKey': 'Clave de la API de Riot',
  'set.saved': 'guardada',
  'set.apiKeyPlaceholderSet': '(sin cambios — escribe para reemplazarla)',
  'set.apiKeyHint':
    'Genera una gratis en developer.riotgames.com (las claves de desarrollo caducan cada 24 h). Se guarda cifrada en este equipo y nunca sale de él.',
  'set.region': 'Región',
  'set.recordLive': 'Grabar partidas en vivo como fixtures (solo desarrollo)',
  'set.sounds': 'Sonidos',
  'set.soundsEnable': 'Activar sonidos',
  'set.volume': 'Volumen',
  'set.sound.recommendation': 'Nueva recomendación (campanita)',
  'set.sound.spike': 'Power-spike enemigo (doble aviso)',
  'set.sound.objective': 'Ventana de objetivo (cuerno)',
  'set.soundTest': 'Probar',
  'set.overlay':
    'Overlay in-game con la mascota (experimental — requiere LoL en ventana o sin bordes; se activa al entrar en partida)',
  'set.theme': 'Tema',
  'set.applyHint': 'Se aplica al instante; pulsa Guardar para conservarlo.',
  'set.save': 'Guardar',
  'set.saveHistory': 'Sincronizar historial',
  'set.settingsSaved': 'Ajustes guardados',
  'set.savedShort': 'Guardado',
  'set.syncError': 'No se pudo iniciar la sincronización',
  'set.meta.title': 'Datos meta (Master+)',
  'set.meta.desc':
    'Rastrea partidas ranked de Master, Grandmaster y Challenger con tu clave de la API y guarda solo agregados (winrates, matchups, builds). Alimenta las sugerencias de pick y el informe. Déjalo en marcha en segundo plano: ~2000 partidas/hora.',
  'set.meta.aggregated': '{n} partidas agregadas',
  'set.meta.patchEntry': 'parche {patch}: {n}',
  'set.meta.crawling': 'Rastreando… {stored} nuevas esta sesión · semillas {done}/{total}',
  'set.meta.stop': 'Detener rastreo',
  'set.meta.start': 'Iniciar rastreo Master+',
  'set.meta.startError': 'no se pudo iniciar',
  'set.coach.title': 'Coach IA local (experimental)',
  'set.coach.desc':
    'Usa un modelo de IA gratuito ejecutándose EN TU PC (via Ollama) para comentar tus informes de partida en lenguaje natural. Nada sale de tu equipo. El motor de recomendaciones no depende de esto.',
  'set.coach.detected': 'Ollama detectado ({n} modelos)',
  'set.coach.notDetected': 'Ollama no detectado. Instálalo gratis desde',
  'set.coach.andRun': 'y ejecuta',
  'set.coach.recheck': 'Volver a consultar Ollama (tras instalar o borrar modelos)',
  'set.coach.enable': 'Activar análisis de la mascota (informe de partida y champ select)',
  'set.coach.live':
    'Consejos EN PARTIDA (~1 por minuto): la mascota sugiere macro en el overlay — visión antes de objetivos, cuándo forzar, cuándo jugar seguro',
  'set.coach.model': 'Modelo',
  'set.coach.notInstalled': '{model} (no instalado — se usará otro)',
  'set.sync.title': 'Sincronización',
  'set.sync.error': 'Error: {error}',
  'set.sync.done': 'Completado: {stored} partidas nuevas ({skipped} ya guardadas)',
  'set.sync.downloading': 'Descargando… {stored} guardadas, {skipped} omitidas',

  // --- Errors + updater (main process) ---
  'err.missingKey': 'Falta la clave de la API de Riot (Ajustes → Cuenta)',
  'err.syncInProgress': 'Sincronización ya en curso',
  'err.missingRiotId': 'Configura tu Riot ID (nombre#TAG) primero',
  'err.accountNotFound': 'Cuenta no encontrada: {message}',
  'err.staticUnavailable': 'Datos estáticos no disponibles (sin conexión y sin caché)',
  'err.apiKeyRejected': 'Clave API rechazada (403): renuévala en Ajustes/.env',
  'err.noSeeds': 'Sin jugadores semilla (¿clave API caducada?)',
  'err.crawlInProgress': 'ya hay un rastreo en marcha',
  'updater.title': 'Actualización lista',
  'updater.message': 'LoL Companion {version} está descargada.',
  'updater.detail':
    'Puedes reiniciar ahora para aplicarla o seguir; se instalará sola al cerrar la app.',
  'updater.restart': 'Reiniciar ahora',
  'updater.later': 'Luego',

  // --- Local-AI coach (Ollama prompts + errors) ---
  'coach.persona':
    'Eres {name}, la mascota coach de League of Legends de este jugador, con alma gamer: tono cercano y un punto friki/weeb (puedes soltar jerga como GG, diff, all-in, farmear, tiltear, "ez" — con gracia y sin pasarte, máximo una expresión por respuesta). El campeón que aparece en los datos ES EL JUGADOR con quien hablas: dirígete SIEMPRE a él/ella de tú ("tienes", "compra", "fuerza"), NUNCA en tercera persona ni llamándole por el nombre del campeón.',
  'coach.dataLabel': 'DATOS',
  'coach.report.frame':
    'Analiza SU partida usando EXCLUSIVAMENTE los datos del JSON siguiente.\nPROHIBIDO inventar cifras, objetos o eventos que no estén en los datos.',
  'coach.report.output':
    'Escribe en español, SIN markdown, máximo 5 frases:\n1-2 frases sobre lo mejor y lo peor comparado con sus medias personales,\n1 frase sobre si siguió las recomendaciones de compra,\ny cierra con UN consejo concreto y accionable para la próxima partida.',
  'coach.draft.frame':
    'El jugador está en la selección de campeones. Usa EXCLUSIVAMENTE los datos del JSON.\nPROHIBIDO mencionar campeones, objetos o cifras que no aparezcan en los datos.',
  'coach.draft.output':
    'Escribe en español, SIN markdown, máximo 4 frases:\nsi hay picks sugeridos, cuál encaja mejor con esta partida y por qué (apóyate en las razones);\ndespués la amenaza o plan de compra más importante según los avisos automáticos.',
  'coach.err.http': 'Ollama respondió HTTP {status}',
  'coach.err.invalid': 'Respuesta de Ollama no válida',
  'coach.err.empty': 'Ollama devolvió una respuesta vacía',
  'coach.err.unreachable': 'No se pudo hablar con Ollama: {message}',
  'coach.err.disabled': 'Coach desactivado (Ajustes)',
  'coach.role.jungle':
    'Eres JUNGLA: di explícitamente qué línea gankear o qué lado del mapa presionar según qué aliados van bien/mal.',
  'coach.role.bottom':
    'Eres ADC: di cómo jugar las peleas (con quién posicionarte, a quién NO acercarte) y cuándo agrupar.',
  'coach.role.utility': 'Eres SUPPORT: di dónde poner visión, a quién proteger y cuándo rotar.',
  'coach.role.middle': 'Eres MID: di cuándo rotar a los lados y qué línea ayudar.',
  'coach.role.top': 'Eres TOP: di si jugar split-push o agrupar, según el estado del mapa.',
  'coach.role.default': 'Adapta el plan al rol que sugieran los datos.',
  'coach.dir.frame':
    'Estáis EN PLENA PARTIDA. Da tu LECTURA ESTRATÉGICA de este momento con los DATOS (JSON): quién va ganando y por qué, y el plan del jugador para los próximos minutos.',
  'coach.dir.noInvent': 'PROHIBIDO inventar datos, campeones u objetos que no estén en el JSON.',
  'coach.dir.output': 'Responde en español, 2 a 4 frases, sin markdown, concreto y accionable.',
  'coach.live.frame':
    'Estáis EN PLENA PARTIDA. Con los DATOS (JSON) da UN único consejo de macro para ESTE momento.\nTipos de consejo según lo que digan los datos: poner visión antes de que salga un objetivo; jugar agresivo si hay ventaja de oro o enemigos muertos; jugar seguro si vais por detrás o hay spikes enemigos recientes; preparar/empujar la oleada antes de volver a base; completar la próxima compra.',
  'coach.live.output':
    'Responde en español, UNA sola frase de máximo 22 palabras, sin markdown ni comillas.',
  'coach.act.prioritize': 'puedes comprarlo YA',
  'coach.act.add': 'próxima compra',
  'coach.act.delay': 'ahorra para él',
  'coach.act.replace': 'vende y cámbialo',
  'coach.side.enemy': 'enemigo',
  'coach.side.ally': 'aliado',
  'coach.side.yourTeam': 'vuestro equipo',
  'coach.side.enemyTeam': 'el enemigo',
  'coach.ev.died': '{champion} ({side}) ha muerto',
  'coach.ev.spike': 'spike: {champion} (enemigo) ha completado {item}',
  'coach.ev.objective': '{objective} para {side}',

  // --- Mascot bubbles ---
  'mascot.idle.1': 'Zzz…',
  'mascot.idle.2': 'Abre el cliente cuando quieras',
  'mascot.idle.3': 'Modo reposo',
  'mascot.clientOpen.1': '¡Lista la cola!',
  'mascot.clientOpen.2': '¿Jugamos?',
  'mascot.clientOpen.3': 'Calentando…',
  'mascot.champSelect.1': '¡Buen pick!',
  'mascot.champSelect.2': 'Mira sus picks 👀',
  'mascot.champSelect.3': '¡A por todas!',
  'mascot.inGame.1': 'Concentración…',
  'mascot.inGame.2': 'Farmea tranquilo, yo vigilo',
  'mascot.inGame.3': 'Ojo al minimapa',
  'mascot.postGame.1': 'GG',
  'mascot.postGame.2': 'Analizando la partida…',
  'mascot.postGame.3': '¿Otra?',
  'mascot.alert': '¡Ojo! ⚠',

  // --- In-game overlay ---
  'overlay.dragMove': 'arrastra para mover',
  'overlay.hoverExpand': 'pasa el ratón para ampliar',
  'overlay.unpin': 'Dejar de fijar',
  'overlay.pin': 'Fijar panel abierto',
  'overlay.dragon': 'dragón',
  'overlay.baron': 'Barón',
  'overlay.live': 'VIVO',
  'overlay.waiting': 'Esperando recomendación…',
  'overlay.matchPanel': 'Panel de partida',

  // --- Live alerts (spike / objective window) ---
  'alert.baronFree': '¡Barón libre!',
  'alert.dragonFree': 'dragón libre',
  'alert.baronIn': 'Barón sale en {time}',
  'alert.dragonIn': 'dragón sale en {time}',
  'alert.junglerDied': '{champion} (jungla enemiga) ha muerto',
  'alert.enemiesDied': '{n} enemigos han muerto',
  'alert.objectiveWindow': '{who} — {objective}',
  'alert.spike': '{champion} completó {item} — power spike',
  'alert.levelSpike': '{champion} alcanzó nivel {level}',

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
