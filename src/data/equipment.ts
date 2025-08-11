import type { Equipment } from './types'

export const EQUIPMENT: Equipment[] = [
  // Weapons
  { id: 'greataxe', name: 'Greataxe', type: 'weapon', group: 'martial', hands: 2, dmg: '1d12 slashing', tags: ['weapon', 'heavy', 'two‑handed'], grants: ['Melee Attack (Greataxe)'] },
  { id: 'greatsword', name: 'Greatsword', type: 'weapon', group: 'martial', hands: 2, dmg: '2d6 slashing', tags: ['weapon', 'heavy', 'two‑handed'], grants: ['Melee Attack (Greatsword)'] },
  { id: 'longsword', name: 'Longsword', type: 'weapon', group: 'martial', hands: 1, dmg: '1d8 slashing', tags: ['weapon', 'versatile'], grants: ['Melee Attack (Longsword)'] },
  { id: 'rapier', name: 'Rapier', type: 'weapon', group: 'martial', hands: 1, dmg: '1d8 piercing', tags: ['weapon', 'finesse'], grants: ['Melee Attack (Rapier)'] },
  { id: 'shortsword', name: 'Shortsword', type: 'weapon', group: 'martial', hands: 1, dmg: '1d6 piercing', tags: ['weapon', 'finesse', 'light'], grants: ['Melee Attack (Shortsword)'] },
  { id: 'warhammer', name: 'Warhammer', type: 'weapon', group: 'martial', hands: 1, dmg: '1d8 bludgeoning', tags: ['weapon', 'versatile'], grants: ['Melee Attack (Warhammer)'] },
  { id: 'mace', name: 'Mace', type: 'weapon', group: 'simple', hands: 1, dmg: '1d6 bludgeoning', tags: ['weapon', 'simple'], grants: ['Melee Attack (Mace)'] },
  { id: 'handaxe', name: 'Handaxe', type: 'weapon', group: 'simple', hands: 1, dmg: '1d6 slashing', tags: ['weapon', 'simple', 'light', 'thrown'], grants: ['Melee Attack (Handaxe)', 'Ranged Attack (Handaxe)'] },
  { id: 'dagger', name: 'Dagger', type: 'weapon', group: 'simple', hands: 1, dmg: '1d4 piercing', tags: ['weapon', 'simple', 'light', 'finesse', 'thrown'], grants: ['Melee Attack (Dagger)', 'Ranged Attack (Dagger)'] },
  { id: 'spear', name: 'Spear', type: 'weapon', group: 'simple', hands: 1, dmg: '1d6 piercing', tags: ['weapon', 'simple', 'thrown', 'versatile'], grants: ['Melee Attack (Spear)', 'Ranged Attack (Spear)'] },
  { id: 'longbow', name: 'Longbow', type: 'weapon', group: 'martial', hands: 2, dmg: '1d8 piercing', tags: ['weapon', 'heavy', 'two‑handed', 'ranged'], grants: ['Ranged Attack (Longbow)'] },
  { id: 'shortbow', name: 'Shortbow', type: 'weapon', group: 'simple', hands: 2, dmg: '1d6 piercing', tags: ['weapon', 'two‑handed', 'ranged'], grants: ['Ranged Attack (Shortbow)'] },
  { id: 'light-crossbow', name: 'Light Crossbow', type: 'weapon', group: 'simple', hands: 2, dmg: '1d8 piercing', tags: ['weapon', 'two‑handed', 'ranged', 'loading'], grants: ['Ranged Attack (Light Crossbow)'] },
  { id: 'heavy-crossbow', name: 'Heavy Crossbow', type: 'weapon', group: 'martial', hands: 2, dmg: '1d10 piercing', tags: ['weapon', 'heavy', 'two‑handed', 'ranged', 'loading'], grants: ['Ranged Attack (Heavy Crossbow)'] },

  // Shields
  { id: 'shield', name: 'Shield', type: 'shield', ac: 2, hands: 1, tags: ['shield'], grants: ['Raise Shield'] },

  // Light Armor
  { id: 'padded', name: 'Padded Armor', type: 'armor', ac: 11, dexMax: Number.POSITIVE_INFINITY, tags: ['armor', 'light'] },
  { id: 'leather', name: 'Leather Armor', type: 'armor', ac: 11, dexMax: Number.POSITIVE_INFINITY, tags: ['armor', 'light'] },
  { id: 'studded-leather', name: 'Studded Leather', type: 'armor', ac: 12, dexMax: Number.POSITIVE_INFINITY, tags: ['armor', 'light'] },

  // Medium Armor
  { id: 'scale-mail', name: 'Scale Mail', type: 'armor', ac: 14, dexMax: 2, tags: ['armor', 'medium'] },
  { id: 'breastplate', name: 'Breastplate', type: 'armor', ac: 14, dexMax: 2, tags: ['armor', 'medium'] },
  { id: 'half-plate', name: 'Half Plate', type: 'armor', ac: 15, dexMax: 2, tags: ['armor', 'medium'] },

  // Heavy Armor
  { id: 'chain', name: 'Chain Mail', type: 'armor', ac: 16, dexMax: 0, reqStr: 13, tags: ['armor', 'heavy'] },
  { id: 'splint', name: 'Splint Armor', type: 'armor', ac: 17, dexMax: 0, reqStr: 15, tags: ['armor', 'heavy'] },
  { id: 'plate', name: 'Plate Armor', type: 'armor', ac: 18, dexMax: 0, reqStr: 15, tags: ['armor', 'heavy'] },
]

export const SUBACTIONS_BY_ITEM: Record<string, string[]> = {
  greataxe: ['Melee Attack (Greataxe)'],
  greatsword: ['Melee Attack (Greatsword)'],
  longsword: ['Melee Attack (Longsword)'],
  rapier: ['Melee Attack (Rapier)'],
  shortsword: ['Melee Attack (Shortsword)'],
  warhammer: ['Melee Attack (Warhammer)'],
  mace: ['Melee Attack (Mace)'],
  handaxe: ['Melee Attack (Handaxe)', 'Ranged Attack (Handaxe)'],
  dagger: ['Melee Attack (Dagger)', 'Ranged Attack (Dagger)'],
  spear: ['Melee Attack (Spear)', 'Ranged Attack (Spear)'],
  longbow: ['Ranged Attack (Longbow)'],
  shortbow: ['Ranged Attack (Shortbow)'],
  'light-crossbow': ['Ranged Attack (Light Crossbow)'],
  'heavy-crossbow': ['Ranged Attack (Heavy Crossbow)'],
  shield: ['Raise Shield'],
}
