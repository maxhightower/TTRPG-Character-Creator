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

type StepType = 'class' | 'feat' | 'asi' | 'note'

type ProgressStepData = {
  onChange?: (p: Partial<ProgressStepData>) => void
  onDelete?: (id: string) => void
  level: number
  type: StepType
  className?: typeof CLASSES[number]
  featName?: string
  asi?: string // e.g., "+2 STR" or "+1 STR/+1 CON"
  notes?: string
}

type RouteOutputData = {
  summary?: {
    totalLevels: number
    classBreakdown: Record<string, number>
    steps: Array<{ level: number; label: string }>
    warnings: string[]
  } | null
}

function PanelBox(props: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 280, background: '#f3f4f6', border: '1px solid #e2e8f0', borderRadius: 12 }}>
      <div style={{ padding: 10, borderBottom: '1px solid #e2e8f0', fontWeight: 600, fontSize: 13 }}>{props.title}</div>
      <div style={{ padding: 10, display: 'grid', gap: 8 }}>{props.children}</div>
    </div>
  )
}

function ProgressStepNode({ id, data }: { id: string; data: ProgressStepData }) {
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
            <select value={data.className || 'Fighter'} onChange={(e) => data.onChange?.({ className: e.target.value as any })} style={inp}>
              {CLASSES.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </label>
        )}
        {data.type === 'feat' && (
          <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
            <span>Feat Name</span>
            <input value={data.featName || ''} onChange={(e) => data.onChange?.({ featName: e.target.value })} placeholder="Great Weapon Master" style={inp} />
          </label>
        )}
        {data.type === 'asi' && (
          <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
            <span>ASI Details</span>
            <input value={data.asi || ''} onChange={(e) => data.onChange?.({ asi: e.target.value })} placeholder="+2 STR or +1 STR / +1 CON" style={inp} />
          </label>
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

function RouteOutputNode({ id, data }: { id: string; data: RouteOutputData }) {
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
      <PanelBox title="Route Output">
        {data.summary ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12, color: '#475569' }}>Total Character Level: <strong>{data.summary.totalLevels}</strong></div>
            <div style={{ fontSize: 12, color: '#475569' }}>Class Split:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(data.summary.classBreakdown).map(([k, v]) => (<span key={k} style={badge}>{k} {v}</span>))}
              {Object.keys(data.summary.classBreakdown).length === 0 ? (<span style={muted}>No classes added.</span>) : null}
            </div>
            <div style={{ borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />
            <div style={{ fontSize: 12, color: '#475569' }}>Steps:</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {data.summary.steps.map((s, i) => (<li key={i}><strong>Lv {s.level}</strong>: {s.label}</li>))}
            </ol>
            {data.summary.warnings.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, color: '#b45309', fontSize: 12 }}>
                {data.summary.warnings.map((w, i) => (<li key={i}>{w}</li>))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#64748b' }}>Connect Progression Steps to summarize a route. Create multiple outputs to compare branches.</div>
        )}
      </PanelBox>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

const nodeTypes = { progressStep: ProgressStepNode, routeOutput: RouteOutputNode }

export function ProgressionPlanner(props: { character?: BuilderState; derived?: any }) {
  // Initial graph
  const initialNodes = useMemo(() => [
    { id: 'step-1', type: 'progressStep', position: { x: 80, y: 40 }, data: { level: 1, type: 'class', className: 'Fighter' } as ProgressStepData },
    { id: 'step-2', type: 'progressStep', position: { x: 80, y: 220 }, data: { level: 4, type: 'feat', featName: 'Great Weapon Master' } as ProgressStepData },
    { id: 'step-3', type: 'progressStep', position: { x: 80, y: 400 }, data: { level: 5, type: 'class', className: 'Fighter' } as ProgressStepData },
    { id: 'out-1', type: 'routeOutput', position: { x: 560, y: 200 }, data: { summary: null } as RouteOutputData },
  ], [])

  const [nodes, setNodes, baseOnNodesChange] = useNodesState<any>(initialNodes as any)
  const [edges, setEdges, baseOnEdgesChange] = useEdgesState([
    { id: 'e1', source: 'step-1', target: 'out-1' },
    { id: 'e2', source: 'step-2', target: 'out-1' },
    { id: 'e3', source: 'step-3', target: 'out-1' },
  ])

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

  // Seed onChange & onDelete
  React.useEffect(() => {
    setNodes((nds: any[]) => nds.map((n) => (
      n.data?.onChange && n.data?.onDelete ? n : { ...n, data: { ...n.data, onChange: (p: any) => updateNodeData(n.id, p), onDelete: (id: string) => removeNode(id) } }
    )))
  }, [updateNodeData])

  const removeNode = useCallback((id: string) => {
    snapshot()
    setNodes((nds: any[]) => nds.filter((n) => n.id !== id))
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
  }, [setNodes, setEdges])

  const computeGraph = useCallback(() => {
    const map = new Map(nodes.map((n) => [n.id, n] as const))

    const nextNodes = nodes.map((n) => {
      if (n.type !== 'routeOutput') return n
      const incoming = edges.filter((e) => e.target === n.id)
      const stepNodes = incoming.map((e) => map.get(e.source)).filter(Boolean).filter((x: any) => x.type === 'progressStep') as any[]

      if (!stepNodes.length) return { ...n, data: { ...n.data, summary: null } }

      const steps = stepNodes.map((s) => {
        const d = s.data as ProgressStepData
        let label = ''
        if (d.type === 'class') label = `Class Level → ${d.className || 'Fighter'}`
        else if (d.type === 'feat') label = `Feat → ${d.featName || 'Unknown Feat'}`
        else if (d.type === 'asi') label = `ASI → ${d.asi || '+2 to one ability'}`
        else label = d.notes || 'Note'
        return { level: d.level, label }
      })

      steps.sort((a, b) => a.level - b.level)

      const classBreakdown: Record<string, number> = {}
      let totalLevels = 0
      stepNodes.forEach((s) => {
        const d = s.data as ProgressStepData
        if (d.type === 'class') {
          const k = d.className || 'Fighter'
          classBreakdown[k] = (classBreakdown[k] || 0) + 1
          totalLevels += 1
        }
      })

      const warnings: string[] = []
      if (totalLevels > 20) warnings.push('Total class levels exceed 20.')
      // Rough guidance for ASI levels (4/8/12/16/19) not exact with multiclassing; kept out to avoid confusion.

      return { ...n, data: { ...n.data, summary: { totalLevels, classBreakdown, steps, warnings } } }
    })

    historyRef.current.suppress = true
    setNodes(nextNodes as any)
    historyRef.current.suppress = false
  }, [nodes, edges, setNodes])

  React.useEffect(() => { computeGraph() }, [nodes.length, JSON.stringify(edges), JSON.stringify(nodes.map(n => n.data))])

  const addNode = (type: keyof typeof nodeTypes) => {
    const id = `${type}-${crypto.randomUUID().slice(0, 6)}`
    const y = 40 + Math.random() * 720
    const base: any = { id, type, position: { x: 80, y }, data: {} }
    if (type === 'progressStep') Object.assign(base.data, { level: 1, type: 'class', className: 'Fighter' } as ProgressStepData)
    if (type === 'routeOutput') Object.assign(base.data, { summary: null } as RouteOutputData)
    // inject handlers
    base.data.onChange = (p: any) => updateNodeData(id, p)
    base.data.onDelete = (nodeId: string) => removeNode(nodeId)

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

        <section style={card}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Add Nodes</div>
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={() => addNode('progressStep')} style={btn}>+ Step</button>
            <button onClick={() => addNode('routeOutput')} style={btn}>+ Output</button>
          </div>
          <div style={{ padding: '0 12px 12px', fontSize: 12, color: '#64748b' }}>Create multiple outputs and connect different sets of steps to compare branches (e.g., Feat A vs Feat B, or different multiclass splits).</div>
        </section>

        <section style={card}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Tips</div>
          <ul style={{ padding: 12, margin: 0, color: '#475569', fontSize: 14 }}>
            <li>Add a Step for each class level, feat, or ASI at the level it occurs.</li>
            <li>Connect Steps into an Output to summarize that route. Duplicate outputs to compare alternatives.</li>
            <li>Use the Notes field on steps to record rationale or prerequisites.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

export default ProgressionPlanner
