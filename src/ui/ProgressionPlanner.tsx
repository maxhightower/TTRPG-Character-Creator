import React, { useCallback, useMemo, useRef, useState } from 'react'
import ReactFlow, { Background, Controls, MiniMap, addEdge, Handle, Position, useEdgesState, useNodesState, useReactFlow } from 'reactflow'
import 'reactflow/dist/style.css'
import type { AppState as BuilderState } from './Builder'

// Simple styles shared across nodes/panels
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 }
const badge: React.CSSProperties = { padding: '2px 8px', borderRadius: 999, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12 }
const card: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 12, background: 'white' }
const btn: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }
const muted: React.CSSProperties = { color: '#64748b', fontSize: 12 }
const delBtn: React.CSSProperties = { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 999, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#334155', lineHeight: '20px', textAlign: 'center', zIndex: 10 }

// Domain data small set
const CLASSES = [
  'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'
] as const

// Races and Backgrounds for root node
const RACE_NAMES = ['Human (Base)', 'Human (Variant)', 'Elf (Wood)', 'Elf (High)'] as const
const BACKGROUNDS = ['Soldier', 'Acolyte', 'Sage', 'Outlander'] as const

type StepType = 'class' | 'feat' | 'asi' | 'note'

// Add token type for typed ASI holes
type AbilityToken = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'

type ProgressStepData = {
  onChange?: (p: Partial<ProgressStepData>) => void
  onDelete?: (id: string) => void
  level: number
  type: StepType
  className?: typeof CLASSES[number]
  featName?: string
  asi?: string // e.g., "+2 STR" or "+1 STR/+1 CON"
  // Optional typed ASI holes integrated into nodes
  ability1?: AbilityToken | null
  ability2?: AbilityToken | null
  notes?: string
}

type RootNodeData = {
  race?: string
  background?: string
  onChange?: (p: Partial<RootNodeData>) => void
  onDelete?: (id: string) => void
  onClone?: (id: string) => void
}

function PanelBox(props: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 280, background: '#f3f4f6', border: '1px solid #e2e8f0', borderRadius: 12 }}>
      <div style={{ padding: 10, borderBottom: '1px solid #e2e8f0', fontWeight: 600, fontSize: 13 }}>{props.title}</div>
      <div style={{ padding: 10, display: 'grid', gap: 8 }}>{props.children}</div>
    </div>
  )
}

// Scratch-like blocks
const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const

type ScratchBlock =
  | { id: string; kind: 'class'; level: number; className?: typeof CLASSES[number] }
  | { id: string; kind: 'feat'; level: number; featName?: string }
  | { id: string; kind: 'asi'; level: number; ability1?: AbilityToken | null; ability2?: AbilityToken | null }
  | { id: string; kind: 'note'; level: number; text?: string }

const blockColors: Record<ScratchBlock['kind'], string> = {
  class: '#fde68a', // amber
  feat: '#86efac',  // green
  asi: '#93c5fd',   // blue
  note: '#fca5a5',  // red
}

const DND_BLOCK_MIME = 'application/x-scratch-block'
const DND_TOKEN_MIME = 'application/x-scratch-token'

function holeStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', minWidth: 72, padding: '4px 8px', borderRadius: 8,
    border: `2px dashed ${active ? '#0ea5e9' : '#cbd5e1'}`, background: active ? '#e0f2fe' : '#f8fafc',
    color: '#0f172a', fontSize: 12, gap: 6
  }
}

function tokenBadge(label: string): JSX.Element {
  return <span style={{ padding: '2px 6px', borderRadius: 999, background: '#e2e8f0', fontSize: 12 }}>{label}</span>
}

function BlockChip(props: { label: string; color: string; draggableData: any }) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData(DND_BLOCK_MIME, JSON.stringify(props.draggableData))}
      style={{ padding: '6px 10px', borderRadius: 10, background: props.color, border: '1px solid #e2e8f0', cursor: 'grab', userSelect: 'none', fontSize: 12 }}
      title="Drag into the workspace"
    >{props.label}</div>
  )
}

