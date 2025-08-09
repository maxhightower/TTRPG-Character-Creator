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
  { id: 'elf', name: 'Elf (Wood)', asis: { dex: 2, wis: 1 }, speed: 35, traits: [ { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' }, { id: 'keen', name: 'Keen Senses', text: 'Proficiency in Perception.' } ] },
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
  { id: 'greataxe', name: 'Greataxe', type: 'weapon', group: 'martial', hands: 2, dmg: '1d12 slashing', tags: ['heavy', 'two‑handed'], grants: ['Melee Attack (Greataxe)'] },
  { id: 'shield', name: 'Shield', type: 'shield', ac: 2, hands: 1, tags: ['shield'], grants: ['Raise Shield'] },
  { id: 'leather', name: 'Leather Armor', type: 'armor', ac: 11, dexMax: Number.POSITIVE_INFINITY, tags: ['light'] },
  { id: 'breastplate', name: 'Breastplate', type: 'armor', ac: 14, dexMax: 2, tags: ['medium'] },
  { id: 'chain', name: 'Chain Mail', type: 'armor', ac: 16, dexMax: 0, reqStr: 13, tags: ['heavy'] },
  { id: 'longbow', name: 'Longbow', type: 'weapon', group: 'martial', hands: 2, dmg: '1d8 piercing', tags: ['heavy', 'two‑handed', 'ranged'], grants: ['Ranged Attack (Longbow)'] },
]

const SUBACTIONS_BY_ITEM: Record<string, string[]> = {
  greataxe: ['Melee Attack (Greataxe)'],
  longbow: ['Ranged Attack (Longbow)'],
  shield: ['Raise Shield'],
}

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

type AppState = {
  name: string
  race: Race
  classes: Array<{ klass: Klass; level: number; subclass?: Subclass }>
  abilities: Record<AbilityKey, number>
  loadout: Equipment[]
}

// ---------------- Main Component ----------------

export function Builder() {
  const [mode, setMode] = useState<'guided' | 'power'>('power')
  const [name, setName] = useState('New Hero')
  const [race, setRace] = useState<Race>(RACES[0])
  const [classes, setClasses] = useState<Array<{ klass: Klass; level: number; subclass?: Subclass }>>([
    { klass: CLASSES[0], level: 1 },
  ])
  const [abilities, setAbilities] = useState<Record<AbilityKey, number>>({ str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 8 })
  const [loadout, setLoadout] = useState<Equipment[]>([EQUIPMENT[0], EQUIPMENT[1]]) // greataxe + shield
  const [history, setHistory] = useState<string[]>([])
  const [future, setFuture] = useState<string[]>([])

  const state: AppState = { name, race, classes, abilities, loadout }
  const derived = useMemo(() => computeDerived(state), [state])
  const issues = useMemo(() => validateChoice(state), [state])
  const sim = useMemo(() => simulateReadiness(state), [state])

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
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                <Labeled label="Character Name">
                  <input value={name} onChange={(e) => setName(e.target.value)} style={inp} />
                </Labeled>

                <Labeled label="Race">
                  <Selector options={RACES} value={race} onChange={setRace} getLabel={(r) => r.name} />
                </Labeled>

                {/* Classes & Level manager */}
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

          {/* Equipment */}
          <Card>
            <CardHeader><CardTitle><Sword size={16} style={{ marginRight: 6 }} />Equipment & Loadout</CardTitle></CardHeader>
            <CardContent>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Catalog</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {EQUIPMENT.map((eq) => (
                      <ItemCard key={eq.id} item={eq} onAdd={() => setLoadout((l) => dedupe([...l, eq]))} />
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8, background: '#f8fafc', padding: 8, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Loadout</div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {loadout.length === 0 && (
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>Nothing equipped.</div>
                    )}
                    {loadout.map((eq) => (
                      <LoadoutRow key={eq.id} item={eq} onRemove={() => setLoadout((l) => l.filter((x) => (x as any).id !== (eq as any).id))} />
                    ))}
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
              </div>

              {/* Saving Throws */}
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Saving Throws</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {(['str','dex','con','int','wis','cha'] as AbilityKey[]).map((k) => (
                    <div key={k} style={{ padding: 8, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'grid', gap: 4 }}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b' }}>{k}</div>
                      <div><Pill>{derived.saves[k] >= 0 ? `+${derived.saves[k]}` : derived.saves[k]}</Pill></div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Ability Scores (incl. racial)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                  {(['str','dex','con','int','wis','cha'] as AbilityKey[]).map((k) => (
                    <div key={k} style={{ padding: 8, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b' }}>{k}</div>
                      <div style={{ fontWeight: 600 }}>{finalAbility(abilities, race)[k]}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>mod {mod(finalAbility(abilities, race)[k]) >= 0 ? '+' : ''}{mod(finalAbility(abilities, race)[k])}</div>
                    </div>
                  ))}
                </div>
              </div>

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
  return (
    <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 12, color: '#64748b' }}>Abilities</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
        {order.map((k) => (
          <div key={k} style={{ padding: 8, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b' }}>{k}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button size="icon" variant="outline" onClick={() => props.onChange({ ...props.abilities, [k]: clamp((props.abilities[k] || 10) - 1, 3, 20) })}>−</Button>
              <div style={{ fontWeight: 600, width: 24, textAlign: 'center' }}>{props.abilities[k] || 10}</div>
              <Button size="icon" variant="outline" onClick={() => props.onChange({ ...props.abilities, [k]: clamp((props.abilities[k] || 10) + 1, 3, 20) })}>+</Button>
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>mod {mod(final[k]) >= 0 ? '+' : ''}{mod(final[k])}</div>
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
    <div style={{ padding: 8, borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', display: 'grid', gap: 6 }}>
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
        <Button size="icon" variant="outline" onClick={onAdd} aria-label="Add"><Plus size={16} /></Button>
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
      </div>
    </div>
  )
}

export default Builder
