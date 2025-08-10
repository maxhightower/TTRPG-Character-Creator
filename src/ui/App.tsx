import React, { useState } from 'react'
import Builder, { AppState as BuilderState } from './Builder.tsx'
import { NodeOptimizer } from './NodeOptimizer.tsx'
import ProgressionPlanner from './ProgressionPlanner.tsx'

export function App() {
  const [tab, setTab] = useState<'builder' | 'planner' | 'optimizer'>('builder')
  const [character, setCharacter] = useState<BuilderState | undefined>(undefined)
  const [derived, setDerived] = useState<any>(undefined)
  // Plan imported from Progression Planner to apply in Builder
  const [importPlan, setImportPlan] = useState<any | undefined>(undefined)
  const onApplyPlan = (plan: any) => {
    // Tag with a timestamp to ensure Builder effect runs even for similar objects
    setImportPlan({ ...plan, _ts: Date.now() })
    // Switch to Builder tab so user sees the applied changes
    setTab('builder')
  }
  return (
    <div>
      <header style={{ position: 'sticky', top: 0, zIndex: 30, backdropFilter: 'saturate(1.2) blur(6px)', background: 'rgba(248,250,252,0.8)', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: 20, letterSpacing: 0.2, fontWeight: 700 }}>TTRPG Character Creator (5e)</h1>
          <nav style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTab('builder')} style={btn(tab === 'builder')}>Character Builder</button>
          <button onClick={() => setTab('planner')} style={btn(tab === 'planner')}>Progression Planner</button>
          <button onClick={() => setTab('optimizer')} style={btn(tab === 'optimizer')}>DPR Graph Optimizer</button>
          </nav>
        </div>
      </header>

      <main style={{ padding: '16px 20px' }}>
        {tab === 'builder' ? (
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <Builder importPlan={importPlan} onCharacterChange={(s, d) => { setCharacter(s); setDerived(d) }} />
          </div>
        ) : tab === 'planner' ? (
          <ProgressionPlanner character={character} derived={derived} onApplyPlan={onApplyPlan} />
        ) : (
          <NodeOptimizer character={character} derived={derived} />
        )}
      </main>
    </div>
  )
}

function btn(active: boolean): React.CSSProperties {
  return {
  padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
  background: active ? '#0ea5e9' : 'white',
    color: active ? 'white' : '#0f172a',
    cursor: 'pointer'
  }
}
