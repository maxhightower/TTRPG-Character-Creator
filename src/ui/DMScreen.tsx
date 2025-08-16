import React, { useEffect, useState } from 'react'
import CombatTracker from './CombatTracker.tsx'
import EncounterSimulator from './EncounterSimulator.tsx'
import TheatreCombatTracker from './TheatreCombatTracker.tsx'

// Lightweight DM Screen to host multiple quick-reference / utility panels.
// Initial prototype includes:
//  - Session Notes (persisted locally)
//  - Combat Tracker (existing component)
//  - Encounter Simulator (existing component)
// Future ideas: random loot/encounter generator, conditions reference, timers, initiative roller.

type PanelId = 'notes' | 'combat' | 'sim' | 'theatre'

// Order determines button order; Theatre first per request
const ALL_PANELS: { id: PanelId; title: string; defaultOpen: boolean }[] = [
  { id: 'theatre', title: 'Theatre Combat', defaultOpen: true },
  { id: 'notes', title: 'Session Notes', defaultOpen: true },
  { id: 'combat', title: 'Combat Tracker', defaultOpen: true },
  { id: 'sim', title: 'Encounter Simulator', defaultOpen: false },
]

export default function DMScreen() {
  const [open, setOpen] = useState<Record<PanelId, boolean>>(() => {
    try {
      const raw = localStorage.getItem('dm.panels.open.v1')
      if (raw) return JSON.parse(raw)
    } catch {}
    return ALL_PANELS.reduce((acc, p) => { acc[p.id] = p.defaultOpen; return acc }, {} as Record<PanelId, boolean>)
  })
  useEffect(() => {
    try { localStorage.setItem('dm.panels.open.v1', JSON.stringify(open)) } catch {}
  }, [open])

  const [notes, setNotes] = useState<string>(() => {
    try { return localStorage.getItem('dm.notes.v1') || '' } catch { return '' }
  })
  useEffect(() => {
    const h = setTimeout(() => {
      try { localStorage.setItem('dm.notes.v1', notes) } catch {}
    }, 400)
    return () => clearTimeout(h)
  }, [notes])

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>DM Screen (Prototype)</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {ALL_PANELS.map(p => (
          <button key={p.id} onClick={() => setOpen(o => ({ ...o, [p.id]: !o[p.id] }))} style={segBtn(open[p.id])}>{open[p.id] ? '▼' : '▶'} {p.title}</button>
        ))}
      </div>

      {open.theatre && (
        <Panel title="Theatre of the Mind Tracker">
          <TheatreCombatTracker />
        </Panel>
      )}

      {open.notes && (
        <Panel title="Session Notes">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Session prep, NPC names, initiative order scratch, etc. (auto-saves)"
            style={{ width: '100%', minHeight: 160, padding: 12, border: '1px solid var(--panel-border, #e2e8f0)', borderRadius: 12, background: 'var(--panel-bg, #fff)', fontFamily: 'inherit', resize: 'vertical' }}
          />
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Auto-saved locally. ({notes.length} chars)</div>
        </Panel>
      )}

      {open.combat && (
        <Panel title="Combat Tracker">
          <CombatTracker />
        </Panel>
      )}

      {open.sim && (
        <Panel title="Encounter Simulator">
          <EncounterSimulator />
        </Panel>
      )}

      <div style={{ marginTop: 32, fontSize: 12, color: '#64748b' }}>
        Prototype: Expect rapid iteration. Suggest new widgets you need and we'll slot them in.
      </div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>{title}</h3>
      <div style={{ border: '1px solid var(--panel-border, #e2e8f0)', borderRadius: 16, padding: 16, background: 'var(--panel-bg, #fff)' }}>
        {children}
      </div>
    </section>
  )
}

function segBtn(active: boolean): React.CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 30,
    border: '1px solid var(--button-border, #cbd5e1)',
    background: active ? 'var(--button-active-bg, #0ea5e9)' : 'var(--button-bg, #fff)',
    color: active ? 'var(--button-active-fg, #fff)' : 'var(--button-fg, #0f172a)',
    cursor: 'pointer',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 4
  }
}
