import React, { useMemo, useState, useEffect, useRef } from 'react'
import { Plus, Dice6, Info, Redo2, Scale, Settings2, Shield, Shuffle, Sparkles, Sword, Undo2, Zap } from 'lucide-react'

// ---------------- Demo Data (typed) ----------------

type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

type Race = {
  id: string
  name: string
  asis: Partial<Record<AbilityKey, number>>
  speed: number
  traits: Array<{ id: string; name: string; text: string }>
}

type Subclass = {
  id: string
  name: string
  unlockLevel: number
  grants?: { subactions?: string[] }
}

type Klass = {
  id: string
  name: string
  hitDie: number
  armor: string[]
  weapons: string[]
  grants?: { subactions?: string[] }
  level1?: Array<{ name: string; text: string }>
  acFormula?: (a: { armor: string | 'none'; dexMod: number; conMod: number }) => number | undefined
  saves?: AbilityKey[]
  subclasses?: Subclass[]
}

type Equipment =
  | { id: string; name: string; type: 'weapon'; group?: string; hands?: number; dmg: string; tags?: string[]; grants?: string[] }
  | { id: string; name: string; type: 'shield'; ac?: number; hands?: number; tags?: string[]; grants?: string[] }
  | { id: string; name: string; type: 'armor'; ac: number; dexMax: number; reqStr?: number; tags?: string[] }

