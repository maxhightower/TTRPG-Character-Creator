import React, { useCallback, useMemo, useRef, useState } from 'react'
import ReactFlow, { Background, Controls, MiniMap, addEdge, Handle, Position, useEdgesState, useNodesState, useReactFlow } from 'reactflow'
import 'reactflow/dist/style.css'
import type { AppState as BuilderState } from './Builder'
import { MONSTERS } from '../data/monsters'

// Fallback remover for nodes that were created before onDelete was injected
let globalRemoveNode: null | ((id: string) => void) = null

// (Slider component removed; stats are now display-only)

const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 }
const badge: React.CSSProperties = { padding: '2px 8px', borderRadius: 999, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12 }
const card: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 12, background: 'white' }
const btn: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }
const muted: React.CSSProperties = { color: '#64748b', fontSize: 12 }
const delBtn: React.CSSProperties = { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 999, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#334155', lineHeight: '20px', textAlign: 'center', zIndex: 10 }

// ----- Helpers & Game Math -----
const DICE_AVG: Record<string, number> = { d4: 2.5, d6: 3.5, d8: 4.5, d10: 5.5, d12: 6.5 }

function parseDice(dice: string): Array<{ n: number; die: string }> {
  const allowed = new Set(['4', '6', '8', '10', '12'])
  return dice
    .toLowerCase()
    .split('+')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const parts = chunk.split('d')
      const n = parseInt(parts[0], 10) || 0
      const size = parts[1] || '6'
      const die = allowed.has(size) ? `d${size}` : 'd6'
      return { n, die }
    })
}

function diceAverage(dice: string, opts?: { greatWeaponFighting?: boolean }) {
  const gwfBoost: Record<string, number> = { d4: 0.75, d6: 0.6667, d8: 0.625, d10: 0.6, d12: 0.5833 }
  const chunks = parseDice(dice)
  let avg = 0
  chunks.forEach(({ n, die }) => {
    const base = DICE_AVG[die] ?? 0
    const boost = opts?.greatWeaponFighting ? gwfBoost[die] ?? 0 : 0
    avg += n * (base + boost)
  })
  return avg
}

function proficiencyBonus(level: number) {
  if (level >= 17) return 6
  if (level >= 13) return 5
  if (level >= 9) return 4
  if (level >= 5) return 3
  return 2
}

function fighterAttacksPerRound(level: number) {
  if (level >= 20) return 4
  if (level >= 11) return 3
  if (level >= 5) return 2
  return 1
}

function abilityMod(score: number) { return Math.floor((score - 10) / 2) }
function clamp(x: number, a: number, b: number) { return Math.max(a, Math.min(b, x)) }
function advTransform(p: number, mode: 'normal' | 'adv' | 'dis'): number { if (mode === 'adv') return 1 - (1 - p) ** 2; if (mode === 'dis') return p ** 2; return p }

// ----- Presets -----
const FIGHTING_STYLES = [
  { id: 'defense', name: 'Defense (+1 AC)', tag: 'defense' },
  { id: 'dueling', name: 'Dueling (+2 dmg with 1H melee)', tag: 'melee-1h' },
  { id: 'great-weapon', name: 'Great Weapon Fighting (reroll 1-2)', tag: 'melee-2h' },
  { id: 'archery', name: 'Archery (+2 to hit)', tag: 'ranged' },
  { id: 'two-weapon', name: 'Two-Weapon Fighting (add mod to offhand)', tag: 'twf' },
] as const

// Enforce consistent types for presets
type Weapon = {
  id: string
  name: string
  dice: string
  versatile?: string
  type: 'slashing' | 'piercing' | 'bludgeoning'
  properties: string[]
  handed: '1h' | '2h'
  finesse: boolean
  ranged: boolean
  tags: string[]
}

const WEAPON_PRESETS: Weapon[] = [
  { id: 'longsword', name: 'Longsword', dice: '1d8', versatile: '1d10', type: 'slashing', properties: ['versatile'], handed: '1h', finesse: false, ranged: false, tags: [] },
  { id: 'greatsword', name: 'Greatsword', dice: '2d6', type: 'slashing', properties: ['heavy', 'two-handed'], handed: '2h', finesse: false, ranged: false, tags: ['gwm'] },
  { id: 'rapier', name: 'Rapier', dice: '1d8', type: 'piercing', properties: ['finesse'], handed: '1h', finesse: true, ranged: false, tags: [] },
  { id: 'shortsword', name: 'Shortsword', dice: '1d6', type: 'piercing', properties: ['finesse', 'light'], handed: '1h', finesse: true, ranged: false, tags: [] },
  { id: 'longbow', name: 'Longbow', dice: '1d8', type: 'piercing', properties: ['heavy', 'two-handed', 'ammunition'], handed: '2h', finesse: false, ranged: true, tags: ['ss'] },
  { id: 'handaxe', name: 'Handaxe', dice: '1d6', type: 'slashing', properties: ['light', 'thrown'], handed: '1h', finesse: false, ranged: false, tags: [] },
  { id: 'glaive', name: 'Glaive', dice: '1d10', type: 'slashing', properties: ['heavy', 'reach', 'two-handed'], handed: '2h', finesse: false, ranged: false, tags: ['gwm', 'pam'] },
  { id: 'halberd', name: 'Halberd', dice: '1d10', type: 'slashing', properties: ['heavy', 'reach', 'two-handed'], handed: '2h', finesse: false, ranged: false, tags: ['gwm', 'pam'] },
  { id: 'spear', name: 'Spear', dice: '1d6', versatile: '1d8', type: 'piercing', properties: ['thrown', 'versatile'], handed: '1h', finesse: false, ranged: false, tags: ['pam'] },
  { id: 'hcrossbow', name: 'Heavy Crossbow', dice: '1d10', type: 'piercing', properties: ['heavy', 'ammunition', 'loading', 'two-handed'], handed: '2h', finesse: false, ranged: true, tags: ['ss', 'cbe'] },
] as const

// ----- Node UI helpers -----
function PanelBox(props: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 260, background: '#f3f4f6', border: '1px solid #e2e8f0', borderRadius: 12 }}>
      <div style={{ padding: 10, borderBottom: '1px solid #e2e8f0', fontWeight: 600, fontSize: 13 }}>{props.title}</div>
      <div style={{ padding: 10, display: 'grid', gap: 8 }}>{props.children}</div>
    </div>
  )
}

// FighterStyleNode removed; style selection moved into ClassFeaturesNode