function TokenChip(props: { label: string; type: 'ability' | 'class'; value: string }) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData(DND_TOKEN_MIME, JSON.stringify({ type: props.type, value: props.value }))
      }
      style={{ padding: '4px 8px', borderRadius: 999, background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'grab', fontSize: 12 }}
      title={`Drag to a matching ${props.type} hole`}
    >{props.label}</div>
  )
}

function ScratchBlockView(props: {
  blk: ScratchBlock
  onChange: (patch: Partial<ScratchBlock>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [over, setOver] = useState<string | null>(null)

  const cardStyle: React.CSSProperties = {
    background: blockColors[props.blk.kind], border: '1px solid #e2e8f0', borderRadius: 12, padding: 10, display: 'grid', gap: 8
  }

  const commonHeader = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3 }}>{props.blk.kind}</strong>
        <span style={{ fontSize: 12, color: '#475569' }}>Level</span>
        <input type="number" min={1} max={20} value={props.blk.level}
          onChange={(e) => props.onChange({ level: Math.max(1, Math.min(20, parseInt(e.target.value || '1', 10))) })}
          style={{ width: 64, padding: '4px 6px', borderRadius: 8, border: '1px solid #cbd5e1' }} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={props.onMoveUp} style={{ ...btn, padding: 6 }} title="Move up">↑</button>
        <button onClick={props.onMoveDown} style={{ ...btn, padding: 6 }} title="Move down">↓</button>
        <button onClick={props.onRemove} style={{ ...btn, padding: 6 }} title="Remove">×</button>
      </div>
    </div>
  )

  return (
    <div style={cardStyle}>
      {commonHeader}
      {props.blk.kind === 'class' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#475569' }}>Class:</span>
          <span
            onDragOver={(e) => { e.preventDefault(); setOver('class') }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              setOver(null)
              const raw = e.dataTransfer.getData(DND_TOKEN_MIME)
              if (!raw) return
              try {
                const tok = JSON.parse(raw)
                if (tok.type === 'class' && (CLASSES as readonly string[]).includes(tok.value)) props.onChange({ className: tok.value })
              } catch {}
            }}
            style={holeStyle(over === 'class')}
          >{props.blk.className ? tokenBadge(props.blk.className) : <span style={{ color: '#64748b' }}>drop class here</span>}</span>
          <select value={props.blk.className || 'Fighter'} onChange={(e) => props.onChange({ className: e.target.value as any })} style={inp}>
            {(CLASSES as readonly string[]).map((c: string) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </div>
      )}
      {props.blk.kind === 'feat' && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#475569' }}>Feat Name:</span>
          <input value={props.blk.featName || ''} onChange={(e) => props.onChange({ featName: e.target.value })} placeholder="Great Weapon Master" style={inp} />
        </div>
      )}
      {props.blk.kind === 'asi' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#475569' }}>Ability +1:</span>
            <span
              onDragOver={(e) => { e.preventDefault(); setOver('a1') }} onDragLeave={() => setOver(null)}
              onDrop={(e) => { setOver(null); const raw = e.dataTransfer.getData(DND_TOKEN_MIME); if (!raw) return; try { const tok = JSON.parse(raw); if (tok.type === 'ability' && (ABILITIES as readonly string[]).includes(tok.value)) props.onChange({ ability1: tok.value }) } catch {} }}
              style={holeStyle(over === 'a1')}
            >{props.blk.ability1 ? tokenBadge(props.blk.ability1) : <span style={{ color: '#64748b' }}>drop ability</span>}</span>
            <span style={{ fontSize: 12, color: '#475569' }}>Ability +1:</span>
            <span
              onDragOver={(e) => { e.preventDefault(); setOver('a2') }} onDragLeave={() => setOver(null)}
              onDrop={(e) => { setOver(null); const raw = e.dataTransfer.getData(DND_TOKEN_MIME); if (!raw) return; try { const tok = JSON.parse(raw); if (tok.type === 'ability' && (ABILITIES as readonly string[]).includes(tok.value)) props.onChange({ ability2: tok.value }) } catch {} }}
              style={holeStyle(over === 'a2')}
            >{props.blk.ability2 ? tokenBadge(props.blk.ability2) : <span style={{ color: '#64748b' }}>drop ability</span>}</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Tip: drag ability tokens into the holes, or just leave blank and fill later.</div>
        </div>
      )}
      {props.blk.kind === 'note' && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#475569' }}>Notes:</span>
          <textarea value={props.blk.text || ''} onChange={(e) => props.onChange({ text: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Why this choice?" />
        </div>
      )}
    </div>
  )
}