const RACES: Race[] = [
  { id: 'human', name: 'Human (Base)', asis: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, speed: 30, traits: [ { id: 'versatile', name: 'Versatile', text: '+1 to all ability scores.' } ] },
  { id: 'human-variant', name: 'Human (Variant)', asis: { str: 1, dex: 1 }, speed: 30, traits: [ { id: 'adaptable', name: 'Adaptable', text: '+1 to two ability scores (demo variant).' } ] },
  { id: 'elf-wood', name: 'Elf (Wood)', asis: { dex: 2, wis: 1 }, speed: 35, traits: [ { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' }, { id: 'keen', name: 'Keen Senses', text: 'Proficiency in Perception.' } ] },
  { id: 'elf-high', name: 'Elf (High)', asis: { dex: 2, int: 1 }, speed: 30, traits: [ { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' }, { id: 'keen', name: 'Keen Senses', text: 'Proficiency in Perception.' } ] },
]

const CLASSES: Klass[] = [
  {
    id: 'barbarian',
    name: 'Barbarian',
    hitDie: 12,
    armor: ['light', 'medium', 'shields'],
    weapons: ['simple', 'martial'],
    grants: { subactions: ['Rage', 'Reckless Attack'] },
    level1: [
      { name: 'Rage', text: '+2 damage, advantage on STR checks; uses/long rest.' },
      { name: 'Unarmored Defense', text: 'AC = 10 + DEX + CON when no armor; shield allowed.' },
    ],
    acFormula: (a) => (a.armor === 'none' ? 10 + a.dexMod + a.conMod : undefined),
    saves: ['str', 'con'],
    subclasses: [
      { id: 'berserker', name: 'Path of the Berserker', unlockLevel: 3, grants: { subactions: ['Frenzy'] } },
    ],
  },
  {
    id: 'fighter',
    name: 'Fighter',
    hitDie: 10,
    armor: ['all', 'shields'],
    weapons: ['simple', 'martial'],
    grants: { subactions: ['Second Wind'] },
    level1: [
      { name: 'Second Wind', text: '1d10 + level self‑heal, 1/short rest.' },
      { name: 'Fighting Style', text: '+2 to hit with archery or +1 AC with defense, etc.' },
    ],
    saves: ['str', 'con'],
    subclasses: [
      { id: 'champion', name: 'Champion', unlockLevel: 3, grants: { subactions: ['Improved Critical'] } },
    ],
  },
  {
    id: 'wizard',
    name: 'Wizard',
    hitDie: 6,
    armor: [],
    weapons: ['daggers', 'quarterstaff'],
    grants: { subactions: ['Cast Spell'] },
    level1: [
      { name: 'Spellcasting', text: 'INT spellcasting. Cantrips & 1st‑level slots.' },
      { name: 'Arcane Recovery', text: 'Recover expended slots on short rest.' },
    ],
    saves: ['int', 'wis'],
    subclasses: [
      { id: 'evocation', name: 'School of Evocation', unlockLevel: 2, grants: { subactions: ['Sculpt Spells'] } },
    ],
  },
]

const EQUIPMENT: Equipment[] = [
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

const SUBACTIONS_BY_ITEM: Record<string, string[]> = {
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

// Skills (demo)
const SKILLS: Array<{ id: string; name: string; ability: AbilityKey }> = [
  { id: 'acrobatics', name: 'Acrobatics', ability: 'dex' },
  { id: 'animal', name: 'Animal Handling', ability: 'wis' },
  { id: 'arcana', name: 'Arcana', ability: 'int' },
  { id: 'athletics', name: 'Athletics', ability: 'str' },
  { id: 'deception', name: 'Deception', ability: 'cha' },
  { id: 'history', name: 'History', ability: 'int' },
  { id: 'insight', name: 'Insight', ability: 'wis' },
  { id: 'intimidation', name: 'Intimidation', ability: 'cha' },
  { id: 'investigation', name: 'Investigation', ability: 'int' },
  { id: 'medicine', name: 'Medicine', ability: 'wis' },
  { id: 'nature', name: 'Nature', ability: 'int' },
  { id: 'perception', name: 'Perception', ability: 'wis' },
  { id: 'performance', name: 'Performance', ability: 'cha' },
  { id: 'persuasion', name: 'Persuasion', ability: 'cha' },
  { id: 'religion', name: 'Religion', ability: 'int' },
  { id: 'sleight', name: 'Sleight of Hand', ability: 'dex' },
  { id: 'stealth', name: 'Stealth', ability: 'dex' },
  { id: 'survival', name: 'Survival', ability: 'wis' },
]

// Backgrounds (demo)
type Background = {
  id: string
  name: string
  skills?: string[]
  tools?: string[]
  languages?: number
  feature?: { name: string; text: string }
}
const BACKGROUNDS: Background[] = [
  { id: 'soldier', name: 'Soldier', skills: ['athletics', 'intimidation'], tools: ['gaming set', 'vehicles (land)'], feature: { name: 'Military Rank', text: 'You have a military rank and can exert influence.' } },
  { id: 'acolyte', name: 'Acolyte', skills: ['insight', 'religion'], languages: 2, feature: { name: 'Shelter of the Faithful', text: 'You command respect from those who share your faith.' } },
  { id: 'criminal', name: 'Criminal', skills: ['deception', 'stealth'], tools: ['thieves’ tools', 'gaming set'], feature: { name: 'Criminal Contact', text: 'You have a reliable and trustworthy contact.' } },
]

// ---------------- Utilities ----------------

function mod(score: number) { return Math.floor((score - 10) / 2) }
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)) }
function dedupe<T>(arr: T[]): T[] { return Array.from(new Set(arr)) }
function proficiencyBonus(level: number) {
  if (level >= 17) return 6
  if (level >= 13) return 5
  if (level >= 9) return 4
  if (level >= 5) return 3
  return 2
}

// Helper to safely read 'hands' across Equipment union
function getHands(i: Equipment): number {
  return typeof (i as any).hands === 'number' ? ((i as any).hands as number) : 0
}

// ---------------- Permit / Validation Stubs ----------------

type Issue = { level: 'error' | 'warn' | 'hint'; msg: string }

function validateChoice(state: AppState): Issue[] {
  const issues: Issue[] = []
  const hasShield = state.loadout.some((i) => i.type === 'shield')
  const armor = state.loadout.find((i) => i.type === 'armor') as Extract<Equipment, { type: 'armor' }> | undefined
  const handsInUse = state.loadout.reduce((acc, i) => acc + getHands(i), 0)
  const twoHandedWeapon = state.loadout.find((i) => (i as any).tags?.includes('two‑handed'))

  if (twoHandedWeapon && hasShield) {
    issues.push({ level: 'error', msg: 'Two‑handed weapon cannot be used with a shield equipped.' })
  }

  if (armor?.id === 'chain' && (state.abilities.str || 10) < 13) {
    issues.push({ level: 'warn', msg: 'Chain Mail requires STR 13 for optimal use (speed penalties otherwise).' })
  }

  if (state.classes.some((c) => c.klass.id === 'wizard') && armor) {
    issues.push({ level: 'warn', msg: 'Wizards are not proficient with armor by default (toy rule).' })
  }

  if (state.classes.some((c) => c.klass.id === 'barbarian') && !armor) {
    issues.push({ level: 'hint', msg: 'Unarmored Defense active: AC = 10 + DEX + CON. Shield allowed.' })
  }

  if (handsInUse > 2) {
    issues.push({ level: 'error', msg: 'You cannot hold more than two hands worth of equipment.' })
  }

  return issues
}

// ---------------- Derived & Simulation ----------------

function computeDerived(state: AppState) {
  const dexMod = mod(state.abilities.dex)
  const conMod = mod(state.abilities.con)
  const strMod = mod(state.abilities.str)

  const armor = state.loadout.find((i) => i.type === 'armor') as Extract<Equipment, { type: 'armor' }> | undefined
  const shield = state.loadout.find((i) => i.type === 'shield') as Extract<Equipment, { type: 'shield' }> | undefined

  const totalLevel = Math.max(1, state.classes.reduce((s, c) => s + (c.level || 0), 0) || 1)

  let ac = 10 + dexMod
  if (armor) {
    const dexCap = typeof armor.dexMax === 'number' ? armor.dexMax : Infinity
    ac = armor.ac + clamp(dexMod, -Infinity, dexCap)
  }
  if (!armor && state.classes.some((c) => c.klass.id === 'barbarian')) {
    ac = 10 + dexMod + conMod
  }
  if (shield) ac += shield.ac ?? 2

  // HP: base at first level from the first selected class, then average per-level per class
  const firstHitDie = state.classes[0]?.klass.hitDie ?? 8
  let hp = firstHitDie + conMod
  state.classes.forEach((c, idx) => {
    const perLevel = Math.max(1, Math.floor(c.klass.hitDie / 2) + 1 + conMod)
    const extraLevels = Math.max(0, (c.level || 0) - (idx === 0 ? 1 : 0))
    hp += extraLevels * perLevel
  })

  const speed = state.race?.speed ?? 30

  const classSubs = state.classes.flatMap((c) => c.klass.grants?.subactions ?? [])
  const subclassSubs = state.classes.flatMap((c) => c.subclass?.grants?.subactions ?? [])
  const itemSubs = state.loadout.flatMap((i) => SUBACTIONS_BY_ITEM[(i as any).id] ?? [])
  const subactions = dedupe([...classSubs, ...subclassSubs, ...itemSubs])

  // Saving throws (union of class save proficiencies)
  const final = finalAbility(state.abilities, state.race)
  const prof = proficiencyBonus(totalLevel)
  const saveProfs = dedupe(state.classes.flatMap((c) => c.klass.saves ?? []))
  const saves: Record<AbilityKey, number> = {
    str: mod(final.str) + (saveProfs.includes('str') ? prof : 0),
    dex: mod(final.dex) + (saveProfs.includes('dex') ? prof : 0),
    con: mod(final.con) + (saveProfs.includes('con') ? prof : 0),
    int: mod(final.int) + (saveProfs.includes('int') ? prof : 0),
    wis: mod(final.wis) + (saveProfs.includes('wis') ? prof : 0),
    cha: mod(final.cha) + (saveProfs.includes('cha') ? prof : 0),
  }

  return { ac, hp, speed, subactions, dexMod, conMod, strMod, saves, totalLevel }
}

function simulateReadiness(state: AppState) {
  const { subactions, strMod, dexMod, conMod } = computeDerived(state)
  const offense = (subactions.includes('Melee Attack (Greataxe)') ? 0.6 : 0) + (subactions.includes('Ranged Attack (Longbow)') ? 0.5 : 0) + Math.max(strMod, dexMod) * 0.15
  const defense = computeDerived(state).ac * 0.03 + conMod * 0.4
  const economy = (subactions.includes('Rage') ? 0.5 : 0) + (subactions.includes('Second Wind') ? 0.4 : 0) + (subactions.includes('Cast Spell') ? 0.4 : 0)
  const readiness = clamp(Math.round((offense + defense + economy) * 100) / 100, 0, 10)
  return { offense, defense, economy, readiness }
}

// ---------------- Local UI helpers ----------------

function Labeled(props: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ fontSize: 12, color: '#64748b' }}>{props.label}</div>
      {props.children}
    </div>
  )
}

function Pill(props: { children: React.ReactNode }) {
  return <span style={{ padding: '2px 8px', borderRadius: 999, background: '#f1f5f9', color: '#0f172a', fontSize: 12 }}>{props.children}</span>
}

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost'; size?: 'sm' | 'md' | 'icon' }) {
  const { variant = 'default', size = 'md', style, ...rest } = props
  const base: React.CSSProperties = {
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    background: variant === 'default' ? '#0ea5e9' : 'white',
    color: variant === 'default' ? 'white' : '#0f172a',
    cursor: 'pointer',
  }
  if (variant === 'outline') { base.background = 'white' }
  if (variant === 'ghost') { base.background = 'transparent'; base.border = '1px solid transparent' }
  if (size === 'sm') { base.padding = '6px 10px'; base.fontSize = 12 }
  else if (size === 'icon') { base.padding = 6 }
  else { base.padding = '8px 12px' }
  return <button {...rest} style={{ ...base, ...style }} />
}

function Progress({ value }: { value: number }) {
  return (
    <div style={{ width: '100%', height: 10, borderRadius: 999, background: '#e2e8f0' }}>
      <div style={{ width: `${clamp(value, 0, 100)}%`, height: '100%', borderRadius: 999, background: '#0ea5e9' }} />
    </div>
  )
}

// ---------------- Simple Card primitives ----------------

function Card(props: { children: React.ReactNode }) {
  return <section style={card}>{props.children}</section>
}
function CardHeader(props: { children: React.ReactNode }) {
  return <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0' }}>{props.children}</div>
}
function CardTitle(props: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>{props.children}</div>
}
function CardContent(props: { children: React.ReactNode }) {
  return <div style={{ padding: 12, display: 'grid', gap: 12 }}>{props.children}</div>
}

// ---------------- Styles ----------------

const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }
const badgeSecondary: React.CSSProperties = { padding: '2px 8px', borderRadius: 999, background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: 12 }
const badgeOutline: React.CSSProperties = { padding: '2px 8px', borderRadius: 999, border: '1px solid #e2e8f0', fontSize: 12 }
const card: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 12, background: 'white' }

