import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppState as BuilderState } from './Builder.tsx'
import type { Equipment } from '../data/types'

type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
function isAbility(k: any): k is AbilityKey { return k === 'str' || k === 'dex' || k === 'con' || k === 'int' || k === 'wis' || k === 'cha' }

// Local utility (duplicated minimal logic to avoid broad re-exports)
function mod(score: number) { return Math.floor((score - 10) / 2) }

type SheetState = {
  hpCurrent: number
  tempHp: number
  hitDice: Record<string, { total: number; remaining: number }>
  rageRemaining?: number | 'unlimited'
  custom: Array<{ id: string; name: string; max: number; current: number }>
  spellSlots?: Record<string, { max: number; current: number }>
}

function uuid() { return Math.random().toString(36).slice(2,9) }

const btn: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, border: '1px solid var(--button-border)', background: 'var(--button-bg)', cursor: 'pointer', fontSize: 12 }
const primaryBtn: React.CSSProperties = { ...btn, background: 'var(--button-active-bg)', color: 'var(--button-active-fg)' }
const pill: React.CSSProperties = { padding: '2px 8px', borderRadius: 999, background: 'var(--pill-bg, #f1f5f9)', fontSize: 12 }

export function CharacterSheet(props: { character?: BuilderState; derived?: any }) {
  const { character, derived } = props
  const name = character?.name || 'unnamed'

  // Compute max HP & other derived baselines
  const maxHp = derived?.hp || 0

  // Build canonical hit dice map (e.g. d12 -> {total, remaining})
  const hitDiceTotals = useMemo(() => {
    const map: Record<string, number> = {}
    if (character) {
      character.classes.forEach(c => {
        const die = 'd' + (c.klass.hitDie || 8)
        map[die] = (map[die] || 0) + (c.level || 0)
      })
    }
    return map
  }, [character])

  // Spell slot model (shared + pact) simplified from progression logic
  const spellSlotsComputed = useMemo(() => computeSpellSlots(character), [character])

  const storageKey = `characterSheet.v1:${name}`
  const [sheet, setSheet] = useState<SheetState>(() => {
    if (!character) return initEmpty()
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        return migrateSheet(parsed, maxHp, hitDiceTotals, spellSlotsComputed, derived?.rageUses)
      }
    } catch {}
    return initFresh(maxHp, hitDiceTotals, spellSlotsComputed, derived?.rageUses)
  })

  // When character identity (name) changes load new state
  useEffect(() => {
    if (!character) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        setSheet(migrateSheet(parsed, maxHp, hitDiceTotals, spellSlotsComputed, derived?.rageUses))
        return
      }
    } catch {}
    setSheet(initFresh(maxHp, hitDiceTotals, spellSlotsComputed, derived?.rageUses))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])

  // Persist
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(sheet)) } catch {}
  }, [sheet, storageKey])

  // If max HP increases (e.g., edits in builder) adjust current proportionally (keep damage & temp separately)
  useEffect(() => {
    setSheet(s => {
      if (s.hpCurrent > maxHp) return { ...s, hpCurrent: maxHp }
      return s
    })
  }, [maxHp])

  // React to changes in hit dice totals / spell slots counts / rage uses
  useEffect(() => {
    setSheet(s => reconcileSheet(s, hitDiceTotals, spellSlotsComputed, derived?.rageUses))
  }, [hitDiceTotals, spellSlotsComputed, derived?.rageUses])

  if (!character) return <div style={{ padding: 16, border: '1px dashed var(--muted-border)', borderRadius: 8 }}>Build a character first in the Builder tab.</div>

  const abilitiesFinal = useMemo(() => {
    const base: Record<AbilityKey, number> = { ...character.abilities }
    const race: any = character.race || {}
    if (race?.asi?.fixed) {
      Object.entries(race.asi.fixed).forEach(([k,v]) => {
        if (isAbility(k)) base[k] = (base[k]||0) + (v as number)
      })
    }
    if (character.asi) {
      Object.entries(character.asi).forEach(([k,v]) => { if (isAbility(k)) base[k] = (base[k]||0) + (v as number) })
    }
    return base
  }, [character])

  const classSummary = character.classes.map(c => `${capitalize(c.klass.name)} ${c.level}${c.subclass ? ` (${c.subclass.name})` : ''}`).join(' / ')

  // Handlers
  const adjustHp = (delta: number) => setSheet(s => ({ ...s, hpCurrent: clamp(0, maxHp, s.hpCurrent + delta) }))
  const setTempHp = (v: number) => setSheet(s => ({ ...s, tempHp: clamp(0, 999, v) }))
  const spendHitDie = (die: string) => setSheet(s => {
    const rec = s.hitDice[die]; if (!rec || rec.remaining <= 0) return s
    return { ...s, hitDice: { ...s.hitDice, [die]: { ...rec, remaining: rec.remaining - 1 } } }
  })
  const longRest = () => setSheet(initFresh(maxHp, hitDiceTotals, spellSlotsComputed, derived?.rageUses))
  const shortRest = () => setSheet(s => {
    // Restore half of total hit dice (rounded down) minus current remaining spent (like standard rule). Simple approach: baseline restoration cannot exceed total.
    const updated: typeof s.hitDice = {}
    Object.entries(s.hitDice).forEach(([die, rec]) => {
      const spent = rec.total - rec.remaining
      const restore = Math.min(Math.floor(rec.total / 2), spent)
      updated[die] = { ...rec, remaining: rec.remaining + restore }
    })
    // Rage uses & spell slots are unchanged (barbarian gets none on short rest; warlock slots should refresh but that's complexity; implement pact refresh if only pact slots present)
    const ss = { ...(s.spellSlots||{}) }
    // Pact slots labeled 'pact' refresh fully
    if (ss['pact']) ss['pact'].current = ss['pact'].max
    return { ...s, hitDice: updated, spellSlots: ss }
  })
  const adjustRage = (delta: number) => setSheet(s => { if (s.rageRemaining === 'unlimited' || typeof s.rageRemaining !== 'number') return s; return { ...s, rageRemaining: clamp(0, 99, s.rageRemaining + delta) } })
  const spendSlot = (lvl: string) => setSheet(s => { const ss = s.spellSlots?.[lvl]; if (!ss || ss.current <= 0) return s; return { ...s, spellSlots: { ...s.spellSlots, [lvl]: { ...ss, current: ss.current - 1 } } } })
  const restoreSlots = () => setSheet(s => { if (!s.spellSlots) return s; const next: any = {}; Object.entries(s.spellSlots).forEach(([k,v]) => next[k] = { ...v, current: v.max }); return { ...s, spellSlots: next } })
  const addCustom = (name: string, max: number) => setSheet(s => ({ ...s, custom: [...s.custom, { id: uuid(), name: name.trim(), max, current: max }] }))
  const updateCustom = (id: string, delta: number) => setSheet(s => ({ ...s, custom: s.custom.map(r => r.id === id ? { ...r, current: clamp(0, r.max, r.current + delta) } : r) }))
  const resetCustom = (id: string) => setSheet(s => ({ ...s, custom: s.custom.map(r => r.id === id ? { ...r, current: r.max } : r) }))
  const removeCustom = (id: string) => setSheet(s => ({ ...s, custom: s.custom.filter(r => r.id !== id) }))

  // Dice Roller
  const [expr, setExpr] = useState('1d20')
  const [log, setLog] = useState<Array<{ id: string; expr: string; total: number; parts: string }>>([])
  const roll = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const parsed = parseDice(expr.trim())
    if (!parsed) return
    const { total, detail } = parsed
    setLog(l => [{ id: uuid(), expr: expr.trim(), total, parts: detail }, ...l.slice(0, 49)])
  }, [expr])

  const quick = (code: string) => { setExpr(code); setTimeout(() => roll(), 0) }

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 1300, margin: '0 auto' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 260px', minWidth: 260 }}>
          <h2 style={{ margin: '0 0 4px' }}>{character.name || 'Unnamed Character'}</h2>
          <div style={{ fontSize: 13, color: 'var(--muted-fg, #64748b)' }}>{classSummary || 'No classes yet'}</div>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <Stat label="AC" value={derived?.ac ?? '—'} />
          <Stat label="HP" value={<span>{sheet.hpCurrent}/{maxHp}</span>} />
          <Stat label="Init" value={(derived?.initiative ?? 0) >= 0 ? `+${derived?.initiative ?? 0}` : derived?.initiative ?? 0} />
          <Stat label="Speed" value={derived?.speed ?? '—'} />
          <Stat label="Prof" value={derived?.totalLevel ? `+${proficiencyBonus(derived.totalLevel)}` : '—'} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={shortRest} style={btn}>Short Rest</button>
          <button onClick={longRest} style={btn}>Long Rest</button>
        </div>
      </header>

      <section style={card()}>
        <h3 style={h3()}>Hit Points</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => adjustHp(-10)} style={btn}>-10</button>
            <button onClick={() => adjustHp(-5)} style={btn}>-5</button>
            <button onClick={() => adjustHp(-1)} style={btn}>-1</button>
            <div style={{ fontWeight: 600 }}>{sheet.hpCurrent} / {maxHp}</div>
            <button onClick={() => adjustHp(+1)} style={btn}>+1</button>
            <button onClick={() => adjustHp(+5)} style={btn}>+5</button>
            <button onClick={() => adjustHp(+10)} style={btn}>+10</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <label style={{ fontSize: 12 }}>Temp HP:</label>
            <input style={input()} type="number" value={sheet.tempHp} onChange={e => setTempHp(Number(e.target.value)||0)} />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {Object.entries(sheet.hitDice).map(([die, rec]) => (
              <div key={die} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={pill}>{die}:</span>
                <span>{rec.remaining}/{rec.total}</span>
                <button onClick={() => spendHitDie(die)} style={btn} disabled={rec.remaining <= 0}>Spend</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={card()}>
        <h3 style={h3()}>Abilities & Saves</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 12 }}>
          {(['str','dex','con','int','wis','cha'] as AbilityKey[]).map(ab => (
            <div key={ab} style={{ border: '1px solid var(--muted-border)', padding: 8, borderRadius: 8, textAlign: 'center', background: 'var(--card-bg)' }}>
              <div style={{ fontSize: 12, letterSpacing: '.5px', fontWeight: 600 }}>{ab.toUpperCase()}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{abilitiesFinal[ab]}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>{mod(abilitiesFinal[ab]) >= 0 ? '+'+mod(abilitiesFinal[ab]) : mod(abilitiesFinal[ab])}</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>Save {formatBonus(derived?.saves?.[ab] ?? 0)}</div>
            </div>
          ))}
        </div>
      </section>

  <AttackOptionsSection character={character} derived={derived} sheet={sheet} abilitiesFinal={abilitiesFinal} />

      {(sheet.rageRemaining || derived?.rageUses) && (
        <section style={card()}>
          <h3 style={h3()}>Rage</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div>Remaining: <b>{sheet.rageRemaining === 'unlimited' ? '∞' : sheet.rageRemaining}</b> / {derived?.rageUses === 'unlimited' ? '∞' : derived?.rageUses}</div>
            {sheet.rageRemaining !== 'unlimited' && typeof sheet.rageRemaining === 'number' && (
              <>
                <button style={btn} onClick={() => adjustRage(-1)} disabled={sheet.rageRemaining <= 0}>Spend</button>
                <button style={btn} onClick={() => adjustRage(+1)} disabled={sheet.rageRemaining >= (derived?.rageUses||0)}>+1</button>
              </>
            )}
          </div>
        </section>
      )}

      {sheet.spellSlots && Object.keys(sheet.spellSlots).length > 0 && (
        <section style={card()}>
          <h3 style={h3()}>Spell Slots</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(sheet.spellSlots).map(([lvl, rec]) => (
              <div key={lvl} style={{ border: '1px solid var(--muted-border)', borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{lvl === 'pact' ? 'Pact' : lvl}</span>
                <span style={{ fontSize: 12 }}>{rec.current}/{rec.max}</span>
                <button onClick={() => spendSlot(lvl)} style={btn} disabled={rec.current <= 0}>Cast</button>
              </div>
            ))}
            <button onClick={restoreSlots} style={btn}>Restore All</button>
          </div>
        </section>
      )}

      <section style={card()}>
        <h3 style={h3()}>Custom Resources</h3>
        <CustomResources sheet={sheet} addCustom={addCustom} updateCustom={updateCustom} resetCustom={resetCustom} removeCustom={removeCustom} />
      </section>

      <section style={card()}>
        <h3 style={h3()}>Actions / Features</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Subactions</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(derived?.subactions || []).map((s: string) => <span key={s} style={pill}>{s}</span>)}
              {(!derived?.subactions || !derived.subactions.length) && <span style={{ fontSize: 12, opacity: 0.6 }}>None</span>}
            </div>
          <FeaturesList character={character} />
        </div>
      </section>

      <section style={card()}>
        <h3 style={h3()}>Dice Roller</h3>
        <form onSubmit={roll} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <input value={expr} onChange={e => setExpr(e.target.value)} style={input()} />
          <button type="submit" style={primaryBtn}>Roll</button>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['d20','1d20+${mod(abilitiesFinal.dex)||0}','1d20+${mod(abilitiesFinal.str)||0}','d12','d10','d8','d6','d4'].map(k => (
              <button key={k} type="button" style={btn} onClick={() => quick(expandTemplate(k))}>{k.replace('${mod(abilitiesFinal.dex)||0}', 'DEX').replace('${mod(abilitiesFinal.str)||0}', 'STR')}</button>
            ))}
          </div>
        </form>
        <ol style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'grid', gap: 4 }}>
          {log.map(r => (
            <li key={r.id} style={{ fontSize: 12, background: 'var(--card-bg-alt, #f1f5f9)', padding: '6px 8px', borderRadius: 6 }}>
              <b>{r.expr}</b>: {r.total} <span style={{ opacity: 0.7 }}>({r.parts})</span>
            </li>
          ))}
          {log.length === 0 && <li style={{ fontSize: 12, opacity: 0.6 }}>No rolls yet.</li>}
        </ol>
      </section>
    </div>
  )
}

