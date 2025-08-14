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
// removed unused delBtn/addBtnRight styles

// Domain data small set
const CLASSES = [
  'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'
] as const

// Subclass unlock levels by class (5e-like defaults)
const SUBCLASS_LEVELS: Record<(typeof CLASSES)[number], number> = {
  Barbarian: 3,
  Bard: 3,
  Cleric: 1,
  Druid: 2,
  Fighter: 3,
  Monk: 3,
  Paladin: 3,
  Ranger: 3,
  Rogue: 3,
  Sorcerer: 1,
  Warlock: 1,
  Wizard: 2,
}

// Races and Backgrounds for root node (mirrors Builder catalog for Scratch tokens)
const RACE_NAMES = [
  'Human (Base)', 'Human (Variant)',
  // Elves
  'Elf (Wood)', 'Elf (High)',
  // Dwarves
  'Dwarf (Hill)', 'Dwarf (Mountain)',
  // Halflings
  'Halfling (Lightfoot)', 'Halfling (Stout)',
  // Tiefling, Dragonborn + variants
  'Tiefling', 'Dragonborn',
  'Dragonborn (Black)', 'Dragonborn (Blue)', 'Dragonborn (Brass)', 'Dragonborn (Bronze)', 'Dragonborn (Copper)', 'Dragonborn (Gold)', 'Dragonborn (Green)', 'Dragonborn (Red)', 'Dragonborn (Silver)', 'Dragonborn (White)',
  // Others
  'Gnome', 'Half-Orc',
 ] as const
const BACKGROUNDS = [
  'Soldier', 'Acolyte', 'Criminal', 'Sage', 'Folk Hero', 'Urchin',
  'Noble', 'Outlander', 'Sailor',
] as const

type StepType = 'level' | 'class' | 'feat' | 'asi' | 'bundle' | 'subclass' | 'note'

// Add token type for typed ASI holes
type AbilityToken = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'

type ProgressStepData = {
  onChange?: (p: Partial<ProgressStepData>) => void
  onDelete?: (id: string) => void
  onAddChild?: (kind?: StepType) => void
  onApply?: () => void
  // Duplicate the entire branch for the root that contains this node
  onCloneFromSelf?: () => void
  level: number
  type: StepType
  className?: typeof CLASSES[number]
  featName?: string
  feats?: string[]
  asi?: string // e.g., "+2 STR" or "+1 STR/+1 CON"
  // Optional typed ASI holes integrated into nodes
  ability1?: AbilityToken | null
  ability2?: AbilityToken | null
  // For subclass decision nodes
  subclass?: string
  notes?: string
  // UI/Customization
  collapsed?: boolean
  // Marks this step as a future/planned choice (not yet taken). Affects styling & builder reference logic.
  future?: boolean
  // Feature choices bundle
  featureChoices?: FeatureChoice[]
  // UI state (derived, not persisted)
  _active?: boolean
}

// Feature Choices for bundle nodes
type FeatureChoice =
  | { id: string; kind: 'fighting-style'; style?: string }
  | { id: string; kind: 'skill-proficiency'; skills: string[]; count: number }
  | { id: string; kind: 'other'; text?: string }