// ---------------- App State ----------------

export type AppState = {
  name: string
  race: Race
  classes: Array<{ klass: Klass; level: number; subclass?: Subclass }>
  abilities: Record<AbilityKey, number>
  loadout: Equipment[]
  background?: Background
}

// ---------------- Main Component ----------------

export function Builder(props: { onCharacterChange?: (state: AppState, derived?: any) => void }) {
  const [mode, setMode] = useState<'guided' | 'power'>('power')
  const [name, setName] = useState('New Hero')
  const [race, setRace] = useState<Race>(RACES[0])
  const [classes, setClasses] = useState<Array<{ klass: Klass; level: number; subclass?: Subclass }>>([
    { klass: CLASSES[0], level: 1 },
  ])
  const [abilities, setAbilities] = useState<Record<AbilityKey, number>>({ str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 8 })
  const [loadout, setLoadout] = useState<Equipment[]>([EQUIPMENT[0], EQUIPMENT[1]]) // greataxe + shield
  // Background selection
  const [background, setBackground] = useState<Background | undefined>(BACKGROUNDS[0])
  // Skills proficiency & sorting state
  type ProfType = 'none' | 'half' | 'prof' | 'expert'
  const [skillProf, setSkillProf] = useState<Record<string, ProfType>>({})
  const [skillSort, setSkillSort] = useState<'ability' | 'alpha' | 'bonus' | 'proftype'>('ability')
  const [history, setHistory] = useState<string[]>([])
  const [future, setFuture] = useState<string[]>([])
  // Catalog search/filter state
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogTags, setCatalogTags] = useState<string[]>([])
  const [catalogFiltersOpen, setCatalogFiltersOpen] = useState(false)
  const allTags = useMemo(() => dedupe(EQUIPMENT.flatMap((i) => (((i as any).tags || []) as string[]))), [])
  const filteredEquipment = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase()
    return EQUIPMENT.filter((eq) => {
      const tags = (((eq as any).tags || []) as string[])
      const nameMatch = q ? eq.name.toLowerCase().includes(q) : true
      const tagsMatch = catalogTags.length ? catalogTags.every((tg) => tags.includes(tg)) : true
      return nameMatch && tagsMatch
    })
  }, [catalogQuery, catalogTags])
  const toggleTag = (tag: string) => setCatalogTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))

  const state: AppState = { name, race, classes, abilities, loadout, background }
  const derived = useMemo(() => computeDerived(state), [state])
  const issues = useMemo(() => validateChoice(state), [state])
  const sim = useMemo(() => simulateReadiness(state), [state])

  // Detect pending class feature decisions (e.g., subclass unlocked but not chosen)
  const pendingSubclassChoices = useMemo(() => {
    return classes.filter((c) => {
      const subs = c.klass.subclasses || []
      if (!subs.length) return false
      const available = subs.filter((s) => c.level >= s.unlockLevel)
      return available.length > 0 && !c.subclass
    })
  }, [classes])
  function setSubclassChoice(klassId: string, s: Subclass) {
    setClasses((cs) => cs.map((c) => (c.klass.id === klassId ? { ...c, subclass: s } : c)))
  }

  // Notify parent when character changes
  useEffect(() => {
    props.onCharacterChange?.(state, derived)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, race, JSON.stringify(classes), JSON.stringify(abilities), JSON.stringify(loadout), JSON.stringify(background), derived])

  function snapshot() {
    setHistory((h) => [...h, JSON.stringify(state)])
    setFuture([])
  }
  function undo() {
    if (!history.length) return
    const prev = history[history.length - 1]
    setFuture((f) => [JSON.stringify(state), ...f])
    setHistory((h) => h.slice(0, -1))
    const s: AppState = JSON.parse(prev)
    setName(s.name); setRace(s.race); setClasses(s.classes as any); setAbilities(s.abilities); setLoadout(s.loadout)
  }
  function redo() {
    if (!future.length) return
    const next = future[0]
    setHistory((h) => [...h, JSON.stringify(state)])
    setFuture((f) => f.slice(1))
    const s: AppState = JSON.parse(next)
    setName(s.name); setRace(s.race); setClasses(s.classes as any); setAbilities(s.abilities); setLoadout(s.loadout)
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Top controls similar to demo header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
        <Sparkles size={18} />
        <div style={{ fontWeight: 600 }}>Character Builder</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' }}>
          <span>Guided</span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={mode === 'power'} onChange={(e) => setMode(e.target.checked ? 'power' : 'guided')} />
            <span>Power</span>
          </label>
          <Button size="sm" variant="outline" onClick={undo}><Undo2 size={16} style={{ marginRight: 6 }} />Undo</Button>
          <Button size="sm" variant="outline" onClick={redo}><Redo2 size={16} style={{ marginRight: 6 }} />Redo</Button>
          <Button size="sm" onClick={snapshot}><Settings2 size={16} style={{ marginRight: 6 }} />Save Draft</Button>
        </div>
      </div>

      {/* Main grid: left builder, right summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 12 }}>
        {/* Left */}
        <div style={{ display: 'grid', gap: 12 }}>
          {/* Basics */}
          <Card>
            <CardHeader><CardTitle><Info size={16} style={{ marginRight: 6 }} />Basics</CardTitle></CardHeader>
            <CardContent>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '2fr 1fr 1fr' }}>
                {/* Character Name (col 1) */}
                <Labeled label="Character Name">
                  <input value={name} onChange={(e) => setName(e.target.value)} style={inp} />
                </Labeled>

                {/* Race (col 2) */}
                <Labeled label="Race">
                  <RaceSelector value={race} onChange={setRace} />
                </Labeled>

                {/* Background (col 3) */}
                <Labeled label="Background">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {BACKGROUNDS.map((bg) => (
                      <Button key={bg.id} size="sm" variant={background?.id === bg.id ? 'default' : 'outline'} onClick={() => setBackground(bg)}>
                        {bg.name}
                      </Button>
                    ))}
                  </div>
                </Labeled>

                {/* Classes & Level manager (full width) */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <ClassManager
                    classes={classes}
                    onChange={setClasses}
                  />
                </div>

                <AbilityEditor abilities={abilities} onChange={setAbilities} race={race} />
              </div>
            </CardContent>
          </Card>

          {/* Class Feature Choices (appears only when needed) */}
          {pendingSubclassChoices.length ? (
            <Card>
              <CardHeader><CardTitle><Sparkles size={16} style={{ marginRight: 6 }} />Class Feature Choices</CardTitle></CardHeader>
              <CardContent>
                <div style={{ fontSize: 12, color: '#64748b' }}>You have class choices to make.</div>
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  {pendingSubclassChoices.map((c) => (
                    <div key={c.klass.id} style={{ padding: 8, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'grid', gap: 8 }}>
                      <div style={{ fontWeight: 600 }}>{c.klass.name}: Choose a Subclass</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(c.klass.subclasses || []).filter((s) => c.level >= s.unlockLevel).map((s) => (
                          <Button key={s.id} size="sm" variant={c.subclass?.id === s.id ? 'default' : 'outline'} onClick={() => setSubclassChoice(c.klass.id, s)}>{s.name}</Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Skills */}
          <Card>
            <CardHeader><CardTitle><Info size={16} style={{ marginRight: 6 }} />Skills</CardTitle></CardHeader>
            <CardContent>
              {/* Sort controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Sort By</div>
                <select value={skillSort} onChange={(e) => setSkillSort(e.target.value as any)} style={{ ...inp, width: 240, padding: '6px 10px' }}>
                  <option value="ability">Ability Score (STR, DEX, ...)</option>
                  <option value="alpha">Alphabetical</option>
                  <option value="bonus">Highest Bonus</option>
                  <option value="proftype">Proficiency Type</option>
                </select>
              </div>

              {(() => {
                const fa = finalAbility(abilities, race)
                const pb = proficiencyBonus(derived.totalLevel)
                const abilityOrder: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
                const profOrder: ProfType[] = ['none', 'half', 'prof', 'expert']
                const nextProf = (t?: ProfType): ProfType => (t === 'none' ? 'half' : t === 'half' ? 'prof' : t === 'prof' ? 'expert' : 'none')
                const items = SKILLS.map((s) => {
                  const base = mod(fa[s.ability])
                  const t: ProfType = skillProf[s.id] ?? 'none'
                  const add = t === 'half' ? Math.floor(pb / 2) : t === 'prof' ? pb : t === 'expert' ? pb * 2 : 0
                  const total = base + add
                  return { ...s, base, add, total, t }
                })
                items.sort((a, b) => {
                  if (skillSort === 'alpha') return a.name.localeCompare(b.name)
                  if (skillSort === 'bonus') return b.total - a.total || a.name.localeCompare(b.name)
                  if (skillSort === 'proftype') return profOrder.indexOf(a.t) - profOrder.indexOf(b.t) || a.name.localeCompare(b.name)
                  // ability
                  return abilityOrder.indexOf(a.ability) - abilityOrder.indexOf(b.ability) || a.name.localeCompare(b.name)
                })
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {items.map((s) => (
                      <div key={s.id} style={{ padding: 8, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'grid', gap: 2 }}>
                          <div style={{ fontWeight: 600 }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>{s.ability}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Pill>{s.total >= 0 ? `+${s.total}` : s.total}</Pill>
                          <Button
                            size="sm"
                            variant={s.t === 'none' ? 'outline' : 'default'}
                            onClick={() => setSkillProf((m) => ({ ...m, [s.id]: nextProf(m[s.id] ?? 'none') }))
                          }>{s.t === 'none' ? 'None' : s.t === 'half' ? 'Half' : s.t === 'prof' ? 'Prof' : 'Expertise'}</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          {/* Equipment */}
          <Card>
            <CardHeader><CardTitle><Sword size={16} style={{ marginRight: 6 }} />Equipment & Loadout</CardTitle></CardHeader>
            <CardContent>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                {/* Catalog column */}
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Catalog</div>
                  {/* Search + Filters toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      placeholder="Search catalog..."
                      value={catalogQuery}
                      onChange={(e) => setCatalogQuery(e.target.value)}
                      style={{ ...inp, flex: 1 }}
                    />
                    <Button
                      size="sm"
                      variant={catalogFiltersOpen || catalogTags.length ? 'default' : 'outline'}
                      onClick={() => setCatalogFiltersOpen((v) => !v)}
                    >Filters{catalogTags.length ? ` (${catalogTags.length})` : ''}</Button>
                  </div>
                  {/* Tag filters (collapsible) */}
                  {catalogFiltersOpen ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {allTags.map((tag) => (
                        <Button
                          key={tag}
                          size="sm"
                          variant={catalogTags.includes(tag) ? 'default' : 'outline'}
                          onClick={() => toggleTag(tag)}
                        >{tag}</Button>
                      ))}
                      {catalogTags.length ? (
                        <Button size="sm" variant="ghost" onClick={() => setCatalogTags([])}>Clear filters</Button>
                      ) : null}
                    </div>
                  ) : null}
                  {/* Scrollable grid of items */}
                  <div style={{ maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {filteredEquipment.length ? filteredEquipment.map((eq) => (
                        <ItemCard key={(eq as any).id} item={eq} onAdd={() => setLoadout((l) => dedupe([...l, eq]))} />
                      )) : (
                        <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#94a3b8' }}>No items match your search.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Loadout column */}
                <div style={{ display: 'grid', gap: 8, background: '#f8fafc', padding: 8, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Loadout</div>
                  <div style={{ maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {loadout.length === 0 && (
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>Nothing equipped.</div>
                      )}
                      {loadout.map((eq) => (
                        <LoadoutRow key={(eq as any).id} item={eq} onRemove={() => setLoadout((l) => l.filter((x) => (x as any).id !== (eq as any).id))} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Compare Panel */}
          <ComparePanel race={race} classes={classes} loadout={loadout} />

          {/* Toy Combat Readiness */}
          <Card>
            <CardHeader><CardTitle><Zap size={16} style={{ marginRight: 6 }} />Toy Combat Readiness</CardTitle></CardHeader>
            <CardContent>
              <div style={{ fontSize: 12, color: '#64748b' }}>This demo computes a quick heuristic score. In production this would call your MCST to simulate turns and return rich analytics.</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
                <ScoreBlock label="Offense" value={sim.offense} />
                <ScoreBlock label="Defense" value={sim.defense} />
                <ScoreBlock label="Economy" value={sim.economy} />
              </div>
              <div style={{ paddingTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span>Readiness</span>
                  <span style={{ fontWeight: 600 }}>{sim.readiness.toFixed(2)} / 10</span>
                </div>
                <Progress value={(sim.readiness / 10) * 100} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Button variant="outline" onClick={() => {
                  const randomEq = EQUIPMENT[Math.floor(Math.random() * EQUIPMENT.length)]
                  setLoadout((l) => dedupe([...l.filter((x) => (x as any).type !== (randomEq as any).type), randomEq]))
                }}><Shuffle size={16} style={{ marginRight: 6 }} />Try Random Loadout</Button>
                <Button onClick={snapshot}><Dice6 size={16} style={{ marginRight: 6 }} />Snapshot Build</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Live Summary */}
        <aside style={{ display: 'grid', gap: 12 }}>
          <Card>
            <CardHeader><CardTitle><Scale size={16} style={{ marginRight: 6 }} />Live Summary</CardTitle></CardHeader>
            <CardContent>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Labeled label="Race"><div>{race.name}</div></Labeled>
                <Labeled label="Level"><Pill>{derived.totalLevel}</Pill></Labeled>
                <Labeled label="Classes">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {classes.map((c) => (
                      <Pill key={c.klass.id}>
                        {c.klass.name} {c.level}{c.subclass ? ` (${c.subclass.name})` : ''}
                      </Pill>
                    ))}
                  </div>
                </Labeled>
                <Labeled label="Speed"><Pill>{derived.speed} ft.</Pill></Labeled>
                <Labeled label="HP @lvl"><Pill>{derived.hp}</Pill></Labeled>
                <Labeled label="AC"><Pill>{derived.ac}</Pill></Labeled>
                <Labeled label="Background"><div>{background?.name || '—'}</div></Labeled>
              </div>

              {/* Combined Abilities + Saves */}
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Abilities & Saves</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {(['str','dex','con','int','wis','cha'] as AbilityKey[]).map((k) => (
                    <div key={k} style={{ padding: 8, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'grid', gap: 6 }}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b' }}>{k}</div>
                      <div style={{ fontWeight: 600 }}>{finalAbility(abilities, race)[k]}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>mod {mod(finalAbility(abilities, race)[k]) >= 0 ? '+' : ''}{mod(finalAbility(abilities, race)[k])}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>Save</span>
                        <Pill>{derived.saves[k] >= 0 ? `+${derived.saves[k]}` : derived.saves[k]}</Pill>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subactions */}
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Subactions Gained</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {derived.subactions.length ? derived.subactions.map((s) => <span key={s} style={badgeSecondary}>{s}</span>) : <div style={{ color: '#94a3b8' }}>None yet.</div>}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={16} style={{ marginRight: 6 }} />Level 1 Features
                </div>
                <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                  {classes.filter((c) => (c.level || 0) >= 1).flatMap((c) => (c.klass.level1 || []).map((f) => ({ f, cname: c.klass.name }))).map(({ f, cname }) => (
                    <div key={cname + f.name} style={{ padding: 8, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <div style={{ fontWeight: 600 }}>{f.name} <span style={{ color: '#64748b', fontWeight: 400 }}>({cname})</span></div>
                      <div style={{ color: '#64748b' }}>{f.text}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Racial Features moved to bottom, text size matches Level 1 Features */}
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Racial Features</div>
                <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                  {(race.traits || []).length ? (
                    (race.traits || []).map((t) => (
                      <div key={t.id} style={{ padding: 8, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        <div style={{ fontWeight: 600 }}>{t.name}</div>
                        <div style={{ color: '#64748b' }}>{t.text}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#94a3b8' }}>No racial features.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
      <div style={{ fontSize: 12, color: '#64748b', padding: '8px 0' }}>Demo only. Replace permit/reward stubs with your engine calls to power full validation, previews, and MCST‑driven simulations.</div>
    </div>
  )
}

// ---------------- Subcomponents ----------------

function Selector<T extends { id: string }>(props: { options: T[]; value: T; onChange: (v: T) => void; getLabel: (t: T) => string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {props.options.map((opt) => (
        <Button key={opt.id} size="sm" variant={props.value?.id === opt.id ? 'default' : 'outline'} onClick={() => props.onChange(opt)}>
          {props.getLabel(opt)}
        </Button>
      ))}
    </div>
  )
}

function AbilityEditor(props: { abilities: Record<AbilityKey, number>; onChange: (v: Record<AbilityKey, number>) => void; race: Race }) {
  const final = finalAbility(props.abilities, props.race)
  const order: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

  // Roll pool + DnD state
  type RollToken = { id: string; value: number }
  const [rollTokens, setRollTokens] = useState<RollToken[]>([])
  const [assignedFromPool, setAssignedFromPool] = useState<Partial<Record<AbilityKey, number>>>({})
  const makeId = () => Math.random().toString(36).slice(2, 9)
  // Point Buy state
  const [pointBuy, setPointBuy] = useState(false)
  // NEW: toggle for generator options
  const [genOpen, setGenOpen] = useState(false)
  const POINT_BUY_BUDGET = 27
  function pointCost(score: number) {
    switch (score) {
      case 8: return 0
      case 9: return 1
      case 10: return 2
      case 11: return 3
      case 12: return 4
      case 13: return 5
      case 14: return 7
      case 15: return 9
      default: return Number.POSITIVE_INFINITY
    }
  }
  function totalPointsSpent(vals: Record<AbilityKey, number>) {
    return (['str','dex','con','int','wis','cha'] as AbilityKey[]).reduce((s, k) => {
      const v = Math.max(8, Math.min(15, vals[k] || 8))
      return s + pointCost(v)
    }, 0)
  }
  const pointsSpent = totalPointsSpent(props.abilities)
  const pointsRemaining = Math.max(0, POINT_BUY_BUDGET - pointsSpent)

  // Generators
  function rollDice(count: number, sides: number) { return Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides)) }
  function gen4d6dlOnce() { const r = rollDice(4, 6).sort((a, b) => b - a); return r[0] + r[1] + r[2] }
  function gen3d6Once() { return rollDice(3, 6).reduce((a, b) => a + b, 0) }
  function toTokens(vals: number[]): RollToken[] { return vals.map((v) => ({ id: makeId(), value: v })) }

  function roll4d6dlPool() {
    const vals = Array.from({ length: 6 }, () => gen4d6dlOnce())
    setRollTokens(toTokens(vals))
    setAssignedFromPool({})
    setPointBuy(false)
  }
  function roll3d6Pool() {
    const vals = Array.from({ length: 6 }, () => gen3d6Once())
    setRollTokens(toTokens(vals))
    setAssignedFromPool({})
    setPointBuy(false)
  }
  function roll1d20Pool() {
    const vals = Array.from({ length: 6 }, () => 1 + Math.floor(Math.random() * 20))
    setRollTokens(toTokens(vals))
    setAssignedFromPool({})
    setPointBuy(false)
  }
  function applyScores(scores: number[]) {
    const sorted = [...scores].sort((a, b) => b - a)
    const next: Record<AbilityKey, number> = { ...props.abilities }
    order.forEach((k, i) => { next[k] = clamp(sorted[i] ?? 10, 3, 20) })
    props.onChange(next)
  }

  function autoAssignFromPool() {
    if (!rollTokens.length) return
    applyScores(rollTokens.map(t => t.value))
    setRollTokens([])
    setAssignedFromPool({})
  }
  function clearRolls() { setRollTokens([]); setAssignedFromPool({}) }

  // DnD handlers
  function onTokenDragStart(e: React.DragEvent<HTMLDivElement>, tokenId: string) {
    e.dataTransfer.setData('text/plain', tokenId)
    e.dataTransfer.effectAllowed = 'move'
  }
  function onAbilityDragOver(e: React.DragEvent<HTMLDivElement>) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  function onAbilityDrop(k: AbilityKey, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const tokenId = e.dataTransfer.getData('text/plain')
    if (!tokenId) return
    const tokenIdx = rollTokens.findIndex(t => t.id === tokenId)
    if (tokenIdx === -1) return
    const token = rollTokens[tokenIdx]
    const remaining = rollTokens.filter((_, i) => i !== tokenIdx)

    // If this ability already had a pool-assigned value, return it to pool
    const prev = assignedFromPool[k]
    const newPool = [...remaining]
    if (typeof prev === 'number') newPool.push({ id: makeId(), value: prev })

    // Update assignment map and abilities
    setAssignedFromPool({ ...assignedFromPool, [k]: token.value })
    setRollTokens(newPool)
    props.onChange({ ...props.abilities, [k]: clamp(token.value, 3, 20) })
  }

  function adjustAbility(k: AbilityKey, delta: number) {
    if (!pointBuy) {
      props.onChange({ ...props.abilities, [k]: clamp((props.abilities[k] || 10) + delta, 3, 20) })
      return
    }
    const current = clamp(props.abilities[k] || 8, 8, 15)
    const next = clamp(current + delta, 8, 15)
    if (next === current) return
    const diff = pointCost(next) - pointCost(current)
    if (diff <= 0 || pointsRemaining - diff >= 0) {
      props.onChange({ ...props.abilities, [k]: next })
    }
  }

  return (
    <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 12, color: '#64748b' }}>Abilities</div>

      {/* Generators */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <Button size="sm" variant="outline" onClick={() => setGenOpen((v) => !v)}>Generate</Button>
        <Button size="sm" variant="ghost" onClick={() => { props.onChange({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }); clearRolls(); setPointBuy(false) }}>Reset</Button>
        {genOpen ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Button size="sm" variant="outline" onClick={roll4d6dlPool}>🎲 4d6 (drop lowest)</Button>
            <Button size="sm" variant="outline" onClick={roll3d6Pool}>🎲 3d6</Button>
            <Button size="sm" variant="outline" onClick={roll1d20Pool}>🎲 1d20</Button>
            <Button size="sm" variant="outline" onClick={() => { applyScores([15, 14, 13, 12, 10, 8]); clearRolls(); setPointBuy(false) }}>Standard Array</Button>
            {!pointBuy ? (
              <Button size="sm" variant="outline" onClick={() => { setPointBuy(true); clearRolls(); props.onChange({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }) }}>Point Buy (27)</Button>
            ) : (
              <>
                <span style={{ fontSize: 12, color: '#64748b' }}>Remaining: <strong>{pointsRemaining}</strong></span>
                <Button size="sm" variant="ghost" onClick={() => setPointBuy(false)}>Exit Point Buy</Button>
              </>
            )}
            {rollTokens.length ? (
              <>
                <Button size="sm" variant="outline" onClick={autoAssignFromPool}>Auto-assign high→low</Button>
                <Button size="sm" variant="ghost" onClick={clearRolls}>Clear Rolls</Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Roll pool as draggable tokens (only for dice methods) */}
      {rollTokens.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {rollTokens.map((t) => (
            <div
              key={t.id}
              draggable
              onDragStart={(e) => onTokenDragStart(e, t.id)}
              title={`Drag ${t.value} onto a stat`}
              style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #ef4444', background: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}
            >
              {t.value}
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
        {order.map((k) => (
          <div
            key={k}
            onDragOver={onAbilityDragOver}
            onDrop={(e) => onAbilityDrop(k, e)}
            style={{ padding: 8, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'grid', gap: 6 }}
          >
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b' }}>{k}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button size="icon" variant="outline" onClick={() => adjustAbility(k, -1)}>−</Button>
              <div style={{ fontWeight: 600, width: 24, textAlign: 'center' }}>{pointBuy ? Math.max(8, Math.min(15, props.abilities[k] || 8)) : (props.abilities[k] || 10)}</div>
              <Button size="icon" variant="outline" onClick={() => adjustAbility(k, +1)}>+</Button>
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>mod {mod(final[k]) >= 0 ? '+' : ''}{mod(final[k])}</div>
            {typeof assignedFromPool[k] === 'number' ? (
              <div style={{ fontSize: 11, color: '#64748b' }}>Assigned: {assignedFromPool[k]}</div>
            ) : (
              rollTokens.length ? <div style={{ fontSize: 11, color: '#94a3b8' }}>Drop a roll here</div> : null
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function finalAbility(abilities: Record<AbilityKey, number>, race: Race): Record<AbilityKey, number> {
  const out: Record<AbilityKey, number> = { ...{ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, ...abilities }
  Object.entries(race?.asis || {}).forEach(([k, inc]) => { const kk = k as AbilityKey; out[kk] = (out[kk] || 10) + (inc || 0) })
  return out
}

function ItemCard({ item, onAdd }: { item: Equipment; onAdd: () => void }) {
  const tags = (item as any).tags as string[] | undefined
  return (
    <div style={{ padding: 8, borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', display: 'grid', gap: 6, minHeight: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {item.type === 'weapon' && <Sword size={16} />}
        {item.type === 'shield' && <Shield size={16} />}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
          <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
            {item.type === 'weapon' && (item as any).dmg}
            {item.type === 'armor' && (
              <>AC {(item as any).ac}{typeof (item as any).dexMax !== 'undefined' ? `, Dex cap ${((item as any).dexMax === (Infinity as any)) ? '—' : (item as any).dexMax}` : ''}</>
            )}
            {item.type === 'shield' && `+${(item as any).ac || 2} AC`}
          </span>
        </div>
        <Button size="icon" onClick={onAdd} aria-label="Add"><Plus size={16} /></Button>
      </div>
      {tags?.length ? (
        <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {tags.join(' • ')}
        </div>
      ) : null}
    </div>
  )
}

function LoadoutRow({ item, onRemove }: { item: Equipment; onRemove: () => void }) {
  return (
    <div style={{ padding: 6, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {item.type === 'weapon' && <Sword size={16} />}
        {item.type === 'shield' && <Shield size={16} />}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {item.type === 'weapon' ? (item as any).dmg : item.type === 'armor' ? `AC ${(item as any).ac}` : item.type}
          </div>
          {item.type === 'armor' && (item as any).tags?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(item as any).tags.map((t: string) => <span key={t} style={{ padding: '1px 6px', borderRadius: 999, border: '1px solid #e2e8f0', fontSize: 10 }}>{t}</span>)}
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {(SUBACTIONS_BY_ITEM[(item as any).id] || []).map((s) => <span key={s} style={{ padding: '1px 6px', borderRadius: 999, background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: 11 }}>{s}</span>)}
        <Button size="sm" variant="ghost" onClick={onRemove} style={{ padding: '4px 6px' }}>Remove</Button>
      </div>
    </div>
  )
}

function ScoreBlock({ label, value }: { label: string; value: number }) {
  const pct = clamp((value / 5) * 100, 0, 100)
  return (
    <div style={{ padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{value.toFixed(2)}</div>
      <Progress value={pct} />
    </div>
  )
}

function ComparePanel({ race, classes, loadout }: { race: Race; classes: Array<{ klass: Klass; level: number; subclass?: Subclass }>; loadout: Equipment[] }) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <CardHeader><CardTitle><Info size={16} style={{ marginRight: 6 }} />Compare</CardTitle></CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => setOpen((v) => !v)}>{open ? 'Close' : 'Open'} Side‑by‑Side Compare</Button>
        {open ? (
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 600 }}>Race</div>
              <div style={{ fontSize: 14 }}>{race.name}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Speed {race.speed} ft</div>
              <div style={{ display: 'grid', gap: 4 }}>
                {(race.traits || []).map((t) => <div key={t.id} style={{ fontSize: 12 }}>• <span style={{ fontWeight: 600 }}>{t.name}:</span> {t.text}</div>)}
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 600 }}>Classes</div>
              <div style={{ display: 'grid', gap: 4, fontSize: 12, color: '#64748b' }}>
                {classes.map((c) => (
                  <div key={c.klass.id}>• {c.klass.name} {c.level}{c.subclass ? ` (${c.subclass.name})` : ''}</div>
                ))}
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 600 }}>Loadout</div>
              <div style={{ display: 'grid', gap: 4, fontSize: 14 }}>
                {loadout.map((i) => <div key={(i as any).id}>• {(i as any).name}</div>)}
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ClassManager(props: { classes: Array<{ klass: Klass; level: number; subclass?: Subclass }>; onChange: (v: Array<{ klass: Klass; level: number; subclass?: Subclass }>) => void }) {
  const [addOpen, setAddOpen] = useState(false)
  const addRef = useRef<HTMLDivElement | null>(null)
  const totalLevel = props.classes.reduce((s: number, c: { klass: Klass; level: number; subclass?: Subclass }) => s + c.level, 0)
  const maxTotal = 20
  const available: Klass[] = CLASSES.filter((k) => !props.classes.some((c) => c.klass.id === k.id))
  const canAdd = totalLevel < maxTotal && available.length > 0

  useEffect(() => {
    if (!addOpen) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setAddOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAddOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [addOpen])

  function setLevelAt(idx: number, next: number) {
    const other = totalLevel - props.classes[idx].level
    const clamped = clamp(next, 1, Math.max(1, Math.min(maxTotal - other, 20)))
    const out = props.classes.map((c, i) => (i === idx ? { ...c, level: clamped, subclass: c.subclass && clamped < (c.subclass?.unlockLevel || Infinity) ? undefined : c.subclass } : c))
    props.onChange(out)
  }
  function removeAt(idx: number) {
    const out = props.classes.filter((_, i) => i !== idx)
    props.onChange(out.length ? out : [{ klass: CLASSES[0], level: 1 }])
  }
  function addClass(k: Klass) {
    if (props.classes.some((c) => c.klass.id === k.id)) return
    const other = totalLevel
    if (other >= maxTotal) return
    props.onChange([...props.classes, { klass: k, level: 1 }])
    setAddOpen(false)
  }
  function setSubclass(idx: number, sc?: Subclass) {
    const out = props.classes.map((c, i) => (i === idx ? { ...c, subclass: sc } : c))
    props.onChange(out)
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: '#64748b' }}>Classes (Total Level: <strong>{totalLevel}</strong>)</div>
        <div ref={addRef} style={{ position: 'relative' }}>
          <Button size="sm" variant="outline" onClick={() => setAddOpen((v) => !v)} disabled={!canAdd}>Add Class</Button>
          {addOpen ? (
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 16px rgba(15,23,42,0.12)', zIndex: 20, minWidth: 220 }}>
              <div style={{ maxHeight: 240, overflowY: 'auto', display: 'grid' }}>
                {available.map((k: Klass) => (
                  <Button key={k.id} size="sm" variant="ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => addClass(k)}>
                    {k.name}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {props.classes.map((c: { klass: Klass; level: number; subclass?: Subclass }, idx: number) => (
          <div key={c.klass.id} style={{ padding: 8, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 600 }}>{c.klass.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Button size="icon" variant="outline" onClick={() => setLevelAt(idx, c.level - 1)}>−</Button>
                  <Pill>{c.level}</Pill>
                  <Button size="icon" variant="outline" onClick={() => setLevelAt(idx, c.level + 1)}>+</Button>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => removeAt(idx)}>Remove</Button>
            </div>
            {c.klass.subclasses?.length ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Subclass</div>
                {c.level < (c.klass.subclasses[0]?.unlockLevel || Infinity) ? (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Unlocks at level {Math.min(...c.klass.subclasses.map((s: Subclass) => s.unlockLevel))}</span>
                ) : (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {c.klass.subclasses.map((s: Subclass) => (
                      <Button
                        key={s.id}
                        size="sm"
                        variant={c.subclass?.id === s.id ? 'default' : 'outline'}
                        onClick={() => setSubclass(idx, s)}
                      >{s.name}</Button>
                    ))}
                    {c.subclass ? (
                      <Button size="sm" variant="ghost" onClick={() => setSubclass(idx, undefined)}>Clear</Button>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ))}

        {/* Placeholder for empty state */}
        {props.classes.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: 8, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'center', color: '#94a3b8' }}>
            No classes added yet. Use "Add Class" to start building your character.
          </div>
        )}
      </div>
    </div>
  )
}

function RaceSelector(props: { value: Race; onChange: (v: Race) => void }) {
  const [showHumanSubs, setShowHumanSubs] = useState(false)
  const [showElfSubs, setShowElfSubs] = useState(false)
  const humanBase = RACES.find(r => r.id === 'human')!
  const humanVar = RACES.find(r => r.id === 'human-variant')!
  const elfWood = RACES.find(r => r.id === 'elf-wood')!
  const elfHigh = RACES.find(r => r.id === 'elf-high')!
  const others = RACES.filter(r => !['human', 'human-variant', 'elf-wood', 'elf-high'].includes(r.id))
  const isHumanSelected = props.value.id === 'human' || props.value.id === 'human-variant'
  const isElfSelected = props.value.id === 'elf-wood' || props.value.id === 'elf-high'

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {/* Human group button */}
      <Button size="sm" variant={isHumanSelected ? 'default' : 'outline'} onClick={() => setShowHumanSubs((v) => !v)}>Human</Button>
      {showHumanSubs && (
        <>
          <Button size="sm" variant={props.value.id === 'human' ? 'default' : 'outline'} onClick={() => props.onChange(humanBase)}>Base</Button>
          <Button size="sm" variant={props.value.id === 'human-variant' ? 'default' : 'outline'} onClick={() => props.onChange(humanVar)}>Variant</Button>
        </>
      )}

      {/* Elf group button */}
      <Button size="sm" variant={isElfSelected ? 'default' : 'outline'} onClick={() => setShowElfSubs((v) => !v)}>Elf</Button>
      {showElfSubs && (
        <>
          <Button size="sm" variant={props.value.id === 'elf-wood' ? 'default' : 'outline'} onClick={() => props.onChange(elfWood)}>Wood</Button>
          <Button size="sm" variant={props.value.id === 'elf-high' ? 'default' : 'outline'} onClick={() => props.onChange(elfHigh)}>High</Button>
        </>
      )}

      {/* Other races remain direct buttons */}
      {others.map((r) => (
        <Button key={r.id} size="sm" variant={props.value.id === r.id ? 'default' : 'outline'} onClick={() => props.onChange(r)}>{r.name}</Button>
      ))}
    </div>
  )
}

export default Builder