// Attack node (formerly Weapon node)
const AttackNode = ({ id, data }: any) => {
  const { deleteElements } = useReactFlow()
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    deleteElements({ nodes: [{ id }] })
  }, [deleteElements, id])
  const weapon = WEAPON_PRESETS.find((w) => w.id === data.weaponId) ?? WEAPON_PRESETS[0]
  const actionType: 'action' | 'bonus' | 'free' | 'reaction' = data.actionType || 'action'
  const attacks: number = data.attacks || 1 // retained for backward compatibility; no manual control now
  const grip: 'main' | 'off' | 'both' = data.grip || 'main'
  const set = (patch: any) => data.onChange(patch)
  if (data.collapsed) {
    return (
      <div style={{ position: 'relative' }}>
        <button className="nodrag nopan" style={delBtn}
          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault() }}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
          onClick={handleDelete} title="Delete">×</button>
        <Handle type="target" position={Position.Left} />
        <PanelBox title={`${actionType.toUpperCase()[0]}:${weapon.name}`}> 
          <div style={{ fontSize: 11, color: '#64748b' }}>{grip} hand • {weapon.dice}</div>
        </PanelBox>
        <Handle type="source" position={Position.Right} />
      </div>
    )
  }
  return (
    <div style={{ position: 'relative' }}>
      <button className="nodrag nopan" style={delBtn}
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onClick={handleDelete} title="Delete">×</button>
      <Handle type="target" position={Position.Left} />
      <PanelBox title={`${actionType === 'action' ? 'Action' : actionType === 'bonus' ? 'Bonus Action' : actionType === 'reaction' ? 'Reaction' : 'Free Action'}: ${weapon.name}`}>        
        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
          <span>Action Type</span>
          <select value={actionType} onChange={(e) => set({ actionType: e.target.value })} style={inp}>
            <option value="action">Action</option>
            <option value="bonus">Bonus Action</option>
            <option value="free">Free Action</option>
            <option value="reaction">Reaction</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
          <span>Attack Preset</span>
          <select value={weapon.id} onChange={(e) => set({ weaponId: e.target.value })} style={inp}>
            {WEAPON_PRESETS.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { k: 'main', label: 'Main Hand' },
            { k: 'off', label: 'Off Hand' },
            { k: 'both', label: 'Both Hands' },
          ] as const).map(opt => (
            <button key={opt.k} type="button" onClick={() => set({ grip: opt.k })}
              style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: grip === opt.k ? '#334155' : '#fff', color: grip === opt.k ? '#fff' : '#334155', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>{opt.label}</button>
          ))}
        </div>
        {actionType === 'action' ? (
          <div style={{ fontSize: 11, color: '#64748b' }}>Attacks per action auto-scaled by level.</div>
        ) : actionType === 'bonus' ? (
          <div style={{ fontSize: 11, color: '#64748b' }}>Bonus action off-hand attack limited to 1.</div>
        ) : actionType === 'reaction' ? (
          <div style={{ fontSize: 11, color: '#64748b' }}>Reaction attack assumed at most 1/round when triggered.</div>
        ) : (
          <div style={{ fontSize: 11, color: '#64748b' }}>Free action attack counted as 1 (homebrew).</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
          <div><strong>Dice:</strong> {weapon.dice}{weapon.versatile ? ` (${weapon.versatile} vers.)` : ''}</div>
          <div><strong>Type:</strong> {weapon.type}</div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {weapon.properties.map((p) => (<span key={p} style={badge}>{p}</span>))}
          </div>
        </div>
      </PanelBox>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function FeatNode({ id, data }: any) {
  const { deleteElements } = useReactFlow()
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    deleteElements({ nodes: [{ id }] })
  }, [deleteElements, id])
  if (data.collapsed) {
    const active: string[] = []
    if (data.gwm) active.push('GWM')
    if (data.ss) active.push('SS')
    if (data.pam) active.push('PAM')
    if (data.cbe) active.push('CBE')
    return (
      <div style={{ position: 'relative' }}>
        <button className="nodrag nopan" style={delBtn}
          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault() }}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
          onClick={handleDelete} title="Delete">×</button>
        <Handle type="target" position={Position.Left} />
        <PanelBox title="Feats">
          <div style={{ fontSize: 11, color: '#64748b' }}>{active.length ? active.join(', ') : 'None'}</div>
        </PanelBox>
        <Handle type="source" position={Position.Right} />
      </div>
    )
  }
  return (
    <div style={{ position: 'relative' }}>
      <button className="nodrag nopan" style={delBtn}
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onClick={handleDelete} title="Delete">×</button>
      <Handle type="target" position={Position.Left} />
      <PanelBox title="Feats">
        <label style={row}><input type="checkbox" checked={!!data.gwm} onChange={(e) => data.onChange({ gwm: e.target.checked })} /> Great Weapon Master</label>
        <label style={row}><input type="checkbox" checked={!!data.ss} onChange={(e) => data.onChange({ ss: e.target.checked })} /> Sharpshooter</label>
        <label style={row}><input type="checkbox" checked={!!data.pam} onChange={(e) => data.onChange({ pam: e.target.checked })} /> Polearm Master</label>
        <label style={row}><input type="checkbox" checked={!!data.cbe} onChange={(e) => data.onChange({ cbe: e.target.checked })} /> Crossbow Expert</label>
      </PanelBox>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

// Feature type options for per-feature configuration nodes
const FEATURE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'fighting-style', label: 'Fighting Style' },
  { value: 'sneak-attack', label: 'Sneak Attack' },
  { value: 'rage', label: 'Rage' },
  { value: 'smite', label: 'Divine Smite' },
  { value: 'hexblade', label: "Hexblade's Curse" },
  { value: 'crit-range', label: 'Expanded Crit Range' },
  { value: 'maneuvers', label: 'Battlemaster Maneuvers' },
  { value: 'brutal-critical', label: 'Brutal Critical' },
  { value: 'legacy-all', label: 'All (Legacy Aggregate)' },
]

