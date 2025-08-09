import React, { useMemo, useState } from 'react'

const RACES = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Half-Orc', 'Gnome', 'Tiefling'] as const
const CLASSES = ['Fighter', 'Rogue', 'Barbarian', 'Paladin', 'Wizard', 'Cleric', 'Ranger', 'Bard', 'Monk', 'Warlock', 'Druid', 'Sorcerer'] as const

type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'

function mod(score: number) { return Math.floor((score - 10) / 2) }
function profBonus(level: number) {
  if (level >= 17) return 6
  if (level >= 13) return 5
  if (level >= 9) return 4
  if (level >= 5) return 3
  return 2
}

export function Builder() {
  const [name, setName] = useState('New Hero')
  const [race, setRace] = useState<typeof RACES[number]>('Human')
  const [klass, setKlass] = useState<typeof CLASSES[number]>('Fighter')
  const [level, setLevel] = useState(5)
  const [abilities, setAbilities] = useState<Record<Ability, number>>({ STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 10 })

  const pb = useMemo(() => profBonus(level), [level])

  function setScore(key: Ability, v: number) {
    setAbilities((prev: Record<Ability, number>) => ({ ...prev, [key]: Math.max(8, Math.min(20, Math.round(v))) }))
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
          <div>
            <label style={lbl}>Name</label>
            <input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Race</label>
            <select value={race} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRace(e.target.value as any)} style={inp}>
              {RACES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Class</label>
            <select value={klass} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setKlass(e.target.value as any)} style={inp}>
              {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Level</label>
            <input type="number" min={1} max={20} value={level} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLevel(Number(e.target.value || 1))} style={inp} />
          </div>
        </div>
      </section>

      <section>
        <h3 style={{ margin: '8px 0' }}>Ability Scores</h3>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
          {(Object.keys(abilities) as Ability[]).map((ab) => (
            <div key={ab} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong>{ab}</strong>
                <span>mod {mod(abilities[ab]) >= 0 ? '+' : ''}{mod(abilities[ab])}</span>
              </div>
              <input
                type="range"
                min={8}
                max={20}
                step={1}
                value={abilities[ab]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScore(ab, Number(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input type="number" min={8} max={20} value={abilities[ab]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScore(ab, Number(e.target.value || 8))} style={{ ...inp, width: '100%' }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gap: 8 }}>
        <h3 style={{ margin: '8px 0' }}>Summary</h3>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
          {(Object.keys(abilities) as Ability[]).map((ab) => (
            <div key={ab} style={chip}>{ab}: {abilities[ab]} ({mod(abilities[ab]) >= 0 ? '+' : ''}{mod(abilities[ab])})</div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={chip}>Level {level}</div>
          <div style={chip}>Proficiency +{pb}</div>
          <div style={chip}>{race}</div>
          <div style={chip}>{klass}</div>
          <div style={chip}>Name: {name}</div>
        </div>
      </section>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: '#475569', marginBottom: 6 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }
const chip: React.CSSProperties = { padding: '6px 10px', borderRadius: 999, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 13 }