function ProgressStepNode({ id, data }: { id: string; data: ProgressStepData }) {
  const { deleteElements } = useReactFlow()
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    deleteElements({ nodes: [{ id }] })
  }, [deleteElements, id])

  // DnD typed holes state
  const [over, setOver] = React.useState<string | null>(null)

  return (
    <div style={{ position: 'relative' }}>
      <button className="nodrag nopan" style={delBtn}
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        onClick={handleDelete} title="Delete">×</button>
      <Handle type="target" position={Position.Left} />
      <PanelBox title={`Progression Step (Level ${data.level})`}>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
          <span>Character Level</span>
          <input type="number" min={1} max={20} value={data.level}
                 onChange={(e) => data.onChange?.({ level: Math.max(1, Math.min(20, parseInt(e.target.value || '1', 10))) })}
                 style={inp} />
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
          <span>Step Type</span>
          <select value={data.type} onChange={(e) => data.onChange?.({ type: e.target.value as StepType })} style={inp}>
            <option value="class">Class Level</option>
            <option value="feat">Feat</option>
            <option value="asi">ASI</option>
            <option value="note">Note</option>
          </select>
        </label>
        {data.type === 'class' && (
          <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
            <span>Class</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                onDragOver={(e) => { e.preventDefault(); setOver('class') }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  setOver(null)
                  const raw = e.dataTransfer.getData('application/x-scratch-token')
                  if (!raw) return
                  try {
                    const tok = JSON.parse(raw)
                    if (tok.type === 'class' && (CLASSES as readonly string[]).includes(tok.value)) data.onChange?.({ className: tok.value })
                  } catch {}
                }}
                style={{ display: 'inline-flex', alignItems: 'center', minWidth: 72, padding: '4px 8px', borderRadius: 8, border: `2px dashed ${over === 'class' ? '#0ea5e9' : '#cbd5e1'}`, background: over === 'class' ? '#e0f2fe' : '#f8fafc', color: '#0f172a', fontSize: 12, gap: 6 }}
              >{data.className ? <span style={{ padding: '2px 6px', borderRadius: 999, background: '#e2e8f0', fontSize: 12 }}>{data.className}</span> : <span style={{ color: '#64748b' }}>drop class here</span>}</span>
              <select value={data.className || 'Fighter'} onChange={(e) => data.onChange?.({ className: e.target.value as any })} style={inp}>
                {(CLASSES as readonly string[]).map((c: string) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
          </label>
        )}
        {data.type === 'feat' && (
          <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
            <span>Feat Name</span>
            <input value={data.featName || ''} onChange={(e) => data.onChange?.({ featName: e.target.value })} placeholder="Great Weapon Master" style={inp} />
          </label>
        )}
        {data.type === 'asi' && (
          <div style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
            <span>ASI (+1/+1 or +2):</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                onDragOver={(e) => { e.preventDefault(); setOver('a1') }} onDragLeave={() => setOver(null)}
                onDrop={(e) => { setOver(null); const raw = e.dataTransfer.getData('application/x-scratch-token'); if (!raw) return; try { const tok = JSON.parse(raw); if (tok.type === 'ability') data.onChange?.({ ability1: tok.value as AbilityToken, asi: buildAsiString(tok.value, data.ability2) }) } catch {} }}
                style={{ display: 'inline-flex', alignItems: 'center', minWidth: 72, padding: '4px 8px', borderRadius: 8, border: `2px dashed ${over === 'a1' ? '#0ea5e9' : '#cbd5e1'}`, background: over === 'a1' ? '#e0f2fe' : '#f8fafc', color: '#0f172a', fontSize: 12, gap: 6 }}
              >{data.ability1 ? <span style={{ padding: '2px 6px', borderRadius: 999, background: '#e2e8f0', fontSize: 12 }}>{data.ability1}</span> : <span style={{ color: '#64748b' }}>drop ability</span>}</span>
              <span
                onDragOver={(e) => { e.preventDefault(); setOver('a2') }} onDragLeave={() => setOver(null)}
                onDrop={(e) => { setOver(null); const raw = e.dataTransfer.getData('application/x-scratch-token'); if (!raw) return; try { const tok = JSON.parse(raw); if (tok.type === 'ability' && (ABILITIES as readonly string[]).includes(tok.value)) data.onChange?.({ ability2: tok.value as AbilityToken, asi: buildAsiString(data.ability1, tok.value) }) } catch {} }}
                style={{ display: 'inline-flex', alignItems: 'center', minWidth: 72, padding: '4px 8px', borderRadius: 8, border: `2px dashed ${over === 'a2' ? '#0ea5e9' : '#cbd5e1'}`, background: over === 'a2' ? '#e0f2fe' : '#f8fafc', color: '#0f172a', fontSize: 12, gap: 6 }}
              >{data.ability2 ? <span style={{ padding: '2px 6px', borderRadius: 999, background: '#e2e8f0', fontSize: 12 }}>{data.ability2}</span> : <span style={{ color: '#64748b' }}>drop ability</span>}</span>
              <input value={data.asi || ''} onChange={(e) => data.onChange?.({ asi: e.target.value })} placeholder="+2 STR or +1 STR / +1 CON" style={inp} />
            </div>
          </div>
        )}
        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
          <span>Notes</span>
          <textarea value={data.notes || ''} onChange={(e) => data.onChange?.({ notes: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Why this choice?" />
        </label>
      </PanelBox>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function buildAsiString(a1?: AbilityToken | null, a2?: AbilityToken | null) {
  if (a1 && a2) return `+1 ${a1} / +1 ${a2}`
  if (a1 && !a2) return `+2 ${a1}`
  if (!a1 && a2) return `+2 ${a2}`
  return ''
}

function RootNode({ id, data }: { id: string; data: RootNodeData }) {
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
      {/* Root has no target handle */}
      <PanelBox title="Character Start">
        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
          <span>Race</span>
          <select value={data.race || ''} onChange={(e) => data.onChange?.({ race: e.target.value })} style={inp}>
            <option value="">Select race…</option>
            {(RACE_NAMES as readonly string[]).map((r) => (<option key={r} value={r}>{r}</option>))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
          <span>Background</span>
          <select value={data.background || ''} onChange={(e) => data.onChange?.({ background: e.target.value })} style={inp}>
            <option value="">Select background…</option>
            {(BACKGROUNDS as readonly string[]).map((b) => (<option key={b} value={b}>{b}</option>))}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => data.onClone?.(id)} style={btn} title="Clone this branch">Clone Branch</button>
        </div>
      </PanelBox>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

// Node registry now: root + progress steps
const nodeTypes = { root: RootNode, progressStep: ProgressStepNode }

export function ProgressionPlanner(props: { character?: BuilderState; derived?: any }) {
  // Initial tree: one root with two steps
  const initialNodes = useMemo(() => [
    { id: 'root-1', type: 'root', position: { x: 40, y: 160 }, data: { race: props.character?.race?.name, background: 'Soldier' } as RootNodeData },
    { id: 'step-1', type: 'progressStep', position: { x: 360, y: 120 }, data: { level: 1, type: 'class', className: 'Fighter' } as ProgressStepData },
    { id: 'step-2', type: 'progressStep', position: { x: 360, y: 300 }, data: { level: 2, type: 'note', notes: 'Pick Fighting Style' } as ProgressStepData },
  ], [])

  const [nodes, setNodes, baseOnNodesChange] = useNodesState<any>(initialNodes as any)
  const [edges, setEdges, baseOnEdgesChange] = useEdgesState([
    { id: 'e-root-1', source: 'root-1', target: 'step-1' },
    { id: 'e-1', source: 'step-1', target: 'step-2' },
  ])

  // Scratch workspace state
  const [scratch, setScratch] = useState<ScratchBlock[]>([])

  const addScratchBlock = useCallback((kind: ScratchBlock['kind']) => {
    const id = `sb-${crypto.randomUUID().slice(0, 6)}`
    const base: ScratchBlock =
      kind === 'class' ? { id, kind, level: 1, className: 'Fighter' } :
      kind === 'feat' ? { id, kind, level: 1, featName: '' } :
      kind === 'asi' ? { id, kind, level: 4, ability1: null, ability2: null } :
      { id, kind: 'note', level: 1, text: '' }
    setScratch((s) => [...s, base])
  }, [])

  const updateScratch = useCallback((id: string, patch: Partial<ScratchBlock>) => {
    setScratch((s) => s.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }, [])
  const removeScratch = useCallback((id: string) => setScratch((s) => s.filter((b) => b.id !== id)), [])
  const moveScratch = useCallback((id: string, dir: -1 | 1) => {
    setScratch((s) => {
      const idx = s.findIndex((b) => b.id === id)
      if (idx < 0) return s
      const ni = Math.max(0, Math.min(s.length - 1, idx + dir))
      if (ni === idx) return s
      const copy = s.slice()
      const [blk] = copy.splice(idx, 1)
      copy.splice(ni, 0, blk)
      return copy
    })
  }, [])

  // History management
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

  const onNodesChange = useCallback((changes: any) => { snapshot(); baseOnNodesChange(changes) }, [snapshot, baseOnNodesChange])
  const onEdgesChange = useCallback((changes: any) => { snapshot(); baseOnEdgesChange(changes) }, [snapshot, baseOnEdgesChange])
  const onConnect = useCallback((params: any) => { snapshot(); setEdges((eds) => addEdge(params, eds)) }, [snapshot, setEdges])

  // Helper to update a node's data
  const updateNodeData = useCallback((id: string, patch: any) => {
    snapshot()
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
  }, [snapshot, setNodes])

  const removeNode = useCallback((id: string) => {
    snapshot()
    setNodes((nds: any[]) => nds.filter((n) => n.id !== id))
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
  }, [setNodes, setEdges])

  // Clone a branch starting from a root node
  const cloneBranch = useCallback((rootId: string) => {
    const idToNode = new Map(nodes.map((n) => [n.id, n] as const))
    if (!idToNode.get(rootId) || idToNode.get(rootId)!.type !== 'root') return

    // Collect reachable nodes from root via outgoing edges
    const reachable = new Set<string>()
    const stack = [rootId]
    while (stack.length) {
      const cur = stack.pop()!
      if (reachable.has(cur)) continue
      reachable.add(cur)
      const children = edges.filter((e) => e.source === cur).map((e) => e.target)
      children.forEach((c) => stack.push(c))
    }

    // Build id mapping and clones
    const idMap = new Map<string, string>()
    const dx = 420
    const newNodes: any[] = []
    Array.from(reachable).forEach((oldId) => {
      const orig = idToNode.get(oldId)!
      const newId = `${orig.type}-${crypto.randomUUID().slice(0, 6)}`
      idMap.set(oldId, newId)
      newNodes.push({
        id: newId,
        type: orig.type,
        position: { x: (orig.position?.x || 0) + dx, y: (orig.position?.y || 0) },
        data: { ...orig.data },
      })
    })

    const newEdges = edges
      .filter((e) => reachable.has(e.source) && reachable.has(e.target))
      .map((e, i) => ({ id: `clone-${crypto.randomUUID().slice(0, 6)}-${i}`, source: idMap.get(e.source)!, target: idMap.get(e.target)! }))

    snapshot()
    setNodes((nds: any) => [...nds, ...newNodes])
    setEdges((eds) => [...eds, ...newEdges])
  }, [nodes, edges, setNodes, setEdges, snapshot])

  // Seed onChange/onDelete/onClone for nodes
  React.useEffect(() => {
    setNodes((nds: any[]) => nds.map((n) => {
      const d: any = { ...n.data }
      if (!d.onChange) d.onChange = (p: any) => updateNodeData(n.id, p)
      if (!d.onDelete) d.onDelete = (id: string) => removeNode(id)
      if (n.type === 'root' && !d.onClone) d.onClone = () => cloneBranch(n.id)
      return { ...n, data: d }
    }))
  }, [updateNodeData, cloneBranch])

  // Generate tree from scratch blocks: create a new root + chain of steps
  const generateFromScratch = useCallback(() => {
    if (!scratch.length) return
    snapshot()
    const baseY = 40 + Math.random() * 40
    const rootId = `root-${crypto.randomUUID().slice(0, 6)}`
    const rootNode: any = { id: rootId, type: 'root', position: { x: 40, y: baseY + 40 }, data: { race: '', background: '' } as RootNodeData }
    rootNode.data.onChange = (p: any) => updateNodeData(rootId, p)
    rootNode.data.onDelete = (nid: string) => removeNode(nid)
    rootNode.data.onClone = () => cloneBranch(rootId)

    let prevId: string = rootId
    let idx = 0
    const newNodes: any[] = [rootNode]
    const newEdges: any[] = []

    scratch.sort((a, b) => a.level - b.level).forEach((b) => {
      const id = `sbnode-${crypto.randomUUID().slice(0, 6)}`
      const data: ProgressStepData = b.kind === 'class'
        ? { level: b.level, type: 'class', className: b.className || 'Fighter' }
        : b.kind === 'feat'
        ? { level: b.level, type: 'feat', featName: b.featName || '' }
        : b.kind === 'asi'
        ? { level: b.level, type: 'asi', asi: [b.ability1, b.ability2].filter(Boolean).join(' / ') || '' }
        : { level: b.level, type: 'note', notes: b.text || '' }
      const n: any = { id, type: 'progressStep', position: { x: 360, y: baseY + idx * 160 }, data: { ...data } }
      n.data.onChange = (p: any) => updateNodeData(id, p)
      n.data.onDelete = (nid: string) => removeNode(nid)
      newNodes.push(n)
      newEdges.push({ id: `e-${crypto.randomUUID().slice(0, 6)}`, source: prevId, target: id })
      prevId = id
      idx += 1
    })

    setNodes((nds: any) => [...nds, ...newNodes])
    setEdges((eds) => [...eds, ...newEdges])
  }, [scratch, setNodes, setEdges, snapshot, updateNodeData, removeNode, cloneBranch])

  const addNode = (type: keyof typeof nodeTypes) => {
    const id = `${type}-${crypto.randomUUID().slice(0, 6)}`
    const y = 40 + Math.random() * 720
    const base: any = { id, type, position: { x: type === 'root' ? 40 : 360, y }, data: {} }
    if (type === 'progressStep') Object.assign(base.data, { level: 1, type: 'class', className: 'Fighter' } as ProgressStepData)
    if (type === 'root') Object.assign(base.data, { race: '', background: '' } as RootNodeData)
    base.data.onChange = (p: any) => updateNodeData(id, p)
    base.data.onDelete = (nodeId: string) => removeNode(nodeId)
    if (type === 'root') base.data.onClone = () => cloneBranch(id)

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

      <div style={{ display: 'grid', gap: 12, overflow: 'auto', paddingRight: 2 }}>
        {/* History */}
        <section style={card}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>History</span>
            {props.character ? (
              <span style={{ fontSize: 12, color: '#64748b' }}>
                {props.character.name} • Lv {props.derived?.totalLevel ?? props.character.classes.reduce((s, c) => s + (c.level || 0), 0)}
              </span>
            ) : null}
          </div>
          <div style={{ padding: 12, display: 'flex', gap: 8 }}>
            <button onClick={undo} style={btn}>↶ Undo</button>
            <button onClick={redo} style={btn}>↷ Redo</button>
          </div>
        </section>

        {/* Add Nodes */}
        <section style={card}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Add Nodes</div>
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={() => addNode('root')} style={btn}>+ Root</button>
            <button onClick={() => addNode('progressStep')} style={btn}>+ Step</button>
          </div>
          <div style={{ padding: '0 12px 12px', fontSize: 12, color: '#64748b' }}>Use Root to set Race and Background, then connect Steps to build branches. Clone a Root to fork a new branch with the same history.</div>
        </section>

        {/* Scratch-like Builder */}
        <section style={card}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Scratch Blocks (beta)</div>

          {/* Palette */}
          <div style={{ padding: 12, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <BlockChip label="Class Block" color={blockColors.class} draggableData={{ kind: 'class' }} />
              <BlockChip label="Feat Block" color={blockColors.feat} draggableData={{ kind: 'feat' }} />
              <BlockChip label="ASI Block" color={blockColors.asi} draggableData={{ kind: 'asi' }} />
              <BlockChip label="Note Block" color={blockColors.note} draggableData={{ kind: 'note' }} />
              <span style={{ fontSize: 12, color: '#64748b', alignSelf: 'center' }}>or click:</span>
              <button onClick={() => addScratchBlock('class')} style={btn}>+ Class</button>
              <button onClick={() => addScratchBlock('feat')} style={btn}>+ Feat</button>
              <button onClick={() => addScratchBlock('asi')} style={btn}>+ ASI</button>
              <button onClick={() => addScratchBlock('note')} style={btn}>+ Note</button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(CLASSES as readonly string[]).map((c: string) => (<TokenChip key={c} label={c} type="class" value={c} />))}
              {(ABILITIES as readonly string[]).map((a: string) => (<TokenChip key={a} label={a} type="ability" value={a} />))}
            </div>
          </div>

          {/* Workspace */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const raw = e.dataTransfer.getData(DND_BLOCK_MIME)
              if (!raw) return
              try { const data = JSON.parse(raw); if (data?.kind) addScratchBlock(data.kind) } catch {}
            }}
            style={{ padding: 12, borderTop: '1px dashed #e2e8f0', display: 'grid', gap: 10 }}
          >
            {scratch.length === 0 ? (
              <div style={{ fontSize: 12, color: '#64748b' }}>Drag blocks here or use the buttons above to build a plan. You can drop tokens (classes, abilities) into matching holes on blocks.</div>
            ) : scratch.map((blk) => (
              <ScratchBlockView
                key={blk.id}
                blk={blk}
                onChange={(p) => updateScratch(blk.id, p)}
                onRemove={() => removeScratch(blk.id)}
                onMoveUp={() => moveScratch(blk.id, -1)}
                onMoveDown={() => moveScratch(blk.id, 1)}
              />
            ))}
          </div>

          <div style={{ padding: 12, display: 'flex', gap: 8 }}>
            <button onClick={generateFromScratch} style={btn}>Generate Branch from Blocks</button>
            {scratch.length ? <span style={{ alignSelf: 'center', fontSize: 12, color: '#64748b' }}>{scratch.length} block(s)</span> : null}
          </div>
        </section>

        {/* Tips */}
        <section style={card}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Tips</div>
          <ul style={{ padding: 12, margin: 0, color: '#475569', fontSize: 14 }}>
            <li>Start with a Root to set Race and Background.</li>
            <li>Add Steps for class levels, feats, and ASIs, and connect them from the Root to form a branch.</li>
            <li>Use Clone on a Root to fork a new branch identical up to that point and explore alternatives.</li>
            <li>Scratch Blocks can generate a new branch quickly; edit nodes after generation.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

export default ProgressionPlanner