function ClassFeaturesNode({ id, data }: any) {
  const { deleteElements } = useReactFlow()
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    deleteElements({ nodes: [{ id }] })
  }, [deleteElements, id])
  const level = data.level ?? 5
  const sneakDice = Math.ceil(level / 2)
  const rageBonus = level >= 16 ? 4 : level >= 9 ? 3 : level >= 3 ? 2 : 2
  const styleId: string = data.styleId || ''
  const critRange: number = data.critRange || 20 // 20 | 19 | 18
  const maneuversPerRound: number = data.maneuversPerRound || 0
  const maneuverDie: string = data.maneuverDie || 'd8'
  const brutalCritDice: number = data.brutalCritDice || 0
  const featureType: string = data.featureType || ''
  if (data.collapsed) {
    let summary = ''
    if (featureType === 'fighting-style') summary = styleId ? `Style: ${FIGHTING_STYLES.find(s=>s.id===styleId)?.name || styleId}` : 'Fighting Style'
    else if (featureType === 'sneak-attack') summary = `Sneak ${sneakDice}d6`
    else if (featureType === 'rage') summary = 'Rage'
    else if (featureType === 'smite') summary = 'Smite'
    else if (featureType === 'hexblade') summary = 'Hexblade Curse'
    else if (featureType === 'crit-range') summary = critRange === 20 ? 'Crit 20' : `Crit ${critRange}-20`
    else if (featureType === 'maneuvers') summary = maneuversPerRound ? `BM ${maneuversPerRound}×${maneuverDie}` : 'Maneuvers'
    else if (featureType === 'brutal-critical') summary = brutalCritDice ? `Brutal +${brutalCritDice}` : 'Brutal Critical'
    else {
      const tags: string[] = []
      if (styleId) tags.push(`Style:${styleId}`)
      if (data.sneak) tags.push(`Sneak ${sneakDice}d6`)
      if (data.rage) tags.push('Rage')
      if (data.smite) tags.push('Smite')
      if (critRange === 19) tags.push('Crit19')
      if (critRange === 18) tags.push('Crit18')
      if (data.hexblade) tags.push('Hexblade')
      if (maneuversPerRound) tags.push(`BM x${maneuversPerRound}`)
      if (brutalCritDice) tags.push(`Brutal+${brutalCritDice}`)
      summary = tags.join(', ')
    }
    return (
      <div style={{ position: 'relative' }}>
        <button className="nodrag nopan" style={delBtn}
          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault() }}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
          onClick={handleDelete} title="Delete">×</button>
        <Handle type="target" position={Position.Left} />
        <PanelBox title="Class Feature">
          <div style={{ fontSize: 11, color: '#64748b' }}>{summary || 'None'}</div>
        </PanelBox>
        <Handle type="source" position={Position.Right} />
      </div>
    )
  }
  const setFeatureType = (ft: string) => {
    if (ft === featureType) return
    // Reset only relevant data for clarity when switching
    const base: any = { featureType: ft }
    switch (ft) {
      case 'fighting-style': base.styleId = data.styleId || ''; break;
      case 'sneak-attack': base.sneak = true; break;
      case 'rage': base.rage = true; break;
      case 'smite': base.smite = true; base.smiteDice = data.smiteDice ?? 2; base.smitesPerRound = data.smitesPerRound ?? 1; break;
      case 'hexblade': base.hexblade = true; break;
      case 'crit-range': base.critRange = data.critRange || 20; break;
      case 'maneuvers': base.maneuversPerRound = data.maneuversPerRound ?? 1; base.maneuverDie = data.maneuverDie || 'd8'; break;
      case 'brutal-critical': base.brutalCritDice = data.brutalCritDice ?? 1; break;
      case 'legacy-all': default: /* keep existing flags */ break;
    }
    data.onChange(base)
  }
  return (
    <div style={{ position: 'relative' }}>
      <button className="nodrag nopan" style={delBtn}
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onClick={handleDelete} title="Delete">×</button>
      <Handle type="target" position={Position.Left} />
      <PanelBox title="Class Feature">
        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
          <span>Feature Type</span>
          <select value={featureType || ''} onChange={(e)=> setFeatureType(e.target.value)} style={inp}>
            <option value="">(select feature)</option>
            {FEATURE_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </label>
        {featureType === 'fighting-style' && (
          <>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
              <span>Fighting Style</span>
              <select value={styleId} onChange={(e) => data.onChange({ styleId: e.target.value })} style={inp}>
                <option value="">(none)</option>
                {FIGHTING_STYLES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            {styleId && <div style={{ fontSize: 11, color: '#64748b' }}>Active: {FIGHTING_STYLES.find(s=>s.id===styleId)?.name}</div>}
          </>
        )}
        {featureType === 'hexblade' && <div style={muted}>Hexblade's Curse: +Prof bonus damage on each hit.</div>}
        {featureType === 'crit-range' && (
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#475569' }}>Crit Range
            <select value={critRange} onChange={(e)=> data.onChange({ critRange: Number(e.target.value) })} style={inp}>
              <option value={20}>20</option>
              <option value={19}>19-20</option>
              <option value={18}>18-20</option>
            </select>
          </label>
        )}
        {featureType === 'brutal-critical' && (
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#475569' }}>Brutal Crit Dice
            <input type="range" min={0} max={3} step={1} value={brutalCritDice} onChange={(e)=> data.onChange({ brutalCritDice: Number(e.target.value) })} />
            {brutalCritDice ? <span style={{ fontSize: 11, color: '#64748b' }}>Adds {brutalCritDice} weapon die on crit (melee only).</span> : null}
          </label>
        )}
        {featureType === 'maneuvers' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#475569' }}>Maneuver Die
              <select value={maneuverDie} onChange={(e)=> data.onChange({ maneuverDie: e.target.value })} style={inp}>
                {['d6','d8','d10','d12'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#475569' }}>Maneuvers/Round
              <input type="number" min={0} max={6} value={maneuversPerRound} onChange={(e)=> data.onChange({ maneuversPerRound: Math.max(0, Number(e.target.value)||0) })} style={inp} />
            </label>
            {maneuversPerRound ? <div style={{ fontSize: 11, color: '#64748b', gridColumn: '1 / -1' }}>Battlemaster dice assumed on action attacks.</div> : null}
          </div>
        )}
        {featureType === 'sneak-attack' && <div style={muted}>Approx: {sneakDice}d6 once/turn on hit.</div>}
        {featureType === 'rage' && <div style={muted}>+{rageBonus} melee damage per hit.</div>}
        {featureType === 'smite' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
            <label style={{ fontSize: 12, color: '#475569', display:'grid', gap:4 }}>Spell Slot Level
              <select value={data.smiteSlotLevel || 1} onChange={(e)=> data.onChange({ smiteSlotLevel: Number(e.target.value) })} style={inp}>
                {[1,2,3,4,5].map(l => <option key={l} value={l}>Level {l}</option>)}
              </select>
            </label>
            <label style={{ ...row, fontSize: 12 }}>
              <input type="checkbox" checked={!!data.smiteUndeadFiend} onChange={(e)=> data.onChange({ smiteUndeadFiend: e.target.checked })} /> Target is Undead/Fiend
            </label>
            <div style={{ fontSize: 11, color:'#64748b' }}>Dice: {Math.min(5, (data.smiteSlotLevel ? data.smiteSlotLevel + 1 : 2)) + (data.smiteUndeadFiend ? 1 : 0)}d8 (auto; +1d8 vs undead/fiend)</div>
          </div>
        )}
        {featureType === 'legacy-all' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>Legacy aggregate mode shows all toggles (deprecated).</div>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
              <span>Fighting Style</span>
              <select value={styleId} onChange={(e) => data.onChange({ styleId: e.target.value })} style={inp}>
                <option value="">(none)</option>
                {FIGHTING_STYLES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label style={row}><input type="checkbox" checked={!!data.hexblade} onChange={(e)=> data.onChange({ hexblade: e.target.checked })} /> Hexblade's Curse</label>
            <label style={row}><input type="checkbox" checked={!!data.sneak} onChange={(e) => data.onChange({ sneak: e.target.checked })} /> Rogue Sneak Attack</label>
            {data.sneak && <div style={muted}>Approx: {sneakDice}d6 once/turn on hit</div>}
            <label style={row}><input type="checkbox" checked={!!data.rage} onChange={(e) => data.onChange({ rage: e.target.checked })} /> Barbarian Rage</label>
            {data.rage && <div style={muted}>+{rageBonus} melee damage per hit</div>}
            <label style={row}><input type="checkbox" checked={!!data.smite} onChange={(e) => data.onChange({ smite: e.target.checked })} /> Paladin Divine Smite</label>
            {data.smite && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                <label style={{ fontSize: 12, color: '#475569', display:'grid', gap:4 }}>Slot Level
                  <select value={data.smiteSlotLevel || 1} onChange={(e)=> data.onChange({ smiteSlotLevel: Number(e.target.value) })} style={inp}>
                    {[1,2,3,4,5].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </label>
                <label style={{ ...row, fontSize: 12 }}>
                  <input type="checkbox" checked={!!data.smiteUndeadFiend} onChange={(e)=> data.onChange({ smiteUndeadFiend: e.target.checked })} /> Undead/Fiend
                </label>
                <div style={{ fontSize: 11, color:'#64748b' }}>Dice: {Math.min(5, (data.smiteSlotLevel ? data.smiteSlotLevel + 1 : 2)) + (data.smiteUndeadFiend ? 1 : 0)}d8 (auto; 1 smite/round)</div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#475569' }}>Crit Range
                <select value={critRange} onChange={(e)=> data.onChange({ critRange: Number(e.target.value) })} style={inp}>
                  <option value={20}>20</option>
                  <option value={19}>19-20</option>
                  <option value={18}>18-20</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#475569' }}>Brutal Crit Dice
                <input type="range" min={0} max={3} step={1} value={brutalCritDice} onChange={(e)=> data.onChange({ brutalCritDice: Number(e.target.value) })} />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#475569' }}>Maneuver Die
                <select value={maneuverDie} onChange={(e)=> data.onChange({ maneuverDie: e.target.value })} style={inp}>
                  {['d6','d8','d10','d12'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#475569' }}>Maneuvers/Round
                <input type="number" min={0} max={6} value={maneuversPerRound} onChange={(e)=> data.onChange({ maneuversPerRound: Math.max(0, Number(e.target.value)||0) })} style={inp} />
              </label>
            </div>
            {maneuversPerRound ? <div style={muted}>Battlemaster dice assumed on action attacks.</div> : null}
            {brutalCritDice ? <div style={muted}>Adds {brutalCritDice} weapon die on crit (melee only).</div> : null}
          </div>
        )}
        {!featureType && <div style={{ fontSize: 11, color: '#64748b' }}>Select a feature type to configure.</div>}
      </PanelBox>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function BuffsNode({ id, data }: any) {
  const { deleteElements } = useReactFlow()
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    deleteElements({ nodes: [{ id }] })
  }, [deleteElements, id])
  if (data.collapsed) {
    const tags: string[] = []
    if (data.bless) tags.push('Bless')
    if (data.d6onhit) tags.push('+1d6')
    return (
      <div style={{ position: 'relative' }}>
        <button className="nodrag nopan" style={delBtn}
          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault() }}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
          onClick={handleDelete} title="Delete">×</button>
        <Handle type="target" position={Position.Left} />
        <PanelBox title="Buffs">
          <div style={{ fontSize: 11, color: '#64748b' }}>{tags.length ? tags.join(', ') : 'None'}</div>
        </PanelBox>
        <Handle type="source" position={Position.Right} />
      </div>
    )
  }
  return (
    <div style={{ position: 'relative' }}>
      <button className="nodrag nopan" style={delBtn}
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onClick={handleDelete} title="Delete">×</button>
      <Handle type="target" position={Position.Left} />
      <PanelBox title="Buffs & Rider Damage">
        <label style={row}><input type="checkbox" checked={!!data.bless} onChange={(e) => data.onChange({ bless: e.target.checked })} /> Bless (≈ +2.5 to hit)</label>
        <label style={row}><input type="checkbox" checked={!!data.d6onhit} onChange={(e) => data.onChange({ d6onhit: e.target.checked })} /> Hex / Hunter's Mark (+1d6 on hit)</label>
      </PanelBox>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function OutputNode({ id, data }: any) {
  const { deleteElements } = useReactFlow()
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    deleteElements({ nodes: [{ id }] })
  }, [deleteElements, id])
  const { summary } = data
  if (data.collapsed) {
    return (
      <div style={{ position: 'relative' }}>
        <button className="nodrag nopan" style={delBtn}
          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault() }}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
          onClick={handleDelete} title="Delete">×</button>
        <Handle type="target" position={Position.Left} />
        <PanelBox title="DPR Output">
          {summary ? (
            <div style={{ fontSize: 11, color: '#64748b' }}>DPR {summary.dpr.toFixed(1)}</div>
          ) : <div style={{ fontSize: 11, color: '#64748b' }}>No data</div>}
        </PanelBox>
        <Handle type="source" position={Position.Right} />
      </div>
    )
  }
  return (
    <div style={{ position: 'relative' }}>
      <button className="nodrag nopan" style={delBtn}
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onClick={handleDelete} title="Delete">×</button>
      <Handle type="target" position={Position.Left} />
      <PanelBox title="DPR Output">
        {summary ? (
          <div style={{ fontSize: 14, display: 'grid', gap: 4 }}>
            <div><span style={muted}>To-hit:</span> <strong>+{summary.toHit}</strong></div>
            <div><span style={muted}>Mode:</span> <strong>{summary.advMode}</strong></div>
            <div><span style={muted}>Hit chance vs AC {summary.targetAC}:</span> <strong>{Math.round(summary.pHit * 100)}%</strong></div>
            <div><span style={muted}>Crit chance:</span> <strong>{Math.round(summary.pCrit * 100)}%</strong></div>
            <div><span style={muted}>Attacks/round:</span> <strong>{summary.attacks}</strong></div>
            <div style={{ borderTop: '1px solid #e2e8f0', margin: '8px 0' }} />
            <div style={{ fontSize: 18 }}>DPR: <strong>{summary.dpr.toFixed(2)}</strong></div>
            {summary.notes?.length ? (
              <ul style={{ marginTop: 6, color: '#475569', paddingLeft: 18 }}>
                {summary.notes.map((n: string, i: number) => (<li key={i} style={{ fontSize: 12 }}>{n}</li>))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#64748b' }}>Connect Attack / Feats / Features / Buffs nodes to compute DPR.</div>
        )}
      </PanelBox>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

const nodeTypes = { attack: AttackNode, weapon: AttackNode, feats: FeatNode, features: ClassFeaturesNode, buffs: BuffsNode, output: OutputNode }

export function NodeOptimizer(props: { character?: BuilderState; derived?: any }) {
  // Global knobs
  const [level, setLevel] = useState(5)
  const [str, setStr] = useState(16)
  const [dex, setDex] = useState(14)
  const [targetAC, setTargetAC] = useState(16)
  const [advMode, setAdvMode] = useState<'normal' | 'adv' | 'dis'>('normal')
  const [useVersatile, setUseVersatile] = useState(false)
  const [resist, setResist] = useState<'none' | 'slashing' | 'piercing' | 'bludgeoning'>('none')
  const [vuln, setVuln] = useState<'none' | 'slashing' | 'piercing' | 'bludgeoning'>('none')
  // Target monster selection / manual override
  const [monsterId, setMonsterId] = useState<string>('')
  const [manualTarget, setManualTarget] = useState<boolean>(true)
  const [targetAbilities, setTargetAbilities] = useState<{str:number;dex:number;con:number;int:number;wis:number;cha:number}>({str:10,dex:10,con:10,int:10,wis:10,cha:10})
  const [targetSaveProfs, setTargetSaveProfs] = useState<{str:boolean;dex:boolean;con:boolean;int:boolean;wis:boolean;cha:boolean}>({str:false,dex:false,con:false,int:false,wis:false,cha:false})
  const selectedMonster = useMemo(() => MONSTERS.find(m => m.id === monsterId), [monsterId])
  React.useEffect(() => {
    if (!manualTarget && selectedMonster) {
      setTargetAC(selectedMonster.ac)
      // Map resist/vuln if physical present
      if (selectedMonster.resistances?.includes('slashing')) setResist('slashing')
      else if (selectedMonster.resistances?.includes('piercing')) setResist('piercing')
      else if (selectedMonster.resistances?.includes('bludgeoning')) setResist('bludgeoning')
      else setResist('none')
      if (selectedMonster.vulnerabilities?.includes('slashing')) setVuln('slashing')
      else if (selectedMonster.vulnerabilities?.includes('piercing')) setVuln('piercing')
      else if (selectedMonster.vulnerabilities?.includes('bludgeoning')) setVuln('bludgeoning')
      else setVuln('none')
      setTargetAbilities({...selectedMonster.abilities})
  // Reset save profs on monster load (could be extended to monster data if available)
  setTargetSaveProfs({str:false,dex:false,con:false,int:false,wis:false,cha:false})
    }
  }, [manualTarget, selectedMonster])

  // Sync from Builder when available
  React.useEffect(() => {
    const builderLevel = props.derived?.totalLevel
    if (typeof builderLevel === 'number' && builderLevel > 0) setLevel(builderLevel)
  }, [props.derived?.totalLevel])
  React.useEffect(() => {
    if (props.character?.abilities?.str) setStr(props.character.abilities.str)
    if (props.character?.abilities?.dex) setDex(props.character.abilities.dex)
  }, [props.character?.abilities?.str, props.character?.abilities?.dex])

  const effLevel = props.derived?.totalLevel ?? level
  const prof = useMemo(() => proficiencyBonus(effLevel), [effLevel])
  const attacksBase = useMemo(() => fighterAttacksPerRound(effLevel), [effLevel])

  // Initial graph (handlers are seeded later)
  const initialNodes = useMemo(() => [] as any[], [])

  const [nodes, setNodes, baseOnNodesChange] = useNodesState<any>(initialNodes as any)
  const [edges, setEdges, baseOnEdgesChange] = useEdgesState([])

  // History management (placed after nodes/edges to avoid TDZ)
  const historyRef = useRef<{ past: { nodes: any[]; edges: any[] }[]; future: { nodes: any[]; edges: any[] }[]; suppress: boolean; lastTs: number }>({ past: [], future: [], suppress: false, lastTs: 0 })
  const snapshot = useCallback(() => {
    if (historyRef.current.suppress) return
    const now = Date.now()
    if (now - historyRef.current.lastTs < 50) return
    historyRef.current.lastTs = now
    const deepNodes = JSON.parse(JSON.stringify(nodes))
    const deepEdges = JSON.parse(JSON.stringify(edges))
    historyRef.current.past.push({ nodes: deepNodes, edges: deepEdges })
    historyRef.current.future = []
  }, [nodes, edges])
  const undo = useCallback(() => {
    const { past, future } = historyRef.current
    if (past.length === 0) return
    const present = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }
    const prev = past.pop()!
    future.push(present)
    historyRef.current.suppress = true
    setNodes(prev.nodes as any)
    setEdges(prev.edges as any)
    historyRef.current.suppress = false
  }, [nodes, edges, setNodes, setEdges])
  const redo = useCallback(() => {
    const { past, future } = historyRef.current
    if (future.length === 0) return
    const present = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }
    const next = future.pop()!
    past.push(present)
    historyRef.current.suppress = true
    setNodes(next.nodes as any)
    setEdges(next.edges as any)
    historyRef.current.suppress = false
  }, [nodes, edges, setNodes, setEdges])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (ctrl && key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if ((ctrl && key === 'y') || (ctrl && key === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  // Wrap change handlers to snapshot before applying
  const onNodesChange = useCallback((changes: any) => { snapshot(); baseOnNodesChange(changes) }, [snapshot, baseOnNodesChange])
  const onEdgesChange = useCallback((changes: any) => { snapshot(); baseOnEdgesChange(changes) }, [snapshot, baseOnEdgesChange])

  // Update helper now that history is ready
  const updateNodeData = useCallback((id: string, patch: any) => {
    snapshot()
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
  }, [snapshot, setNodes])

  // Seed missing onChange handlers (idempotent)
  React.useEffect(() => {
    setNodes((nds: any[]) => {
      const need = nds.some((n) => !n.data?.onChange)
      return need ? nds.map((n) => (n.data?.onChange ? n : { ...n, data: { ...n.data, onChange: (p: any) => updateNodeData(n.id, p) } })) : nds
    })
  }, [updateNodeData, setNodes])

  // Remove node + its connected edges
  const removeNode = useCallback((id: string) => {
    snapshot()
    setNodes((nds: any[]) => nds.filter((n) => n.id !== id))
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
  }, [setNodes, setEdges])

  // Expose remover as a fallback for nodes rendered before onDelete was injected
  React.useEffect(() => {
    globalRemoveNode = removeNode
    return () => { if (globalRemoveNode === removeNode) globalRemoveNode = null }
  }, [removeNode])

  // Seed existing nodes with onDelete handler (idempotent)
  React.useEffect(() => {
    setNodes((nds: any[]) => {
      const need = nds.some((n) => !n.data?.onDelete)
      return need ? nds.map((n) => (n.data?.onDelete ? n : { ...n, data: { ...n.data, onDelete: removeNode } })) : nds
    })
  }, [removeNode, setNodes])

  const onConnect = useCallback((params: any) => { snapshot(); setEdges((eds) => addEdge(params, eds)) }, [snapshot, setEdges])

  const computeGraph = useCallback(() => {
    const map = new Map(nodes.map((n) => [n.id, n] as const))
    const nextNodes = nodes.map((n) => {
      if (n.type !== 'output') return n
      const incoming = edges.filter((e) => e.target === n.id)
      const weaponNodes = incoming.map((e) => map.get(e.source)).filter((x) => x && (x.type === 'attack' || x.type === 'weapon')) as any[]
      const featNode = incoming.map((e) => map.get(e.source)).find((x) => x?.type === 'feats') as any
      const featureNodes = incoming.map((e) => map.get(e.source)).filter((x) => x?.type === 'features') as any[]
      const buffsNode = incoming.map((e) => map.get(e.source)).find((x) => x?.type === 'buffs') as any
      if (!weaponNodes.length) return { ...n, data: { ...n.data, summary: null } }
      // Aggregate feature nodes (supports new per-feature nodes & legacy-all)
  const agg: any = { level: effLevel, styleId: undefined, sneak: false, rage: false, smite: false, smiteSlotLevel: 0, smiteUndeadFiend: false, hexblade: false, critRange: 20, maneuversPerRound: 0, maneuverDie: 'd8', brutalCritDice: 0 }
      const dieOrder = ['d6','d8','d10','d12']
      featureNodes.forEach(fn => {
        const d = fn.data || {}
        const ft = d.featureType || 'legacy-all'
        if (ft === 'legacy-all') {
          if (d.styleId && !agg.styleId) agg.styleId = d.styleId
          if (d.sneak) agg.sneak = true
          if (d.rage) agg.rage = true
          if (d.smite) { agg.smite = true; 
            if (d.smiteSlotLevel) { agg.smiteSlotLevel = Math.max(agg.smiteSlotLevel, d.smiteSlotLevel) }
            if (d.smiteUndeadFiend) { agg.smiteUndeadFiend = true }
          }
          if (d.hexblade) agg.hexblade = true
          if (d.critRange) agg.critRange = Math.min(agg.critRange, d.critRange)
          if (d.maneuversPerRound) { agg.maneuversPerRound += d.maneuversPerRound; if (dieOrder.indexOf(d.maneuverDie) > dieOrder.indexOf(agg.maneuverDie)) agg.maneuverDie = d.maneuverDie }
          if (d.brutalCritDice) agg.brutalCritDice = Math.max(agg.brutalCritDice, d.brutalCritDice)
        } else if (ft === 'fighting-style') { if (d.styleId && !agg.styleId) agg.styleId = d.styleId }
        else if (ft === 'sneak-attack') agg.sneak = true
        else if (ft === 'rage') agg.rage = true
  else if (ft === 'smite') { agg.smite = true; if (d.smiteSlotLevel) agg.smiteSlotLevel = Math.max(agg.smiteSlotLevel, d.smiteSlotLevel); if (d.smiteUndeadFiend) agg.smiteUndeadFiend = true }
        else if (ft === 'hexblade') agg.hexblade = true
        else if (ft === 'crit-range') agg.critRange = Math.min(agg.critRange, d.critRange || 20)
        else if (ft === 'maneuvers') { agg.maneuversPerRound += d.maneuversPerRound || 0; if (dieOrder.indexOf(d.maneuverDie) > dieOrder.indexOf(agg.maneuverDie)) agg.maneuverDie = d.maneuverDie }
        else if (ft === 'brutal-critical') agg.brutalCritDice = Math.max(agg.brutalCritDice, d.brutalCritDice || 0)
      })
      const styleId = agg.styleId
      const critRange = agg.critRange
      const feats = featNode?.data || {}
      // Derive smite dice from slot level (1->2d8,2->3d8,3->4d8,4->5d8,5->5d8 per PHB cap)
      if (agg.smiteSlotLevel) {
        const slot = clamp(agg.smiteSlotLevel,1,5)
        agg.smiteDice = Math.min(5, slot + 1)
      }
      const features = agg
      const buffs = buffsNode?.data || {}
      const notes: string[] = []
      const strMod = props.derived?.strMod ?? abilityMod(str)
      const dexMod = props.derived?.dexMod ?? abilityMod(dex)

      // Aggregate across weapon sequences
      let totalAttacks = 0
      let totalDPR = 0
      let maxToHit = -Infinity
      const ac = targetAC
      const sequencePHits: number[] = []
      const sequencePCrits: number[] = []
      const qualifyingSneakPHits: number[] = []
      let sneakDice = features.sneak ? Math.min(10, Math.ceil(effLevel / 2)) : 0
      let sneakAdded = false

      weaponNodes.forEach((wn, idx) => {
        const weapon = WEAPON_PRESETS.find((w) => w.id === wn.data.weaponId) ?? WEAPON_PRESETS[0]
        const actionType: 'action' | 'bonus' | 'free' | 'reaction' = wn.data.actionType || (idx === 0 ? 'action' : 'bonus')
        const attacksForSeq = actionType === 'action'
          ? (wn.data.attacks || fighterAttacksPerRound(effLevel))
          : 1
        const grip: 'main' | 'off' | 'both' = wn.data.grip || 'main'
        const isRanged = weapon.ranged === true
        const usesDex = isRanged || weapon.finesse
  let toHit = prof + (usesDex ? dexMod : strMod)
  if (styleId === 'archery' && isRanged) { toHit += 2; if (idx === 0) notes.push('Archery: +2 to hit applied.') }
  if (styleId === 'defense' && idx === 0) { notes.push('Defense: +1 AC (not in DPR).') }
        if (buffs.bless) { toHit += 2.5; if (idx === 0) notes.push('Bless: +≈2.5 to hit EV.') }
        const qualifiesGWM = weapon.tags?.includes('gwm')
        const qualifiesSS = weapon.tags?.includes('ss')
        if (feats.gwm && qualifiesGWM && !isRanged) { toHit -= 5; if (idx === 0) notes.push('GWM: -5 to hit/+10 dmg.') }
        if (feats.ss && qualifiesSS && isRanged) { toHit -= 5; if (idx === 0) notes.push('Sharpshooter: -5 to hit/+10 dmg.') }
  const basePHit = clamp((21 + toHit - ac) / 20, 0, 1)
  const basePCritRaw = (21 - critRange) / 20 // e.g. critRange 20 => 1/20
  const basePCrit = basePCritRaw
        const pHit = advTransform(basePHit, advMode)
        const pCrit = advTransform(basePCrit, advMode)
        sequencePHits.push(pHit)
        sequencePCrits.push(pCrit)
        let dice = weapon.dice
        const usingTwoHands = (grip === 'both') || (weapon.handed === '2h')
        if (weapon.versatile && (useVersatile || usingTwoHands)) {
          dice = weapon.versatile
          if (idx === 0 && grip === 'both') notes.push('Two-handed / versatile die used.')
        }
  const gwf = styleId === 'great-weapon' && usingTwoHands && !isRanged && (weapon.handed === '2h' || !!weapon.versatile)
        const baseDieAvg = diceAverage(dice, { greatWeaponFighting: gwf })
        if (gwf && idx === 0) { notes.push('Great Weapon Fighting: reroll 1s & 2s estimated.') }
        const abilityModVal = usesDex ? dexMod : strMod
        const isOffhand = grip === 'off'
        const includeAbilityMod = !isOffhand || styleId === 'two-weapon'
        if (isOffhand && actionType !== 'bonus' && idx === 0) notes.push('Off-hand flagged outside bonus action (verify).')
  let flatDamageBonus = 0
  // Dueling: +2 damage when wielding a melee weapon in one hand (we don't enforce shield/no other weapon logic here)
  if (styleId === 'dueling' && !isRanged && weapon.handed === '1h' && grip !== 'both') { flatDamageBonus += 2; if (idx === 0) notes.push('Dueling: +2 damage (1H melee).') }
        if (feats.gwm && qualifiesGWM && !isRanged) { flatDamageBonus += 10 }
        if (feats.ss && qualifiesSS && isRanged) { flatDamageBonus += 10 }
  if (styleId === 'two-weapon' && isOffhand && includeAbilityMod && idx === 0) { notes.push('Two-Weapon Fighting: ability mod added to off-hand.') }
  if (features.hexblade) { flatDamageBonus += prof; if (idx === 0) notes.push(`Hexblade's Curse: +${prof} dmg per hit.`) }
        const riderOnHitAvg = buffs.d6onhit ? DICE_AVG.d6 : 0
        if (buffs.d6onhit && idx === 0) notes.push("Hex/Hunter's Mark: +1d6 on hit.")
        const rageBonus = features.rage ? (effLevel >= 16 ? 4 : effLevel >= 9 ? 3 : 2) : 0
        if (rageBonus && !isRanged) { flatDamageBonus += rageBonus; if (idx === 0) notes.push(`Rage: +${rageBonus} melee damage per hit.`) }
        const critDiceAvg = diceAverage(dice, { greatWeaponFighting: gwf })
        const perAttackBase = baseDieAvg + (includeAbilityMod ? abilityModVal : 0) + flatDamageBonus + riderOnHitAvg
        const dmgPerAttack = (pHit - pCrit) * perAttackBase + pCrit * (perAttackBase + critDiceAvg)
        let seqDPR = dmgPerAttack * attacksForSeq
        // Brutal Critical extra dice (melee only)
        if (features.brutalCritDice && !isRanged) {
          // Determine single weapon die size (e.g. 2d6 -> d6)
          const dieMatch = weapon.dice.match(/d(\d+)/)
          const dieFace = dieMatch ? `d${dieMatch[1]}` : 'd6'
          const extraAvg = diceAverage(`${features.brutalCritDice}${dieFace}`, { greatWeaponFighting: gwf })
          seqDPR += pCrit * extraAvg * attacksForSeq
          if (idx === 0) notes.push(`Brutal Critical: +${features.brutalCritDice}${dieFace} on crit.`)
        }
        // Smite only on action sequences (simplified)
        if (features.smite && actionType === 'action') {
          const baseDice = features.smiteDice ? features.smiteDice : 2
          const smiteDice = baseDice + (features.smiteUndeadFiend ? 1 : 0)
          const pNonCritHit = Math.max(pHit - pCrit, 0)
          const d8avg = DICE_AVG.d8
          const smiteAvg = (pNonCritHit * (smiteDice * d8avg)) + (pCrit * (smiteDice * 2 * d8avg))
          seqDPR += smiteAvg
          if (idx === 0) notes.push(`Smite: ${smiteDice}d8 (slot L${features.smiteSlotLevel || 1}${features.smiteUndeadFiend ? '+vs undead/fiend' : ''}).`)
        }
        // Battlemaster maneuvers (apply once per round on action sequence only, using average hit chances of this sequence)
        if (features.maneuversPerRound && features.maneuversPerRound > 0 && actionType === 'action' && idx === 0) {
          const pNonCritHit = Math.max(pHit - pCrit, 0)
          const dieAvg = DICE_AVG[features.maneuverDie || 'd8'] || DICE_AVG.d8
          const maneuverAvg = features.maneuversPerRound * ((pNonCritHit * dieAvg) + (pCrit * dieAvg * 2))
          seqDPR += maneuverAvg
          notes.push(`Maneuvers: +${(maneuverAvg).toFixed(2)} DPR (${features.maneuversPerRound}× ${features.maneuverDie}).`)
        }
        totalAttacks += attacksForSeq
        totalDPR += seqDPR
        maxToHit = Math.max(maxToHit, toHit)
        // Sneak qualification (finesse or ranged)
        if (weapon.finesse || isRanged) {
          const pNonCritHit = Math.max(pHit - pCrit, 0)
          const pAnyHitSeq = 1 - Math.pow(1 - pNonCritHit, attacksForSeq)
          qualifyingSneakPHits.push(pAnyHitSeq)
        }
      })

      // Sneak attack applied once if any qualifying sequence hits
      if (sneakDice) {
        const pNoSneak = qualifyingSneakPHits.reduce((acc, p) => acc * (1 - p), 1)
        const pSneak = 1 - pNoSneak
        const sneakAvg = pSneak * diceAverage(`${sneakDice}d6`)
        totalDPR += sneakAvg
        if (qualifyingSneakPHits.length) notes.push('Sneak Attack applied once.')
      }

      // Resistance / vulnerability (apply to weapon damage only; already included entire DPR simplistic)
      // For simplicity apply after aggregation if all weapons share type; otherwise skip (future enhancement)
  const distinctTypes = new Set(weaponNodes.map(w => (WEAPON_PRESETS.find(p => p.id === w.data.weaponId) || WEAPON_PRESETS[0]).type))
      if (distinctTypes.size === 1) {
        const onlyType = Array.from(distinctTypes)[0]
        if (resist !== 'none' && resist === onlyType) { totalDPR *= 0.5; notes.push(`Target resists ${onlyType} damage.`) }
        if (vuln !== 'none' && vuln === onlyType) { totalDPR *= 2; notes.push(`Target vulnerable to ${onlyType} damage.`) }
      }

      // Use average pHit/pCrit of first sequence for display; could be improved
      const pHitDisplay = sequencePHits[0] ?? 0
      const pCritDisplay = sequencePCrits[0] ?? 0.05
      return { ...n, data: { ...n.data, summary: { toHit: Math.round(maxToHit), advMode, targetAC: ac, pHit: pHitDisplay, pCrit: pCritDisplay, attacks: totalAttacks, dpr: totalDPR, notes } } }
    })

    historyRef.current.suppress = true
    setNodes(nextNodes as any)
    historyRef.current.suppress = false
  }, [nodes, edges, effLevel, str, dex, targetAC, useVersatile, advMode, resist, vuln, setNodes, prof, props.derived?.strMod, props.derived?.dexMod])

  React.useEffect(() => { computeGraph() }, [nodes.length, JSON.stringify(edges), effLevel, str, dex, targetAC, useVersatile, advMode, resist, vuln, computeGraph])

  // ---------------- Persistence ----------------
  const STORAGE_KEY = 'dpr-optimizer-state-v1'
  // Migration: consolidate legacy fighterStyle nodes into features node
  const migrateStyleNodes = useCallback((rawNodes: any[], rawEdges: any[]) => {
    const nodesCopy = rawNodes.map(n => ({ ...n }))
    let edgesCopy = rawEdges.map(e => ({ ...e }))
    const styleNodes = nodesCopy.filter(n => n.type === 'fighterStyle')
    if (!styleNodes.length) return { nodes: nodesCopy, edges: edgesCopy }
    let featuresNode = nodesCopy.find(n => n.type === 'features')
    if (!featuresNode) {
      featuresNode = styleNodes[0]
      featuresNode.type = 'features'
    }
    styleNodes.forEach(sn => {
      if (sn.data?.styleId && !featuresNode!.data?.styleId) {
        featuresNode!.data = { ...featuresNode!.data, styleId: sn.data.styleId }
      }
    })
    // Rewire edges from style nodes (except retained one) to features
    styleNodes.forEach(sn => {
      if (sn === featuresNode) return
      edgesCopy = edgesCopy.map(e => e.source === sn.id ? { ...e, source: featuresNode!.id } : e)
    })
    const cleanedNodes = nodesCopy.filter(n => n.type !== 'fighterStyle')
    return { nodes: cleanedNodes, edges: edgesCopy }
  }, [])
  // Attach handlers helper for restored nodes
  const attachHandlers = useCallback((rawNodes: any[]) => rawNodes.map((n: any) => ({
    ...n,
    data: {
      ...n.data,
      onChange: (p: any) => updateNodeData(n.id, p),
      onDelete: (id: string) => removeNode(id)
    }
  })), [updateNodeData, removeNode])

  // Initial load
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        historyRef.current.suppress = true
  const migrated = migrateStyleNodes(parsed.nodes as any, parsed.edges as any)
  setNodes(attachHandlers(migrated.nodes as any))
  setEdges(migrated.edges as any)
        if (parsed.settings) {
          if (typeof parsed.settings.level === 'number') setLevel(parsed.settings.level)
          if (typeof parsed.settings.str === 'number') setStr(parsed.settings.str)
          if (typeof parsed.settings.dex === 'number') setDex(parsed.settings.dex)
          if (typeof parsed.settings.targetAC === 'number') setTargetAC(parsed.settings.targetAC)
          if (parsed.settings.advMode) setAdvMode(parsed.settings.advMode)
          if (typeof parsed.settings.useVersatile === 'boolean') setUseVersatile(parsed.settings.useVersatile)
          if (parsed.settings.resist) setResist(parsed.settings.resist)
          if (parsed.settings.vuln) setVuln(parsed.settings.vuln)
          if (typeof parsed.settings.monsterId === 'string') setMonsterId(parsed.settings.monsterId)
          if (typeof parsed.settings.manualTarget === 'boolean') setManualTarget(parsed.settings.manualTarget)
          if (parsed.settings.targetAbilities) setTargetAbilities({ ...targetAbilities, ...parsed.settings.targetAbilities })
          if (parsed.settings.targetSaveProfs) setTargetSaveProfs({ ...targetSaveProfs, ...parsed.settings.targetSaveProfs })
        }
        historyRef.current.suppress = false
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced save
  const saveTimeoutRef = useRef<number | null>(null)
  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = window.setTimeout(() => {
      try {
        const payload = {
          version: 1,
            nodes: nodes.map(n => ({ ...n })),
            edges: edges.map(e => ({ ...e })),
            settings: { level, str, dex, targetAC, advMode, useVersatile, resist, vuln, monsterId, manualTarget, targetAbilities, targetSaveProfs }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch {}
    }, 150)
  }, [nodes, edges, level, str, dex, targetAC, advMode, useVersatile, resist, vuln, monsterId, manualTarget, targetAbilities, targetSaveProfs])

  React.useEffect(() => { scheduleSave() }, [nodes, edges, level, str, dex, targetAC, advMode, useVersatile, resist, vuln, monsterId, manualTarget, targetAbilities, targetSaveProfs, scheduleSave])

  // Clear persistence on full reset
  const clearPersistence = useCallback(() => { try { localStorage.removeItem(STORAGE_KEY) } catch {} }, [])

  const addNode = (type: keyof typeof nodeTypes) => {
    const id = `${type}-${crypto.randomUUID().slice(0, 6)}`
    const y = 40 + Math.random() * 760
    const base: any = { id, type, position: { x: 80, y }, data: { onChange: (p: any) => updateNodeData(id, p), onDelete: removeNode } }
  if (type === 'attack') { base.data.weaponId = WEAPON_PRESETS[0].id; base.data.actionType = nodes.some(n => n.type === 'attack') ? 'bonus' : 'action'; base.data.grip = 'main' }
  if (type === 'feats') Object.assign(base.data, { gwm: false, ss: false, pam: false, cbe: false })
  if (type === 'features') Object.assign(base.data, { level, featureType: '', styleId: '', critRange: 20, maneuversPerRound: 0, maneuverDie: 'd8', brutalCritDice: 0, hexblade: false, sneak: false, rage: false, smite: false })
    if (type === 'buffs') Object.assign(base.data, { bless: false, d6onhit: false })
    if (type === 'output') base.data.summary = null
    snapshot()
    setNodes((nds) => [...nds as any, base] as any)
  }

  // Expand / Collapse All (mirror Planner options)
  const expandAll = useCallback(() => {
    snapshot();
    setNodes((nds:any[]) => nds.map(n => ({ ...n, data: { ...n.data, collapsed: false } })))
  }, [snapshot, setNodes])
  const collapseAll = useCallback(() => {
    snapshot();
    setNodes((nds:any[]) => nds.map(n => ({ ...n, data: { ...n.data, collapsed: true } })))
  }, [snapshot, setNodes])

  // Auto-arrange (simple layered layout)
  const autoArrange = useCallback(() => {
    const idToIncoming = new Map<string, number>()
    nodes.forEach(n => idToIncoming.set(n.id, 0))
    edges.forEach(e => { idToIncoming.set(e.target, (idToIncoming.get(e.target)||0) + 1) })
    const layers: string[][] = []
    let frontier = nodes.filter(n => (idToIncoming.get(n.id)||0) === 0).map(n => n.id)
    const remainingEdges = edges.slice()
    const visited = new Set<string>()
    while (frontier.length) {
      layers.push(frontier)
      const next: string[] = []
      frontier.forEach(id => { visited.add(id) })
      remainingEdges.filter(e => frontier.includes(e.source)).forEach(e => {
        if (visited.has(e.target)) return
        const incoming = remainingEdges.filter(x => x.target === e.target && !visited.has(x.source)).length
        if (incoming === 0 && !next.includes(e.target)) next.push(e.target)
      })
      frontier = next
      if (layers.length > 50) break
    }
    // Add any disconnected nodes
    const disconnected = nodes.map(n=>n.id).filter(id => !layers.flat().includes(id))
    if (disconnected.length) layers.push(disconnected)
    const dx = 260; const dy = 180
    const nextPos: Record<string,{x:number;y:number}> = {}
    layers.forEach((layer, i) => {
      layer.forEach((id, j) => { nextPos[id] = { x: 40 + i*dx, y: 60 + j*dy } })
    })
    snapshot()
    setNodes(nds => nds.map(n => nextPos[n.id] ? { ...n, position: nextPos[n.id] } : n))
  }, [nodes, edges, snapshot, setNodes])

  // Reset (clear) graph
  const resetGraph = useCallback(() => {
    if (!window.confirm('Clear all optimizer nodes?')) return
    snapshot();
    setNodes([] as any); setEdges([]); clearPersistence()
  }, [snapshot, setNodes, setEdges, clearPersistence])

  // Reseed: build a sample baseline chain for convenience
  const reseed = useCallback(() => {
    if (!window.confirm('Reseed with a baseline example? This clears existing nodes (undoable).')) return
    snapshot();
    const newNodes: any[] = []
    const newEdges: any[] = []
    const make = (type: keyof typeof nodeTypes, x:number, y:number, data: any) => {
      const id = `${type}-${crypto.randomUUID().slice(0,6)}`
      newNodes.push({ id, type, position: { x, y }, data: { ...data, onChange: (p:any)=> updateNodeData(id,p), onDelete: removeNode } })
      return id
    }
  const attackId = make('attack', 40, 200, { weaponId: WEAPON_PRESETS[0].id, actionType: 'action', grip: 'main' })
  const featsId = make('feats', 40, 380, { gwm:false, ss:false, pam:false, cbe:false })
  const featuresStyle = make('features', 40, 520, { level: effLevel, featureType: 'fighting-style', styleId: 'dueling' })
  const featuresSneak = make('features', 40, 640, { level: effLevel, featureType: 'sneak-attack' })
  const featuresRage = make('features', 40, 760, { level: effLevel, featureType: 'rage' })
  const outputId = make('output', 420, 420, { summary: null })
  const buffsId = make('buffs', 40, 880, { bless:false, d6onhit:false })
  ;[attackId, featsId, featuresStyle, featuresSneak, featuresRage, buffsId].forEach(src => { newEdges.push({ id: `e-${crypto.randomUUID().slice(0,6)}`, source: src, target: outputId }) })
    setNodes(newNodes as any)
    setEdges(newEdges as any)
  }, [snapshot, updateNodeData, removeNode, effLevel, setNodes, setEdges])

  // Export / Import JSON
  const exportGraph = useCallback(() => {
    const payload = { version: 1, nodes, edges, settings: { level, str, dex, targetAC, advMode, useVersatile, resist, vuln } }
    const text = JSON.stringify(payload, null, 2)
    try { navigator.clipboard.writeText(text) } catch {}
    const blob = new Blob([text], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'optimizer-graph.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 5000)
  }, [nodes, edges, level, str, dex, targetAC, advMode, useVersatile, resist, vuln])
  const importGraph = useCallback(() => {
    const inpEl = document.createElement('input'); inpEl.type = 'file'; inpEl.accept = '.json,application/json';
    inpEl.onchange = () => {
      const file = inpEl.files?.[0]; if (!file) return
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result) || '{}')
          if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
            snapshot();
            const migrated = migrateStyleNodes(data.nodes as any[], data.edges as any[])
            setNodes(migrated.nodes.map(n => ({ ...n, data: { ...n.data, onChange: (p:any)=> updateNodeData(n.id,p), onDelete: removeNode } })))
            setEdges(migrated.edges as any)
            if (data.settings) {
              setLevel(data.settings.level ?? level)
              setStr(data.settings.str ?? str)
              setDex(data.settings.dex ?? dex)
              setTargetAC(data.settings.targetAC ?? targetAC)
              setAdvMode(data.settings.advMode ?? advMode)
              setUseVersatile(!!data.settings.useVersatile)
              setResist(data.settings.resist ?? resist)
              setVuln(data.settings.vuln ?? vuln)
            }
          } else alert('Invalid graph file')
        } catch { alert('Failed to parse file') }
      }
      reader.readAsText(file)
    }
    inpEl.click()
  }, [snapshot, updateNodeData, removeNode, setNodes, setEdges, level, str, dex, targetAC, advMode, useVersatile, resist, vuln])

  return (
    <div className="w-full" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12, height: 'calc(100vh - 100px)', overflow: 'hidden' }}>
      <div style={{ height: '100%', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: 'white', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6, zIndex: 30, flexWrap: 'wrap' }}>
          <button onClick={undo} style={{ ...btn, padding: 6 }} title="Undo (Ctrl+Z)">↶</button>
          <button onClick={redo} style={{ ...btn, padding: 6 }} title="Redo (Ctrl+Y)">↷</button>
          <button onClick={expandAll} style={btn} title="Expand all">Expand</button>
          <button onClick={collapseAll} style={btn} title="Collapse all">Collapse</button>
          <button onClick={autoArrange} style={btn} title="Auto arrange">Arrange</button>
          <button onClick={reseed} style={btn} title="Add baseline example">Reseed</button>
          <button onClick={resetGraph} style={{ ...btn, borderColor: '#ef4444', color: '#b91c1c' }} title="Clear all">Reset</button>
          <button onClick={exportGraph} style={btn} title="Export JSON">Export</button>
          <button onClick={importGraph} style={btn} title="Import JSON">Import</button>
        </div>
        <ReactFlow nodes={nodes as any} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes as any} fitView>
          <Background />
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

  <div style={{ display: 'grid', gap: 12, overflowY: 'auto', overflowX: 'hidden', paddingRight: 8 }}>
        <section style={card}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>History</div>
          <div style={{ padding: 12, display: 'flex', gap: 8 }}>
            <button onClick={undo} style={btn}>↶ Undo</button>
            <button onClick={redo} style={btn}>↷ Redo</button>
          </div>
        </section>
        <section style={card}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Character Stats</div>
          <div style={{ padding: 12, display: 'grid', gap: 10 }}>
            {props.character && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: -4 }}>
                Stats are synced from the Character Builder.
              </div>
            )}
            {!props.character && (
              <div style={{ fontSize: 11, color: '#64748b' }}>No builder linked – using default sample stats.</div>
            )}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
              <div style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
                <strong>Level</strong> <span style={{ marginLeft: 4 }}>{effLevel}</span>
              </div>
              <div style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
                <strong>STR</strong> <span style={{ marginLeft: 4 }}>{str} ({props.derived?.strMod ?? abilityMod(str) >= 0 ? '+' : ''}{props.derived?.strMod ?? abilityMod(str)})</span>
              </div>
              <div style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
                <strong>DEX</strong> <span style={{ marginLeft: 4 }}>{dex} ({props.derived?.dexMod ?? abilityMod(dex) >= 0 ? '+' : ''}{props.derived?.dexMod ?? abilityMod(dex)})</span>
              </div>
              <div style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
                <strong>Prof</strong> <span style={{ marginLeft: 4 }}>+{proficiencyBonus(effLevel)}</span>
              </div>
              <div style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
                <strong>Base Attacks</strong> <span style={{ marginLeft: 4 }}>{fighterAttacksPerRound(effLevel)}</span>
              </div>
            </div>
            <label style={{ ...row, fontSize: 12 }}><input type="checkbox" checked={useVersatile} onChange={(e) => setUseVersatile(e.target.checked)} /> Use versatile die</label>
          </div>
        </section>
        <section style={card}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Target Settings</div>
          <div style={{ padding: 12, display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <strong style={{ fontSize: 12 }}>Monster</strong>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 400 }}>
                  <input type="checkbox" checked={manualTarget} onChange={(e) => setManualTarget(e.target.checked)} /> Manual
                </label>
              </div>
              <select disabled={manualTarget} value={monsterId} onChange={(e) => { setMonsterId(e.target.value) }} style={inp}>
                <option value="">{manualTarget ? 'Manual entry enabled' : 'Select Monster...'}</option>
                {MONSTERS.map(m => (
                  <option key={m.id} value={m.id}>{m.name} (CR {m.cr}, AC {m.ac})</option>
                ))}
              </select>
              {!manualTarget && selectedMonster && (
                <div style={{ fontSize: 11, color: '#64748b' }}>Loaded {selectedMonster.name} • STR {selectedMonster.abilities.str} DEX {selectedMonster.abilities.dex} CON {selectedMonster.abilities.con}</div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>Target AC
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" value={targetAC} onChange={(e) => setTargetAC(parseInt(e.target.value || '0', 10))} style={inp} disabled={!manualTarget && !!selectedMonster} />
                  <span style={badge}>vs</span>
                </div>
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>Roll Mode
                <select value={advMode} onChange={(e) => setAdvMode(e.target.value as any)} style={inp}>
                  <option value="normal">Normal</option>
                  <option value="adv">Advantage</option>
                  <option value="dis">Disadvantage</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>Resistance
                <select value={resist} onChange={(e) => setResist(e.target.value as any)} style={inp} disabled={!manualTarget && !!selectedMonster}>
                  <option value="none">None</option>
                  <option value="slashing">Slashing</option>
                  <option value="piercing">Piercing</option>
                  <option value="bludgeoning">Bludgeoning</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>Vulnerability
                <select value={vuln} onChange={(e) => setVuln(e.target.value as any)} style={inp} disabled={!manualTarget && !!selectedMonster}>
                  <option value="none">None</option>
                  <option value="slashing">Slashing</option>
                  <option value="piercing">Piercing</option>
                  <option value="bludgeoning">Bludgeoning</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Target Ability Scores</div>
              {manualTarget ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
                  {(['str','dex','con','int','wis','cha'] as const).map(k => (
                    <label key={k} style={{ display: 'grid', gap: 2, fontSize: 10, color: '#475569', textTransform: 'uppercase' }}>
                      {k}
                      <input type="number" value={targetAbilities[k]} min={1} max={30} onChange={(e)=> setTargetAbilities(a=>({...a,[k]: parseInt(e.target.value||'0',10)}))} style={{ ...inp, padding: '4px 6px' }} />
                    </label>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#475569', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(['str','dex','con','int','wis','cha'] as const).map(k => (
                    <span key={k}><strong style={{ textTransform:'uppercase' }}>{k}</strong> {targetAbilities[k]}</span>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginTop: 4 }}>Saving Throw Proficiencies</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
                {(['str','dex','con','int','wis','cha'] as const).map(k => {
                  const active = targetSaveProfs[k]
                  return (
                    <button key={k} type="button" onClick={() => setTargetSaveProfs(p=>({...p,[k]:!p[k]}))} style={{
                      fontSize: 10,
                      padding: '4px 2px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 4,
                      background: active ? '#1e293b' : '#f1f5f9',
                      color: active ? '#fff' : '#475569',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}>{k}</button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <section style={card}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Add Nodes</div>
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <button onClick={() => addNode('attack')} style={btn}>+ Attack</button>
            <button onClick={() => addNode('feats')} style={btn}>+ Feats</button>
            <button onClick={() => addNode('features')} style={btn}>+ Features</button>
            <button onClick={() => addNode('buffs')} style={btn}>+ Buffs</button>
            <button onClick={() => addNode('output')} style={btn}>+ Output</button>
          </div>
          <div style={{ padding: '0 12px 12px', fontSize: 12, color: '#64748b' }}>Typical wiring: Attack / Feats / Features / Buffs → Output. Fighting Style is configured inside Features.</div>
        </section>

      </div>
    </div>
  )
}
