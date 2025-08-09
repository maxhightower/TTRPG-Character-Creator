import React, { useCallback, useMemo, useRef, useState } from 'react'
import ReactFlow, { Background, Controls, MiniMap, addEdge, Handle, Position, useEdgesState, useNodesState, useReactFlow } from 'reactflow'
import 'reactflow/dist/style.css'

// Fallback remover for nodes that were created before onDelete was injected
let globalRemoveNode: null | ((id: string) => void) = null

// Small UI helpers (defined early to avoid TDZ and DOM Range name collision)
function Slider(props: { label: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>{props.label}</div>
      <input type="range" min={props.min} max={props.max} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} style={{ width: '100%' }} />
    </div>
  )
}

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

function FighterStyleNode({ id, data }: any) {
  const { deleteElements } = useReactFlow()
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    deleteElements({ nodes: [{ id }] })
  }, [deleteElements, id])
  return (
    <div style={{ position: 'relative' }}>
      <button className="nodrag nopan" style={delBtn}
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onClick={handleDelete} title="Delete">×</button>
      <Handle type="target" position={Position.Left} />
      <PanelBox title="Fighter: Fighting Style">
        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
          <span>Style</span>
          <select value={data.styleId} onChange={(e) => data.onChange({ styleId: e.target.value })} style={inp}>
            {FIGHTING_STYLES.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
        </label>
        {data.styleId && <div style={{ fontSize: 12, color: '#64748b' }}><strong>{data.styleId}</strong> active</div>}
      </PanelBox>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

const WeaponNode = ({ id, data }: any) => {
  const { deleteElements } = useReactFlow()
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    deleteElements({ nodes: [{ id }] })
  }, [deleteElements, id])
  const weapon = WEAPON_PRESETS.find((w) => w.id === data.weaponId) ?? WEAPON_PRESETS[0]
  return (
    <div style={{ position: 'relative' }}>
      <button className="nodrag nopan" style={delBtn}
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onClick={handleDelete} title="Delete">×</button>
      <Handle type="target" position={Position.Left} />
      <PanelBox title="Weapon">
        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
          <span>Preset</span>
          <select value={weapon.id} onChange={(e) => data.onChange({ weaponId: e.target.value })} style={inp}>
            {WEAPON_PRESETS.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
          </select>
        </label>
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

function ClassFeaturesNode({ id, data }: any) {
  const { deleteElements } = useReactFlow()
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    deleteElements({ nodes: [{ id }] })
  }, [deleteElements, id])
  const level = data.level ?? 5
  const sneakDice = Math.ceil(level / 2)
  const rageBonus = level >= 16 ? 4 : level >= 9 ? 3 : level >= 3 ? 2 : 2
  return (
    <div style={{ position: 'relative' }}>
      <button className="nodrag nopan" style={delBtn}
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onClick={handleDelete} title="Delete">×</button>
      <Handle type="target" position={Position.Left} />
      <PanelBox title="Class Features">
        <label style={row}><input type="checkbox" checked={!!data.sneak} onChange={(e) => data.onChange({ sneak: e.target.checked })} /> Rogue Sneak Attack</label>
        {data.sneak && <div style={muted}>Approx: {sneakDice}d6 once/turn on hit</div>}
        <label style={row}><input type="checkbox" checked={!!data.rage} onChange={(e) => data.onChange({ rage: e.target.checked })} /> Barbarian Rage</label>
        {data.rage && <div style={muted}>+{rageBonus} melee damage per hit</div>}
        <label style={row}><input type="checkbox" checked={!!data.smite} onChange={(e) => data.onChange({ smite: e.target.checked })} /> Paladin Divine Smite</label>
        {data.smite && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ fontSize: 12, color: '#475569' }}>Smite Dice (d8)
              <input type="range" min={0} max={5} step={1} value={data.smiteDice ?? 2} onChange={(e) => data.onChange({ smiteDice: Number(e.target.value) })} style={{ width: '100%' }} />
            </label>
            <label style={{ fontSize: 12, color: '#475569' }}>Smites/Round
              <input type="range" min={0} max={2} step={1} value={data.smitesPerRound ?? 1} onChange={(e) => data.onChange({ smitesPerRound: Number(e.target.value) })} style={{ width: '100%' }} />
            </label>
          </div>
        )}
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
          <div style={{ fontSize: 12, color: '#64748b' }}>Connect a Fighting Style / Weapon / Feats / Features / Buffs to compute DPR.</div>
        )}
      </PanelBox>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

const nodeTypes = { fighterStyle: FighterStyleNode, weapon: WeaponNode, feats: FeatNode, features: ClassFeaturesNode, buffs: BuffsNode, output: OutputNode }

