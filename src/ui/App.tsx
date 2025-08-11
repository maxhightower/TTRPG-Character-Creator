import React, { useEffect, useMemo, useState } from 'react'
import Builder, { AppState as BuilderState } from './Builder.tsx'
import { NodeOptimizer } from './NodeOptimizer.tsx'
import ProgressionPlanner from './ProgressionPlanner.tsx'
import CombatTracker from './CombatTracker.tsx'
import EncounterSimulator from './EncounterSimulator.tsx'

export function App() {
  const [tab, setTab] = useState<'builder' | 'planner' | 'optimizer' | 'combat' | 'sim'>('builder')
  const [character, setCharacter] = useState<BuilderState | undefined>(undefined)
  const [derived, setDerived] = useState<any>(undefined)
  // theme
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('theme.v1') as 'light' | 'dark' | null
      if (saved === 'light' || saved === 'dark') return saved
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      return prefersDark ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('theme.v1', theme)
    } catch {}
    const root = document.documentElement
    if (theme === 'dark') root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
  }, [theme])
  // Plan imported from Progression Planner to apply in Builder
  const [importPlan, setImportPlan] = useState<any | undefined>(undefined)
  const onApplyPlan = (plan: any) => {
    // Tag with a timestamp to ensure Builder effect runs even for similar objects
    setImportPlan({ ...plan, _ts: Date.now() })
    // Switch to Builder tab so user sees the applied changes
    setTab('builder')
  }

  // When navigating back to the Builder tab without explicitly applying, load the last active plan
  const activePlanKey = useMemo(() => `progressionPlanner.activePlan.v1:${character?.name || 'default'}`, [character?.name])
  useEffect(() => {
    if (tab !== 'builder') return
    try {
      const raw = localStorage.getItem(activePlanKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && parsed.plan) {
        // Attach a timestamp so Builder can detect and prompt
        setImportPlan({ ...(parsed.plan || {}), _ts: Date.now(), _origin: 'planner-passive' })
      }
    } catch {}
  }, [tab, activePlanKey])
  return (
    <div>
      <header style={{ position: 'sticky', top: 0, zIndex: 30, backdropFilter: 'saturate(1.2) blur(6px)', background: 'var(--header-bg)', borderBottom: '1px solid var(--header-border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 20, letterSpacing: 0.2, fontWeight: 700 }}>TTRPG Character Creator (5e)</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <nav style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setTab('builder')} style={btn(tab === 'builder')}>Character Builder</button>
              <button onClick={() => setTab('planner')} style={btn(tab === 'planner')}>Progression Planner</button>
              <button onClick={() => setTab('optimizer')} style={btn(tab === 'optimizer')}>DPR Graph Optimizer</button>
              <button onClick={() => setTab('combat')} style={btn(tab === 'combat')}>Combat Tracker</button>
              <button onClick={() => setTab('sim')} style={btn(tab === 'sim')}>Encounter Simulator</button>
            </nav>
            <button aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={toggleBtn()}>
              {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </button>
          </div>
        </div>
      </header>

      <main style={{ padding: '16px 20px' }}>
        {tab === 'builder' ? (
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <Builder importPlan={importPlan} onCharacterChange={(s, d) => { setCharacter(s); setDerived(d) }} />
          </div>
        ) : tab === 'planner' ? (
          <ProgressionPlanner character={character} derived={derived} onApplyPlan={onApplyPlan} />
        ) : tab === 'optimizer' ? (
          <NodeOptimizer character={character} derived={derived} />
        ) : tab === 'combat' ? (
          <CombatTracker />
        ) : (
          <EncounterSimulator />
        )}
      </main>
    </div>
  )
}

function btn(active: boolean): React.CSSProperties {
  return {
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid var(--button-border)',
    background: active ? 'var(--button-active-bg)' : 'var(--button-bg)',
    color: active ? 'var(--button-active-fg)' : 'var(--button-fg)',
    cursor: 'pointer'
  }
}

function toggleBtn(): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--button-border)',
    background: 'var(--button-bg)',
    color: 'var(--button-fg)',
    cursor: 'pointer'
  }
}
