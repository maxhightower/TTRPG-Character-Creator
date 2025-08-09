import React, { useState } from 'react'
import Builder, { AppState as BuilderState } from './Builder'
import { NodeOptimizer } from './NodeOptimizer'
import ProgressionPlanner from './ProgressionPlanner'

export function App() {
  const [tab, setTab] = useState<'builder' | 'planner' | 'optimizer'>('builder')
  const [character, setCharacter] = useState<BuilderState | undefined>(undefined)
  const [derived, setDerived] = useState<any>(undefined)
  return (
    <div style={{ fontFamily: 'system-ui, Arial, sans-serif', color: '#0f172a' }}>
      <header style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>TTRPG Character Creator (5e)</h1>
        <nav style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTab('builder')} style={btn(tab === 'builder')}>Character Builder</button>
          <button onClick={() => setTab('planner')} style={btn(tab === 'planner')}>Progression Planner</button>
          <button onClick={() => setTab('optimizer')} style={btn(tab === 'optimizer')}>DPR Graph Optimizer</button>
        </nav>
      </header>

      <main style={{ padding: 16 }}>
        {tab === 'builder' ? (
          <Builder onCharacterChange={(s, d) => { setCharacter(s); setDerived(d) }} />
        ) : tab === 'planner' ? (
          <ProgressionPlanner character={character} derived={derived} />
        ) : (
          <NodeOptimizer character={character} derived={derived} />
        )}
      </main>
    </div>
  )
}

function btn(active: boolean): React.CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    background: active ? '#0ea5e9' : 'white',
    color: active ? 'white' : '#0f172a',
    cursor: 'pointer'
  }
}
