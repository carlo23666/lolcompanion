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