export function NodeOptimizer() {
  // Global knobs
  const [level, setLevel] = useState(5)
  const [str, setStr] = useState(16)
  const [dex, setDex] = useState(14)
  const [targetAC, setTargetAC] = useState(16)
  const [advMode, setAdvMode] = useState<'normal' | 'adv' | 'dis'>('normal')
  const [useVersatile, setUseVersatile] = useState(false)
  const [resist, setResist] = useState<'none' | 'slashing' | 'piercing' | 'bludgeoning'>('none')
  const [vuln, setVuln] = useState<'none' | 'slashing' | 'piercing' | 'bludgeoning'>('none')

  const prof = useMemo(() => proficiencyBonus(level), [level])
  const attacksBase = useMemo(() => fighterAttacksPerRound(level), [level])

  // Initial graph (handlers are seeded later)
  const initialNodes = useMemo(() => [
    { id: 'style-1', type: 'fighterStyle', position: { x: 80, y: 200 }, data: { styleId: 'dueling' } },
    { id: 'wpn-1', type: 'weapon', position: { x: 80, y: 20 }, data: { weaponId: 'longsword' } },
    { id: 'feat-1', type: 'feats', position: { x: 80, y: 380 }, data: { gwm: false, ss: false, pam: false, cbe: false } },
    { id: 'feat-2', type: 'features', position: { x: 80, y: 560 }, data: { } },
    { id: 'buff-1', type: 'buffs', position: { x: 80, y: 740 }, data: { bless: false, d6onhit: false } },
    { id: 'out-1', type: 'output', position: { x: 620, y: 240 }, data: { summary: null } },
  ], [])

  const [nodes, setNodes, baseOnNodesChange] = useNodesState<any>(initialNodes as any)
  const [edges, setEdges, baseOnEdgesChange] = useEdgesState([
    { id: 'e1', source: 'wpn-1', target: 'out-1' },
    { id: 'e2', source: 'style-1', target: 'out-1' },
    { id: 'e3', source: 'feat-1', target: 'out-1' },
    { id: 'e4', source: 'feat-2', target: 'out-1' },
    { id: 'e5', source: 'buff-1', target: 'out-1' },
  ])

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
      const styleNode = incoming.map((e) => map.get(e.source)).find((x) => x?.type === 'fighterStyle') as any
      const weaponNode = incoming.map((e) => map.get(e.source)).find((x) => x?.type === 'weapon') as any
      const featNode = incoming.map((e) => map.get(e.source)).find((x) => x?.type === 'feats') as any
      const featuresNode = incoming.map((e) => map.get(e.source)).find((x) => x?.type === 'features') as any
      const buffsNode = incoming.map((e) => map.get(e.source)).find((x) => x?.type === 'buffs') as any

      if (!weaponNode) return { ...n, data: { ...n.data, summary: null } }

      const styleId = styleNode?.data?.styleId as string | undefined
      const feats = featNode?.data || {}
      const features = { ...(featuresNode?.data || {}), level }
      const buffs = buffsNode?.data || {}
      const weapon = WEAPON_PRESETS.find((w) => w.id === weaponNode.data.weaponId) ?? WEAPON_PRESETS[0]

      const strMod = abilityMod(str)
      const dexMod = abilityMod(dex)
      const isRanged = weapon.ranged === true
      const usesDex = isRanged || weapon.finesse

      let toHit = prof + (usesDex ? dexMod : strMod)
      const notes: string[] = []

      if (styleId === 'archery' && isRanged) { toHit += 2; notes.push('Archery: +2 to hit applied.') }
      if (styleId === 'defense') { notes.push('Defense: +1 AC (not factored into DPR).') }
      if (buffs.bless) { toHit += 2.5; notes.push('Bless: +≈2.5 to hit EV.') }

      const qualifiesGWM = weapon.tags?.includes('gwm')
      const qualifiesSS = weapon.tags?.includes('ss')
      if (feats.gwm && qualifiesGWM && !isRanged) { toHit -= 5; notes.push('GWM: -5 to hit/+10 dmg.') }
      if (feats.ss && qualifiesSS && isRanged) { toHit -= 5; notes.push('Sharpshooter: -5 to hit/+10 dmg.') }

      const ac = targetAC
      const basePHit = clamp((21 + toHit - ac) / 20, 0, 1)
      const basePCrit = 0.05
      const pHit = advTransform(basePHit, advMode)
      const pCrit = advTransform(basePCrit, advMode)

      const dice = useVersatile && weapon.versatile ? weapon.versatile : weapon.dice
      const gwf = styleId === 'great-weapon' && weapon.handed === '2h' && !isRanged
      const baseDieAvg = diceAverage(dice, { greatWeaponFighting: gwf })
      if (gwf) { notes.push('Great Weapon Fighting: reroll 1s & 2s estimated.') }

      const dmgMod = usesDex ? dexMod : strMod

      let flatDamageBonus = 0
      let extraAttacks = 0

      if (styleId === 'dueling' && weapon.handed === '1h' && !isRanged) { flatDamageBonus += 2; notes.push('Dueling: +2 damage with 1H melee.') }
      if (styleId === 'two-weapon' && weapon.properties.includes('light') && !isRanged) { extraAttacks += 1; notes.push('Two-Weapon Fighting: includes offhand attack (adds mod).') }

      if (feats.gwm && qualifiesGWM && !isRanged) { flatDamageBonus += 10 }
      if (feats.ss && qualifiesSS && isRanged) { flatDamageBonus += 10 }
      let pamBonusAvg = 0
      if (feats.pam && weapon.tags?.includes('pam') && !isRanged) {
        const rageBonus = features.rage ? (level >= 16 ? 4 : level >= 9 ? 3 : 2) : 0
        const riderOnHitAvgPam = buffs.d6onhit ? DICE_AVG.d6 : 0
        const buttAvg = DICE_AVG.d4 + dmgMod + rageBonus + riderOnHitAvgPam
        const critDieAvg = DICE_AVG.d4
        const pNonCritHit = Math.max(pHit - pCrit, 0)
        pamBonusAvg = pNonCritHit * buttAvg + pCrit * (buttAvg + critDieAvg)
        notes.push('Polearm Master: bonus 1d4 attack added.') }
      if (feats.cbe && isRanged && weapon.id.includes('crossbow')) { extraAttacks += 1; notes.push('Crossbow Expert: bonus attack added.') }

      const riderOnHitAvg = buffs.d6onhit ? DICE_AVG.d6 : 0
      if (buffs.d6onhit) notes.push("Hex/Hunter's Mark: +1d6 on hit.")

      const rageBonus = features.rage ? (level >= 16 ? 4 : level >= 9 ? 3 : 2) : 0
      if (rageBonus && !isRanged) { flatDamageBonus += rageBonus; notes.push(`Rage: +${rageBonus} melee damage per hit.`) }

      let smiteDice = 0, smitesPerRound = 0
      if (features.smite) { smiteDice = features.smiteDice ?? 2; smitesPerRound = features.smitesPerRound ?? 1 }

      const sneakDice = features.sneak ? Math.min(10, Math.ceil(level / 2)) : 0

      const critDiceAvg = diceAverage(dice, { greatWeaponFighting: gwf })
      const avgWeapon = baseDieAvg + dmgMod + flatDamageBonus + riderOnHitAvg
      const dmgPerAttack = (pHit - pCrit) * avgWeapon + pCrit * (avgWeapon + critDiceAvg)

      let attacksPerRound = attacksBase
      if (extraAttacks) attacksPerRound += extraAttacks

      const pNonCritHit = Math.max(pHit - pCrit, 0)
      const pAnyPrimaryHit = 1 - Math.pow(1 - pNonCritHit, Math.max(1, attacksBase))
      const sneakAvg = sneakDice ? pAnyPrimaryHit * diceAverage(`${sneakDice}d6`) : 0

      const d8avg = DICE_AVG.d8
      const smiteAvg = smiteDice && smitesPerRound ? smitesPerRound * ((pNonCritHit * (smiteDice * d8avg)) + (pCrit * (smiteDice * 2 * d8avg))) : 0

      let dpr = dmgPerAttack * attacksPerRound + sneakAvg + smiteAvg + pamBonusAvg

      let multiplier = 1
      if (resist !== 'none' && resist === weapon.type) { multiplier *= 0.5; notes.push(`Target resists ${weapon.type} damage.`) }
      if (vuln !== 'none' && vuln === weapon.type) { multiplier *= 2; notes.push(`Target vulnerable to ${weapon.type} damage.`) }

      dpr *= multiplier

      return { ...n, data: { ...n.data, summary: { toHit: Math.round(toHit), advMode, targetAC: ac, pHit, pCrit, attacks: attacksPerRound, dpr, notes } } }
    })

    historyRef.current.suppress = true
    setNodes(nextNodes as any)
    historyRef.current.suppress = false
  }, [nodes, edges, level, str, dex, targetAC, attacksBase, useVersatile, advMode, resist, vuln, setNodes])

  React.useEffect(() => { computeGraph() }, [nodes.length, JSON.stringify(edges), level, str, dex, targetAC, useVersatile, advMode, resist, vuln, computeGraph])

  const addNode = (type: keyof typeof nodeTypes) => {
    const id = `${type}-${crypto.randomUUID().slice(0, 6)}`
    const y = 40 + Math.random() * 760
    const base: any = { id, type, position: { x: 80, y }, data: { onChange: (p: any) => updateNodeData(id, p), onDelete: removeNode } }
    if (type === 'weapon') base.data.weaponId = WEAPON_PRESETS[0].id
    if (type === 'fighterStyle') base.data.styleId = 'dueling'
    if (type === 'feats') Object.assign(base.data, { gwm: false, ss: false, pam: false, cbe: false })
    if (type === 'features') Object.assign(base.data, { level })
    if (type === 'buffs') Object.assign(base.data, { bless: false, d6onhit: false })
    if (type === 'output') base.data.summary = null
    snapshot()
    setNodes((nds) => [...nds as any, base] as any)
  }

  return (
    <div className="w-full" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12, height: 'calc(100vh - 100px)' }}>
      <div style={{ height: '100%', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: 'white' }}>
        <ReactFlow nodes={nodes as any} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes as any} fitView>
          <Background />
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <section style={card}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>History</div>
          <div style={{ padding: 12, display: 'flex', gap: 8 }}>
            <button onClick={undo} style={btn}>↶ Undo</button>
            <button onClick={redo} style={btn}>↷ Redo</button>
          </div>
        </section>
        <section style={card}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Global Settings</div>
          <div style={{ padding: 12, display: 'grid', gap: 12 }}>
            <Slider label={`Level: ${level}`} min={1} max={20} value={level} onChange={(v) => setLevel(v)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Slider label={`STR: ${str}`} min={8} max={20} value={str} onChange={(v) => setStr(v)} />
              <Slider label={`DEX: ${dex}`} min={8} max={20} value={dex} onChange={(v) => setDex(v)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>Target AC
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" value={targetAC} onChange={(e) => setTargetAC(parseInt(e.target.value || '0', 10))} style={inp} />
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'end' }}>
              <label style={row}><input type="checkbox" checked={useVersatile} onChange={(e) => setUseVersatile(e.target.checked)} /> Use versatile die</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>Resistance
                  <select value={resist} onChange={(e) => setResist(e.target.value as any)} style={inp}>
                    <option value="none">None</option>
                    <option value="slashing">Slashing</option>
                    <option value="piercing">Piercing</option>
                    <option value="bludgeoning">Bludgeoning</option>
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>Vulnerability
                  <select value={vuln} onChange={(e) => setVuln(e.target.value as any)} style={inp}>
                    <option value="none">None</option>
                    <option value="slashing">Slashing</option>
                    <option value="piercing">Piercing</option>
                    <option value="bludgeoning">Bludgeoning</option>
                  </select>
                </label>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#475569' }}>Proficiency: <strong>+{proficiencyBonus(level)}</strong> • Base Attacks/Round (Fighter): <strong>{fighterAttacksPerRound(level)}</strong></div>
          </div>
        </section>

        <section style={card}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Add Nodes</div>
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <button onClick={() => addNode('weapon')} style={btn}>+ Weapon</button>
            <button onClick={() => addNode('fighterStyle')} style={btn}>+ Style</button>
            <button onClick={() => addNode('feats')} style={btn}>+ Feats</button>
            <button onClick={() => addNode('features')} style={btn}>+ Features</button>
            <button onClick={() => addNode('buffs')} style={btn}>+ Buffs</button>
            <button onClick={() => addNode('output')} style={btn}>+ Output</button>
          </div>
          <div style={{ padding: '0 12px 12px', fontSize: 12, color: '#64748b' }}>Typical wiring: Weapon → Output; Style/Feats/Features/Buffs → Output. Create multiple outputs to compare builds.</div>
        </section>

        <section style={card}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Notes</div>
          <ul style={{ padding: 12, margin: 0, color: '#475569', fontSize: 14 }}>
            <li>Advantage/disadvantage transforms hit and crit probabilities.</li>
            <li>GWM/SS: -5 to hit, +10 damage when weapon qualifies.</li>
            <li>Polearm Master adds a bonus 1d4 attack if using a qualifying weapon.</li>
            <li>Rogue Sneak Attack modeled once/turn with probability of at least one primary hit.</li>
            <li>Divine Smite adds chosen d8s per smite on hit; crit doubles smite dice.</li>
            <li>Rage adds +2/+3/+4 melee damage scaling by level.</li>
            <li>Resist/Vulnerability multiplies final DPR by 0.5x/2x if it matches damage type.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
