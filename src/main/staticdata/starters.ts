/**
 * Purchasable first-shop items on Summoner's Rift. These ids are stable Riot
 * item ids; unavailable entries are filtered through the current item graph.
 * Kept separate from finished build items so starters inform a route without
 * ever becoming a legendary/core slot.
 */
export const STARTER_ITEM_IDS = new Set([
  1054, // Doran's Shield
  1055, // Doran's Blade
  1056, // Doran's Ring
  1082, // Dark Seal
  1083, // Cull
  1101, // Mosstomper Seedling
  1102, // Gustwalker Hatchling
  1103, // Scorchclaw Pup
  3865 // World Atlas
])

export function isStarterItemId(itemId: number): boolean {
  return STARTER_ITEM_IDS.has(itemId)
}
