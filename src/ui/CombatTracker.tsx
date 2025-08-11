import React, { useMemo, useState } from 'react'

type Combatant = {
  id: string
  name: string
  maxHp: number
  hp: number
  initiative: number
}

function uuid() {
  return Math.random().toString(36).slice(2, 9)
}

export default function CombatTracker() {
  const [combatants, setCombatants] = useState<Combatant[]>([])
  const [round, setRound] = useState(1)
  const [turnIndex, setTurnIndex] = useState(0)

  const [name, setName] = useState('')
  const [maxHp, setMaxHp] = useState<number | ''>('')
  const [initiative, setInitiative] = useState<number | ''>('')

  const ordered = useMemo(
    () => [...combatants].sort((a, b) => b.initiative - a.initiative),
    [combatants]
  )

  const currentId = ordered[turnIndex]?.id

  const add = () => {
    if (!name || maxHp === '' || initiative === '') return
    const c: Combatant = {
      id: uuid(),
      name: name.trim(),
      maxHp: Number(maxHp),
      hp: Number(maxHp),
      initiative: Number(initiative),
    }
    const next = [...combatants, c]
    setCombatants(next)
    // Keep current turn pointed to the same combatant after sort if possible
    const sorted = [...next].sort((a, b) => b.initiative - a.initiative)
    const idx = Math.max(0, sorted.findIndex(x => x.id === currentId))
    setTurnIndex(idx === -1 ? 0 : idx)
    setName('')
    setMaxHp('')
    setInitiative('')
  }

  const remove = (id: string) => {
    const idxInOrder = ordered.findIndex(c => c.id === id)
    const filtered = combatants.filter(c => c.id !== id)
    setCombatants(filtered)
    if (filtered.length === 0) {
      setTurnIndex(0)
      setRound(1)
    } else if (idxInOrder !== -1) {
      // If removing someone before or at current index, keep pointer consistent
      const newOrder = [...filtered].sort((a, b) => b.initiative - a.initiative)
      const newIdx = Math.min(Math.max(0, turnIndex - (idxInOrder <= turnIndex ? 1 : 0)), newOrder.length - 1)
      setTurnIndex(newIdx)
    }
  }

  const nextTurn = () => {
    if (ordered.length === 0) return
    const nextIdx = (turnIndex + 1) % ordered.length
    setTurnIndex(nextIdx)
    if (nextIdx === 0) setRound(r => r + 1)
  }

  const applyDelta = (id: string, delta: number) => {
    setCombatants(cs => cs.map(c => (c.id === id ? { ...c, hp: Math.max(0, Math.min(c.maxHp, c.hp + delta)) } : c)))
  }

  const reset = () => {
    setRound(1)
    setTurnIndex(0)
    setCombatants(cs => cs.map(c => ({ ...c, hp: c.maxHp })))
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>Combat Tracker</h2>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Goblin A / Cleric" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Max HP</label>
          <input value={maxHp} onChange={e => setMaxHp(e.target.value === '' ? '' : Number(e.target.value))} type="number" min={0} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Initiative</label>
          <input value={initiative} onChange={e => setInitiative(e.target.value === '' ? '' : Number(e.target.value))} type="number" style={inputStyle} />
        </div>
        <button onClick={add} style={primaryBtn}>Add</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <div style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 8, background: 'white' }}>Round: <b>{round}</b></div>
          <button onClick={nextTurn} style={btn}>Next Turn →</button>
          <button onClick={reset} style={btn}>Reset</button>
        </div>
      </div>

      {ordered.length === 0 ? (
        <div style={{ padding: 16, border: '1px dashed #cbd5e1', borderRadius: 8, color: '#475569' }}>
          Add combatants with their max HP and initiative. Use Next Turn to advance the round.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {ordered.map((c, idx) => {
            const isActive = idx === turnIndex
            const isDown = c.hp <= 0
            return (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr repeat(4, auto)', alignItems: 'center', gap: 8, padding: 10, border: '1px solid #e2e8f0', borderRadius: 8, background: isActive ? '#ecfeff' : 'white', opacity: isDown ? 0.7 : 1 }}>
                <div title="Initiative" style={{ width: 40, textAlign: 'center', fontWeight: 700 }}>{c.initiative}</div>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <HpBar hp={c.hp} maxHp={c.maxHp} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => applyDelta(c.id, -1)} style={smallBtn}>-1</button>
                  <button onClick={() => applyDelta(c.id, -5)} style={smallBtn}>-5</button>
                  <button onClick={() => applyDelta(c.id, -10)} style={smallBtn}>-10</button>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => applyDelta(c.id, +1)} style={smallBtn}>+1</button>
                  <button onClick={() => applyDelta(c.id, +5)} style={smallBtn}>+5</button>
                  <button onClick={() => applyDelta(c.id, +10)} style={smallBtn}>+10</button>
                </div>
                <div style={{ color: '#0f172a', minWidth: 80, textAlign: 'right' }}>{c.hp} / {c.maxHp}</div>
                <button onClick={() => remove(c.id)} style={{ ...smallBtn, color: '#ef4444', borderColor: '#fecaca' }}>Remove</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100))
  const color = hp <= 0 ? '#64748b' : pct < 25 ? '#ef4444' : pct < 60 ? '#f59e0b' : '#22c55e'
  return (
    <div style={{ height: 10, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden', border: '1px solid #e2e8f0', marginTop: 6 }}>
      <div style={{ width: pct + '%', height: '100%', background: color }} />
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: '#334155', marginBottom: 4 }
const inputStyle: React.CSSProperties = { padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8, minWidth: 160 }
const btn: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }
const primaryBtn: React.CSSProperties = { ...btn, background: '#0ea5e9', color: 'white', borderColor: '#38bdf8' }
const smallBtn: React.CSSProperties = { ...btn, padding: '6px 10px' }
