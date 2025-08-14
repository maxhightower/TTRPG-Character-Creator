// Shared domain types used by data modules
export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export type Background = {
  id: string
  name: string
  skills?: string[]
  tools?: string[]
  languages?: number
  feature?: { name: string; text: string }
}

export type Spell = { id: string; name: string; level: 0 | 1 | 2 | 3; classes: string[]; text: string }
export type MagicSchool =
  | 'abjuration'
  | 'conjuration'
  | 'divination'
  | 'enchantment'
  | 'evocation'
  | 'illusion'
  | 'necromancy'
  | 'transmutation'
export type DamageType =
  | 'acid'
  | 'bludgeoning'
  | 'cold'
  | 'fire'
  | 'force'
  | 'lightning'
  | 'necrotic'
  | 'piercing'
  | 'poison'
  | 'psychic'
  | 'radiant'
  | 'slashing'
  | 'thunder'
export type SaveAbility = AbilityKey | 'none'

export type SpellMeta = { school?: MagicSchool; damageTypes?: DamageType[]; save?: SaveAbility }

// Equipment and Feats
export type Equipment =
  | { id: string; name: string; type: 'weapon'; group?: string; hands?: number; dmg: string; weight?: number; cost?: number; tags?: string[]; grants?: string[] }
  | { id: string; name: string; type: 'shield'; ac?: number; hands?: number; weight?: number; cost?: number; tags?: string[]; grants?: string[] }
  | { id: string; name: string; type: 'armor'; ac: number; dexMax: number; reqStr?: number; weight?: number; cost?: number; tags?: string[] }

export type Feat = { id: string; name: string; text: string; tags?: string[] }
