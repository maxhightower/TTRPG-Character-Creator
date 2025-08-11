import React, { useMemo, useState } from 'react'

// Very lightweight Monte Carlo encounter simulator for DPR vs HP attrition over N rounds
// Not a full 5e engine—just enough to explore average outcomes quickly.

type Side = {
  name: string
  count: number
  attackBonus: number
  damageAvg: number // average damage per hit
  ac: number
  hp: number // HP per unit
}

type Result = {
  trials: number
  rounds: number
  winRateA: number
  winRateB: number
  avgUnitsAliveA: number
  avgUnitsAliveB: number
}

function d20() {
  return Math.floor(Math.random() * 20) + 1
}

function simulateOnce(A: Side, B: Side, maxRounds: number) {
  const a: number[] = Array(A.count).fill(A.hp)
  const b: number[] = Array(B.count).fill(B.hp)

  const atkP = (atk: number, ac: number) => {
    // Hit on d20 + atk >= ac; 1 auto miss, 20 auto hit
    let hits = 0
    for (let i = 0; i < 1; i++) {
      const r = d20()
      const hit = r === 20 || (r !== 1 && r + atk >= ac)
      if (hit) hits++
    }
    return hits
  }

  for (let round = 1; round <= maxRounds; round++) {
    // A attacks B
    for (let i = 0; i < a.length; i++) {
      if (a[i] <= 0) continue
      // Assume 1 attack each with average damage on hit
      const hits = atkP(A.attackBonus, B.ac)
      let dmg = hits * A.damageAvg
      // Apply to first alive enemy
      for (let j = 0; j < b.length && dmg > 0; j++) {
        if (b[j] <= 0) continue
        const before = b[j]
        b[j] = Math.max(0, b[j] - dmg)
        dmg = Math.max(0, dmg - before)
      }
    }

    // B attacks A
    for (let i = 0; i < b.length; i++) {
      if (b[i] <= 0) continue
      const hits = atkP(B.attackBonus, A.ac)
      let dmg = hits * B.damageAvg
      for (let j = 0; j < a.length && dmg > 0; j++) {
        if (a[j] <= 0) continue
        const before = a[j]
        a[j] = Math.max(0, a[j] - dmg)
        dmg = Math.max(0, dmg - before)
      }
    }

    const aliveA = a.some(x => x > 0)
    const aliveB = b.some(x => x > 0)
    if (!aliveA || !aliveB) break
  }

  const aliveA = a.filter(x => x > 0).length
  const aliveB = b.filter(x => x > 0).length
  return { aliveA, aliveB }
}

export default function EncounterSimulator() {
  const [A, setA] = useState<Side>({ name: 'Party', count: 4, attackBonus: 6, damageAvg: 8, ac: 16, hp: 24 })
  const [B, setB] = useState<Side>({ name: 'Enemies', count: 4, attackBonus: 4, damageAvg: 6, ac: 14, hp: 18 })
  const [rounds, setRounds] = useState(5)
  const [trials, setTrials] = useState(2000)

  const run = useMemo(() => {
    return (): Result => {
      let winsA = 0
      let winsB = 0
      let sumAliveA = 0
      let sumAliveB = 0
      for (let t = 0; t < trials; t++) {
        const r = simulateOnce(A, B, rounds)
        sumAliveA += r.aliveA
        sumAliveB += r.aliveB
        if (r.aliveA > 0 && r.aliveB === 0) winsA++
        else if (r.aliveB > 0 && r.aliveA === 0) winsB++
        else if (r.aliveA > r.aliveB) winsA++
        else if (r.aliveB > r.aliveA) winsB++
      }
      const res: Result = {
        trials,
        rounds,
        winRateA: winsA / trials,
        winRateB: winsB / trials,
        avgUnitsAliveA: sumAliveA / trials,
        avgUnitsAliveB: sumAliveB / trials,
      }
      return res
    }
  }, [A, B, rounds, trials])

  const result = useMemo(() => run(), [run])

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>Encounter Simulator</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <SideEditor title="Side A" side={A} onChange={setA} />
        <SideEditor title="Side B" side={B} onChange={setB} />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <label style={label}>Rounds</label>
          <input type="number" min={1} value={rounds} onChange={e => setRounds(Number(e.target.value))} style={input} />
        </div>
        <div>
          <label style={label}>Trials</label>
          <input type="number" min={100} step={100} value={trials} onChange={e => setTrials(Number(e.target.value))} style={input} />
        </div>
        <div style={{ marginLeft: 'auto', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: 'white' }}>
          Computed across {result.trials.toLocaleString()} trials / {result.rounds} rounds
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Stat title={`${A.name} Win Rate`} value={(result.winRateA * 100).toFixed(1) + '%'} accent="#22c55e" />
        <Stat title={`${B.name} Win Rate`} value={(result.winRateB * 100).toFixed(1) + '%'} accent="#ef4444" />
        <Stat title={`${A.name} Avg Units Alive`} value={result.avgUnitsAliveA.toFixed(2)} />
        <Stat title={`${B.name} Avg Units Alive`} value={result.avgUnitsAliveB.toFixed(2)} />
      </div>
    </div>
  )
}

function SideEditor({ title, side, onChange }: { title: string; side: Side; onChange: (s: Side) => void }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        <Field label="Name">
          <input value={side.name} onChange={e => onChange({ ...side, name: e.target.value })} style={input} />
        </Field>
        <Field label="Count">
          <input type="number" min={1} value={side.count} onChange={e => onChange({ ...side, count: Number(e.target.value) })} style={input} />
        </Field>
        <Field label="Attack Bonus">
          <input type="number" value={side.attackBonus} onChange={e => onChange({ ...side, attackBonus: Number(e.target.value) })} style={input} />
        </Field>
        <Field label="Avg Damage on Hit">
          <input type="number" min={0} value={side.damageAvg} onChange={e => onChange({ ...side, damageAvg: Number(e.target.value) })} style={input} />
        </Field>
        <Field label="AC">
          <input type="number" min={0} value={side.ac} onChange={e => onChange({ ...side, ac: Number(e.target.value) })} style={input} />
        </Field>
        <Field label="HP per Unit">
          <input type="number" min={1} value={side.hp} onChange={e => onChange({ ...side, hp: Number(e.target.value) })} style={input} />
        </Field>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <div style={labelStyle}>{label}</div>
      {children}
    </label>
  )
}

function Stat({ title, value, accent }: { title: string; value: string; accent?: string }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, color: '#334155' }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ?? '#0f172a' }}>{value}</div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: '#334155', marginBottom: 4 }
const label: React.CSSProperties = labelStyle
const input: React.CSSProperties = { padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8, width: '100%' }
