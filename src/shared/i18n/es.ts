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
  'shell.tagline': 'análisis local en directo',
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
    'El overlay mantiene la siguiente compra y los avisos visibles sin tapar la partida (LoL en ventana o sin bordes).',
  'live.overlayEnable': 'Actívalo en Ajustes',
  'live.waitingClient': 'Esperando al cliente de League…',
  'live.loadingGame': 'Cargando partida…',
  'live.notInGame': 'No hay partida en curso',
  'live.recommendation': 'Opción principal',
  'live.alternatives': 'Opciones contextuales',
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
  'live.levelShort': 'nv {n}',
  'live.patch': 'parche {patch}',
  'live.gamePlan': 'Plan de partida',
  'live.workspace': 'Espacio de decisiones',
  'live.matchContext': 'Contexto visible de partida',
  'live.telemetry': 'Telemetría de composición',
  'live.gameOverBanner': 'Fin de la partida',
  'live.compareHistory': 'Ver en historial — compara con tus otras partidas',
  'live.loadingTitle': 'Cargando partida',
  'live.loadingHint':
    'La pantalla de carga está en marcha; los datos llegan al aparecer en la Grieta.',
  'live.connectingTitle': 'Conectando con la partida',
  'live.connectingHint': 'Leyendo datos del juego (puerto 2999)…',
  'action.prioritize': 'DISPONIBLE',
  'action.add': 'añade',
  'action.delay': 'espera',
  'action.replace': 'reemplaza',
  'rec.action.prioritize': 'ASEQUIBLE',
  'rec.action.add': 'OPCIÓN DE RUTA',
  'rec.action.delay': 'UMBRAL DE TIENDA',
  'rec.action.replace': 'TRADE-OFF DE HUECO',
  'rec.hideHistory': 'ocultar historial',
  'rec.showHistory': 'historial ({n})',
  'rec.route': 'Ruta de build observada',
  'rec.currentGold': '{value} de oro',
  'rec.evidence': 'Por qué aparece esta opción',
  'rec.confidence': '{value}% de confianza',
  'rec.coreLock': '{count} picos de núcleo protegidos',
  'rec.stepOwned': '{item}, completado',
  'rec.stepCurrent': '{item}, paso actual de la ruta',
  'rec.stepLater': '{item}, paso posterior de la ruta',
  'rec.option': 'Opción {n}',
  'shell.productLine': 'Sistema de decisión',
  'theme.rift.label': 'Rift',
  'theme.rift.hint': 'Centro de mando nocturno · magenta de señal · Hexi',
  'theme.dark.label': 'Dark',
  'theme.dark.hint': 'Obsidiana · carmesí contenido · Sombra',
  'theme.sakura.label': 'Sakura',
  'theme.sakura.hint': 'Washi cálido · ciruela y rosa apagado · Kohaku',
  'shell.localData': 'LOCAL · DATOS VISIBLES EN PANTALLA',
  'shell.primaryNav': 'Navegación principal',

  // --- Home dashboard (idle / client open) ---
  'home.tip.1': 'El dragón aparece en el minuto 5: pide visión del río antes.',
  'home.tip.2': 'Con 2500 de oro sin gastar estás jugando con desventaja — planea la base.',
  'home.tip.3':
    'Heridas graves reducen la curación enemiga un 40%: revisa el timing antes de que sea urgente.',
  'home.tip.4':
    'Tu racha de derrotas pesa: después de 2 seguidas, un descanso rinde más que otra cola.',
  'home.tip.5': 'Los picos de nivel 6/11/16 enemigos aparecen en el feed: respétalos.',
  'home.tip.6': 'Farmear 8 CS/min vale más que perseguir kills que no llegan.',
  'home.tip.7':
    'Mira tu Historial: los datos de tus propias partidas mandan más que cualquier guía.',
  'home.firstRun.greeting': 'Configura tu espacio de decisiones',
  'home.firstRun.body':
    'Añade tu Riot ID y sincroniza el historial para adaptar builds, picks e informes a tus partidas.',
  'home.firstRun.cta': 'Empezar en Ajustes',
  'home.ready.title': 'Cliente conectado',
  'home.idle.title': 'Todo listo cuando vuelvas',
  'home.ready.body':
    'Cliente detectado. Entra en cola: la selección de campeones y la partida se activan solas.',
  'home.idle.body':
    'Abre el cliente de League of Legends y la conexión se activará automáticamente.',
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
  'report.coachTitle': 'Análisis complementario (IA local)',
  'report.coachThinking': 'Analizando la partida con el modelo local…',
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
  'report.sum.dmgHigh': 'Has cargado con el daño del equipo: {pct}% frente a tu media de {avg}%',
  'report.sum.buildConsistent':
    'Build consistente: has seguido {followed} de {total} recomendaciones del motor',
  'report.sum.buildFew':
    'Solo has seguido {followed} de {total} recomendaciones del motor — compara tu build final con las sugerencias de abajo',
  'report.sum.metaHigh':
    'Tu build final coincide en {overlap} de {total} objetos con lo más comprado en Master+ con {champion}',
  'report.sum.metaLow':
    'Tu build final solo coincide en {overlap} de {total} objetos con lo más comprado en Master+ — compara tu itemización',

  // --- Champ select panel ---
  'csp.coachTitle': '{mascot} · lectura del draft',
  'csp.recalculating': 'recalculando…',
  'csp.thinking': 'Pensando…',
  'csp.waitingDraft': 'Esperando cambios en el draft…',
  'csp.championFallback': 'campeón {id}',
  'csp.unpicked': 'sin elegir',
  'csp.buyPlan': 'Ajustes de build para esta composición',
  'csp.yourPlan': 'Tu plan con {champion} (de tus propias partidas)',
  'csp.situational': 'situacionales:',
  'csp.inProgress': 'Selección de campeones en curso',
  'csp.waitingData': 'Esperando datos de la selección…',
  'csp.title': 'Selección de campeones',
  'csp.yourPosition': 'tu posición: {pos}',
  'csp.noPicks': 'Sin picks visibles todavía',
  'csp.bans': 'Baneos',
  'csp.whatPick': 'Opciones de pick · tus partidas + Master+ + encaje',
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
  'set.overlayLayout': 'Tamaño y posición del overlay',
  'set.overlayScale': 'Escala',
  'set.overlayMoveHint': 'Arrastra el control ··· durante la partida. La posición se recuerda.',
  'set.overlayReset': 'Restablecer posición',
  'set.overlayPositionReset': 'Posición del overlay restablecida',
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
  'set.meta.crawling':
    'Rastreando… {stored} nuevas esta sesión · semillas {done}/{total} · {rate}/h',
  'set.meta.stop': 'Detener rastreo',
  'set.meta.start': 'Iniciar rastreo Master+',
  'set.meta.startError': 'no se pudo iniciar',
  'set.meta.base': 'Base compartida: parche {patch} · actualizada hace {days} d',
  'set.meta.baseToday': 'Base compartida: parche {patch} · actualizada hoy',
  'set.meta.noBase': 'Sin base compartida — solo crawler local',
  'set.meta.currentPatch': 'parche actual {patch}: {n} partidas',
  'set.coach.title': 'Coach IA local (experimental)',
  'set.coach.desc':
    'Usa un modelo de IA gratuito ejecutándose EN TU PC (via Ollama) para comentar tus informes de partida en lenguaje natural. Nada sale de tu equipo. El motor de recomendaciones no depende de esto.',
  'set.coach.detected': 'Ollama detectado ({n} modelos)',
  'set.coach.notDetected': 'Ollama no detectado. Instálalo gratis desde',
  'set.coach.andRun': 'y ejecuta',
  'set.coach.recheck': 'Volver a consultar Ollama (tras instalar o borrar modelos)',
  'set.coach.enable': 'Activar análisis local (informe de partida y champ select)',
  'set.coach.live':
    'Lecturas EN PARTIDA (~1 por minuto): el modelo resume opciones de macro en el overlay — visión, objetivos y nivel de riesgo',
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
  'updater.message': 'WinCon {version} está descargada.',
  'updater.detail':
    'Puedes reiniciar ahora para aplicarla o seguir; se instalará sola al cerrar la app.',
  'updater.restart': 'Reiniciar ahora',
  'updater.later': 'Luego',

  // --- Local-AI coach (Ollama prompts + errors) ---
  'coach.persona':
    'Actúas como {name}, la voz de análisis de una herramienta para jugadores adultos. Usa español actual, cercano, conciso y seguro, con carisma sobrio. El campeón de los datos ES EL JUGADOR. No te presentes, no digas que eres una mascota o un coach, no uses emojis, muletillas, role-play ni tono infantil. Explica trade-offs y opciones condicionales; nunca presentes una acción como obligatoria.',
  'coach.dataLabel': 'DATOS',
  'coach.report.frame':
    'Analiza SU partida usando EXCLUSIVAMENTE los datos del JSON siguiente.\nPROHIBIDO inventar cifras, objetos o eventos que no estén en los datos.',
  'coach.report.output':
    'Escribe en español, SIN markdown, máximo 5 frases:\n1-2 frases sobre lo mejor y lo peor comparado con sus medias personales,\n1 frase sobre si siguió las recomendaciones de compra,\ny cierra con UN consejo concreto y accionable para la próxima partida.',
  'coach.draft.frame':
    'El jugador está en la selección de campeones. Usa EXCLUSIVAMENTE los datos del JSON.\nPROHIBIDO mencionar campeones, objetos o cifras que no aparezcan en los datos.',
  'coach.draft.output':
    'Escribe en español natural, SIN markdown, máximo 4 frases: compara hasta dos picks sugeridos y por qué encaja cada uno; después resume el ajuste de build más importante. Sin presentaciones, emojis, coletillas ni frases de relleno.',
  'coach.err.http': 'Ollama respondió HTTP {status}',
  'coach.err.invalid': 'Respuesta de Ollama no válida',
  'coach.err.empty': 'Ollama devolvió una respuesta vacía',
  'coach.err.unreachable': 'No se pudo hablar con Ollama: {message}',
  'coach.err.disabled': 'Coach desactivado (Ajustes)',
  'coach.role.jungle':
    'Para JUNGLA: compara las opciones visibles de lado del mapa según qué aliados van bien o mal; mantén la elección condicional y no inventes posiciones.',
  'coach.role.bottom':
    'Para ADC: compara jugar front-to-back o ceder espacio según las amenazas y quién va por delante; no inventes posiciones exactas.',
  'coach.role.utility':
    'Para SUPPORT: destaca trade-offs de visión, protección y rotación sin inventar posiciones exactas ni cargas de wards.',
  'coach.role.middle':
    'Para MID: compara agruparse o jugar por un lateral según la ventaja visible; no inventes el estado de las oleadas.',
  'coach.role.top':
    'Para TOP: compara split-push o agrupación según la ventaja visible; no inventes presión de líneas.',
  'coach.role.default': 'Adapta el plan al rol que sugieran los datos.',
  'coach.dir.frame':
    'La partida está EN CURSO. Resume el estado estratégico visible y compara dos opciones razonables para los próximos minutos usando solo los DATOS (JSON).',
  'coach.dir.noInvent': 'PROHIBIDO inventar datos, campeones u objetos que no estén en el JSON.',
  'coach.dir.output':
    'Responde en español actual, 2 a 4 frases, sin markdown, conciso y condicional. No te presentes ni uses emojis o coletillas.',
  'coach.live.frame':
    'Estáis EN PLENA PARTIDA. Solo con los DATOS (JSON), destaca UNA decisión y dos opciones condicionales breves. No inventes oleadas, posiciones, cooldowns ni cargas de wards.',
  'coach.live.output':
    'Responde en español natural, UNA sola frase de máximo 26 palabras, sin markdown, comillas ni emojis; usa «si» o «considera» y evita presentarte o rellenar.',
  'coach.act.prioritize': 'la compra está disponible',
  'coach.act.add': 'opción de ruta',
  'coach.act.delay': 'umbral de tienda',
  'coach.act.replace': 'trade-off de hueco',
  'coach.side.enemy': 'enemigo',
  'coach.side.ally': 'aliado',
  'coach.side.yourTeam': 'vuestro equipo',
  'coach.side.enemyTeam': 'el enemigo',
  'coach.ev.died': '{champion} ({side}) ha muerto',
  'coach.ev.spike': 'pico de poder: {champion} (enemigo) ha completado {item}',
  'coach.ev.objective': '{objective} para {side}',

  // --- Mascot bubbles ---
  'mascot.idle.1': 'Sin cliente conectado',
  'mascot.idle.2': 'Listo cuando vuelvas',
  'mascot.idle.3': 'Datos locales en espera',
  'mascot.clientOpen.1': 'Cliente conectado',
  'mascot.clientOpen.2': 'Esperando cola',
  'mascot.clientOpen.3': 'Todo preparado',
  'mascot.champSelect.1': 'Revisando el draft',
  'mascot.champSelect.2': 'Opciones actualizadas',
  'mascot.champSelect.3': 'La composición está cambiando',
  'mascot.inGame.1': 'Lectura en directo',
  'mascot.inGame.2': 'El plan sigue actualizado',
  'mascot.inGame.3': 'Revisando cambios visibles',
  'mascot.postGame.1': 'Partida cerrada',
  'mascot.postGame.2': 'Preparando el informe',
  'mascot.postGame.3': 'Datos guardados',
  'mascot.alert': 'Cambio importante',

  // --- In-game overlay ---
  'overlay.dragMove': 'arrastra para mover',
  'overlay.hoverExpand': 'pasa para ampliar',
  'overlay.unpin': 'Dejar de fijar',
  'overlay.pin': 'Fijar panel abierto',
  'overlay.pinShort': 'FIJAR',
  'overlay.dragon': 'dragón',
  'overlay.baron': 'Barón',
  'overlay.live': 'VIVO',
  'overlay.waiting': 'Esperando recomendación…',
  'overlay.matchPanel': 'Panel de partida',
  'overlay.itemReference': 'PRÓXIMA COMPRA',

  // --- Live alerts (spike / objective window) ---
  'alert.baronFree': 'ventana para valorar Barón',
  'alert.dragonFree': 'ventana para valorar dragón',
  'alert.baronIn': 'Barón sale en {time}',
  'alert.dragonIn': 'dragón sale en {time}',
  'alert.junglerDied': '{champion} (jungla enemiga) ha muerto',
  'alert.enemiesDied': '{n} enemigos han muerto',
  'alert.objectiveWindow': '{who} · {objective}',
  'alert.spike': '{champion} ha completado {item}: nuevo pico de poder',
  'alert.levelSpike': '{champion} ha alcanzado el nivel {level}',
  'alert.purchaseFallback': 'Ha cambiado tu siguiente objetivo de compra.',
  'alert.duel':
    'Tienes {advantages} sobre {champion}; si el duelo está realmente aislado, la pelea te favorece.',
  'alert.duel.join': '{first} y {second}',
  'alert.duel.levels': '{n} niveles',
  'alert.duel.completedOne': 'un objeto completado',
  'alert.duel.completedMany': '{n} objetos completados',
  'alert.duel.itemValue': 'unos {value} de valor visible en objetos',
  'alert.duel.health': 'un {pct}% más de vida actual',
  'alert.duel.cs': '{n} súbditos más',
  'alert.duel.kda': 'mejor KDA visible',

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
  'engine.antiheal.buy': '{item} cuesta {cost} de oro y llevas {gold}: cómpralo en la próxima base',
  'engine.antiheal.short': '{item} cuesta {cost} de oro, te faltan {missing}',
  'engine.antiheal.allyHas':
    'Un aliado ya lleva antiheal; menos urgente pero cubre tus propios objetivos',

  // --- Engine: armor vs MR ---
  'engine.armorMr.dealerItems': '{champion} con {count} objetos de daño',
  'engine.armorMr.physical': 'El {pct} del daño enemigo estimado es físico ({dealers})',
  'engine.armorMr.magic': 'El {pct} del daño enemigo estimado es mágico ({dealers})',
  'engine.armorMr.prioArmor': 'Opciones de armadura compatibles con tu campeón: {items}',
  'engine.armorMr.prioMr': 'Opciones de resistencia mágica compatibles con tu campeón: {items}',
  'engine.armorMr.preFirst':
    'Tu primer objeto sigue siendo la prioridad; revisa esta defensa después del núcleo',

  // --- Engine: anti-tank ---
  'engine.antitank.teamEhp':
    'HP efectiva media enemiga {ehp} (esperada a este minuto: ~{baseline})',
  'engine.antitank.boss':
    '{champion} acumula {ehp} de HP efectiva (nivel {level} + {items} objetos)',
  'engine.antitank.penPhysical': 'Penetración/daño % con {items}',
  'engine.antitank.penMagic': 'Penetración mágica con {items}',

  // --- Engine: anti-burst ---
  'engine.antiburst.threat': '{kda} va por delante (+{diff}) y supone una amenaza de burst {type}',
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
    'Si puedes mantenerte en mapa, completar el objeto rinde más que repartir el oro en piezas menores',
  'engine.spike.target':
    '{item} está a {cost} de oro de completarse; tenlo como objetivo de la próxima base',

  // --- Engine: next-buy + endgame ---
  'engine.nextbuy.labelPool': '{ordinal} objeto de tu build de {champion}',
  'engine.nextbuy.labelMeta': '{ordinal} objeto más comprado en Master+ con {champion} este parche',
  'engine.nextbuy.bootsPaused': 'Botas en pausa: Calzado Mágico (runa) te las dará gratis',
  'engine.nextbuy.isLabel': '{item} es el {label}',
  'engine.nextbuy.canFinishNow':
    'La finalización está disponible: cuesta {cost} de oro y llevas {gold}',
  'engine.nextbuy.component': '{component} ({cost} de oro) avanza el {label}: {target}',
  'engine.nextbuy.componentGold': 'A {target} le faltan {missing} de oro en total; llevas {gold}',
  'engine.nextbuy.saveFor': 'Guarda oro para {target} ({label}): te faltan {missing}',
  'engine.nextbuy.noPiece':
    'Ninguna pieza suelta merece la pena ahora mismo (llevas {gold} de oro)',
  'engine.starter.route':
    '{item} es el inicial observado para esta ruta ({games} partidas de ruta)',
  'engine.starter.affordable': 'Disponible por {cost} de oro; ahora tienes {gold}',
  'engine.starter.short': 'Te faltan {missing} de oro para {item}',
  'engine.route.observed': 'Ruta observada: {games} partidas Master+ · {confidence}% de confianza',
  'engine.route.personal': 'Tu historial en este rol inclina la opción hacia esta ruta',
  'engine.route.damage': 'Esta ruta observada equilibra mejor el daño de tu equipo',
  'engine.route.inferred': 'Inferida por orden de compra; aún no hay datos completos de rutas',
  'engine.route.coreProtected': 'Quedan {remaining} picos de núcleo antes de una desviación normal',
  'engine.endgame.situPool': '{item} es tu situacional',
  'engine.endgame.situMeta': '{item} es compra habitual en Master+ con {champion}',
  'engine.endgame.coreDone':
    'Tu build principal de {champion} está completa y te queda hueco: {situational}',
  'engine.endgame.buyNow': 'Esta opción es asequible: cuesta {cost} de oro y llevas {gold}',
  'engine.endgame.shortGold': 'Te faltan {missing} de oro (cuesta {cost} y llevas {gold})',
  'engine.endgame.sellStarter':
    'Inventario lleno pero sigues llevando {starter}: véndelo para liberar hueco',
  'engine.endgame.thenBuy': 'Con el hueco libre, compra {item} ({cost} de oro; llevas {gold})',

  // --- Engine: meta-items + exclusivity + recommend ---
  'engine.meta.pickReason':
    '{item} es lo que compran los Master+ con {champion} en este caso ({games} partidas, {wr}% WR)',
  'engine.meta.suggestion':
    'Pocos Master+ con {champion} lo compran: sugerencia situacional, no prioridad',
  'engine.exclusivity.over': 'Antes que {other}: no se pueden llevar a la vez (comparten {group})',
  'engine.recommend.situPool': '{item} está en tus situacionales de {champion}',
  'engine.recommend.metaWr':
    'en Master+ con {champion}: {wr}% WR llevando este objeto ({games} partidas)',
  'engine.personal.winrate':
    'tus datos: ganas más con {item} ({wr}% en {games} partidas), así que sube',
  'engine.personal.order':
    'tus datos: abres con {item} y ganas {wr}% ({games} partidas), así que va primero',

  // --- Stats: weakness insights (WP-016) ---
  'weakness.deaths.early.finding': 'Mueres {avg} veces por partida antes del minuto 14',
  'weakness.deaths.early.advice':
    'Tus muertes tempranas están cediendo experiencia y control de línea; deja más margen cuando falte información del jungla',
  'weakness.deaths.mid.finding': 'Mueres {avg} veces por partida entre el minuto 14 y el 25',
  'weakness.deaths.mid.advice':
    'Las muertes aisladas de mid game suelen abrir objetivos; acompaña las entradas al río y evita cruzar sin información',
  'weakness.deaths.late.finding': 'Mueres {avg} veces por partida pasado el minuto 25',
  'weakness.deaths.late.advice':
    'En late game, una muerte aislada abre objetivos y alarga mucho el tiempo fuera; prioriza rutas seguras y presencia de equipo',
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
  'cs.pick.antiTankStrong':
    '{n} tanques enfrente: tu daño por vida máxima encaja bien contra su primera línea',
  'cs.pick.antiTankWeak':
    '{n} tanques enfrente y a este pick le cuesta atravesar la primera línea — necesitarás una opción antitanque',
  'cs.pick.inPool': 'está en tu pool: build baseline lista',
  'cs.tip.heavyAP': 'Comp enemiga muy AP ({n} de {total})',
  'cs.tip.heavyAD': 'Comp enemiga muy AD ({n} de {total})',
  'cs.tip.carryMr':
    '{heavy}: conviene reservar una opción de resistencia mágica tras el núcleo — {items} encajan en tu ruta ({cheap} es el componente temprano)',
  'cs.tip.planMr':
    '{heavy}: valora resistencia mágica tras el núcleo; {cheap} permite cubrirla por piezas',
  'cs.tip.carryArmor':
    '{heavy}: conviene reservar una opción de armadura tras el núcleo — {items} encaja en tu ruta ({cheap} es el componente temprano)',
  'cs.tip.planArmor':
    '{heavy}: valora armadura tras el núcleo; {cheap} permite cubrirla por piezas',
  'cs.tip.mixed': 'Daño enemigo mixto: la vida rinde más que apilar una sola resistencia',
  'cs.tip.healers': 'Curación enemiga a la vista ({names}): reserva hueco para heridas graves',
  'cs.tip.teamAllAd':
    'Tu equipo es casi todo AD: al rival le renta apilar armadura — el daño mágico que aportes vale doble',
  'cs.tip.teamAllAp':
    'Tu equipo es casi todo AP: al rival le renta apilar RM — el daño físico que aportes vale doble'
}