// Helpers & subcomponents
function initEmpty(): SheetState { return { hpCurrent: 0, tempHp: 0, hitDice: {}, custom: [] } }
function initFresh(maxHp: number, hitDiceTotals: Record<string, number>, slots: Record<string, { max: number }> | undefined, rageUses: any): SheetState {
  const hitDice: SheetState['hitDice'] = {}
  Object.entries(hitDiceTotals).forEach(([die, total]) => hitDice[die] = { total, remaining: total })
  const spellSlots: SheetState['spellSlots'] | undefined = slots ? Object.fromEntries(Object.entries(slots).map(([k,v]) => [k, { max: v.max, current: v.max }])) : undefined
  return { hpCurrent: maxHp, tempHp: 0, hitDice, rageRemaining: rageUses ?? undefined, custom: [], spellSlots }
}
function migrateSheet(prev: any, maxHp: number, hitDiceTotals: Record<string, number>, slots: Record<string, { max: number }> | undefined, rageUses: any): SheetState {
  let base = initFresh(maxHp, hitDiceTotals, slots, rageUses)
  // Preserve remaining values where possible
  if (prev && typeof prev === 'object') {
    base.hpCurrent = clamp(0, maxHp, typeof prev.hpCurrent === 'number' ? prev.hpCurrent : base.hpCurrent)
    base.tempHp = clamp(0, 999, typeof prev.tempHp === 'number' ? prev.tempHp : 0)
    Object.entries(base.hitDice).forEach(([die, rec]) => {
      const old = prev.hitDice?.[die]
      if (old) base.hitDice[die].remaining = clamp(0, rec.total, typeof old.remaining === 'number' ? old.remaining : rec.total)
    })
    if (base.spellSlots) {
      Object.entries(base.spellSlots).forEach(([lvl, rec]) => {
        const old = prev.spellSlots?.[lvl]
        if (old) base.spellSlots![lvl].current = clamp(0, rec.max, typeof old.current === 'number' ? old.current : rec.max)
      })
    }
    base.custom = Array.isArray(prev.custom) ? prev.custom.filter((r: any) => r && typeof r.name === 'string' && typeof r.max === 'number').map((r: any) => ({ id: r.id || uuid(), name: r.name, max: r.max, current: clamp(0, r.max, r.current || r.max) })) : []
    if (rageUses) {
      if (rageUses === 'unlimited') base.rageRemaining = 'unlimited'
      else base.rageRemaining = clamp(0, rageUses, typeof prev.rageRemaining === 'number' ? prev.rageRemaining : rageUses)
    }
  }
  return base
}
function reconcileSheet(s: SheetState, hitDiceTotals: Record<string, number>, slots: Record<string, { max: number }> | undefined, rageUses: any): SheetState {
  const next = { ...s }
  // Hit dice: add new, update totals, clamp remaining
  Object.entries(hitDiceTotals).forEach(([die, total]) => {
    const existing = next.hitDice[die]
    if (!existing) next.hitDice[die] = { total, remaining: total }
    else next.hitDice[die] = { total, remaining: Math.min(existing.remaining, total) }
  })
  Object.keys(next.hitDice).forEach(die => { if (!(die in hitDiceTotals)) delete next.hitDice[die] })
  // Spell slots
  if (slots) {
    const ss: any = {}
    Object.entries(slots).forEach(([k,v]) => {
      const old = s.spellSlots?.[k]
      ss[k] = { max: v.max, current: old ? Math.min(old.current, v.max) : v.max }
    })
    next.spellSlots = ss
  } else delete next.spellSlots
  // Rage
  if (rageUses) {
    if (rageUses === 'unlimited') next.rageRemaining = 'unlimited'
    else if (typeof next.rageRemaining === 'number') next.rageRemaining = Math.min(next.rageRemaining, rageUses)
    else next.rageRemaining = rageUses
  } else delete next.rageRemaining
  return next
}

