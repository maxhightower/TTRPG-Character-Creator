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
const delBtn: React.CSSProperties = { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 999, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#334155', lineHeight: '22px', textAlign: 'center', zIndex: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
const addBtnRight: React.CSSProperties = { position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)', width: 24, height: 24, borderRadius: 999, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#0f172a', lineHeight: '22px', textAlign: 'center', zIndex: 9, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }

// Domain data small set
const CLASSES = [
  'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'
] as const

// Races and Backgrounds for root node
const RACE_NAMES = ['Human (Base)', 'Human (Variant)', 'Elf (Wood)', 'Elf (High)'] as const
const BACKGROUNDS = ['Soldier', 'Acolyte', 'Sage', 'Outlander'] as const

type StepType = 'level' | 'class' | 'feat' | 'asi' | 'note'

// Add token type for typed ASI holes
type AbilityToken = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'

type ProgressStepData = {
  onChange?: (p: Partial<ProgressStepData>) => void
  onDelete?: (id: string) => void
  onAddChild?: (kind?: StepType) => void
  onApply?: () => void
  level: number
  type: StepType
  className?: typeof CLASSES[number]
  featName?: string
  feats?: string[]
  asi?: string // e.g., "+2 STR" or "+1 STR/+1 CON"
  // Optional typed ASI holes integrated into nodes
  ability1?: AbilityToken | null
  ability2?: AbilityToken | null
  notes?: string
  // UI/Customization
  collapsed?: boolean
}

