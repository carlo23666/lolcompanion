/**
 * English message catalog — the SOURCE OF TRUTH for i18n keys (ADR-009).
 * Adding a key here makes it required in es.ts (TypeScript enforces it).
 * Interpolation: `{name}` tokens are replaced from the params object.
 * Keys grow per WP-017 slice; keep them grouped and dotted by area.
 */
export const en = {
  // --- Settings / language ---
  'settings.language': 'Language',
  'settings.language.hint': 'Applies instantly across the app.',

  // --- App shell / navigation ---
  'nav.live': 'Live',
  'nav.history': 'History',
  'nav.settings': 'Settings',
  'shell.tagline': 'your local coach',
  'phase.idle': 'Client closed',
  'phase.clientOpen': 'Client open',
  'phase.champSelect': 'Champion select',
  'phase.inGame': 'In game',
  'phase.postGame': 'Game over',

  // --- Live view (in-game) ---
  'live.curveTitle': 'Your {champion} average ({games} games): {cs10} CS @10, {cs15} CS @15',
  'live.csVsAvg': 'CS {cs} · your avg {avg}',
  'live.goldTitle': 'Estimated team gold (model documented in normalize.ts)',
  'live.gold': 'gold',
  'live.onMap': 'on the map',
  'live.dragonIn': 'in {time}',
  'live.baronIn': 'Baron in {time}',
  'live.baronOnMap': 'Baron on the map',
  'live.deadGold': '{gold} unspent gold — plan a back',
  'live.overlayHint': 'Your mascot can join you in-game with an overlay (LoL in windowed or borderless).',
  'live.overlayEnable': 'Enable it in Settings',
  'live.waitingClient': 'Waiting for the League client…',
  'live.loadingGame': 'Loading game…',
  'live.notInGame': 'No game in progress',
  'live.recommendation': 'Recommendation',
  'live.alternatives': 'Alternatives',
  'live.score': 'score {score}',
  'live.history': 'history',
  'live.yourTeam': 'Your team',
  'live.enemies': 'Enemies',
  'live.allies': 'Allies',
  'live.enemyAnalysis': 'Enemy team analysis',
  'live.physicalDmg': 'Physical dmg {pct}',
  'live.magicDmg': 'Magic {pct}',
  'live.tankiness': 'Tankiness',
  'live.healShield': 'Healing/shields:',
  'live.considerAntiheal': 'consider antiheal',
  'live.enemyDmgSplit': 'Enemy damage split',
  'live.ehpAbbrev': 'eff. HP',
  'live.stat.time': 'Time',
  'live.stat.gold': 'Gold',
  'live.stat.kda': 'KDA',
  'live.stat.cs': 'CS',
  'live.levelAbbr': 'level {n}',
  'live.patch': 'patch {patch}',
  'live.gamePlan': 'Game plan',
  'live.gameOverBanner': 'Game over',
  'live.compareHistory': 'View in history — compare with your other games',
  'live.loadingTitle': 'Loading game',
  'live.loadingHint': "The loading screen is up; data arrives once you're on the Rift.",
  'live.connectingTitle': 'Connecting to the game',
  'live.connectingHint': 'Reading game data (port 2999)…',
  'action.prioritize': 'BUY NOW',
  'action.add': 'add',
  'action.delay': 'wait',
  'action.replace': 'replace',
  'rec.action.prioritize': 'BUY NOW',
  'rec.action.add': 'NEXT BUY',
  'rec.action.delay': 'WAIT',
  'rec.action.replace': 'SELL & SWAP',
  'rec.hideHistory': 'hide history',
  'rec.showHistory': 'history ({n})',

  // --- Home dashboard (idle / client open) ---
  'home.tip.1': 'Dragon spawns at minute 5: ask for river vision beforehand.',
  'home.tip.2': "With 2500 unspent gold you're playing at a disadvantage — plan your back.",
  'home.tip.3': 'Grievous Wounds cuts enemy healing by 40%: don’t buy it late.',
  'home.tip.4': 'A losing streak weighs on you: after 2 in a row, a break beats another queue.',
  'home.tip.5': 'Enemy level 6/11/16 spikes show up in the feed: respect them.',
  'home.tip.6': "Farming 8 CS/min is worth more than chasing kills that don't come.",
  'home.tip.7': 'Check your History: your own games matter more than any guide.',
  'home.firstRun.greeting': "Hi! I'm {mascot}, your Rift coach",
  'home.firstRun.body':
    'Set your Riot ID and sync your history: from there I analyze your champions, your builds and your live games.',
  'home.firstRun.cta': 'Get started in Settings',
  'home.ready.title': 'Ready to queue!',
  'home.idle.title': 'Resting the crystal…',
  'home.ready.body':
    'Client detected. Hop in queue: champ select and the game start on their own.',
  'home.idle.body': 'Open the League of Legends client; I detect it automatically.',
  'home.metric.games': 'Games',
  'home.metric.streak': 'Streak',
  'home.metric.wr': 'WR {champion}',
  'home.champCard': '{games} games · KDA {kda} · {cs} CS/min',
  'home.lastGame': 'Last game',
  'home.win': 'Win',
  'home.loss': 'Loss',
  'home.withChampion': 'with {champion}',
  'home.noGame': 'No linked game yet — play one and the report shows up here.',

  // --- History view ---
  'hist.tab.games': 'Games',
  'hist.tab.stats': 'Stats',
  'hist.summary.games': 'Games',
  'hist.summary.winrate': 'Winrate',
  'hist.summary.kda': 'KDA',
  'hist.summary.cs': 'CS/min',
  'hist.summary.streak': 'Streak',
  'hist.summary.form': 'Form',
  'hist.summary.formTitle': 'Last 10 (left = most recent)',
  'hist.win': 'Win',
  'hist.loss': 'Loss',
  'hist.winLower': 'win',
  'hist.lossLower': 'loss',
  'hist.goldCurveLabel': 'Gold per minute curve',
  'hist.finalBuild': 'Final build',
  'hist.detailGold': '{gold}k gold',
  'hist.perMin': '({value}/min)',
  'hist.damageVision': '{dmg}k dmg · vision {vision}',
  'hist.laneOpponent': 'Lane opponent',
  'hist.viewReport': 'View report',
  'hist.metaBuild': 'Master+ build ({champion} · patch {patch} · {games} games) — matches on',
  'hist.masterPctTitle': '{pct}% of Master+ builds',
  'hist.alsoYours': ' · also in yours',
  'hist.goldPerMin': 'Gold per minute',
  'hist.noReport': 'No report available for this game.',
  'hist.filter.champion': 'Filter by champion',
  'hist.allChampions': 'All champions',
  'hist.filter.result': 'Filter by result',
  'hist.result.all': 'All',
  'hist.result.wins': 'Wins',
  'hist.result.losses': 'Losses',
  'hist.filter.role': 'Filter by role',
  'hist.allRoles': 'All roles',
  'hist.filter.queue': 'Filter by queue',
  'hist.allQueues': 'All queues',
  'hist.filter.patch': 'Filter by patch',
  'hist.allPatches': 'All patches',
  'hist.patchLabel': 'patch {patch}',
  'hist.queuePrefix': 'queue {id}',
  'hist.sort': 'Sort',
  'hist.sortAria': 'Sort games',
  'hist.sort.date': 'Date',
  'hist.sort.kda': 'KDA',
  'hist.sort.cs': 'CS/min',
  'hist.sort.duration': 'Duration',
  'hist.filterBy': 'Filter by {champion}',
  'hist.aggGames': '{n}g',
  'hist.empty.none': 'No saved games',
  'hist.empty.noMatch': 'No game matches the filter',
  'hist.empty.noneHint':
    "Sync your history in Settings or finish a game: it'll appear here on its own.",
  'hist.empty.noMatchHint': 'Relax a filter to see games again.',
  'hist.itemAlt': 'item {id}',

  // --- Stats view ---
  'stats.calculating': 'Calculating stats…',
  'stats.noData': 'No data yet — sync your history in Settings.',
  'stats.streaks': 'Streaks & sessions',
  'stats.currentStreak': 'current streak',
  'stats.bestStreak': 'Best streak:',
  'stats.wins': '{n} wins',
  'stats.worstStreak': 'Worst streak:',
  'stats.losses': '{n} losses',
  'stats.gamesAnalyzed': '{n} games analyzed',
  'stats.session12': 'Games 1-2 of session:',
  'stats.session3': 'Game 3 onward:',
  'stats.tilt': 'Your winrate drops {n} points from game 3 on — consider shorter sessions',
  'stats.weakTitle': 'Detected weak points',
  'stats.weakSample': '({n}g)',
  'stats.byChampion': 'By champion',
  'stats.th.champion': 'Champion',
  'stats.th.games': 'G',
  'stats.th.wr': 'WR',
  'stats.th.kda': 'KDA',
  'stats.th.csmin': 'CS/min',
  'stats.th.goldmin': 'Gold/min',
  'stats.th.dmgPct': '% dmg',
  'stats.th.visionMin': 'Vision/min',
  'stats.matchupTitle': '{role} · {games} games',
  'stats.curves': 'Your farming curve (personal averages)',
  'stats.th.gold10': 'Gold @10',
  'stats.th.gold15': 'Gold @15',
  'stats.durationTitle': 'Winrate by game length',
  'stats.firstDragon': 'First dragon',
  'stats.dragonTaken': 'your team takes it ({n})',
  'stats.dragonLost': 'loses it ({n})',
  'stats.worstMatchups': 'Worst matchups (same lane)',
  'stats.bestMatchups': 'Best matchups (same lane)',
  'stats.byWeekday': 'Winrate by day of week',
  'stats.wd.0': 'Sun',
  'stats.wd.1': 'Mon',
  'stats.wd.2': 'Tue',
  'stats.wd.3': 'Wed',
  'stats.wd.4': 'Thu',
  'stats.wd.5': 'Fri',
  'stats.wd.6': 'Sat',

  // --- Post-game report ---
  'report.coachTitle': "{mascot}'s analysis (local AI)",
  'report.coachThinking': '{mascot} is thinking… (local model, give it a few seconds)',
  'report.coachPreparing': 'Preparing analysis…',
  'report.unknownError': 'unknown error',
  'report.avg': 'avg {value}',
  'report.practiceTool': 'Practice Tool',
  'report.thisMode': 'this mode',
  'report.waiting': 'The report shows up as soon as Riot publishes the game (1-3 min)…',
  'report.unsupportedMode':
    "{mode} games don't appear in Riot's match history, so there's no report for this game.",
  'report.stat.deaths': 'Deaths',
  'report.stat.vision': 'Vision',
  'report.engineRecs': 'Engine recommendations ({followed}/{total} followed)',
  'report.sum.deathsHigh':
    'You died {deaths} times, above your {avg} average with {champion} — review which deaths were avoidable',
  'report.sum.deathsLow': 'Only {deaths} deaths (your avg: {avg}) — good risk control',
  'report.sum.visionLow':
    'Low vision: {score} points vs your {avg} average — buy a few more control wards and use your trinket leaving base',
  'report.sum.visionGood': 'Good vision: {score} points vs your {avg} average',
  'report.sum.csLow':
    'Weak farming: {cs} CS/min vs your {avg} average — prioritize waves between plays',
  'report.sum.dmgHigh': "You carried the team's damage: {pct}% vs your {avg}% average",
  'report.sum.buildConsistent':
    'Consistent build: you followed {followed} of {total} engine recommendations',
  'report.sum.buildFew':
    'You only followed {followed} of {total} engine recommendations — compare your final build with the suggestions below',
  'report.sum.metaHigh':
    'Your final build matches {overlap} of {total} items with the most-bought Master+ build for {champion}',
  'report.sum.metaLow':
    'Your final build only matches {overlap} of {total} items with the most-bought Master+ build — compare your itemization',

  // --- Champ select panel ---
  'csp.coachTitle': '{mascot} analyzes the draft',
  'csp.recalculating': 'recalculating…',
  'csp.thinking': 'Thinking…',
  'csp.waitingDraft': 'Waiting for draft changes…',
  'csp.championFallback': 'champion {id}',
  'csp.unpicked': 'unpicked',
  'csp.buyPlan': 'Buy plan against this comp',
  'csp.yourPlan': 'Your plan with {champion} (from your own games)',
  'csp.situational': 'situational:',
  'csp.inProgress': 'Champion select in progress',
  'csp.waitingData': 'Waiting for select data…',
  'csp.title': 'Champion select',
  'csp.yourPosition': 'your position: {pos}',
  'csp.noPicks': 'No visible picks yet',
  'csp.bans': 'Bans',
  'csp.whatPick': 'What should I pick? · your games + Master+ + kit',
  'csp.inGames': 'in {games} games',
  'csp.footer': 'Advice derived only from champions visible on screen.',

  // --- Settings view ---
  'set.account': 'Account',
  'set.riotId': 'Riot ID (name#TAG)',
  'set.riotIdPlaceholder': 'Example#EUW',
  'set.apiKey': 'Riot API key',
  'set.saved': 'saved',
  'set.apiKeyPlaceholderSet': '(unchanged — type to replace it)',
  'set.apiKeyHint':
    'Generate one free at developer.riotgames.com (dev keys expire every 24 h). Stored encrypted on this machine and never leaves it.',
  'set.region': 'Region',
  'set.recordLive': 'Record live games as fixtures (dev only)',
  'set.sounds': 'Sounds',
  'set.soundsEnable': 'Enable sounds',
  'set.volume': 'Volume',
  'set.sound.recommendation': 'New recommendation (chime)',
  'set.sound.spike': 'Enemy power spike (double alert)',
  'set.sound.objective': 'Objective window (horn)',
  'set.soundTest': 'Test',
  'set.overlay':
    'In-game overlay with the mascot (experimental — needs LoL windowed or borderless; activates in game)',
  'set.theme': 'Theme',
  'set.applyHint': 'Applies instantly; press Save to keep it.',
  'set.save': 'Save',
  'set.saveHistory': 'Sync history',
  'set.settingsSaved': 'Settings saved',
  'set.savedShort': 'Saved',
  'set.syncError': "Couldn't start the sync",
  'set.meta.title': 'Meta data (Master+)',
  'set.meta.desc':
    'Crawls ranked Master, Grandmaster and Challenger games with your API key and stores only aggregates (winrates, matchups, builds). Feeds pick suggestions and the report. Leave it running in the background: ~2000 games/hour.',
  'set.meta.aggregated': '{n} games aggregated',
  'set.meta.patchEntry': 'patch {patch}: {n}',
  'set.meta.crawling': 'Crawling… {stored} new this session · seeds {done}/{total}',
  'set.meta.stop': 'Stop crawl',
  'set.meta.start': 'Start Master+ crawl',
  'set.meta.startError': "couldn't start",
  'set.coach.title': 'Local AI coach (experimental)',
  'set.coach.desc':
    "Uses a free AI model running ON YOUR PC (via Ollama) to comment your post-game reports in natural language. Nothing leaves your machine. The recommendation engine doesn't depend on this.",
  'set.coach.detected': 'Ollama detected ({n} models)',
  'set.coach.notDetected': 'Ollama not detected. Install it free from',
  'set.coach.andRun': 'and run',
  'set.coach.recheck': 'Re-check Ollama (after installing or deleting models)',
  'set.coach.enable': 'Enable mascot analysis (post-game report and champ select)',
  'set.coach.live':
    'IN-GAME tips (~1 per minute): the mascot suggests macro in the overlay — vision before objectives, when to force, when to play safe',
  'set.coach.model': 'Model',
  'set.coach.notInstalled': '{model} (not installed — another will be used)',
  'set.sync.title': 'Sync',
  'set.sync.error': 'Error: {error}',
  'set.sync.done': 'Done: {stored} new games ({skipped} already saved)',
  'set.sync.downloading': 'Downloading… {stored} saved, {skipped} skipped',

  // --- Errors + updater (main process) ---
  'err.missingKey': 'Riot API key missing (Settings → Account)',
  'err.syncInProgress': 'Sync already in progress',
  'err.missingRiotId': 'Set your Riot ID (name#TAG) first',
  'err.accountNotFound': 'Account not found: {message}',
  'err.staticUnavailable': 'Static data unavailable (offline and no cache)',
  'err.apiKeyRejected': 'API key rejected (403): renew it in Settings/.env',
  'err.noSeeds': 'No seed players (API key expired?)',
  'err.crawlInProgress': 'a crawl is already running',
  'updater.title': 'Update ready',
  'updater.message': 'LoL Companion {version} is downloaded.',
  'updater.detail':
    'You can restart now to apply it, or keep going; it installs on its own when you close the app.',
  'updater.restart': 'Restart now',
  'updater.later': 'Later',

  // --- Mascot bubbles ---
  'mascot.idle.1': 'Zzz…',
  'mascot.idle.2': 'Open the client whenever',
  'mascot.idle.3': 'Rest mode',
  'mascot.clientOpen.1': 'Queue is ready!',
  'mascot.clientOpen.2': 'Shall we play?',
  'mascot.clientOpen.3': 'Warming up…',
  'mascot.champSelect.1': 'Nice pick!',
  'mascot.champSelect.2': 'Check their picks 👀',
  'mascot.champSelect.3': 'Go get them!',
  'mascot.inGame.1': 'Focus…',
  'mascot.inGame.2': "Farm easy, I've got the map",
  'mascot.inGame.3': 'Watch the minimap',
  'mascot.postGame.1': 'GG',
  'mascot.postGame.2': 'Analyzing the game…',
  'mascot.postGame.3': 'Another one?',
  'mascot.alert': 'Heads up! ⚠',

  // --- In-game overlay ---
  'overlay.dragMove': 'drag to move',
  'overlay.hoverExpand': 'hover to expand',
  'overlay.unpin': 'Unpin',
  'overlay.pin': 'Pin panel open',
  'overlay.dragon': 'dragon',
  'overlay.baron': 'Baron',
  'overlay.live': 'LIVE',
  'overlay.waiting': 'Waiting for a recommendation…',
  'overlay.matchPanel': 'Match panel',

  // --- Live alerts (spike / objective window) ---
  'alert.baronFree': "Baron's up!",
  'alert.dragonFree': "dragon's up",
  'alert.baronIn': 'Baron spawns in {time}',
  'alert.dragonIn': 'dragon spawns in {time}',
  'alert.junglerDied': '{champion} (enemy jungler) died',
  'alert.enemiesDied': '{n} enemies died',
  'alert.objectiveWindow': '{who} — {objective}',
  'alert.spike': '{champion} finished {item} — power spike',
  'alert.levelSpike': '{champion} reached level {level}',

  // --- Engine: shared words + ordinals + categories ---
  'engine.word.physical': 'physical',
  'engine.word.magic': 'magic',
  'engine.word.thisItem': 'This item',
  'engine.word.theAlternative': 'the alternative',
  'engine.ordinal.1': '1st',
  'engine.ordinal.2': '2nd',
  'engine.ordinal.3': '3rd',
  'engine.ordinal.4': '4th',
  'engine.ordinal.5': '5th',
  'engine.ordinal.6': '6th',
  'engine.cat.armor': 'armor',
  'engine.cat.mr': 'magic resist',
  'engine.cat.antitank': 'anti-tank',
  'engine.cat.survival': 'survival',

  // --- Engine: antiheal ---
  'engine.antiheal.index':
    'Enemy healing index {index}{healers} — Grievous Wounds cuts their healing by 40%',
  'engine.antiheal.buy': '{item} costs {cost} gold and you have {gold}: buy it next base',
  'engine.antiheal.short': "{item} costs {cost} gold, you're {missing} short",
  'engine.antiheal.allyHas':
    'An ally already carries antiheal; less urgent but it still covers your own targets',

  // --- Engine: armor vs MR ---
  'engine.armorMr.dealerItems': '{champion} with {count} damage items',
  'engine.armorMr.physical': '{pct} of estimated enemy damage is physical ({dealers})',
  'engine.armorMr.magic': '{pct} of estimated enemy damage is magic ({dealers})',
  'engine.armorMr.prioArmor': 'Prioritize armor: {items} fit your champion',
  'engine.armorMr.prioMr': 'Prioritize magic resist: {items} fit your champion',
  'engine.armorMr.preFirst':
    'No first item yet: prioritize your build and leave this defense for later',

  // --- Engine: anti-tank ---
  'engine.antitank.teamEhp':
    'Average enemy effective HP {ehp} (expected at this minute: ~{baseline})',
  'engine.antitank.boss': '{champion} stacks {ehp} effective HP (level {level} + {items} items)',
  'engine.antitank.penPhysical': 'Penetration / % damage with {items}',
  'engine.antitank.penMagic': 'Magic penetration with {items}',

  // --- Engine: anti-burst ---
  'engine.antiburst.threat':
    '{kda} is fed (+{diff}) and their {type} burst kills you with no answer',
  'engine.antiburst.window':
    '{item} gives you a survival window against their engage pattern',
  'engine.antiburst.more': 'Additional threats: {threats}',

  // --- Engine: spike-now ---
  'engine.spike.now': 'You can finish {item} NOW: it costs {cost} gold and you have {gold}',
  'engine.spike.nowExplain':
    'Finishing an item is almost always a better spike than hoarding loose components',
  'engine.spike.close': 'Only {shortfall} gold short of {item} ({remaining} left, you have {gold})',
  'engine.spike.closeExplain':
    'Wait one more wave before backing: finishing it is worth more than buying small pieces',
  'engine.spike.target':
    '{item} is {cost} gold from completion; make it your next-base goal',

  // --- Engine: next-buy + endgame ---
  'engine.nextbuy.labelPool': '{ordinal} item in your {champion} build',
  'engine.nextbuy.labelMeta': '{ordinal} most-bought item in Master+ with {champion} this patch',
  'engine.nextbuy.bootsPaused': 'Boots on hold: Magical Footwear (rune) will grant them free',
  'engine.nextbuy.isLabel': '{item} is the {label}',
  'engine.nextbuy.canFinishNow': 'You can finish it NOW: it costs {cost} gold and you have {gold}',
  'engine.nextbuy.component': '{component} ({cost} gold) advances the {label}: {target}',
  'engine.nextbuy.componentGold': '{target} needs {missing} gold total; you have {gold}',
  'engine.nextbuy.saveFor': "Save gold for {target} ({label}): you're {missing} short",
  'engine.nextbuy.noPiece': 'No loose piece is worth it right now (you have {gold} gold)',
  'engine.endgame.situPool': '{item} is your situational',
  'engine.endgame.situMeta': '{item} is a common Master+ buy with {champion}',
  'engine.endgame.coreDone':
    'Your main {champion} build is complete and you have a slot: {situational}',
  'engine.endgame.buyNow': 'You can buy it NOW: it costs {cost} gold and you have {gold}',
  'engine.endgame.shortGold': "You're {missing} gold short (costs {cost}, you have {gold})",
  'engine.endgame.sellStarter':
    'Inventory full but you still carry {starter}: sell it to free a slot',
  'engine.endgame.thenBuy': 'With the free slot, buy {item} ({cost} gold; you have {gold})',

  // --- Engine: meta-items + exclusivity + recommend ---
  'engine.meta.pickReason':
    '{item} is what Master+ players buy with {champion} here ({games} games, {wr}% WR)',
  'engine.meta.suggestion':
    'Few Master+ {champion} players buy it: situational suggestion, not a priority',
  'engine.exclusivity.over':
    "Over {other}: you can't carry both at once (they share {group})",
  'engine.recommend.situPool': '{item} is in your {champion} situationals',
  'engine.recommend.metaWr':
    'in Master+ with {champion}: {wr}% WR carrying this item ({games} games)',

  // --- Stats: weakness insights (WP-016) ---
  'weakness.deaths.early.finding': 'You die {avg} times per game before minute 14',
  'weakness.deaths.early.advice':
    'Play the laning phase further back: every early death hands over the lane and a level lead',
  'weakness.deaths.mid.finding': 'You die {avg} times per game between minute 14 and 25',
  'weakness.deaths.mid.advice':
    'In mid game whoever walks alone dies: move with your team and never cross the river without vision',
  'weakness.deaths.late.finding': 'You die {avg} times per game after minute 25',
  'weakness.deaths.late.advice':
    'In late game each death is 40+ seconds out: never fight without your team or defend lanes with no escape',
  'weakness.gankable.finding':
    'The enemy jungler is involved in {avg} of your early deaths per game',
  'weakness.gankable.advice':
    "You're an easy gank target: hold river vision, watch the minimap when you push, and respect missing pings",
  'weakness.vision.finding':
    "Your average vision is {vision}/min, below your role's floor ({floor}/min)",
  'weakness.vision.advice':
    'Buy control wards every base and use your trinket leaving lane: vision is the cheapest stat to improve',
  'weakness.objectives.finding':
    '{pct}% of enemy objectives fall right after one of your deaths',
  'weakness.objectives.advice':
    "Before a dragon or baron spawns, play not to die: your death opens the objective even if you're not near it",
  'weakness.participation.finding':
    "You take part in {pct}% of your team's kills (floor: {floor}%)",
  'weakness.participation.advice':
    'The game is happening away from you: rotate to your team fights even at the cost of some farm',

  // --- Champ select: role labels + pick reasons + comp tips ---
  'cs.role.top': 'top',
  'cs.role.jungle': 'jungle',
  'cs.role.mid': 'mid',
  'cs.role.adc': 'ADC',
  'cs.role.support': 'support',
  'cs.role.default': 'your games',
  'cs.pick.metaBase': '{wr}% WR in Master+ this patch ({games} games) — the base of the suggestion',
  'cs.pick.ownAdjust': '{wr}% wins in {games} games as {role} (your data, adjusts)',
  'cs.pick.ownBase':
    '{wr}% wins in {games} games as {role} (your data — meta has no sample for this champion yet)',
  'cs.pick.versusOwn': "against this comp's champions: {wins} of {total} won",
  'cs.pick.versusMeta': 'in Master+ vs {names}: {wr}% WR ({games} games)',
  'cs.pick.addsMagic': 'adds the magic damage your team lacks',
  'cs.pick.addsPhysical': 'adds the physical damage your team lacks',
  'cs.pick.frontline': 'your team has no frontline and this pick provides it',
  'cs.pick.tankVsAssassins': '{n} assassins ahead: you hold their engages better',
  'cs.pick.mobilityVsAssassins':
    '{n} assassins ahead: your mobility lets you reposition when they jump',
  'cs.pick.immobileVsAssassins':
    "watch out: immobile pick vs {n} assassins — you'll depend on your team's peel",
  'cs.pick.antiTankStrong': '{n} tanks ahead: your %HP damage melts them',
  'cs.pick.antiTankWeak':
    '{n} tanks ahead and this pick struggles to kill them — consider an anti-tank',
  'cs.pick.inPool': 'in your pool: baseline build ready',
  'cs.tip.heavyAP': 'Very AP enemy comp ({n} of {total})',
  'cs.tip.heavyAD': 'Very AD enemy comp ({n} of {total})',
  'cs.tip.carryMr': "{heavy}: as a carry don't buy tank MR — {items} fit you ({cheap} is the cheap piece)",
  'cs.tip.planMr': '{heavy}: plan magic resist — {cheap} is the cheap piece',
  'cs.tip.carryArmor':
    "{heavy}: as a carry don't buy tank armor — {items} fit you ({cheap} is the cheap piece)",
  'cs.tip.planArmor': '{heavy}: plan armor — {cheap} is the cheap piece',
  'cs.tip.mixed': 'Mixed enemy damage: HP outperforms stacking a single resist',
  'cs.tip.healers': 'Enemy healing on the board ({names}): save a slot for Grievous Wounds',
  'cs.tip.teamAllAd':
    'Your team is almost all AD: the enemy benefits from stacking armor — the magic damage you add counts double',
  'cs.tip.teamAllAp':
    'Your team is almost all AP: the enemy benefits from stacking MR — the physical damage you add counts double'
} as const