function clamp(min: number, max: number, v: number) { return Math.max(min, Math.min(max, v)) }
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
function formatBonus(v: number) { return v >= 0 ? `+${v}` : `${v}` }
function h3(): React.CSSProperties { return { margin: '0 0 12px', fontSize: 16 } }
function input(): React.CSSProperties { return { padding: '6px 8px', border: '1px solid var(--muted-border)', borderRadius: 6, background: 'var(--card-bg)', minWidth: 80 } }
function card(): React.CSSProperties { return { border: '1px solid var(--muted-border)', borderRadius: 12, background: 'var(--card-bg)', padding: 16 } }

function Stat(p: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ minWidth: 70, textAlign: 'center', padding: '6px 10px', border: '1px solid var(--muted-border)', borderRadius: 10, background: 'var(--card-bg)' }}>
      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{p.value}</div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.5px', color: '#64748b', marginTop: 2 }}>{p.label.toUpperCase()}</div>
    </div>
  )
}

function CustomResources(props: { sheet: SheetState; addCustom: (name: string, max: number) => void; updateCustom: (id: string, delta: number) => void; resetCustom: (id: string) => void; removeCustom: (id: string) => void }) {
  const { sheet, addCustom, updateCustom, resetCustom, removeCustom } = props
  const [name, setName] = useState('')
  const [max, setMax] = useState<number | ''>('')
  const submit = () => {
    if (!name.trim() || max === '' || max <= 0) return
    addCustom(name.trim(), Number(max))
    setName(''); setMax('')
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} style={input()} />
        <input placeholder="Max" type="number" min={1} value={max} onChange={e => setMax(e.target.value === '' ? '' : Number(e.target.value))} style={input()} />
        <button onClick={submit} style={btn}>Add</button>
      </div>
      {sheet.custom.length === 0 ? <div style={{ fontSize: 12, opacity: 0.6 }}>No custom resources.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sheet.custom.map(r => (
            <div key={r.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', border: '1px solid var(--muted-border)', padding: '6px 8px', borderRadius: 8 }}>
              <b style={{ minWidth: 120 }}>{r.name}</b>
              <span style={{ fontSize: 12 }}>{r.current}/{r.max}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[-5,-1,+1,+5].map(d => <button key={d} onClick={() => updateCustom(r.id, d)} style={btn}>{d>0?`+${d}`:d}</button>)}
              </div>
              <button style={btn} onClick={() => resetCustom(r.id)}>Reset</button>
              <button style={{ ...btn, color: '#ef4444' }} onClick={() => removeCustom(r.id)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FeaturesList({ character }: { character: BuilderState }) {
  // Aggregate features from classes up to their levels
  const feats = useMemo(() => {
    const out: Array<{ name: string; source: string; level: number }> = []
    character.classes.forEach(c => {
      for (let lvl = 1; lvl <= c.level; lvl++) {
        const list = c.klass.featuresByLevel?.[lvl] || []
        list.forEach(f => out.push({ name: f.name, source: c.klass.name, level: lvl }))
        if (c.subclass && lvl === c.subclass.unlockLevel) out.push({ name: `${c.subclass.name} Features`, source: c.subclass.name, level: lvl })
      }
    })
    return out
  }, [character])
  if (!feats.length) return <div style={{ fontSize: 12, opacity: 0.6 }}>No class features yet.</div>
  return (
    <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Class Features</div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
        {feats.map((f,i) => <li key={i} style={{ fontSize: 12, background: 'var(--card-bg-alt, #f1f5f9)', padding: '4px 6px', borderRadius: 4 }}><strong>{f.name}</strong> <span style={{ opacity: 0.6 }}>({f.source} L{f.level})</span></li>)}
      </ul>
    </div>
  )
}

// Simple dice parser: supports expressions like 2d6+3d4+5-1
function parseDice(expr: string): { total: number; detail: string } | null {
  if (!/^[0-9dD+\-\s*()xX*/]+$/.test(expr.replace(/\s+/g,''))) return null
  const parts = expr.split(/(?=[+-])/g).map(p => p.trim()).filter(Boolean)
  let total = 0
  const detailParts: string[] = []
  for (const part of parts) {
    const sign = part.startsWith('-') ? -1 : 1
    const core = part.replace(/^[-+]/, '')
    const m = core.match(/^(\d*)d(\d+)$/i)
    if (m) {
      const count = Number(m[1] || 1)
      const sides = Number(m[2])
      const rolls: number[] = []
      for (let i=0;i<count;i++) rolls.push(1 + Math.floor(Math.random()*sides))
      const subtotal = rolls.reduce((a,b)=>a+b,0) * sign
      total += subtotal
      detailParts.push(`${sign<0?'-':''}[${rolls.join(',')}]`)
      continue
    }
    // Flat number
    const num = Number(core)
    if (!isNaN(num)) { total += sign * num; detailParts.push(`${sign<0?'-':''}${Math.abs(num)}`); continue }
    return null
  }
  return { total, detail: detailParts.join(' + ') }
}

// Spell slot calculation (full/half/third casters + pact) mirroring simplified builder logic
function computeSpellSlots(character?: BuilderState): Record<string, { max: number }> | undefined {
  if (!character) return undefined
  // Determine per-level sequence for multiclass effective caster level
  const FULL = new Set(['wizard','sorcerer','cleric','druid','bard'])
  const HALF = new Set(['paladin','ranger'])
  // Third casters omitted for brevity unless subclass tracked separately
  const PACT = 'warlock'
  const SHARED: number[][] = [
    [2], [3], [4,2], [4,3], [4,3,2], [4,3,3], [4,3,3,1], [4,3,3,2], [4,3,3,3,1], [4,3,3,3,2],
    [4,3,3,3,2,1], [4,3,3,3,2,1], [4,3,3,3,2,1,1], [4,3,3,3,2,1,1], [4,3,3,3,2,1,1,1], [4,3,3,3,2,1,1,1],
    [4,3,3,3,2,1,1,1,1], [4,3,3,3,2,1,1,1,1], [4,3,3,3,2,1,1,1,1], [4,3,3,3,2,1,1,1,1]
  ]
  const PACT_SLOTS: Array<{ slots: number; level: number }> = [
    { slots:1, level:1 }, { slots:2, level:1 }, { slots:2, level:2 }, { slots:2, level:2 }, { slots:2, level:3 },
    { slots:2, level:3 }, { slots:2, level:4 }, { slots:2, level:4 }, { slots:2, level:5 }, { slots:2, level:5 },
    { slots:3, level:5 }, { slots:3, level:5 }, { slots:3, level:5 }, { slots:3, level:5 }, { slots:3, level:5 },
    { slots:3, level:5 }, { slots:4, level:5 }, { slots:4, level:5 }, { slots:4, level:5 }, { slots:4, level:5 },
  ]
  let full=0, half=0, pact=0
  character.classes.forEach(c => {
    if (FULL.has(c.klass.id)) full += c.level
    else if (HALF.has(c.klass.id)) half += c.level
    else if (c.klass.id === PACT) pact += c.level
  })
  const effective = full + Math.floor(half/2)
  const out: Record<string, { max: number }> = {}
  if (effective > 0) {
    const shared = SHARED[Math.min(effective, 20)-1]
    shared.forEach((n,i) => { out[`${i+1}st`.replace('1st','1st').replace('2st','2nd').replace('3st','3rd')] = { max: n } })
  }
  if (pact > 0) {
    const pactInfo = PACT_SLOTS[Math.min(pact,20)-1]
    out['pact'] = { max: pactInfo.slots }
  }
  return out
}

function proficiencyBonus(level: number) { return 2 + Math.floor((Math.max(1, level) - 1) / 4) }
function expandTemplate(t: string) { return t.replace('${mod(abilitiesFinal.dex)||0}', String(modTemplateCtx.dex)).replace('${mod(abilitiesFinal.str)||0}', String(modTemplateCtx.str)) }
const modTemplateCtx = { dex: 0, str: 0 } // will be overwritten each render by CharacterSheet (imperative; simplified)

// Override during render via side-effect (safe enough given deterministic order) – not ideal but keeps quick buttons simple
export function __setTemplateMods(dex: number, str: number) { modTemplateCtx.dex = dex; modTemplateCtx.str = str }

// ---------------- Attack Options Section ----------------

type AttackOption = {
  id: string
  label: string
  weaponId: string
  attackBonus: number
  abilityMod: number
  avgNormal: number
  avgCrit: number
  hitChance: number // includes crit chance
  expected: number
  notes?: string
}

function AttackOptionsSection(props: { character: BuilderState; derived: any; sheet: SheetState; abilitiesFinal: Record<AbilityKey, number> }) {
  const { character, derived, sheet, abilitiesFinal } = props
  const [targetAC, setTargetAC] = useState<number>(15)
  const [advMode, setAdvMode] = useState<'normal' | 'adv' | 'dis'>('normal')
  const [includeRage, setIncludeRage] = useState<boolean>(false)

  // Auto-enable rage toggle if character has rage remaining and not already toggled when section mounts
  useEffect(() => {
    if (!includeRage && typeof sheet.rageRemaining !== 'undefined') {
      // leave off by default; user can toggle
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const prof = derived?.totalLevel ? proficiencyBonus(derived.totalLevel) : 0
  const rageBonus = includeRage && derived?.rageDamageBonus && sheet.rageRemaining ? derived.rageDamageBonus : 0

  const options: AttackOption[] = useMemo(() => {
    if (!character?.loadout) return []
    const out: AttackOption[] = []
    character.loadout.filter(i => i.type === 'weapon').forEach(w => {
      const weapon = w as Extract<Equipment, { type: 'weapon' }>
      const tags = (weapon.tags || [])
      // Pick ability mod
      let ability: AbilityKey = 'str'
      if (tags.includes('ranged')) ability = 'dex'
      else if (tags.includes('finesse')) ability = (abilitiesFinal.dex >= abilitiesFinal.str ? 'dex' : 'str')
      const abilityMod = mod(abilitiesFinal[ability])
      const attackBonus = abilityMod + prof // assume proficiency; could refine later
      // Parse damage dice (e.g., "2d6 slashing")
      const diceMatch = weapon.dmg.match(/(\d*)d(\d+)/i)
      let diceCount = 1, diceSides = 6
      if (diceMatch) {
        diceCount = Number(diceMatch[1] || 1)
        diceSides = Number(diceMatch[2])
      }
      const avgDice = diceCount * (diceSides + 1) / 2
      const avgNormal = avgDice + abilityMod + rageBonus
      const avgCrit = avgDice * 2 + abilityMod + rageBonus
      const hitChanceBase = chanceToHit(attackBonus, targetAC)
      const hitChance = applyAdvantageMode(hitChanceBase, advMode)
      const critChance = 0.05 // simplified
      const nonCritHitChance = Math.max(0, hitChance - critChance)
      const expected = nonCritHitChance * avgNormal + critChance * avgCrit
      out.push({
        id: weapon.id,
        label: weapon.name,
        weaponId: weapon.id,
        attackBonus,
        abilityMod,
        avgNormal: round2(avgNormal),
        avgCrit: round2(avgCrit),
        hitChance: hitChance,
        expected: round2(expected),
        notes: ability.toUpperCase() + (rageBonus ? ' +Rage' : '')
      })
    })
    // Sort by expected descending
    out.sort((a,b)=> b.expected - a.expected)
    return out
  }, [character, abilitiesFinal, prof, targetAC, advMode, rageBonus])

  if (!character?.loadout?.some(i => i.type === 'weapon')) return null

  return (
    <section style={card()}>
      <h3 style={h3()}>Attack Options</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontSize: 12 }}>Target AC <input type="number" value={targetAC} onChange={e=> setTargetAC(Number(e.target.value)||0)} style={input()} /></label>
        <label style={{ fontSize: 12 }}>Advantage
          <select value={advMode} onChange={e=> setAdvMode(e.target.value as any)} style={{ ...input(), minWidth: 110 }}>
            <option value="normal">Normal</option>
            <option value="adv">Advantage</option>
            <option value="dis">Disadvantage</option>
          </select>
        </label>
        {typeof sheet.rageRemaining !== 'undefined' && (
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={includeRage} onChange={e=> setIncludeRage(e.target.checked)} /> Include Rage Damage
          </label>
        )}
        <div style={{ fontSize: 11, opacity: 0.7 }}>Estimates ignore special fighting styles & feats (future enhancement).</div>
      </div>
      {options.length === 0 ? <div style={{ fontSize: 12, opacity: 0.6 }}>No weapon attacks.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--card-bg-alt, #f1f5f9)' }}>
                <th style={atkTh}>Weapon</th>
                <th style={atkTh}>Atk Bonus</th>
                <th style={atkTh}>Hit %</th>
                <th style={atkTh}>Avg Dmg</th>
                <th style={atkTh}>Crit Avg</th>
                <th style={atkTh}>Exp DPR</th>
                <th style={atkTh}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {options.map(o => (
                <tr key={o.id} style={{ borderTop: '1px solid var(--muted-border)' }}>
                  <td style={atkTd}>{o.label}</td>
                  <td style={atkTd}>{formatBonus(o.attackBonus)}</td>
                  <td style={atkTd}>{Math.round(o.hitChance*100)}%</td>
                  <td style={atkTd}>{o.avgNormal}</td>
                  <td style={atkTd}>{o.avgCrit}</td>
                  <td style={atkTd}>{o.expected}</td>
                  <td style={atkTd}>{o.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function chanceToHit(attackBonus: number, targetAC: number) {
  const needed = targetAC - attackBonus
  // Need to roll needed or higher on d20; min roll 1, max 20.
  const success = 21 - needed // number of successful roll values
  const p = clamp(0, 20, success) / 20
  return clamp(0, 1, p)
}

function applyAdvantageMode(p: number, mode: 'normal' | 'adv' | 'dis') {
  if (mode === 'adv') return 1 - (1 - p) * (1 - p)
  if (mode === 'dis') return p * p
  return p
}

function round2(v: number) { return Math.round(v * 100) / 100 }

const atkTh: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', borderLeft: '1px solid var(--muted-border)', whiteSpace: 'nowrap' }
const atkTd: React.CSSProperties = { padding: '6px 8px', textAlign: 'center', fontSize: 12 }