type RootNodeData = {
  race?: string
  background?: string
  other?: string
  onChange?: (p: Partial<RootNodeData>) => void
  onDelete?: (id: string) => void
  onClone?: () => void
  onApply?: () => void
  onAddChild?: (kind?: StepType) => void
  collapsed?: boolean
  // UI state (derived, not persisted)
  _active?: boolean
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
const SKILLS = [
  'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation',
  'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'
] as const
const FIGHTING_STYLES = [
  'Archery', 'Defense', 'Dueling', 'Great Weapon Fighting', 'Protection', 'Two-Weapon Fighting',
] as const

type ScratchBlock =
  | { id: string; kind: 'class'; level: number; className?: typeof CLASSES[number] }
  | { id: string; kind: 'feat'; level: number; featName?: string }
  | { id: string; kind: 'asi'; level: number; ability1: AbilityToken | null; ability2: AbilityToken | null }
  | { id: string; kind: 'note'; level: number; text: string }

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

function TokenChip(props: { label: string; type: 'ability' | 'class' | 'race' | 'background' | 'text'; value: string }) {
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
            {(CLASSES as readonly string[])
              .slice()
              .sort((a, b) => a.localeCompare(b))
              .map((c: string) => (<option key={c} value={c}>{c}</option>))}
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
  const { deleteElements, getEdges, setNodes: rfSetNodes, setEdges: rfSetEdges, getNodes, getNode } = useReactFlow()
  const handleDelete = useCallback((e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); deleteElements({ nodes: [{ id }] }) }, [deleteElements, id])
  const [over, setOver] = useState<string | null>(null)
  const [overAny, setOverAny] = useState(false)
  const future = !!data.future

  // Drag-to-fill refs/state
  const fillRef = useRef<{ active: boolean; startClientX: number; baseX: number; baseY: number; baseLevel: number; className?: string; lastId: string; added: number; deleted: number }>({ active: false, startClientX: 0, baseX: 0, baseY: 0, baseLevel: 1, className: undefined, lastId: id, added: 0, deleted: 0 })
  const stopFillListeners = useCallback(() => {
    window.removeEventListener('pointermove', onFillMove as any)
    window.removeEventListener('pointerup', onFillEnd as any)
  }, [])
  const onFillEnd = useCallback(() => { fillRef.current.active = false; stopFillListeners() }, [stopFillListeners])
  const onFillMove = useCallback((e: PointerEvent) => {
    if (!fillRef.current.active) return
    const dxRaw = e.clientX - fillRef.current.startClientX
    const stepPx = 120
    if (dxRaw >= 0) {
      const dx = Math.max(0, dxRaw)
      let want = Math.floor(dx / stepPx)
      if (want <= fillRef.current.added) return
      const remaining = Math.max(0, 20 - fillRef.current.baseLevel)
      want = Math.min(want, remaining)
      let prevId = fillRef.current.lastId
      const nodesList = (getNodes?.() as any[]) || []
      const edgesList = (getEdges?.() as any[]) || []
      const toAddNodes: any[] = []
      const toAddEdges: any[] = []
      for (let i = fillRef.current.added + 1; i <= want; i += 1) {
        const level = fillRef.current.baseLevel + i
        const nid = `step-${crypto.randomUUID().slice(0, 6)}`
        toAddNodes.push({ id: nid, type: 'progressStep', position: { x: fillRef.current.baseX + i * 320, y: fillRef.current.baseY }, data: { level, type: 'class', className: fillRef.current.className, collapsed: true } as any })
        toAddEdges.push({ id: `e-${crypto.randomUUID().slice(0, 6)}`, source: prevId, target: nid })
        prevId = nid
      }
      fillRef.current.added = want
      fillRef.current.lastId = prevId
      if (toAddNodes.length) rfSetNodes?.([...(nodesList as any), ...toAddNodes])
      if (toAddEdges.length) rfSetEdges?.([...(edgesList as any), ...toAddEdges])
    } else {
      const dx = Math.abs(dxRaw)
      let wantDel = Math.floor(dx / stepPx)
      if (wantDel <= fillRef.current.deleted) return
      const nodesList = (getNodes?.() as any[]) || []
      const edgesList = (getEdges?.() as any[]) || []
      const idToNode = new Map(nodesList.map((n: any) => [n.id, n] as const))
      const forward: any[] = []
      let cur = id
      let guard = 0
      while (cur && guard < 256) {
        guard += 1
        const outs = (edgesList as any[]).filter((e: any) => e.source === cur)
        if (!outs.length) break
        const nextId = outs.map((e: any) => ({ e, n: idToNode.get(e.target) }))
          .filter((x: any) => !!x.n)
          .sort((a: any, b: any) => (a.n!.position?.y || 0) - (b.n!.position?.y || 0))[0]?.n?.id
        if (!nextId) break
        const nn = idToNode.get(nextId)
        if (!nn) break
        forward.push(nn)
        cur = nextId
      }
      const className = fillRef.current.className
      const sameClassForward = forward.filter((n) => n.type === 'progressStep' && n.data?.type === 'class' && n.data?.className === className)
      const deletable = sameClassForward.length
      if (deletable <= 0) return
      wantDel = Math.min(wantDel, deletable)
      const toRemoveCount = wantDel - fillRef.current.deleted
      if (toRemoveCount <= 0) return
      const toRemove = sameClassForward.slice(-toRemoveCount).map((n) => n.id)
      const remainingNodes = nodesList.filter((n: any) => !toRemove.includes(n.id))
      const remainingEdges = edgesList.filter((e: any) => !toRemove.includes(e.source) && !toRemove.includes(e.target))
      fillRef.current.deleted = wantDel
      if (toRemove.includes(fillRef.current.lastId)) {
        const stillThere = sameClassForward.filter((n) => !toRemove.includes(n.id)).pop()?.id || id
        fillRef.current.lastId = stillThere
      }
      rfSetNodes?.(remainingNodes as any)
      rfSetEdges?.(remainingEdges as any)
    }
  }, [getNodes, getEdges, rfSetNodes, rfSetEdges, id])
  const onFillStart = useCallback((e: React.PointerEvent) => {
    if (data.type !== 'class' || !data.className) return
    e.preventDefault(); e.stopPropagation()
    const n = getNode?.(id) as any
    fillRef.current = { active: true, startClientX: e.clientX, baseX: (n?.position?.x ?? 0), baseY: (n?.position?.y ?? 0), baseLevel: Number(data.level) || 1, className: data.className, lastId: id, added: 0, deleted: 0 }
    window.addEventListener('pointermove', onFillMove as any)
    window.addEventListener('pointerup', onFillEnd as any, { once: true })
  }, [data.type, data.className, data.level, id, getNode, onFillMove, onFillEnd])

  const toggleCollapsed = () => data.onChange?.({ collapsed: !data.collapsed })
  const summary = useMemo(() => {
    const parts: string[] = []
    parts.push(`L${data.level}`)
    if (data.type === 'class') parts.push(data.className || 'Class')
    if (data.type === 'feat' && (data.featName || (data.feats && data.feats.length))) {
      const count = (data.feats?.length || 0) + (data.featName ? 1 : 0)
      parts.push(count > 1 ? `${count} feats` : 'Feat')
    }
    if (data.type === 'asi') {
      if (data.ability1 || data.ability2 || data.asi) parts.push(data.asi || buildAsiString(data.ability1, data.ability2) || 'ASI')
    }
    if (data.type === 'bundle') {
      const fc = data.featureChoices || []
      const kinds = new Set(fc.map((c) => c.kind))
      const labels: string[] = []
      if (kinds.has('fighting-style')) labels.push('Fighting Style')
      if (kinds.has('skill-proficiency')) labels.push('Skills')
      if (kinds.has('other')) labels.push('Other')
      parts.push(labels.length ? `Choices: ${labels.join(', ')}` : 'Choices')
    }
    if (data.type === 'subclass') parts.push(`Subclass${data.subclass ? `: ${data.subclass}` : ''}`)
    if ((data.notes || '').trim()) parts.push((data.notes || '').trim().slice(0, 32))
    return parts.join(' • ')
  }, [data.level, data.type, data.className, data.featName, data.asi, data.notes, data.featureChoices, data.subclass, data.ability1, data.ability2])
  const qualifiesForImprovements = useMemo(() => {
    const lvl = Number(data.level)
    const base = [4, 8, 12, 16, 19].includes(lvl)
    const fighterExtra = data.className === 'Fighter' && (lvl === 6 || lvl === 14)
    const rogueExtra = data.className === 'Rogue' && lvl === 10
    return base || fighterExtra || rogueExtra
  }, [data.level, data.className])
  const isValidAttachConnection = useCallback((conn: any) => {
    if (conn?.targetHandle !== 'attach') return true
    const src = conn?.source ? getNode(conn.source) as any : null
    const tgt = conn?.target ? getNode(conn.target) as any : null
    const okSource = !!(src && src.type === 'progressStep' && (src.data?.type === 'asi' || src.data?.type === 'bundle' || src.data?.type === 'subclass'))
    const okTarget = !!(tgt && tgt.type === 'progressStep' && tgt.data?.type === 'class')
    return okSource && okTarget
  }, [getNode])
  const attachedChoiceCount = useMemo(() => {
    const directChoices = Array.isArray((data as any)?.featureChoices) ? (data as any).featureChoices.length : 0
    if ((data as any)?.type !== 'class') return directChoices
    try {
      const incoming = (getEdges?.() || []).filter((e: any) => e.target === id && e?.targetHandle === 'attach')
      let extra = 0
      for (const e of incoming) {
        const src = getNode?.(e.source) as any
        if (!src || src.type !== 'progressStep') continue
        if (src.data?.type === 'bundle' && Array.isArray(src.data?.featureChoices)) extra += src.data.featureChoices.length
        else if (src.data?.type === 'asi') extra += 1
        else if (src.data?.type === 'subclass') extra += 1
      }
      return directChoices + extra
    } catch { return directChoices }
  }, [data, getEdges, getNode, id])
  const activeGlow = data?._active ? '0 0 0 2px rgba(14,165,233,0.35), 0 6px 20px rgba(14,165,233,0.25)' : '0 1px 2px rgba(0,0,0,0.06)'
  return (
    <div style={{ position: 'relative', boxShadow: activeGlow, outline: overAny ? '2px dashed #0ea5e9' : undefined, outlineOffset: -2, opacity: future ? 0.55 : undefined }}
      onDragOver={(e) => { if (Array.from(e.dataTransfer.types || []).includes(DND_TOKEN_MIME)) { e.preventDefault(); setOverAny(true) } }}
      onDragLeave={() => setOverAny(false)}
      onDrop={(e) => {
        setOverAny(false)
        const raw = e.dataTransfer.getData(DND_TOKEN_MIME); if (!raw) return
        try {
          const tok = JSON.parse(raw)
          if (data.type === 'class' && tok.type === 'class' && (CLASSES as readonly string[]).includes(tok.value)) { data.onChange?.({ className: tok.value }); e.stopPropagation(); return }
          if (data.type === 'asi' && tok.type === 'ability' && (ABILITIES as readonly string[]).includes(tok.value)) {
            const a1 = (data.ability1 as any) || null; const a2 = (data.ability2 as any) || null
            if (!a1) data.onChange?.({ ability1: tok.value as any, asi: buildAsiString(tok.value, a2 as any) })
            else if (!a2) data.onChange?.({ ability2: tok.value as any, asi: buildAsiString(a1 as any, tok.value) })
            else data.onChange?.({ ability2: tok.value as any, asi: buildAsiString(a1 as any, tok.value) })
            e.stopPropagation(); return
          }
        } catch {}
      }}>
      <details className="nodrag nopan" style={{ position: 'absolute', top: 4, right: 4, zIndex: 10 }}>
        <summary role="button" style={{ listStyle: 'none', width: 24, height: 24, borderRadius: 999, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#0f172a', lineHeight: '22px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }} onPointerDown={(e) => { e.stopPropagation() }} onMouseDown={(e) => { e.stopPropagation() }} onClick={(e) => { e.stopPropagation() }} title="Node actions">⋯</summary>
        <div style={{ position: 'absolute', right: 0, top: 28, display: 'grid', gap: 6, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} onClick={(e) => e.stopPropagation()}>
          <button className="nodrag nopan" style={btn} onClick={(e) => { e.preventDefault(); handleDelete(e as any); const dtl = (e.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null; if (dtl) dtl.removeAttribute('open') }}>Delete</button>
          <button className="nodrag nopan" style={btn} onClick={(e) => { e.preventDefault(); toggleCollapsed(); const dtl = (e.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null; if (dtl) dtl.removeAttribute('open') }}>{data.collapsed ? 'Show' : 'Hide'}</button>
          {data.onApply ? (<button className="nodrag nopan" style={btn} onClick={(e) => { e.preventDefault(); data.onApply?.(); const dtl = (e.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null; if (dtl) dtl.removeAttribute('open') }}>Apply to Builder</button>) : null}
          {data.onCloneFromSelf ? (<button className="nodrag nopan" style={btn} onClick={(e) => { e.preventDefault(); data.onCloneFromSelf?.(); const dtl = (e.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null; if (dtl) dtl.removeAttribute('open') }}>Duplicate Branch</button>) : null}
        </div>
      </details>
      <Handle type="target" position={Position.Left} />
      {data?.type === 'class' ? (
        <div className="nodrag nopan" onPointerDown={onFillStart} title={data.className ? `Drag to extend ${data.className} levels` : 'Set class to enable quick-fill'} style={{ position: 'absolute', bottom: -8, right: -8, width: 16, height: 16, borderRadius: 4, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', cursor: data.className ? 'ew-resize' : 'not-allowed', display: 'grid', placeItems: 'center', fontSize: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.06)', zIndex: 10 }}>»</div>
      ) : null}
      {data?.type === 'bundle' || data?.type === 'asi' || data?.type === 'subclass' ? (<Handle type="source" id="top" position={Position.Top} style={{ background: '#0ea5e9', width: 10, height: 10, border: '2px solid #fff' }} />) : null}
      {data?.type === 'class' ? (<Handle type="target" id="attach" position={Position.Bottom} isValidConnection={isValidAttachConnection} style={{ background: '#0ea5e9', width: 10, height: 10, border: '2px solid #fff' }} />) : null}
      {data?.type === 'class' ? (
        <button className="nodrag nopan" onClick={(e) => {
          e.preventDefault(); e.stopPropagation();
          try {
            const nid = `step-${crypto.randomUUID().slice(0, 6)}`
            const y = (getNode?.(id) as any)?.position?.y ?? 0
            const x = (getNode?.(id) as any)?.position?.x ?? 0
            const subclassLevel = data.className ? SUBCLASS_LEVELS[data.className as keyof typeof SUBCLASS_LEVELS] : undefined
            const makeSubclass = !!(data.className && subclassLevel && Number(data.level) === subclassLevel)
            const makeAsi = !makeSubclass && !!qualifiesForImprovements
            const newNode: any = { id: nid, type: 'progressStep', position: { x, y: y + 100 }, data: makeAsi ? { level: data.level, type: 'asi', ability1: null, ability2: null, asi: '', collapsed: false } : makeSubclass ? { level: data.level, type: 'subclass', subclass: '', collapsed: false } : { level: data.level, type: 'bundle', featureChoices: [], collapsed: false } }
            const newEdge: any = { id: `e-${crypto.randomUUID().slice(0, 6)}`, source: nid, sourceHandle: 'top', target: id, targetHandle: 'attach' }
            const list = (getNodes?.() as any[]) || []
            rfSetNodes?.([...(list as any), newNode])
            const existingEdges = (getEdges?.() as any[]) || []
            rfSetEdges?.([...(existingEdges as any), newEdge])
          } catch {}
        }} title={(data.className && SUBCLASS_LEVELS[data.className as keyof typeof SUBCLASS_LEVELS] === Number(data.level)) ? 'Attach Subclass' : (qualifiesForImprovements ? 'Attach ASI' : 'Attach Feature Choices')} style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(8px)', width: 20, height: 20, borderRadius: 999, border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>+</button>
      ) : null}
      {data?.type === 'class' && attachedChoiceCount > 0 ? (
        <div className="nodrag nopan" style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(10px)', background: '#0ea5e9', color: '#fff', fontSize: 10, lineHeight: '14px', height: 16, minWidth: 16, padding: '0 4px', borderRadius: 999, border: '2px solid #fff', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }} title="Attached feature choices">{attachedChoiceCount}</div>
      ) : null}
      <PanelBox title={`Step — ${summary}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ ...badge }}>Type: {data.type}</span>
            <span style={{ ...badge }}>Level: {data.level}</span>
          </div>
        </div>
        {!data.collapsed && (
          <>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: '#fff', border: '1px solid #e2e8f0', padding: '4px 8px', borderRadius: 6, width: 'fit-content' }} title="Mark this step as a planned future choice (will appear greyed)">
              <input type="checkbox" checked={future} onChange={e => data.onChange?.({ future: e.target.checked })} />
              <span>{future ? 'Future Step (planned)' : 'Current Step'}</span>
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
              <span>Character Level</span>
              <input type="number" min={1} max={20} value={data.level} onChange={(e) => data.onChange?.({ level: Math.max(1, Math.min(20, parseInt(e.target.value || '1', 10))) })} style={inp} />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
              <span>Step Type</span>
              <select value={data.type} onChange={(e) => data.onChange?.({ type: e.target.value as StepType })} style={inp}>
                <option value="class">Class Level</option>
                <option value="feat">Feat</option>
                <option value="asi">ASI</option>
                <option value="bundle">Feature Choices</option>
                <option value="note">Note</option>
                <option value="subclass">Subclass</option>
              </select>
            </label>
            {data.type === 'class' && (
              <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
                <span>Class</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span onDragOver={(e) => { e.preventDefault(); setOver('class') }} onDragLeave={() => setOver(null)} onDrop={(e) => { setOver(null); const raw = e.dataTransfer.getData('application/x-scratch-token'); if (!raw) return; try { const tok = JSON.parse(raw); if (tok.type === 'class' && (CLASSES as readonly string[]).includes(tok.value)) data.onChange?.({ className: tok.value }) } catch {} }} style={{ display: 'inline-flex', alignItems: 'center', minWidth: 72, padding: '4px 8px', borderRadius: 8, border: `2px dashed ${over === 'class' ? '#0ea5e9' : '#cbd5e1'}`, background: over === 'class' ? '#e0f2fe' : '#f8fafc', color: '#0f172a', fontSize: 12, gap: 6 }}>{data.className ? <span style={{ padding: '2px 6px', borderRadius: 999, background: '#e2e8f0', fontSize: 12 }}>{data.className}</span> : <span style={{ color: '#64748b' }}>drop class here</span>}</span>
                  <select value={data.className || 'Fighter'} onChange={(e) => data.onChange?.({ className: e.target.value as any })} style={inp}>
                    {(CLASSES as readonly string[]).slice().sort((a, b) => a.localeCompare(b)).map((c: string) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>
              </label>
            )}
            {data.type === 'feat' && (
              <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
                <span>Feats (this level)</span>
                <input value={data.featName || ''} onChange={(e) => data.onChange?.({ featName: e.target.value })} placeholder="Great Weapon Master" style={inp} />
                <div style={{ display: 'grid', gap: 6 }}>
                  {(data.feats || []).map((f, i) => (
                    <div key={`${i}-${f}`} style={{ display: 'flex', gap: 6 }}>
                      <input value={f} onChange={(e) => { const copy = [...(data.feats || [])]; copy[i] = e.target.value; data.onChange?.({ feats: copy }) }} style={inp} />
                      <button onClick={() => data.onChange?.({ feats: (data.feats || []).filter((_, idx) => idx !== i) })} style={btn} title="Remove">×</button>
                    </div>
                  ))}
                  <button onClick={() => data.onChange?.({ feats: [...(data.feats || []), ''] })} style={btn}>+ Add Feat</button>
                </div>
              </label>
            )}
            {data.type === 'asi' && (
              <div style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
                <span>ASI (+1/+1 or +2):</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span onDragOver={(e) => { e.preventDefault(); setOver('a1') }} onDragLeave={() => setOver(null)} onDrop={(e) => { setOver(null); const raw = e.dataTransfer.getData('application/x-scratch-token'); if (!raw) return; try { const tok = JSON.parse(raw); if (tok.type === 'ability') data.onChange?.({ ability1: tok.value as AbilityToken, asi: buildAsiString(tok.value, data.ability2) }) } catch {} }} style={{ display: 'inline-flex', alignItems: 'center', minWidth: 72, padding: '4px 8px', borderRadius: 8, border: `2px dashed ${over === 'a1' ? '#0ea5e9' : '#cbd5e1'}`, background: over === 'a1' ? '#e0f2fe' : '#f8fafc', color: '#0f172a', fontSize: 12, gap: 6 }}>{data.ability1 ? <span style={{ padding: '2px 6px', borderRadius: 999, background: '#e2e8f0', fontSize: 12 }}>{data.ability1}</span> : <span style={{ color: '#64748b' }}>drop ability</span>}</span>
                  <span onDragOver={(e) => { e.preventDefault(); setOver('a2') }} onDragLeave={() => setOver(null)} onDrop={(e) => { setOver(null); const raw = e.dataTransfer.getData('application/x-scratch-token'); if (!raw) return; try { const tok = JSON.parse(raw); if (tok.type === 'ability' && (ABILITIES as readonly string[]).includes(tok.value)) data.onChange?.({ ability2: tok.value as AbilityToken, asi: buildAsiString(data.ability1, tok.value) }) } catch {} }} style={{ display: 'inline-flex', alignItems: 'center', minWidth: 72, padding: '4px 8px', borderRadius: 8, border: `2px dashed ${over === 'a2' ? '#0ea5e9' : '#cbd5e1'}`, background: over === 'a2' ? '#e0f2fe' : '#f8fafc', color: '#0f172a', fontSize: 12, gap: 6 }}>{data.ability2 ? <span style={{ padding: '2px 6px', borderRadius: 999, background: '#e2e8f0', fontSize: 12 }}>{data.ability2}</span> : <span style={{ color: '#64748b' }}>drop ability</span>}</span>
                  <input value={data.asi || ''} onChange={(e) => data.onChange?.({ asi: e.target.value })} placeholder="+2 STR or +1 STR / +1 CON" style={inp} />
                </div>
              </div>
            )}
            {data.type === 'bundle' && (
              <div style={{ display: 'grid', gap: 10, fontSize: 12, color: '#475569' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Feature Choices</span>
                  <button style={btn} onClick={() => { const newChoice: FeatureChoice = { id: `ch-${crypto.randomUUID().slice(0,6)}`, kind: 'fighting-style', style: undefined }; data.onChange?.({ featureChoices: [...(data.featureChoices || []), newChoice] }) }}>+ Add Choice</button>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {(data.featureChoices || []).map((c, idx) => (
                    <div key={c.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, background: '#f8fafc', display: 'grid', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span>Kind</span>
                          <select value={c.kind} onChange={(e) => { const kind = e.target.value as FeatureChoice['kind']; const base = kind === 'fighting-style' ? { id: c.id, kind, style: undefined as string | undefined } : kind === 'skill-proficiency' ? { id: c.id, kind, skills: [] as string[], count: 2 } : { id: c.id, kind, text: '' as string }; const next = [...(data.featureChoices || [])]; next[idx] = base as FeatureChoice; data.onChange?.({ featureChoices: next }) }} style={inp}>
                            <option value="fighting-style">Fighting Style</option>
                            <option value="skill-proficiency">Skill Proficiencies</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <button style={btn} title="Remove" onClick={() => data.onChange?.({ featureChoices: (data.featureChoices || []).filter((x) => x.id !== c.id) })}>×</button>
                      </div>
                      {c.kind === 'fighting-style' && (
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span>Fighting Style</span>
                          <select value={(c as any).style || ''} onChange={(e) => { const next = [...(data.featureChoices || [])]; next[idx] = { ...(c as any), style: e.target.value } as FeatureChoice; data.onChange?.({ featureChoices: next }) }} style={inp}>
                            <option value="">Select…</option>
                            {(FIGHTING_STYLES as readonly string[]).map((s) => (<option key={s} value={s}>{s}</option>))}
                          </select>
                        </label>
                      )}
                      {c.kind === 'skill-proficiency' && (
                        <div style={{ display: 'grid', gap: 6 }}>
                          <label style={{ display: 'grid', gap: 6 }}>
                            <span>Choose up to</span>
                            <input type="number" min={1} max={6} value={(c as any).count ?? 2} onChange={(e) => { const val = Math.max(1, Math.min(6, parseInt(e.target.value || '1', 10))); const next = [...(data.featureChoices || [])]; const cur = { ...(c as any) }; cur.count = val; if (Array.isArray(cur.skills) && cur.skills.length > val) cur.skills = cur.skills.slice(0, val); next[idx] = cur as FeatureChoice; data.onChange?.({ featureChoices: next }) }} style={{ ...inp, width: 80 }} />
                          </label>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {(SKILLS as readonly string[]).map((s) => { const sel = Array.isArray((c as any).skills) ? (c as any).skills : []; const max = (c as any).count ?? 2; const checked = sel.includes(s); const disabled = !checked && sel.length >= max; return (<label key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: 8, background: disabled ? '#f1f5f9' : '#fff', color: disabled ? '#94a3b8' : '#0f172a' }}><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => { const next = [...(data.featureChoices || [])]; const cur = { ...(c as any) }; const arr: string[] = Array.isArray(cur.skills) ? cur.skills.slice() : []; if (e.target.checked) { if (!arr.includes(s) && arr.length < max) arr.push(s) } else { const i = arr.indexOf(s); if (i >= 0) arr.splice(i, 1) } cur.skills = arr; next[idx] = cur as FeatureChoice; data.onChange?.({ featureChoices: next }) }} /><span style={{ fontSize: 12 }}>{s}</span></label>) })}
                          </div>
                        </div>
                      )}
                      {c.kind === 'other' && (
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span>Details</span>
                          <input value={(c as any).text || ''} onChange={(e) => { const next = [...(data.featureChoices || [])]; next[idx] = { ...(c as any), text: e.target.value } as FeatureChoice; data.onChange?.({ featureChoices: next }) }} placeholder="Describe the choice" style={inp} />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.type === 'subclass' && (
              <div style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
                <span>Subclass</span>
                <input value={data.subclass || ''} onChange={(e) => data.onChange?.({ subclass: e.target.value })} placeholder="Champion / Battle Master / Arcane Trickster …" style={inp} />
              </div>
            )}
          </>
        )}
      </PanelBox>
      {data.onAddChild ? (
        <div style={{ position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)', zIndex: 9 }}>
          <details className="nodrag nopan" style={{ position: 'relative' }}>
            <summary role="button" style={{ listStyle: 'none', width: 24, height: 24, borderRadius: 999, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#0f172a', lineHeight: '22px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }} onPointerDown={(e) => { e.stopPropagation() }} onMouseDown={(e) => { e.stopPropagation() }} onClick={(e) => { e.stopPropagation() }} title="Add and connect a new step">+</summary>
            <div style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 8, background: 'white', border: '1px solid #e2e8f0', borderRadius: 999, padding: '4px 8px', boxShadow: '0 6px 20px rgba(0,0,0,0.08)' }} onClick={(e) => e.stopPropagation()}>
              {(['class','feat','asi','bundle','subclass','note'] as StepType[]).map((k) => (
                <button key={k} className="nodrag nopan" style={{ ...btn, padding: '4px 8px' }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); data.onAddChild?.(k); const dtl = (e.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null; if (dtl && dtl.hasAttribute('open')) dtl.removeAttribute('open') }} onPointerDown={(e) => { e.stopPropagation() }} onMouseDown={(e) => { e.stopPropagation() }}>{k}</button>
              ))}
            </div>
          </details>
        </div>
      ) : null}
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

  const toggleCollapsed = () => data.onChange?.({ collapsed: !data.collapsed })
  const [over, setOver] = useState<string | null>(null)
  const [overAny, setOverAny] = useState<boolean>(false)

  const activeGlow = data?._active ? '0 0 0 2px rgba(14,165,233,0.35), 0 6px 20px rgba(14,165,233,0.25)' : '0 1px 2px rgba(0,0,0,0.06)'
  return (
    <div
      style={{ position: 'relative', boxShadow: activeGlow, outline: overAny ? '2px dashed #0ea5e9' : undefined, outlineOffset: -2 }}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types || []).includes(DND_TOKEN_MIME)) {
          e.preventDefault()
          setOverAny(true)
        }
      }}
      onDragLeave={() => setOverAny(false)}
      onDrop={(e) => {
        setOverAny(false)
        const raw = e.dataTransfer.getData(DND_TOKEN_MIME)
        if (!raw) return
        try {
          const tok = JSON.parse(raw)
          if (tok.type === 'race' && (RACE_NAMES as readonly string[]).includes(tok.value)) {
            data.onChange?.({ race: tok.value })
            e.stopPropagation()
            return
          }
          if (tok.type === 'background' && (BACKGROUNDS as readonly string[]).includes(tok.value)) {
            data.onChange?.({ background: tok.value })
            e.stopPropagation()
            return
          }
          if ((tok.type === 'text' || tok.type === 'other') && typeof tok.value === 'string') {
            data.onChange?.({ other: tok.value })
            e.stopPropagation()
            return
          }
        } catch {}
      }}
    >
      {/* Kebab actions */}
      <details className="nodrag nopan" style={{ position: 'absolute', top: 4, right: 4, zIndex: 10 }}>
        <summary
          role="button"
          style={{ listStyle: 'none', width: 24, height: 24, borderRadius: 999, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#0f172a', lineHeight: '22px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
          onPointerDown={(e) => { e.stopPropagation() }}
          onMouseDown={(e) => { e.stopPropagation() }}
          onClick={(e) => { e.stopPropagation() }}
          title="Node actions"
        >⋯</summary>
        <div
          style={{ position: 'absolute', right: 0, top: 28, display: 'grid', gap: 6, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="nodrag nopan" style={btn} onClick={(e) => { e.preventDefault(); handleDelete(e as any); const dtl = (e.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null; if (dtl) dtl.removeAttribute('open') }}>Delete</button>
          <button className="nodrag nopan" style={btn} onClick={(e) => { e.preventDefault(); toggleCollapsed(); const dtl = (e.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null; if (dtl) dtl.removeAttribute('open') }}>{data.collapsed ? 'Show' : 'Hide'}</button>
          {data.onClone ? (
            <button className="nodrag nopan" style={btn} onClick={(e) => { e.preventDefault(); data.onClone?.(); const dtl = (e.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null; if (dtl) dtl.removeAttribute('open') }}>Duplicate Branch</button>
          ) : null}
          {data.onApply ? (
            <button className="nodrag nopan" style={btn} onClick={(e) => { e.preventDefault(); data.onApply?.(); const dtl = (e.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null; if (dtl) dtl.removeAttribute('open') }}>Apply to Builder</button>
          ) : null}
        </div>
      </details>
      {/* Root has no target handle */}
  <PanelBox title="Character Start">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {data.race ? <span style={badge}>{data.race}</span> : null}
            {data.background ? <span style={badge}>{data.background}</span> : null}
            {data.other ? <span style={badge}>{data.other}</span> : null}
          </div>
          {/* actions moved to kebab */}
        </div>
        {!data.collapsed && (
          <>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
              <span>Race</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  onDragOver={(e) => { e.preventDefault(); setOver('race') }}
                  onDragLeave={() => setOver(null)}
                  onDrop={(e) => {
                    setOver(null)
                    const raw = e.dataTransfer.getData(DND_TOKEN_MIME)
                    if (!raw) return
                    try {
                      const tok = JSON.parse(raw)
                      if (tok.type === 'race' && (RACE_NAMES as readonly string[]).includes(tok.value)) data.onChange?.({ race: tok.value })
                    } catch {}
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', minWidth: 120, padding: '6px 10px', borderRadius: 8, border: `2px dashed ${over === 'race' ? '#0ea5e9' : '#cbd5e1'}`, background: over === 'race' ? '#e0f2fe' : '#f8fafc', color: '#0f172a', fontSize: 12, gap: 6 }}
                >{data.race ? <span style={{ padding: '2px 6px', borderRadius: 999, background: '#e2e8f0', fontSize: 12 }}>{data.race}</span> : <span style={{ color: '#64748b' }}>drop race here</span>}</span>
              </div>
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
              <span>Background</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  onDragOver={(e) => { e.preventDefault(); setOver('background') }}
                  onDragLeave={() => setOver(null)}
                  onDrop={(e) => {
                    setOver(null)
                    const raw = e.dataTransfer.getData(DND_TOKEN_MIME)
                    if (!raw) return
                    try {
                      const tok = JSON.parse(raw)
                      if (tok.type === 'background' && (BACKGROUNDS as readonly string[]).includes(tok.value)) data.onChange?.({ background: tok.value })
                    } catch {}
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', minWidth: 120, padding: '6px 10px', borderRadius: 8, border: `2px dashed ${over === 'background' ? '#0ea5e9' : '#cbd5e1'}`, background: over === 'background' ? '#e0f2fe' : '#f8fafc', color: '#0f172a', fontSize: 12, gap: 6 }}
                >{data.background ? <span style={{ padding: '2px 6px', borderRadius: 999, background: '#e2e8f0', fontSize: 12 }}>{data.background}</span> : <span style={{ color: '#64748b' }}>drop background here</span>}</span>
              </div>
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
              <span>Other Option</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  onDragOver={(e) => { e.preventDefault(); setOver('other') }}
                  onDragLeave={() => setOver(null)}
                  onDrop={(e) => {
                    setOver(null)
                    const raw = e.dataTransfer.getData(DND_TOKEN_MIME)
                    if (!raw) return
                    try {
                      const tok = JSON.parse(raw)
                      if (tok && (tok.type === 'text' || tok.type === 'other') && typeof tok.value === 'string') data.onChange?.({ other: tok.value })
                    } catch {}
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', minWidth: 120, padding: '6px 10px', borderRadius: 8, border: `2px dashed ${over === 'other' ? '#0ea5e9' : '#cbd5e1'}`, background: over === 'other' ? '#e0f2fe' : '#f8fafc', color: '#0f172a', fontSize: 12, gap: 6 }}
                >{data.other ? <span style={{ padding: '2px 6px', borderRadius: 999, background: '#e2e8f0', fontSize: 12 }}>{data.other}</span> : <span style={{ color: '#64748b' }}>drop text here</span>}</span>
              </div>
            </label>
            {/* Branch cloning moved to sidebar actions */}
          </>
        )}
      </PanelBox>
      {data.onAddChild ? (
        <div style={{ position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)', zIndex: 9 }}>
          <details className="nodrag nopan" style={{ position: 'relative' }}>
            <summary
              role="button"
              style={{ listStyle: 'none', width: 24, height: 24, borderRadius: 999, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#0f172a', lineHeight: '22px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
              onPointerDown={(e) => { e.stopPropagation() }}
              onMouseDown={(e) => { e.stopPropagation() }}
              onClick={(e) => { e.stopPropagation() }}
              title="Add and connect a new step"
            >+</summary>
            <div
              style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 8, background: 'white', border: '1px solid #e2e8f0', borderRadius: 999, padding: '4px 8px', boxShadow: '0 6px 20px rgba(0,0,0,0.08)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {(['class','feat','asi','bundle','note'] as StepType[]).map((k) => (
                <button
                  key={k}
                  className="nodrag nopan"
                  style={{ ...btn, padding: '4px 8px' }}
                  onClick={(e) => {
                    e.preventDefault(); e.stopPropagation()
                    data.onAddChild?.(k)
                    const dtl = (e.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null
                    if (dtl && dtl.hasAttribute('open')) dtl.removeAttribute('open')
                  }}
                  onPointerDown={(e) => { e.stopPropagation() }}
                  onMouseDown={(e) => { e.stopPropagation() }}
                >{k}</button>
              ))}
            </div>
          </details>
        </div>
      ) : null}
      <Handle type="source" position={Position.Right} />
  </div>
  )
}

// Node registry now: root + progress steps
const nodeTypes = { root: RootNode, progressStep: ProgressStepNode }

// Helper to build a plan from a given root
function buildPlanFromRoot(nodes: any[], edges: any[], rootId: string) {
  const idToNode = new Map(nodes.map((n) => [n.id, n] as const))
  const seq: any[] = []
  let cur = rootId
  let guard = 0
  while (cur && guard < 256) {
    guard += 1
    const outs = (edges as any[]).filter((e) => e.source === cur)
    if (!outs.length) break
    const nextId = outs
      .map((e) => ({ e, n: idToNode.get(e.target) }))
      .filter((x) => !!x.n)
      .sort((a, b) => (a.n!.position?.y || 0) - (b.n!.position?.y || 0))[0]?.n?.id
    if (!nextId) break
    const nn = idToNode.get(nextId)
    if (!nn) break
    if (nn.type === 'progressStep') seq.push(nn)
    cur = nextId
  }
  if (!seq.length) {
    const reach = new Set<string>()
    const stack = [rootId]
    while (stack.length) {
      const s = stack.pop()!
      if (reach.has(s)) continue
      reach.add(s)
      edges.filter((e: any) => e.source === s).forEach((e: any) => stack.push(e.target))
    }
    seq.push(...nodes.filter((n: any) => n.type === 'progressStep' && reach.has(n.id)))
    seq.sort((a, b) => (a.data?.level || 0) - (b.data?.level || 0) || (a.position?.y || 0) - (b.position?.y || 0))
  }
  const rootNode = idToNode.get(rootId)
  // Aggregate by level so we return a single entry per character level
  const byLevel = new Map<number, any>()
  for (const n of seq) {
    const lvl = Number(n.data?.level || 0)
    if (!lvl) continue
    const cur = byLevel.get(lvl) || { level: lvl, feats: [] as string[], featureChoices: [] as any[] }
  if (n.data?.className) cur.className = n.data.className
  if (n.data?.future) cur.future = true
    const feats: string[] = [
      ...(Array.isArray(n.data?.feats) ? n.data.feats.filter((x: any) => !!x) : []),
      ...(n.data?.featName ? [n.data.featName] : []),
    ]
    if (feats.length) cur.feats = [...cur.feats, ...feats]
    if (n.data?.asi) cur.asi = n.data.asi
    if (n.data?.ability1) cur.ability1 = n.data.ability1
    if (n.data?.ability2) cur.ability2 = n.data.ability2
    // Include feature choices defined directly on this node
    if (Array.isArray(n.data?.featureChoices) && n.data.featureChoices.length) cur.featureChoices = [...(cur.featureChoices || []), ...n.data.featureChoices]
    // Also include feature choices from any incoming edges connected to the single bottom attach handle
    // This allows attaching bundle nodes (and ASIs) to a class level without affecting the main progression chain
    if (n.data?.type === 'class') {
  const incomingChoiceEdges = (edges as any[]).filter((e) => e.target === n.id && e?.targetHandle === 'attach')
      for (const e of incomingChoiceEdges) {
        const src = idToNode.get(e.source)
        if (!src || src.type !== 'progressStep') continue
  if (src.data?.type === 'bundle' && Array.isArray(src.data?.featureChoices)) {
          cur.featureChoices = [...(cur.featureChoices || []), ...src.data.featureChoices]
        } else if (src.data?.type === 'asi') {
          // Prefer explicit asi string; else build from tokens
          const asiStr = src.data.asi || buildAsiString(src.data.ability1, src.data.ability2)
          if (!cur.asi && asiStr) cur.asi = asiStr
          if (!cur.ability1 && src.data.ability1) cur.ability1 = src.data.ability1
          if (!cur.ability2 && src.data.ability2) cur.ability2 = src.data.ability2
  } else if (src.data?.type === 'subclass') {
          if (!cur.subclass) cur.subclass = src.data.subclass || ''
        }
      }
      // Deduplicate feature choices by id if present
      if (Array.isArray(cur.featureChoices)) {
        const seen = new Set<string>()
        cur.featureChoices = cur.featureChoices.filter((fc: any) => {
          const k = fc && typeof fc === 'object' && fc.id ? String(fc.id) : JSON.stringify(fc)
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
      }
    }
  if (typeof n.data?.notes === 'string' && n.data.notes && !cur.notes) cur.notes = n.data.notes
    byLevel.set(lvl, cur)
  }
  const levels = Array.from(byLevel.values()).sort((a, b) => a.level - b.level)
  const plan = {
    race: rootNode?.data?.race,
    background: rootNode?.data?.background,
    levels,
  }
  return plan
}

// Helper to build a plan starting at a given node (progressStep), using its branch forward
function buildPlanFromStart(nodes: any[], edges: any[], startId: string) {
  const idToNode = new Map(nodes.map((n) => [n.id, n] as const))
  // Find nearest ancestor root for race/background and gather all prior steps up to startId
  let cur: string | undefined = startId
  let guard = 0
  let rootId: string | undefined
  const upstreamSteps: any[] = []
  while (cur && guard < 256) {
    guard += 1
    const incoming = (edges as any[]).filter((e) => e.target === cur)
    if (!incoming.length) break
    const parentId = incoming
      .map((e) => ({ e, n: idToNode.get(e.source) }))
      .filter((x) => !!x.n)
      .sort((a, b) => (a.n!.position?.y || 0) - (b.n!.position?.y || 0))[0]?.n?.id
    if (!parentId) break
    const pn = idToNode.get(parentId)
    if (!pn) break
    if (pn.type === 'root') { rootId = pn.id; break }
    if (pn.type === 'progressStep') upstreamSteps.push(pn)
    cur = pn.id
  }
  const rootNode = rootId ? idToNode.get(rootId) : undefined
  // Walk forward from startId
  const forwardSeq: any[] = []
  cur = startId
  guard = 0
  while (cur && guard < 256) {
    guard += 1
    const n = idToNode.get(cur)
    if (n && n.type === 'progressStep') forwardSeq.push(n)
    const outs = (edges as any[]).filter((e) => e.source === cur)
    if (!outs.length) break
    const nextId = outs
      .map((e) => ({ e, n: idToNode.get(e.target) }))
      .filter((x) => !!x.n)
      .sort((a, b) => (a.n!.position?.y || 0) - (b.n!.position?.y || 0))[0]?.n?.id
    if (!nextId) break
    cur = nextId
  }
  // Combine upstream (reversed to chronological) + forward, then aggregate by level
  const seq = [...upstreamSteps.reverse(), ...forwardSeq]
  const byLevel = new Map<number, any>()
  for (const n of seq) {
    const lvl = Number(n.data?.level || 0)
    if (!lvl) continue
    const cur = byLevel.get(lvl) || { level: lvl, feats: [] as string[], featureChoices: [] as any[] }
    if (n.data?.className) cur.className = n.data.className
    const feats: string[] = [
      ...(Array.isArray(n.data?.feats) ? n.data.feats.filter((x: any) => !!x) : []),
      ...(n.data?.featName ? [n.data.featName] : []),
    ]
    if (feats.length) cur.feats = [...cur.feats, ...feats]
    if (n.data?.asi) cur.asi = n.data.asi
    if (n.data?.ability1) cur.ability1 = n.data.ability1
    if (n.data?.ability2) cur.ability2 = n.data.ability2
    // Direct feature choices on this node
    if (Array.isArray(n.data?.featureChoices) && n.data.featureChoices.length) cur.featureChoices = [...(cur.featureChoices || []), ...n.data.featureChoices]
    // Attached choices via bottom single attach handle
    if (n.data?.type === 'class') {
      const incomingChoiceEdges = (edges as any[]).filter((e) => e.target === n.id && e?.targetHandle === 'attach')
      for (const e of incomingChoiceEdges) {
        const src = idToNode.get(e.source)
        if (!src || src.type !== 'progressStep') continue
        if (src.data?.type === 'bundle' && Array.isArray(src.data?.featureChoices)) {
          cur.featureChoices = [...(cur.featureChoices || []), ...src.data.featureChoices]
        } else if (src.data?.type === 'asi') {
          const asiStr = src.data.asi || buildAsiString(src.data.ability1, src.data.ability2)
          if (!cur.asi && asiStr) cur.asi = asiStr
          if (!cur.ability1 && src.data.ability1) cur.ability1 = src.data.ability1
          if (!cur.ability2 && src.data.ability2) cur.ability2 = src.data.ability2
        } else if (src.data?.type === 'subclass') {
          if (!cur.subclass) cur.subclass = src.data.subclass || ''
        }
      }
      if (Array.isArray(cur.featureChoices)) {
        const seen = new Set<string>()
        cur.featureChoices = cur.featureChoices.filter((fc: any) => {
          const k = fc && typeof fc === 'object' && fc.id ? String(fc.id) : JSON.stringify(fc)
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
      }
    }
    if (typeof n.data?.notes === 'string' && n.data.notes && !cur.notes) cur.notes = n.data.notes
    byLevel.set(lvl, cur)
  }
  const levels = Array.from(byLevel.values()).sort((a, b) => a.level - b.level)
  const plan = {
    race: rootNode?.data?.race,
    background: rootNode?.data?.background,
    levels,
  }
  return plan
}

// Sidebar helper: pick a root, duplicate its branch, or apply to Builder
function BranchActions(props: {
  nodes: any[]
  edges: any[]
  onClone: (rootId: string) => void
  onApplyPlan?: (plan: any) => void
  onCreateRoot?: () => void
}) {
  const roots = React.useMemo(() => props.nodes.filter((n) => n.type === 'root'), [props.nodes])
  const [selectedRoot, setSelectedRoot] = React.useState<string | undefined>(() => roots[0]?.id)
  React.useEffect(() => {
    if (!selectedRoot && roots[0]?.id) setSelectedRoot(roots[0].id)
  }, [roots, selectedRoot])

  const buildPlan = useCallback(() => {
    if (!selectedRoot) return null
  return buildPlanFromRoot(props.nodes as any, props.edges as any, selectedRoot)
  }, [props.nodes, props.edges, selectedRoot])

  return (
    <div style={{ padding: 12, display: 'grid', gap: 10 }}>
      <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
        <span>Select Root</span>
        <select value={selectedRoot || ''} onChange={(e) => setSelectedRoot(e.target.value || undefined)} style={inp}>
          {roots.map((r) => (
            <option key={r.id} value={r.id}>{r.data?.race || 'Race'} • {r.data?.background || 'Background'} ({r.id.slice(0, 6)})</option>
          ))}
        </select>
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button disabled={!selectedRoot} onClick={() => selectedRoot && props.onClone(selectedRoot)} style={btn}>Duplicate Branch</button>
  <button onClick={() => props.onCreateRoot?.()} style={btn}>+ New Root</button>
  <button disabled={!selectedRoot} onClick={() => { const p = buildPlan(); if (p && props.onApplyPlan) props.onApplyPlan(p) }} style={btn}>Apply to Builder</button>
      </div>
    </div>
  )
}

export function ProgressionPlanner(props: { character?: BuilderState; derived?: any; onApplyPlan?: (plan: any) => void }) {
  // Seed from Builder by default; keep state empty until seeded
  const [nodes, setNodes, baseOnNodesChange] = useNodesState<any>([] as any)
  const [edges, setEdges, baseOnEdgesChange] = useEdgesState([])
  const [activeRootId, setActiveRootId] = useState<string | undefined>(undefined)
  const seededRef = useRef(false)
  const loadedFromStorageRef = useRef(false)

  const STORAGE_KEY_BASE = 'progressionPlanner.v1'
  const storageKey = useMemo(() => `${STORAGE_KEY_BASE}:${props.character?.name || 'default'}`, [props.character?.name])
  const DISMISS_KEY_BASE = 'progressionPlanner.reseedDismissed.v1'
  const dismissKey = useMemo(() => `${DISMISS_KEY_BASE}:${props.character?.name || 'default'}`,[props.character?.name])
  const ACTIVE_KEY_BASE = 'progressionPlanner.activeRoot.v1'
  const activeKey = useMemo(() => `${ACTIVE_KEY_BASE}:${props.character?.name || 'default'}`,[props.character?.name])
  // Persist the currently active plan for Builder to optionally import when returning from Planner
  const ACTIVE_PLAN_KEY_BASE = 'progressionPlanner.activePlan.v1'
  const activePlanKey = useMemo(() => `${ACTIVE_PLAN_KEY_BASE}:${props.character?.name || 'default'}`,[props.character?.name])

  // Highlight the active branch (reachable from activeRootId)
  const computeActiveFlags = useCallback((nds: any[], eds: any[], rootId?: string) => {
    const idToNode = new Map(nds.map((n) => [n.id, n] as const))
    const active = new Set<string>()
    if (rootId && idToNode.has(rootId)) {
      const stack = [rootId]
      while (stack.length) {
        const cur = stack.pop()!
        if (active.has(cur)) continue
        active.add(cur)
        eds.filter((e) => e.source === cur).forEach((e) => stack.push(e.target))
      }
    }
    return { active }
  }, [])

  const applyActiveHighlight = useCallback((rootId?: string) => {
    setNodes((nds: any[]) => {
      const { active } = computeActiveFlags(nds as any, edges as any, rootId)
      return nds.map((n: any) => ({ ...n, data: { ...n.data, _active: active.has(n.id) } }))
    })
  }, [edges, setNodes, computeActiveFlags])

  // Create default branch from Builder
  const seedFromBuilder = useCallback((ch: BuilderState | undefined, derived?: any) => {
    if (!ch) return null
    const totalLevel = derived?.totalLevel ?? ch.classes.reduce((s, c) => s + (c.level || 0), 0)
  const levelToClass: Record<number, typeof CLASSES[number]> = {}
    let lv = 1
    ch.classes.forEach((cl) => {
      for (let i = 0; i < (cl.level || 0); i += 1) {
    const nm = cl.klass.name
    const valid = (CLASSES as readonly string[]).includes(nm) ? (nm as typeof CLASSES[number]) : 'Fighter'
    levelToClass[lv] = valid
        lv += 1
      }
    })
    // Fallback class if classes empty
    if (Object.keys(levelToClass).length === 0 && totalLevel > 0) {
      for (let i = 1; i <= totalLevel; i++) levelToClass[i] = 'Fighter'
    }
    const asiLevels = [4, 8, 12, 16, 19]
    const feats = (ch.feats || [])

    const rootId = `root-${crypto.randomUUID().slice(0, 6)}`
    const rootNode: any = {
      id: rootId,
      type: 'root',
      position: { x: 40, y: 120 },
      data: { race: ch.race?.name, background: ch.background?.name, collapsed: true } as RootNodeData,
    }

    const newNodes: any[] = [rootNode]
    const newEdges: any[] = []
    let prevId: string = rootId
    let idx = 0
    for (let level = 1; level <= Math.max(1, totalLevel || 1); level += 1) {
      // Class node for this level
      const idClass = `step-${crypto.randomUUID().slice(0, 6)}`
      const classData: ProgressStepData = {
        level,
        type: 'class',
        className: levelToClass[level] || 'Fighter',
        collapsed: true,
      } as any
      const nClass: any = { id: idClass, type: 'progressStep', position: { x: 360, y: 80 + idx * 120 }, data: classData }
      newNodes.push(nClass)
      newEdges.push({ id: `e-${crypto.randomUUID().slice(0, 6)}`, source: prevId, target: idClass })
      prevId = idClass
      idx += 1

      // If this level grants ASI, create an ASI node and attach any one feat
      const isAsi = asiLevels.includes(level)
      if (isAsi) {
        const idAsi = `step-${crypto.randomUUID().slice(0, 6)}`
        const featsForLevel: string[] = []
        if (feats.length) {
          const f = feats.shift(); if (f) featsForLevel.push(f)
        }
        const asiData: ProgressStepData = {
          level,
          type: 'asi',
          asi: '',
          ability1: null,
          ability2: null,
          feats: featsForLevel,
          collapsed: true,
        } as any
        const nAsi: any = { id: idAsi, type: 'progressStep', position: { x: 360, y: 80 + idx * 120 }, data: asiData }
        newNodes.push(nAsi)
        newEdges.push({ id: `e-${crypto.randomUUID().slice(0, 6)}`, source: prevId, target: idAsi })
        prevId = idAsi
        idx += 1
      }
    }

    return { nodes: newNodes, edges: newEdges }
  }, [])

  // Build a simple signature from Builder (race, background, classes per level)
  const builderSignature = useMemo(() => {
    const ch = props.character
    if (!ch) return null
    const totalLevel = props.derived?.totalLevel ?? ch.classes.reduce((s, c) => s + (c.level || 0), 0)
    const classes: string[] = []
    ch.classes.forEach((cl) => {
      const nm = cl.klass?.name || ''
      const count = cl.level || 0
      for (let i = 0; i < count; i += 1) classes.push(nm)
    })
    // Fallback if empty but totalLevel > 0
    if (classes.length === 0 && totalLevel > 0) {
      for (let i = 0; i < totalLevel; i += 1) classes.push('Fighter')
    }
    return JSON.stringify({
      race: ch.race?.name || '',
      background: ch.background?.name || '',
      classes,
    })
  }, [props.character, props.derived])

  // Compute per-root branch signatures similar to BranchActions buildPlan
  const branchSignatures = useMemo(() => {
    const idToNode = new Map((nodes as any[]).map((n) => [n.id, n]))
    const roots = (nodes as any[]).filter((n) => n.type === 'root')
    const sigs: string[] = []
    for (const r of roots) {
      // Chain walk: follow first outgoing edge by lowest target Y
      const seq: any[] = []
      let cur = r.id
      let guard = 0
      while (cur && guard < 256) {
        guard += 1
        const outs = (edges as any[]).filter((e) => e.source === cur)
        if (!outs.length) break
        const nextId = outs
          .map((e) => ({ e, n: idToNode.get(e.target) }))
          .filter((x) => !!x.n)
          .sort((a, b) => (a.n!.position?.y || 0) - (b.n!.position?.y || 0))[0]?.n?.id
        if (!nextId) break
        const nn = idToNode.get(nextId)
        if (!nn) break
        if (nn.type === 'progressStep') seq.push(nn)
        cur = nextId
      }
      if (!seq.length) {
        const reach = new Set<string>()
        const stack = [r.id]
        while (stack.length) {
          const s = stack.pop()!
          if (reach.has(s)) continue
          reach.add(s)
          ;(edges as any[]).filter((e) => e.source === s).forEach((e) => stack.push(e.target))
        }
        seq.push(...(nodes as any[]).filter((n) => n.type === 'progressStep' && reach.has(n.id)))
        seq.sort((a, b) => (a.data?.level || 0) - (b.data?.level || 0) || (a.position?.y || 0) - (b.position?.y || 0))
      }
      // Only consider class steps when computing the signature to avoid ASI/bundle/subclass nodes affecting matching
      const classes = seq
        .slice()
        .filter((n) => (n as any)?.data?.type === 'class' && !!(n as any)?.data?.className)
        .sort((a, b) => (a.data?.level || 0) - (b.data?.level || 0) || (a.position?.y || 0) - (b.position?.y || 0))
        .map((n) => (n as any).data.className as string)
      sigs.push(JSON.stringify({ race: r.data?.race || '', background: r.data?.background || '', classes }))
    }
    return sigs
  }, [nodes, edges])

  // Reseed suggestion visibility, with per-character dismissal bound to builder signature
  const [showReseedPrompt, setShowReseedPrompt] = useState(false)
  React.useEffect(() => {
    if (!builderSignature) { setShowReseedPrompt(false); return }
    const dismissedFor = localStorage.getItem(dismissKey)
    const matches = branchSignatures.includes(builderSignature)
    setShowReseedPrompt(!matches && dismissedFor !== builderSignature)
  }, [builderSignature, branchSignatures, dismissKey])

  const dismissReseedPrompt = useCallback(() => {
    if (builderSignature) localStorage.setItem(dismissKey, builderSignature)
    setShowReseedPrompt(false)
  }, [builderSignature, dismissKey])

  React.useEffect(() => {
    if (seededRef.current) return
    // 1) Try localStorage restore first
    try {
      const raw = localStorage.getItem(storageKey)
  const savedActive = localStorage.getItem(activeKey) || undefined
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          const wired = (parsed.nodes as any[]).map((n) => {
            const d: any = { ...n.data }
            d.onChange = (p: any) => updateNodeData(n.id, p)
            d.onDelete = (nid: string) => removeNode(nid)
            if (n.type === 'root') d.onClone = () => cloneBranch(n.id)
            d.onAddChild = (k?: StepType) => addChild(n.id, k)
            return { ...n, data: d }
          })
          setNodes(wired as any)
          setEdges(parsed.edges as any)
          seededRef.current = true
          loadedFromStorageRef.current = true
          setActiveRootId(savedActive)
          applyActiveHighlight(savedActive)
          return
        }
      }
    } catch {}

    // 2) Seed from Builder if nothing in storage
    const seeded = seedFromBuilder(props.character, props.derived)
    if (seeded) {
      const withHandlers = (seeded.nodes as any[]).map((n) => {
        const d: any = { ...n.data }
        d.onChange = (p: any) => updateNodeData(n.id, p)
        d.onDelete = (nid: string) => removeNode(nid)
        if (n.type === 'root') d.onClone = () => cloneBranch(n.id)
  d.onAddChild = (k?: StepType) => addChild(n.id, k)
        return { ...n, data: d }
      })
  setNodes(withHandlers as any)
      setEdges(seeded.edges as any)
      seededRef.current = true
  // Set active to the newly seeded root that matches the Builder branch (first root)
  const firstRoot = (withHandlers as any[]).find((n) => n.type === 'root')?.id
  if (firstRoot) { setActiveRootId(firstRoot); localStorage.setItem(activeKey, firstRoot); applyActiveHighlight(firstRoot) }
    } else {
      // 3) Fallback minimal default
      const rid = `root-${crypto.randomUUID().slice(0, 6)}`
      const sid = `step-${crypto.randomUUID().slice(0, 6)}`
      const nodes0: any[] = [
        { id: rid, type: 'root', position: { x: 40, y: 160 }, data: { race: '', background: '', collapsed: true } as RootNodeData },
        { id: sid, type: 'progressStep', position: { x: 360, y: 120 }, data: { level: 1, type: 'class', className: 'Fighter', collapsed: true } as ProgressStepData },
      ]
      nodes0.forEach((n) => {
        const d: any = { ...n.data }
        d.onChange = (p: any) => updateNodeData(n.id, p)
        d.onDelete = (nid: string) => removeNode(nid)
        if (n.type === 'root') d.onClone = () => cloneBranch(n.id)
  d.onAddChild = (k?: StepType) => addChild(n.id, k)
        n.data = d
      })
  setNodes(nodes0)
      setEdges([{ id: `e-${crypto.randomUUID().slice(0, 6)}`, source: rid, target: sid }])
      seededRef.current = true
  setActiveRootId(rid); localStorage.setItem(activeKey, rid); applyActiveHighlight(rid)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.character, props.derived])

  // Persist graph to localStorage on change (strip functions)
  React.useEffect(() => {
    if (!seededRef.current) return
    try {
      const cleanNodes = (nodes as any[]).map((n) => {
        const d: any = { ...n.data }
        if (d) {
          delete d.onChange; delete d.onDelete; delete d.onClone; delete d.onApply; delete d.onAddChild
          delete d._active
        }
        return { id: n.id, type: n.type, position: n.position, data: d }
      })
      const payload = { nodes: cleanNodes, edges }
      localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch {}
  }, [nodes, edges, storageKey])

  // Re-apply highlight when active root, nodes, or edges change
  React.useEffect(() => {
    applyActiveHighlight(activeRootId)
  }, [activeRootId, nodes.length, edges.length, applyActiveHighlight])

  // Persist the active plan to localStorage so the App/Builder can prompt to apply when navigating back
  React.useEffect(() => {
    if (!seededRef.current) return
    try {
      const roots = (nodes as any[]).filter((n) => n.type === 'root')
      const rid = activeRootId || roots[0]?.id
      if (!rid) {
        localStorage.removeItem(activePlanKey)
        return
      }
      const plan = buildPlanFromRoot(nodes as any, edges as any, rid)
      const payload = { plan, ts: Date.now() }
      localStorage.setItem(activePlanKey, JSON.stringify(payload))
    } catch {}
  }, [nodes, edges, activeRootId, activePlanKey])

  // Scratch workspace state
  const [scratch, setScratch] = useState<ScratchBlock[]>([])
  // Token filter for organizing the palette chips
  const [tokenFilter, setTokenFilter] = useState('')

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
    setScratch((s) => s.map((b) => (b.id === id ? ({ ...(b as any), ...(patch as any) } as ScratchBlock) : b as ScratchBlock)))
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
      else if (e.shiftKey && e.key === 'Delete') {
        // Only handle Shift+Delete when not typing in an input/textarea/contenteditable
        const target = e.target as HTMLElement | null
        const isEditable = !!(target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          (target as HTMLElement).isContentEditable
        ))
        if (isEditable) return
        e.preventDefault()
        // Collect selected nodes and edges
        const selectedNodeIds = (nodes as any[]).filter((n: any) => n?.selected).map((n: any) => n.id)
        const selectedEdgeIds = (edges as any[]).filter((ed: any) => ed?.selected).map((ed: any) => ed.id)
        if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return
        snapshot()
        setNodes((nds: any[]) => nds.filter((n: any) => !selectedNodeIds.includes(n.id)))
        setEdges((eds: any[]) => eds.filter((ed: any) => !selectedEdgeIds.includes(ed.id) && !selectedNodeIds.includes(ed.source) && !selectedNodeIds.includes(ed.target)))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, nodes, edges, snapshot, setNodes, setEdges])

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

  // Auto-arrange: account for expanded/collapsed heights per card and stack accordingly
  const autoArrange = useCallback(() => {
    // Helpers for estimated card heights (fallback to measured values if present)
    const getHeight = (n: any): number => {
      const measured = (n as any).height || (n as any).measured?.height
      if (typeof measured === 'number' && measured > 0) return measured
      const collapsed = !!n.data?.collapsed
      if (n.type === 'root') return collapsed ? 120 : 240
      // progressStep or others
      return collapsed ? 140 : 560
    }
    // Determine the nearest root (branch) for each node to isolate layout per branch
    const idToNode = new Map(nodes.map((n) => [n.id, n] as const))
    const findRoot = (id: string): string | undefined => {
      let cur: string | undefined = id
      let guard = 0
      while (cur && guard < 256) {
        guard += 1
        const incoming = edges.filter((e) => e.target === cur)
        if (!incoming.length) break
        const parentId = incoming
          .map((e) => ({ e, n: idToNode.get(e.source) }))
          .filter((x) => !!x.n)
          .sort((a, b) => (a.n!.position?.y || 0) - (b.n!.position?.y || 0))[0]?.n?.id
        if (!parentId) break
        const pn = idToNode.get(parentId)
        if (!pn) break
        if (pn.type === 'root') return pn.id
        cur = pn.id
      }
      return undefined
    }

    // Group nodes by root id (branch)
    const groups = new Map<string, any[]>()
    const groupKeyOf = (n: any) => (n.type === 'root' ? n.id : (findRoot(n.id) || `ungrouped-${n.id}`))
    nodes.forEach((n) => {
      const k = groupKeyOf(n)
      const arr = groups.get(k) || []
      arr.push(n)
      groups.set(k, arr)
    })

    const dx = 360
    const gapY = 24
    const baseX = 40
    const y0 = 60
    const groupDX = 520 // horizontal spacing between branches
    const nextPositions: Record<string, { x: number; y: number }> = {}

  // Plan positions per group first (anchored at root.x), then stack groups vertically with spacing
  const plannedGroups: Array<{ key: string; positions: Record<string, { x: number; y: number }>; minX: number; maxX: number; minY: number; maxY: number; rootX: number; rootY: number }> = []

    Array.from(groups.entries()).forEach(([groupKey, groupNodes], gIdx) => {
      const idSet = new Set(groupNodes.map((n) => n.id))
      const incoming: Record<string, number> = {}
      groupNodes.forEach((n) => { incoming[n.id] = 0 })
      edges.forEach((e) => { if (idSet.has(e.target) && idSet.has(e.source)) incoming[e.target] = (incoming[e.target] || 0) + 1 })

      const depth: Record<string, number> = {}
      groupNodes.forEach((n) => { depth[n.id] = incoming[n.id] ? 0 : 0 })
      for (let iter = 0; iter < groupNodes.length; iter += 1) {
        let changed = false
        for (const e of edges) {
          if (!idSet.has(e.source) || !idSet.has(e.target)) continue
          const d = (depth[e.source] ?? 0) + 1
          if ((depth[e.target] ?? 0) < d) { depth[e.target] = d; changed = true }
        }
        if (!changed) break
      }

      const byDepth: Record<number, any[]> = {}
      groupNodes.forEach((n) => {
        const d = depth[n.id] ?? 0
        if (!byDepth[d]) byDepth[d] = []
        byDepth[d].push(n)
      })

      // Anchor at this group's root X when available, else fallback to a lane
      const maybeRoot = groupNodes.find((n) => n.type === 'root')
      const anchorX = (maybeRoot?.position?.x ?? (baseX + gIdx * groupDX))

  const positions: Record<string, { x: number; y: number }> = {}
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
      const depths = Object.keys(byDepth).map((k) => parseInt(k, 10)).sort((a, b) => a - b)
      depths.forEach((d, colIdx) => {
        const arr = byDepth[d]
        arr.sort((a, b) => {
          const la = typeof a.data?.level === 'number' ? a.data.level : Number.MAX_SAFE_INTEGER
          const lb = typeof b.data?.level === 'number' ? b.data.level : Number.MAX_SAFE_INTEGER
          if (la !== lb) return la - lb
          if (a.type !== b.type) return String(a.type).localeCompare(String(b.type))
          return String(a.id).localeCompare(String(b.id))
        })
        let yAcc = y0
        arr.forEach((n) => {
          const x = anchorX + colIdx * dx
          positions[n.id] = { x, y: yAcc }
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          minY = Math.min(minY, yAcc)
          maxY = Math.max(maxY, yAcc + getHeight(n))
          yAcc += getHeight(n) + gapY
        })
      })

      plannedGroups.push({ key: groupKey, positions, minX, maxX, minY, maxY, rootX: maybeRoot?.position?.x ?? (baseX + gIdx * groupDX), rootY: maybeRoot?.position?.y ?? y0 })
    })

    // Stack groups vertically by their root Y, with sufficient vertical spacing so branches don't touch
    plannedGroups.sort((a, b) => a.rootY - b.rootY)
    let curTop = y0
    const branchGapY = 120
    for (const g of plannedGroups) {
      const height = Math.max(0, g.maxY - g.minY)
      const shiftY = curTop - g.minY
      Object.keys(g.positions).forEach((id) => { g.positions[id].y += shiftY })
      curTop += height + branchGapY
      Object.assign(nextPositions, g.positions)
    }

    snapshot()
    setNodes((nds) => nds.map((n) => ({ ...n, position: nextPositions[n.id] ? nextPositions[n.id] : n.position })))
  }, [nodes, edges, setNodes, snapshot])

  // Add and connect a child step to a given node
  const addChild = useCallback((sourceId: string, kind?: StepType) => {
    const idToNode = new Map((nodes as any[]).map((n) => [n.id, n] as const))
    const src = idToNode.get(sourceId)
    if (!src) return

    // Walk down the first-child chain to find the last step under this source
    let cur: string | undefined = sourceId
    let guard = 0
    let lastStep: any = undefined
    while (cur && guard < 256) {
      guard += 1
      const n = idToNode.get(cur)
      if (n && n.type === 'progressStep') lastStep = n
      const outs = (edges as any[]).filter((e) => e.source === cur)
      if (!outs.length) break
      const nextId = outs
        .map((e) => ({ e, n: idToNode.get(e.target) }))
        .filter((x) => !!x.n)
        .sort((a, b) => (a.n!.position?.y || 0) - (b.n!.position?.y || 0))[0]?.n?.id
      if (!nextId) break
      cur = nextId
    }

    // Decide defaults for the new step
    let nextLevel = 1
    let nextClass: typeof CLASSES[number] = 'Fighter'
    if (lastStep) {
      nextLevel = Math.min(20, (Number(lastStep.data?.level) || 0) + 1)
      nextClass = (lastStep.data?.className && (CLASSES as readonly string[]).includes(lastStep.data.className) ? lastStep.data.className : 'Fighter') as typeof CLASSES[number]
    } else if (src.type === 'progressStep') {
      nextLevel = Math.min(20, (Number(src.data?.level) || 0) + 1)
      nextClass = (src.data?.className && (CLASSES as readonly string[]).includes(src.data.className) ? src.data.className : 'Fighter') as typeof CLASSES[number]
    } else {
      const firstClass = props.character?.classes?.[0]?.klass?.name
      nextClass = (firstClass && (CLASSES as readonly string[]).includes(firstClass) ? firstClass : 'Fighter') as typeof CLASSES[number]
      nextLevel = 1
    }

    const newId = `step-${crypto.randomUUID().slice(0, 6)}`
    const srcPos = src.position || { x: 0, y: 0 }
    const siblingCount = (edges as any[]).filter((e) => e.source === sourceId).length
    const newPos = { x: (srcPos.x || 0) + 320, y: (srcPos.y || 0) + siblingCount * 140 }
  const chosen: StepType = (kind || 'class')
    const base: ProgressStepData = { level: nextLevel, type: chosen, collapsed: false }
    let data: ProgressStepData = base
  if (chosen === 'class') {
      data = { ...base, className: nextClass, type: chosen }
    } else if (chosen === 'feat') {
      data = { ...base, featName: '', feats: [] }
    } else if (chosen === 'asi') {
      data = { ...base, asi: '', ability1: null, ability2: null }
    } else if (chosen === 'bundle') {
      data = { ...base, featureChoices: [] }
    } else if (chosen === 'subclass') {
      data = { ...base, type: 'subclass', subclass: '' }
    } else if (chosen === 'note') {
      data = { ...base, notes: '' }
    }

    snapshot()
    setNodes((nds: any[]) => {
      const node: any = { id: newId, type: 'progressStep', position: newPos, data: { ...data } }
      node.data.onChange = (p: any) => updateNodeData(newId, p)
      node.data.onDelete = (nid: string) => removeNode(nid)
  node.data.onAddChild = (k?: StepType) => addChild(newId, k)
      // onApply for steps will be injected by the wiring effect if missing
      return [...nds, node]
    })
    // If adding a bundle or ASI from a class step, connect their top handle to the single class bottom handle
    const isClassSrc = (idToNode.get(sourceId)?.type === 'progressStep') && (idToNode.get(sourceId) as any)?.data?.type === 'class'
  if (isClassSrc && (chosen === 'bundle' || chosen === 'asi' || chosen === 'subclass')) {
      setEdges((eds: any[]) => [...eds, { id: `e-${crypto.randomUUID().slice(0, 6)}`, source: newId, sourceHandle: 'top', target: sourceId, targetHandle: 'attach' }])
    } else {
      setEdges((eds: any[]) => [...eds, { id: `e-${crypto.randomUUID().slice(0, 6)}`, source: sourceId, target: newId }])
    }
    // Auto-tidy after creation
  setTimeout(() => { try { (autoArrange as any)() } catch {} }, 0)
  }, [nodes, edges, props.character, setNodes, setEdges, snapshot, updateNodeData, removeNode, /* tidy */ autoArrange])

  // Expand/Collapse All
  const collapseAll = useCallback(() => {
    snapshot()
    setNodes((nds: any[]) => nds.map((n) => ({ ...n, data: { ...n.data, collapsed: true } })))
  }, [snapshot, setNodes])
  const expandAll = useCallback(() => {
    snapshot()
    setNodes((nds: any[]) => nds.map((n) => ({ ...n, data: { ...n.data, collapsed: false } })))
  }, [snapshot, setNodes])

  // Reset graph for this character: clears nodes/edges and related storage keys
  const resetGraph = useCallback(() => {
    const ok = window.confirm('Reset planner? This will clear all nodes and edges for this character. This cannot be undone except via Ctrl+Z in this session.')
    if (!ok) return
    snapshot()
    setNodes([] as any)
    setEdges([])
    setActiveRootId(undefined)
    try {
      localStorage.removeItem(storageKey)
      localStorage.removeItem(activeKey)
      localStorage.removeItem(activePlanKey)
    } catch {}
    applyActiveHighlight(undefined)
  }, [snapshot, setNodes, setEdges, storageKey, activeKey, activePlanKey, applyActiveHighlight])

  

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

  // Seed onChange/onDelete/onClone and ensure onApply/onAddChild are wired
  React.useEffect(() => {
    setNodes((nds: any[]) => nds.map((n) => {
      const d: any = { ...n.data }
      if (!d.onChange) d.onChange = (p: any) => updateNodeData(n.id, p)
      if (!d.onDelete) d.onDelete = (id: string) => removeNode(id)
      if (n.type === 'root' && !d.onClone) d.onClone = () => cloneBranch(n.id)
    if (n.type === 'root' && !d.onApply) {
        d.onApply = () => {
      const rid = activeRootId || n.id
      const plan: any = buildPlanFromRoot(nds as any, edges as any, rid)
          if (plan && props.onApplyPlan) props.onApplyPlan(plan)
        }
      }
      if (n.type === 'progressStep' && !d.onApply) {
        d.onApply = () => {
          const plan: any = buildPlanFromStart(nds as any, edges as any, n.id)
          if (plan && props.onApplyPlan) props.onApplyPlan(plan)
        }
      }
  // Ensure onAddChild forwards the selected kind when invoked from the + menu
  // Always rebind so stale handlers get updated to forward the selected kind
  d.onAddChild = (k?: StepType) => addChild(n.id, k)
      // Bind duplicate-branch for step nodes: walk up to find ancestor root, then clone that branch
      if (n.type === 'progressStep') {
        d.onCloneFromSelf = () => {
          let cur: string | undefined = n.id
          let guard = 0
          const idToNode = new Map((nds as any[]).map((x) => [x.id, x] as const))
          let rootId: string | undefined
          while (cur && guard < 256) {
            guard += 1
            const incoming = (edges as any[]).filter((e) => e.target === cur)
            if (!incoming.length) break
            const parentId = incoming
              .map((e) => ({ e, nn: idToNode.get(e.source) }))
              .filter((x) => !!x.nn)
              .sort((a, b) => ((a.nn as any).position?.y || 0) - ((b.nn as any).position?.y || 0))[0]?.nn?.id
            if (!parentId) break
            const pn = idToNode.get(parentId)
            if (!pn) break
            if (pn.type === 'root') { rootId = pn.id; break }
            cur = pn.id
          }
          if (rootId) cloneBranch(rootId)
        }
      }
      return { ...n, data: d }
    }))
  }, [updateNodeData, cloneBranch, edges, props.onApplyPlan, addChild, setNodes])
  // include activeRootId in deps to keep onApply closures up-to-date

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
  rootNode.data.onApply = () => { const plan: any = buildPlanFromRoot(nodes as any, edges as any, rootId); if (plan && props.onApplyPlan) props.onApplyPlan(plan) }
  rootNode.data.onAddChild = (k?: StepType) => addChild(rootId, k)

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
  n.data.onApply = () => { const plan: any = buildPlanFromStart(nodes as any, edges as any, id); if (plan && props.onApplyPlan) props.onApplyPlan(plan) }
  n.data.onAddChild = (k?: StepType) => addChild(id, k)
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
    // Prefer deterministic placement to avoid overlapping other branches
    const baseX = 40
    const yBaseline = 120
    const branchGapY = 160
    let x = type === 'root' ? baseX : 360
    let y = type === 'root' ? yBaseline : (40 + Math.random() * 720)
    if (type === 'root') {
      const roots = (nodes as any[]).filter((n) => n.type === 'root')
      if (roots.length > 0) {
        const maxRootBottom = Math.max(...roots.map((r) => Number(r.position?.y ?? yBaseline)))
        y = maxRootBottom + branchGapY
      }
    }
    const base: any = { id, type, position: { x, y }, data: {} }
  if (type === 'progressStep') Object.assign(base.data, { level: 1, type: 'class', className: 'Fighter', collapsed: false } as ProgressStepData)
  if (type === 'root') Object.assign(base.data, { race: '', background: '', collapsed: false } as RootNodeData)
    base.data.onChange = (p: any) => updateNodeData(id, p)
    base.data.onDelete = (nodeId: string) => removeNode(nodeId)
  base.data.onAddChild = (k?: StepType) => addChild(id, k)
    if (type === 'root') {
      base.data.onClone = () => cloneBranch(id)
      base.data.onApply = () => { const plan: any = buildPlanFromRoot(nodes as any, edges as any, id); if (plan && props.onApplyPlan) props.onApplyPlan(plan) }
    }

    snapshot()
    setNodes((nds) => [...nds as any, base] as any)
  }

  return (
    <div className="w-full" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, height: 'calc(100vh - 100px)' }}>
  <div style={{ height: '100%', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: 'white', position: 'relative' }}>
        {/* Graph toolbar (top-right) */}
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6, zIndex: 20 }}>
          <button onClick={undo} style={{ ...btn, padding: 6, width: 32, height: 32 }} title="Undo">↶</button>
          <button onClick={redo} style={{ ...btn, padding: 6, width: 32, height: 32 }} title="Redo">↷</button>
          <button onClick={expandAll} style={btn} title="Expand all nodes">Expand</button>
          <button onClick={collapseAll} style={btn} title="Collapse all nodes">Collapse</button>
          <button onClick={autoArrange} style={btn} title="Auto-arrange nodes">Arrange</button>
          <button
            onClick={() => {
              const seeded = seedFromBuilder(props.character, props.derived)
              if (!seeded) return
              snapshot()
              setNodes((seeded.nodes as any[]).map((n) => {
                const d: any = { ...n.data, onChange: (p: any) => updateNodeData(n.id, p), onDelete: (nid: string) => removeNode(nid) }
                if (n.type === 'root') {
                  d.onClone = () => cloneBranch(n.id)
                  d.onApply = () => { const plan: any = buildPlanFromRoot(seeded.nodes as any, seeded.edges as any, n.id); if (plan && props.onApplyPlan) props.onApplyPlan(plan) }
                }
                if (n.type === 'progressStep') {
                  d.onApply = () => { const plan: any = buildPlanFromStart(seeded.nodes as any, seeded.edges as any, n.id); if (plan && props.onApplyPlan) props.onApplyPlan(plan) }
                }
                d.onAddChild = (k?: StepType) => addChild(n.id, k)
                return { ...n, data: d }
              }))
              setEdges(seeded.edges as any)
              const firstRoot = (seeded.nodes as any[]).find((n) => n.type === 'root')?.id
              if (firstRoot) { setActiveRootId(firstRoot); localStorage.setItem(activeKey, firstRoot); applyActiveHighlight(firstRoot) }
              setTimeout(() => { try { (autoArrange as any)() } catch {} }, 0)
            }}
            style={btn}
            title="Reseed from Builder"
          >Reseed</button>
          <button onClick={resetGraph} style={{ ...btn, borderColor: '#ef4444', color: '#b91c1c' }} title="Reset (clear all nodes and edges)">Reset</button>
        </div>
  <style>{`.react-flow__edge.edge-active path { stroke: #0ea5e9 !important; stroke-width: 2.5px; }`}</style>
        {(() => {
          const idToActive = new Map((nodes as any[]).map((n: any) => [n.id, !!n.data?._active]))
          const styledEdges = (edges as any[]).map((e: any) => {
            const a = idToActive.get(e.source) && idToActive.get(e.target)
            return a ? { ...e, className: 'edge-active' } : e
          })
          return (
            <ReactFlow nodes={nodes as any} edges={styledEdges as any} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes as any} fitView>
              <Background />
              <MiniMap pannable zoomable />
              <Controls showInteractive={false} />
            </ReactFlow>
          )
        })()}
        {showReseedPrompt ? (
          <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ pointerEvents: 'auto', maxWidth: 640, width: '100%', background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.08)', padding: 12, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 600 }}>No branch matches the current Builder</div>
                <button onClick={dismissReseedPrompt} style={{ ...btn, padding: '4px 8px' }} title="Dismiss">✕</button>
              </div>
              <div style={{ fontSize: 13, color: '#475569' }}>You can reseed the planner from the Character Builder to create a matching branch.</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={dismissReseedPrompt} style={btn}>Not now</button>
                <button
                  onClick={() => {
                    const seeded = seedFromBuilder(props.character, props.derived)
                    if (!seeded) return
                    snapshot()
                    setNodes((seeded.nodes as any[]).map((n) => {
                                    const d: any = { ...n.data, onChange: (p: any) => updateNodeData(n.id, p), onDelete: (nid: string) => removeNode(nid) }
                                    if (n.type === 'root') { d.onClone = () => cloneBranch(n.id); d.onApply = () => { const plan: any = buildPlanFromRoot(seeded.nodes as any, seeded.edges as any, n.id); if (plan && props.onApplyPlan) props.onApplyPlan(plan) } }
                                    if (n.type === 'progressStep') { d.onApply = () => { const plan: any = buildPlanFromStart(seeded.nodes as any, seeded.edges as any, n.id); if (plan && props.onApplyPlan) props.onApplyPlan(plan) } }
                                    d.onAddChild = (k?: StepType) => addChild(n.id, k)
                                    return { ...n, data: d }
                                  }))
                    setEdges(seeded.edges as any)
                    const firstRoot = (seeded.nodes as any[]).find((n) => n.type === 'root')?.id
                    if (firstRoot) { setActiveRootId(firstRoot); localStorage.setItem(activeKey, firstRoot); applyActiveHighlight(firstRoot) }
                    // Auto-arrange after reseed to tidy layout
                    setTimeout(() => { try { (autoArrange as any)() } catch {} }, 0)
                    dismissReseedPrompt()
                  }}
                  style={{ ...btn, background: '#0ea5e9', borderColor: '#0284c7', color: 'white' }}
                >Reseed from Builder</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

  <div style={{ display: 'grid', gap: 12, overflowY: 'auto', overflowX: 'hidden', paddingRight: 12, minWidth: 0 }}>

        {/* Branch actions */}
        <section style={card}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Branch Actions</div>
          <BranchActions
            nodes={nodes}
            edges={edges}
            onClone={cloneBranch}
            onApplyPlan={props.onApplyPlan}
            onCreateRoot={() => { addNode('root'); setTimeout(() => { try { (autoArrange as any)() } catch {} }, 0) }}
          />
          <div style={{ padding: 12, display: 'grid', gap: 8 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
              <span>Active Branch</span>
              <select
                value={activeRootId || ''}
                onChange={(e) => { const v = e.target.value || undefined; setActiveRootId(v); if (v) localStorage.setItem(activeKey, v); applyActiveHighlight(v) }}
                style={inp}
              >
                <option value="">(none)</option>
                {(nodes as any[]).filter((n) => n.type === 'root').map((r) => (
                  <option key={r.id} value={r.id}>{r.data?.race || 'Race'} • {r.data?.background || 'Background'} ({r.id.slice(0,6)})</option>
                ))}
              </select>
            </label>
            <div style={{ fontSize: 12, color: '#64748b' }}>The active branch is highlighted and drives the “Apply to Builder”.</div>
          </div>
        </section>

        {/* Add Nodes */}
        <section style={card}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Add Nodes</div>
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={() => { addNode('root'); setTimeout(() => { try { (autoArrange as any)() } catch {} }, 0) }} style={btn}>+ Root</button>
            <button onClick={() => addNode('progressStep')} style={btn}>+ Step</button>
          </div>
          <div style={{ padding: '0 12px 12px', fontSize: 12, color: '#64748b' }}>Use Root to set Race and Background, then connect Steps to build branches. Clone a Root to fork a new branch with the same history.</div>
        </section>

        {/* Quick Plan Builder */}
        <section style={card}>
          <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span>Quick Plan Builder</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={generateFromScratch} style={btn} title="Create a new branch from the blocks below">Create Branch</button>
              <button onClick={() => setScratch([])} style={btn} title="Clear all blocks">Clear</button>
            </div>
          </div>

          {/* Palette */}
          <div style={{ padding: 12, display: 'grid', gap: 12 }}>
            {/* Quick add buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => addScratchBlock('class')} style={btn}>+ Class</button>
              <button onClick={() => addScratchBlock('feat')} style={btn}>+ Feat</button>
              <button onClick={() => addScratchBlock('asi')} style={btn}>+ ASI</button>
              <button onClick={() => addScratchBlock('note')} style={btn}>+ Note</button>
              <span style={{ fontSize: 12, color: '#64748b' }}>or drag chips:</span>
              <BlockChip label="Class" color={blockColors.class} draggableData={{ kind: 'class' }} />
              <BlockChip label="Feat" color={blockColors.feat} draggableData={{ kind: 'feat' }} />
              <BlockChip label="ASI" color={blockColors.asi} draggableData={{ kind: 'asi' }} />
              <BlockChip label="Note" color={blockColors.note} draggableData={{ kind: 'note' }} />
            </div>
            {/* Token filter */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={tokenFilter}
                onChange={(e) => setTokenFilter(e.target.value)}
                placeholder="Filter tokens (e.g., fighter, str, elf)"
                style={{ ...inp, maxWidth: 320 }}
              />
              {tokenFilter ? (
                <button style={{ ...btn, padding: '6px 10px' }} onClick={() => setTokenFilter('')}>Clear</button>
              ) : null}
            </div>

            {/* Organized token sections */}
            {(() => {
              const q = tokenFilter.trim().toLowerCase()
              const filt = (s: string) => (q ? s.toLowerCase().includes(q) : true)
              const classes = (CLASSES as readonly string[]).filter((c: string) => filt(c))
              const abilities = (ABILITIES as readonly string[]).filter((a: string) => filt(a))
              const races = (RACE_NAMES as readonly string[]).filter((r: string) => filt(r))
              const backgrounds = (BACKGROUNDS as readonly string[]).filter((b: string) => filt(b))
              const othersAll = ['Variant Rule', 'Alignment', 'Deity']
              const others = othersAll.filter((t) => filt(t))

              const showAll = q === ''

              return (
                <div style={{ display: 'grid', gap: 10 }}>
                  {(showAll || classes.length) ? (
                    <details open>
                      <summary style={{ ...muted, cursor: 'pointer' }}>Classes</summary>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 6 }}>
                        {classes.map((c: string) => (<TokenChip key={c} label={c} type="class" value={c} />))}
                        {!classes.length ? <span style={muted}>No matches</span> : null}
                      </div>
                    </details>
                  ) : null}

                  {(showAll || abilities.length) ? (
                    <details open>
                      <summary style={{ ...muted, cursor: 'pointer' }}>Abilities</summary>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 6 }}>
                        {abilities.map((a: string) => (<TokenChip key={a} label={a} type="ability" value={a} />))}
                        {!abilities.length ? <span style={muted}>No matches</span> : null}
                      </div>
                    </details>
                  ) : null}

                  {(showAll || races.length) ? (
                    <details open>
                      <summary style={{ ...muted, cursor: 'pointer' }}>Races</summary>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 6 }}>
                        {races.map((r: string) => (<TokenChip key={r} label={r} type="race" value={r} />))}
                        {!races.length ? <span style={muted}>No matches</span> : null}
                      </div>
                    </details>
                  ) : null}

                  {(showAll || backgrounds.length) ? (
                    <details open>
                      <summary style={{ ...muted, cursor: 'pointer' }}>Backgrounds</summary>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 6 }}>
                        {backgrounds.map((b: string) => (<TokenChip key={b} label={b} type="background" value={b} />))}
                        {!backgrounds.length ? <span style={muted}>No matches</span> : null}
                      </div>
                    </details>
                  ) : null}

                  {(showAll || others.length) ? (
                    <details>
                      <summary style={{ ...muted, cursor: 'pointer' }}>Other</summary>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 6 }}>
                        {others.map((t) => (<TokenChip key={t} label={t} type="text" value={t} />))}
                        {!others.length ? <span style={muted}>No matches</span> : null}
                      </div>
                    </details>
                  ) : null}
                </div>
              )
            })()}

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

          <div style={{ padding: '0 12px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
            {scratch.length ? <span style={{ fontSize: 12, color: '#64748b' }}>{scratch.length} block(s)</span> : <span style={{ fontSize: 12, color: '#64748b' }}>No blocks yet</span>}
          </div>
        </section>

  {/* Tips removed per feedback */}
      </div>
    </div>
  )
}

export default ProgressionPlanner