type RootNodeData = {
  race?: string
  background?: string
  other?: string
  onChange?: (p: Partial<RootNodeData>) => void
  onDelete?: (id: string) => void
  onClone?: (id: string) => void
  onApply?: () => void
  onAddChild?: (kind?: StepType) => void
  collapsed?: boolean
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

  // Tags and Checklist removed per request

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
    if ((data.notes || '').trim()) parts.push((data.notes || '').trim().slice(0, 32))
    return parts.join(' • ')
  }, [data.level, data.type, data.className, data.featName, data.asi, data.notes])

  // Only certain levels qualify for ASI/Feat when type === 'level'
  const qualifiesForImprovements = useMemo(() => {
    const lvl = Number(data.level)
    const base = [4, 8, 12, 16, 19].includes(lvl)
    const fighterExtra = data.className === 'Fighter' && (lvl === 6 || lvl === 14)
    const rogueExtra = data.className === 'Rogue' && lvl === 10
    return base || fighterExtra || rogueExtra
  }, [data.level, data.className])

  return (
    <div style={{ position: 'relative' }}>
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
          {data.onApply ? (
            <button className="nodrag nopan" style={btn} onClick={(e) => { e.preventDefault(); data.onApply?.(); const dtl = (e.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null; if (dtl) dtl.removeAttribute('open') }}>Apply to Builder</button>
          ) : null}
        </div>
      </details>
      <Handle type="target" position={Position.Left} />
  <PanelBox title={`Step — ${summary}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ ...badge }}>Type: {data.type}</span>
            <span style={{ ...badge }}>Level: {data.level}</span>
          </div>
          {/* actions moved to kebab */}
        </div>
  {!data.collapsed && (
  <>
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
        {false && (
          <div />
        )}
  {data.type === 'feat' && (
          <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#475569' }}>
            <span>Feats (this level)</span>
            <input value={data.featName || ''} onChange={(e) => data.onChange?.({ featName: e.target.value })} placeholder="Great Weapon Master" style={inp} />
            {/* Optional multiple feats list */}
            <div style={{ display: 'grid', gap: 6 }}>
              {(data.feats || []).map((f, i) => (
                <div key={`${i}-${f}`} style={{ display: 'flex', gap: 6 }}>
                  <input value={f} onChange={(e) => {
                    const copy = [...(data.feats || [])]; copy[i] = e.target.value; data.onChange?.({ feats: copy })
                  }} style={inp} />
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
  {/* Notes removed per request; Tags/Checklist removed */}
  </>
        )}
      </PanelBox>
      {data.onApply || data.onChange ? null : null}
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
              {(['class','feat','asi','note'] as StepType[]).map((k) => (
                <button
                  key={k}
                  className="nodrag nopan"
                  style={{ ...btn, padding: '4px 8px' }}
                  onClick={(e) => {
                    e.preventDefault()
                    data.onAddChild?.(k)
                    const dtl = (e.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null
                    if (dtl && dtl.hasAttribute('open')) dtl.removeAttribute('open')
                  }}
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

  return (
    <div style={{ position: 'relative' }}>
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
              {(['class','feat','asi','note'] as StepType[]).map((k) => (
                <button
                  key={k}
                  className="nodrag nopan"
                  style={{ ...btn, padding: '4px 8px' }}
                  onClick={(e) => {
                    e.preventDefault()
                    data.onAddChild?.(k)
                    const dtl = (e.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null
                    if (dtl && dtl.hasAttribute('open')) dtl.removeAttribute('open')
                  }}
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
  const cur = byLevel.get(lvl) || { level: lvl, feats: [] as string[] }
    if (n.data?.className) cur.className = n.data.className
    const feats: string[] = [
      ...(Array.isArray(n.data?.feats) ? n.data.feats.filter((x: any) => !!x) : []),
      ...(n.data?.featName ? [n.data.featName] : []),
    ]
    if (feats.length) cur.feats = [...cur.feats, ...feats]
    if (n.data?.asi) cur.asi = n.data.asi
    if (n.data?.ability1) cur.ability1 = n.data.ability1
    if (n.data?.ability2) cur.ability2 = n.data.ability2
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
  // Find nearest ancestor root for race/background
  let cur: string | undefined = startId
  let guard = 0
  let rootId: string | undefined
  while (cur && guard < 256) {
    guard += 1
    const incoming = (edges as any[]).filter((e) => e.target === cur)
    if (!incoming.length) break
    // prefer parent with lowest Y (stable visual ordering)
    const parentId = incoming
      .map((e) => ({ e, n: idToNode.get(e.source) }))
      .filter((x) => !!x.n)
      .sort((a, b) => (a.n!.position?.y || 0) - (b.n!.position?.y || 0))[0]?.n?.id
    if (!parentId) break
    const pn = idToNode.get(parentId)
    if (!pn) break
    if (pn.type === 'root') { rootId = pn.id; break }
    cur = pn.id
  }
  const rootNode = rootId ? idToNode.get(rootId) : undefined
  // Walk forward from startId
  const seq: any[] = []
  cur = startId
  guard = 0
  while (cur && guard < 256) {
    guard += 1
    const n = idToNode.get(cur)
    if (n && n.type === 'progressStep') seq.push(n)
    const outs = (edges as any[]).filter((e) => e.source === cur)
    if (!outs.length) break
    const nextId = outs
      .map((e) => ({ e, n: idToNode.get(e.target) }))
      .filter((x) => !!x.n)
      .sort((a, b) => (a.n!.position?.y || 0) - (b.n!.position?.y || 0))[0]?.n?.id
    if (!nextId) break
    cur = nextId
  }
  // Aggregate by level starting from this node forward
  const byLevel = new Map<number, any>()
  for (const n of seq) {
    const lvl = Number(n.data?.level || 0)
    if (!lvl) continue
  const cur = byLevel.get(lvl) || { level: lvl, feats: [] as string[] }
    if (n.data?.className) cur.className = n.data.className
    const feats: string[] = [
      ...(Array.isArray(n.data?.feats) ? n.data.feats.filter((x: any) => !!x) : []),
      ...(n.data?.featName ? [n.data.featName] : []),
    ]
    if (feats.length) cur.feats = [...cur.feats, ...feats]
    if (n.data?.asi) cur.asi = n.data.asi
    if (n.data?.ability1) cur.ability1 = n.data.ability1
    if (n.data?.ability2) cur.ability2 = n.data.ability2
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
    const idToNode = new Map(props.nodes.map((n) => [n.id, n] as const))
    const outEdgesBySource = new Map<string, any[]>(props.edges.reduce((m: [string, any[]][], e: any) => {
      const arr = (outEdgesBySource as any).get?.(e.source) || []
      arr.push(e)
      m.push([e.source, arr])
      return m
    }, []))
    // Simple chain walk: follow the first outgoing edge each time, preferring lowest Y position of target
    const seq: any[] = []
    let cur = selectedRoot
    let guard = 0
    while (cur && guard < 256) {
      guard += 1
      const outs = (props.edges as any[]).filter((e) => e.source === cur)
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
    // Fallback: if no sequential walk found, include all reachable step nodes sorted by level
    if (!seq.length) {
      const reach = new Set<string>()
      const stack = [selectedRoot]
      while (stack.length) {
        const s = stack.pop()!
        if (reach.has(s)) continue
        reach.add(s)
        props.edges.filter((e) => e.source === s).forEach((e) => stack.push(e.target))
      }
      seq.push(...props.nodes.filter((n) => n.type === 'progressStep' && reach.has(n.id)))
      seq.sort((a, b) => (a.data?.level || 0) - (b.data?.level || 0) || (a.position?.y || 0) - (b.position?.y || 0))
    }

    const rootNode = idToNode.get(selectedRoot)
    const plan = {
      race: rootNode?.data?.race,
      background: rootNode?.data?.background,
      levels: seq.map((n) => ({
        level: n.data?.level,
        className: n.data?.className,
        feats: [
          ...(Array.isArray(n.data?.feats) ? n.data.feats.filter((x: any) => !!x) : []),
          ...(n.data?.featName ? [n.data.featName] : []),
        ],
        asi: n.data?.asi,
        ability1: n.data?.ability1,
        ability2: n.data?.ability2,
        notes: n.data?.notes,
  // tags removed
      })),
    }
    return plan
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
      </div>
    </div>
  )
}

export function ProgressionPlanner(props: { character?: BuilderState; derived?: any; onApplyPlan?: (plan: any) => void }) {
  // Seed from Builder by default; keep state empty until seeded
  const [nodes, setNodes, baseOnNodesChange] = useNodesState<any>([] as any)
  const [edges, setEdges, baseOnEdgesChange] = useEdgesState([])
  const seededRef = useRef(false)
  const loadedFromStorageRef = useRef(false)

  const STORAGE_KEY_BASE = 'progressionPlanner.v1'
  const storageKey = useMemo(() => `${STORAGE_KEY_BASE}:${props.character?.name || 'default'}`, [props.character?.name])
  const DISMISS_KEY_BASE = 'progressionPlanner.reseedDismissed.v1'
  const dismissKey = useMemo(() => `${DISMISS_KEY_BASE}:${props.character?.name || 'default'}`,[props.character?.name])

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
      const classes = seq
        .slice()
        .sort((a, b) => (a.data?.level || 0) - (b.data?.level || 0) || (a.position?.y || 0) - (b.position?.y || 0))
        .map((n) => n.data?.className || '')
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
        }
        return { id: n.id, type: n.type, position: n.position, data: d }
      })
      const payload = { nodes: cleanNodes, edges }
      localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch {}
  }, [nodes, edges, storageKey])

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

  // Auto-arrange: account for expanded/collapsed heights per card and stack accordingly
  const autoArrange = useCallback(() => {
    const idSet = new Set(nodes.map((n) => n.id))
    const incoming: Record<string, number> = {}
    nodes.forEach((n) => { incoming[n.id] = 0 })
    edges.forEach((e) => { if (idSet.has(e.target)) incoming[e.target] = (incoming[e.target] || 0) + 1 })

    // Compute depths via longest path propagation
    const depth: Record<string, number> = {}
    nodes.forEach((n) => { depth[n.id] = incoming[n.id] ? 0 : 0 })
    for (let iter = 0; iter < nodes.length; iter += 1) {
      let changed = false
      for (const e of edges) {
        const d = (depth[e.source] ?? 0) + 1
        if ((depth[e.target] ?? 0) < d) { depth[e.target] = d; changed = true }
      }
      if (!changed) break
    }

    // Group by depth
    const byDepth: Record<number, any[]> = {}
    nodes.forEach((n) => {
      const d = depth[n.id] ?? 0
      if (!byDepth[d]) byDepth[d] = []
      byDepth[d].push(n)
    })

    // Helpers for estimated card heights (fallback to measured values if present)
    const getHeight = (n: any): number => {
      const measured = (n as any).height || (n as any).measured?.height
      if (typeof measured === 'number' && measured > 0) return measured
      const collapsed = !!n.data?.collapsed
      if (n.type === 'root') return collapsed ? 120 : 240
      // progressStep or others
      return collapsed ? 140 : 560
    }

    const dx = 360 // allow more room for expanded nodes
    const gapY = 24
    const x0 = 40
    const y0 = 60
    const nextPositions: Record<string, { x: number; y: number }> = {}
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
        nextPositions[n.id] = { x: x0 + colIdx * dx, y: yAcc }
        yAcc += getHeight(n) + gapY
      })
    })

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
  setEdges((eds: any[]) => [...eds, { id: `e-${crypto.randomUUID().slice(0, 6)}`, source: sourceId, target: newId }])
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
          const plan: any = buildPlanFromRoot(nds as any, edges as any, n.id)
          if (plan && props.onApplyPlan) props.onApplyPlan(plan)
        }
      }
      if (n.type === 'progressStep' && !d.onApply) {
        d.onApply = () => {
          const plan: any = buildPlanFromStart(nds as any, edges as any, n.id)
          if (plan && props.onApplyPlan) props.onApplyPlan(plan)
        }
      }
      if (!d.onAddChild) d.onAddChild = () => addChild(n.id)
      return { ...n, data: d }
    }))
  }, [updateNodeData, cloneBranch, edges, props.onApplyPlan, addChild, setNodes])

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
    const y = 40 + Math.random() * 720
    const base: any = { id, type, position: { x: type === 'root' ? 40 : 360, y }, data: {} }
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
        <ReactFlow nodes={nodes as any} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes as any} fitView>
          <Background />
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
        </ReactFlow>
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
          <div style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', paddingRight: 16 }}>
            <button onClick={undo} style={btn}>↶ Undo</button>
            <button onClick={redo} style={btn}>↷ Redo</button>
            <button onClick={autoArrange} style={btn} title="Auto-arrange nodes">Auto Arrange</button>
            <button onClick={expandAll} style={btn} title="Expand all nodes">Expand All</button>
            <button onClick={collapseAll} style={btn} title="Collapse all nodes">Collapse All</button>
  <button onClick={() => { const seeded = seedFromBuilder(props.character, props.derived); if (!seeded) return; snapshot(); setNodes((seeded.nodes as any[]).map((n) => { const d: any = { ...n.data, onChange: (p: any) => updateNodeData(n.id, p), onDelete: (nid: string) => removeNode(nid) }; if (n.type === 'root') { d.onClone = () => cloneBranch(n.id); d.onApply = () => { const plan: any = buildPlanFromRoot(seeded.nodes as any, seeded.edges as any, n.id); if (plan && props.onApplyPlan) props.onApplyPlan(plan) } } if (n.type === 'progressStep') { d.onApply = () => { const plan: any = buildPlanFromStart(seeded.nodes as any, seeded.edges as any, n.id); if (plan && props.onApplyPlan) props.onApplyPlan(plan) } } d.onAddChild = (k?: StepType) => addChild(n.id, k); return { ...n, data: d } })); setEdges(seeded.edges as any) }} style={btn} title="Regenerate using current Builder">Reseed from Builder</button>
          </div>
        </section>

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
              {(RACE_NAMES as readonly string[]).map((r: string) => (<TokenChip key={r} label={r} type="race" value={r} />))}
              {(BACKGROUNDS as readonly string[]).map((b: string) => (<TokenChip key={b} label={b} type="background" value={b} />))}
              {/* Simple text options for Other */}
              {['Variant Rule', 'Alignment', 'Deity'].map((t) => (<TokenChip key={t} label={t} type="text" value={t} />))}
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

  {/* Tips removed per feedback */}
      </div>
    </div>
  )
}

export default ProgressionPlanner
