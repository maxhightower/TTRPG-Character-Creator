import React, { useState } from 'react'
import { Builder } from './Builder'
import { Optimizer } from './Optimizer'

export function App() {
  const [tab, setTab] = useState<'builder' | 'optimizer'>('builder')
  return (
    <div style={{ fontFamily: 'system-ui, Arial, sans-serif', color: '#0f172a' }}>
      <header style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>TTRPG Character Creator (5e)</h1>
        <nav style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTab('builder')} style={btn(tab === 'builder')}>Character Builder</button>
          <button onClick={() => setTab('optimizer')} style={btn(tab === 'optimizer')}>DPR Optimizer</button>
        </nav>
      </header>

      <main style={{ padding: 16 }}>
        {tab === 'builder' ? <Builder /> : <Optimizer />}
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
