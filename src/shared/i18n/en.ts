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
    'in Master+ with {champion}: {wr}% WR carrying this item ({games} games)'
} as const
