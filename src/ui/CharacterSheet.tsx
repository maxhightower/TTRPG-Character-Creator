import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Lock as LockIcon, Unlock as UnlockIcon } from 'lucide-react'
import type { AppState as BuilderState } from './Builder.tsx'
import { EQUIPMENT } from '../data/equipment'
import type { Equipment } from '../data/types'
import { SKILLS } from '../data/skills'
import { computeOtherProficiencies } from './proficiencies'

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
  reducedMax?: number // effective temporary reduced maximum HP (< base maxHp)
  inspiration?: boolean
}

function uuid() { return Math.random().toString(36).slice(2,9) }

const btn: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, border: '1px solid var(--button-border)', background: 'var(--button-bg)', cursor: 'pointer', fontSize: 12 }
const primaryBtn: React.CSSProperties = { ...btn, background: 'var(--button-active-bg)', color: 'var(--button-active-fg)' }
const pill: React.CSSProperties = { padding: '2px 8px', borderRadius: 999, background: 'var(--pill-bg, #f1f5f9)', fontSize: 12 }
// Insertion line styling for drag-and-drop feedback
function insertLineStyle(orientation: 'horizontal' | 'vertical'): React.CSSProperties {
  if (orientation === 'vertical') return { width: 4, alignSelf: 'stretch', background: '#3b82f6', borderRadius: 2, margin: '0 4px' }
  return { height: 4, background: '#3b82f6', borderRadius: 2, margin: '4px 0', width: '100%', boxShadow: '0 0 0 1px #3b82f6' }
}

export function CharacterSheet(props: { character?: BuilderState; derived?: any; onCharacterChange?: (c: BuilderState) => void }) {
  const { character, derived, onCharacterChange } = props
  const name = character?.name || 'unnamed'
  // Layout column count (1-3). User adjustable.
  const [colCount, setColCount] = useState<2 | 3>(2)
  // Branch options sourced from Progression Planner root nodes
  type RootBranch = { id: string; label: string }
  const [rootBranches, setRootBranches] = useState<RootBranch[]>([])
  const [selectedRootId, setSelectedRootId] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [lockedSnapshot, setLockedSnapshot] = useState<{ character: BuilderState; derived: any } | null>(null)
  const [showReducedInput, setShowReducedInput] = useState(false)
  const [reorderMode, setReorderMode] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const draggingIdRef = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragOverArea, setDragOverArea] = useState<AreaId | null>(null)
  const [dragOverPos, setDragOverPos] = useState<'before' | 'after'>('after')
  // Adjustable area widths
  const areaWidthsKey = `characterSheet.areaWidths.v1:${name}`
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    try { const raw = localStorage.getItem(areaWidthsKey); if (raw) { const parsed = JSON.parse(raw); if (parsed && typeof parsed.left === 'number') return parsed.left } } catch {}
    return 260
  })
  const [rightWidth, setRightWidth] = useState<number>(() => {
    try { const raw = localStorage.getItem(areaWidthsKey); if (raw) { const parsed = JSON.parse(raw); if (parsed && typeof parsed.right === 'number') return parsed.right } } catch {}
    return 260
  })
  const [sheetMaxWidth, setSheetMaxWidth] = useState<number>(() => {
    try { const raw = localStorage.getItem(areaWidthsKey); if (raw) { const parsed = JSON.parse(raw); if (parsed && typeof parsed.max === 'number') return parsed.max } } catch {}
    return 1600
  })
  useEffect(() => {
    try { localStorage.setItem(areaWidthsKey, JSON.stringify({ left: leftWidth, right: rightWidth, max: sheetMaxWidth })) } catch {}
  }, [leftWidth, rightWidth, sheetMaxWidth, areaWidthsKey])
  // Highlights (header stat pills) customization
  const highlightAll = useMemo(() => ['ac','hp','init','speed','prof','passivePerception','inspiration'] as const, [])
  type HighlightId = typeof highlightAll[number]
  const highlightOrderKey = `characterSheet.highlights.v1:${name}`
  const [highlightEdit, setHighlightEdit] = useState(false)
  const highlightDraggingIdRef = useRef<string | null>(null)
  const [highlightDragOverId, setHighlightDragOverId] = useState<string | null>(null)
  const [highlightDragOverPos, setHighlightDragOverPos] = useState<'before' | 'after'>('after')
  const defaultHighlightOrder: HighlightId[] = ['ac','hp','init','speed','prof']
  const [highlightOrder, setHighlightOrder] = useState<HighlightId[]>(() => {
    try {
      const raw = localStorage.getItem(highlightOrderKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed.filter((x: any): x is HighlightId => highlightAll.includes(x))
      }
    } catch {}
    return defaultHighlightOrder
  })
  useEffect(() => {
    // append any new highlights
    setHighlightOrder(prev => {
      const next = [...prev]
      highlightAll.forEach(h => { if (!next.includes(h)) next.push(h) })
      return next.filter(h => highlightAll.includes(h))
    })
  }, [highlightAll])
  useEffect(() => { try { localStorage.setItem(highlightOrderKey, JSON.stringify(highlightOrder)) } catch {} }, [highlightOrder, highlightOrderKey])
  const layoutOrderKey = `characterSheet.layout.v1:${name}`
  const allSections = useMemo(() => [
    'hp','hpChart','skills','otherProficiencies','abilities','attacks','rage','slots','custom','actions','dice','loadout','acFormulas'
  ], [])
  const sectionsMeta: Record<string, { label: string; desc?: string }> = {
    hp: { label: 'Hit Points' },
    hpChart: { label: 'HP Visualization' },
  skills: { label: 'Skills' },
  otherProficiencies: { label: 'Other Proficiencies' },
    abilities: { label: 'Abilities & Saves' },
    attacks: { label: 'Attacks' },
    rage: { label: 'Rage' },
    slots: { label: 'Spell Slots' },
    custom: { label: 'Custom Resources' },
    actions: { label: 'Actions / Features' },
    dice: { label: 'Dice Roller' },
    loadout: { label: 'Loadout Manager' },
    acFormulas: { label: 'Armor Class Formulas' }
  }
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(layoutOrderKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed.filter((x: any) => typeof x === 'string')
      }
    } catch {}
    return allSections
  })
  // Persist layout order
  useEffect(() => { try { localStorage.setItem(layoutOrderKey, JSON.stringify(sectionOrder)) } catch {} }, [sectionOrder, layoutOrderKey])
  // Areas for sections (left / main / right sidebars)
  type AreaId = 'left' | 'main' | 'right' | string // allow dynamic extra areas (prefixed with 'extra-')
  const extraAreasKey = `characterSheet.extraAreas.v1:${name}`
  const [extraAreas, setExtraAreas] = useState<string[]>(() => {
    try { const raw = localStorage.getItem(extraAreasKey); if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed.filter(a => typeof a === 'string') } } catch {}
    return []
  })
  useEffect(() => { try { localStorage.setItem(extraAreasKey, JSON.stringify(extraAreas)) } catch {} }, [extraAreas, extraAreasKey])
  const sectionAreasKey = `characterSheet.sectionAreas.v1:${name}`
  const [sectionAreas, setSectionAreas] = useState<Record<string, AreaId>>(() => {
    try { const raw = localStorage.getItem(sectionAreasKey); if (raw) { const parsed = JSON.parse(raw); if (parsed && typeof parsed === 'object') return parsed } } catch {}
    return {}
  })
  useEffect(() => { try { localStorage.setItem(sectionAreasKey, JSON.stringify(sectionAreas)) } catch {} }, [sectionAreas, sectionAreasKey])
  // Ensure any new sections that shipped later get appended (unless intentionally removed before they existed)
  useEffect(() => {
    setSectionOrder(prev => {
      const next = [...prev]
      allSections.forEach(id => { if (!next.includes(id)) next.push(id) })
      // keep only known sections (user may have stale ids)
      return next.filter(id => allSections.includes(id))
    })
  }, [allSections])

  // Load roots from planner localStorage payload
  useEffect(() => {
    if (!character) return
    try {
      const key = `progressionPlanner.v1:${character.name || 'default'}`
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        const roots: RootBranch[] = (parsed.nodes || [])
          .filter((n: any) => n.type === 'root')
          .map((n: any) => ({ id: n.id, label: n.label || n.name || 'Root' }))
        setRootBranches(roots)
        if (!selectedRootId && roots.length) setSelectedRootId(roots[0].id)
      }
    } catch {}
  }, [character?.name])

  // Lock toggle
  const toggleLock = () => {
    setLocked(l => {
      const nl = !l
      if (nl) {
        if (character && derived) setLockedSnapshot({ character: structuredClone(character), derived: structuredClone(derived) })
        else setLockedSnapshot(null)
      } else setLockedSnapshot(null)
      return nl
    })
  }

  const activeCharacter = locked && lockedSnapshot ? lockedSnapshot.character : character
  const activeDerived = locked && lockedSnapshot ? lockedSnapshot.derived : derived

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

  if (!activeCharacter) return <div style={{ padding: 16, border: '1px dashed var(--muted-border)', borderRadius: 8 }}>Build a character first in the Builder tab.</div>

  const abilitiesFinal = useMemo(() => {
    if (!activeCharacter) return { str:0,dex:0,con:0,int:0,wis:0,cha:0 } as Record<AbilityKey, number>
    const base: Record<AbilityKey, number> = { ...activeCharacter.abilities }
    const race: any = activeCharacter.race || {}
    if (race?.asi?.fixed) {
      Object.entries(race.asi.fixed).forEach(([k,v]) => {
        if (isAbility(k)) base[k] = (base[k]||0) + (v as number)
      })
    }
    if (activeCharacter.asi) {
      Object.entries(activeCharacter.asi).forEach(([k,v]) => { if (isAbility(k)) base[k] = (base[k]||0) + (v as number) })
    }
    return base
  }, [activeCharacter])

  // Keep quick dice template modifiers in sync after abilitiesFinal computed
  useEffect(() => { if (abilitiesFinal) __setTemplateMods(mod(abilitiesFinal.dex), mod(abilitiesFinal.str)) }, [abilitiesFinal])

  const classSummary = activeCharacter.classes.map(c => `${capitalize(c.klass.name)} ${c.level}${c.subclass ? ` (${c.subclass.name})` : ''}`).join(' / ')

  // Handlers
  const adjustHp = (delta: number) => setSheet(s => {
    const effMax = s.reducedMax && s.reducedMax < maxHp ? s.reducedMax : maxHp
    return { ...s, hpCurrent: clamp(0, effMax, s.hpCurrent + delta) }
  })
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
  <div style={{ display: 'grid', gap: 20, maxWidth: sheetMaxWidth, margin: '0 auto' }}>
      <header style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16, minWidth: 0 }}>
          <div style={{ flex: '1 1 260px', minWidth: 260 }}>
          <h2 style={{ margin: '0 0 4px' }}>{activeCharacter.name || 'Unnamed Character'}</h2>
          <div style={{ fontSize: 13, color: 'var(--muted-fg, #64748b)', marginBottom: 4 }}>{classSummary || 'No classes yet'}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={selectedRootId || ''}
              onChange={e => setSelectedRootId(e.target.value || null)}
              style={{ padding: '6px 8px', border: '1px solid var(--muted-border)', borderRadius: 6, background: 'var(--card-bg)', fontSize: 12, minWidth: 160 }}
            >
              {rootBranches.length === 0 && <option value="">(no roots yet)</option>}
              {rootBranches.map((b: any) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
            <button
              onClick={toggleLock}
              style={locked ? primaryBtn : btn}
              title={locked ? 'Unlock (resume live updates & new snapshots)' : 'Lock (freeze at selected snapshot)'}
              aria-label={locked ? 'Unlock character sheet (resume live updates & new snapshots)' : 'Lock character sheet (freeze at selected snapshot)'}
            >
              {locked ? <LockIcon size={16} strokeWidth={2} aria-hidden /> : <UnlockIcon size={16} strokeWidth={2} aria-hidden />}
            </button>
            {/* No 'Latest' button needed now; branch list comes from planner roots */}
          </div>
          </div>
          {/* Highlights Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 300px', minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.5px', color: '#64748b' }}>HIGHLIGHTS</span>
            <button onClick={() => setHighlightEdit(e => !e)} style={highlightEdit ? primaryBtn : btn}>{highlightEdit ? 'Done' : 'Edit'}</button>
            {highlightEdit && (
              <div style={{ position: 'relative' }}>
                <AddHighlightsMenu all={highlightAll} current={highlightOrder} add={id => setHighlightOrder(o => [...o, id])} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'stretch', minHeight: 60 }}
            onDragOver={e => { if (highlightEdit) e.preventDefault() }}
            onDrop={e => {
              if (!highlightEdit) return
              e.preventDefault()
              const fromRaw = highlightDraggingIdRef.current
              const from = fromRaw as HighlightId | null
              if (from && !highlightOrder.includes(from)) return
              if (from && !highlightDragOverId) {
                // dropped into empty space: move to end
                setHighlightOrder(o => {
                  const arr = [...o]
                  const idx = arr.indexOf(from)
                  if (idx === -1) return o
                  arr.splice(idx,1)
                  arr.push(from)
                  return arr
                })
              }
              highlightDraggingIdRef.current = null
              setHighlightDragOverId(null)
              setHighlightDragOverPos('after')
            }}
          >
            {highlightOrder.flatMap((id, idx) => {
              const parts: React.ReactNode[] = []
              const showBefore = highlightEdit && highlightDragOverId === id && highlightDragOverPos === 'before'
              if (showBefore) parts.push(<div key={id+'-before'} style={insertLineStyle('horizontal')} />)
              parts.push(
                <HighlightPill
                  key={id}
                  id={id}
                  sheet={sheet}
                  setSheet={setSheet}
                  activeDerived={activeDerived}
                  abilitiesFinal={abilitiesFinal}
                  maxHp={maxHp}
                  edit={highlightEdit}
                  remove={() => setHighlightOrder(o => o.filter(h => h !== id))}
                  draggable={highlightEdit}
                  isDragOver={highlightDragOverId === id}
                  onDragStart={() => { highlightDraggingIdRef.current = id; setHighlightDragOverId(null); setHighlightDragOverPos('after') }}
                  onDragEnter={() => { /* handled by onDragOver to capture position */ }}
                  onDrop={() => {
                    const from = highlightDraggingIdRef.current as HighlightId | null
                    const to = id as HighlightId
                    if (from && to) {
                      setHighlightOrder(o => {
                        const arr = [...o]
                        const fromIdx = arr.indexOf(from)
                        if (fromIdx === -1) return o
                        arr.splice(fromIdx,1)
                        let insertIdx = arr.indexOf(to)
                        if (insertIdx === -1) insertIdx = arr.length
                        if (highlightDragOverPos === 'after') insertIdx += 1
                        arr.splice(insertIdx,0,from)
                        return arr
                      })
                    }
                    highlightDraggingIdRef.current = null
                    setHighlightDragOverId(null)
                    setHighlightDragOverPos('after')
                  }}
                  onDragEnd={() => { highlightDraggingIdRef.current = null; setHighlightDragOverId(null); setHighlightDragOverPos('after') }}
                  onDragOverCapture={e => {
                    if (!highlightEdit) return
                    if (highlightDraggingIdRef.current && highlightDraggingIdRef.current !== id) {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      const x = e.clientX - rect.left
                      const pos = x < rect.width / 2 ? 'before' : 'after'
                      setHighlightDragOverId(id)
                      setHighlightDragOverPos(pos)
                    }
                  }}
                />
              )
              const showAfter = highlightEdit && highlightDragOverId === id && highlightDragOverPos === 'after'
              if (showAfter) parts.push(<div key={id+'-after'} style={insertLineStyle('horizontal')} />)
              return parts
            })}
          </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifySelf: 'end', alignSelf: 'start' }}>
          <button onClick={shortRest} style={btn}>Short Rest</button>
          <button onClick={longRest} style={btn}>Long Rest</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.5px', color: '#64748b' }}>Layout</span>
      {[2,3].map(n => (
              <button
                key={n}
        onClick={() => setColCount(n as 2|3)}
                style={n === colCount ? primaryBtn : btn}
              >{n} col{n>1?'s':''}</button>
            ))}
            <button onClick={() => setReorderMode(m => !m)} style={reorderMode ? primaryBtn : btn}>{reorderMode ? 'Done' : 'Edit Layout'}</button>
            {reorderMode && (
              <button style={btn} onClick={() => {
                const id = 'extra-' + Date.now().toString(36)
                setExtraAreas(a => [...a, id])
              }}>Add Area</button>
            )}
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowAddMenu(m => !m); setReorderMode(false) }} style={showAddMenu ? primaryBtn : btn}>Add Component</button>
              {showAddMenu && (
                <div style={{ position: 'absolute', top: '110%', right: 0, background: 'var(--card-bg, #fff)', border: '1px solid var(--muted-border)', borderRadius: 8, padding: 8, minWidth: 220, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 50 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <strong style={{ fontSize: 12 }}>Add Section</strong>
                    <button style={{ ...btn, padding: '2px 6px' }} onClick={() => setShowAddMenu(false)}>×</button>
                  </div>
                  <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {allSections.filter(id => !sectionOrder.includes(id)).map(id => (
                      <button key={id} style={{ ...btn, textAlign: 'left', justifyContent: 'flex-start', padding: '6px 8px', fontSize: 12 }} onClick={() => {
                        setSectionOrder(o => [...o, id])
                      }}>{sectionsMeta[id]?.label || id}</button>
                    ))}
                    {allSections.filter(id => !sectionOrder.includes(id)).length === 0 && <div style={{ fontSize: 11, opacity: 0.6 }}>All sections added.</div>}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                if (!window.confirm('Reset layout to default?')) return
                setSectionOrder(allSections)
                setHighlightOrder(defaultHighlightOrder)
                setSectionAreas({})
                setColCount(2)
                setLeftWidth(260); setRightWidth(260); setSheetMaxWidth(1600)
                setExtraAreas([])
                setReorderMode(false)
                setHighlightEdit(false)
                try { localStorage.removeItem(layoutOrderKey); localStorage.removeItem(highlightOrderKey); localStorage.removeItem(sectionAreasKey) } catch {}
                try { localStorage.removeItem(areaWidthsKey) } catch {}
                try { localStorage.removeItem(extraAreasKey) } catch {}
              }}
              style={btn}
            >Reset Layout</button>
            {/* Removed numeric width inputs in favor of drag handles */}
          </div>
        </div>
      </header>
      {/* Area-based Sections Layout */}
      <MultiAreas
        reorderMode={reorderMode}
        leftWidth={leftWidth}
        rightWidth={rightWidth}
        setLeftWidth={(w: number) => setLeftWidth(clamp(180,500,w))}
        setRightWidth={(w: number) => setRightWidth(clamp(180,500,w))}
        extraAreas={extraAreas}
      >
        {(['left','main', ...extraAreas, 'right'] as AreaId[]).map(area => {
          const areaSections = sectionOrder.filter(id => (sectionAreas[id] || 'main') === area)
          const areaLabel = area === 'left' ? 'Left Sidebar' : area === 'right' ? 'Right Sidebar' : (area === 'main' ? 'Main Area' : 'Area')
          return (
            <div
              key={area}
              style={{ minWidth: 0, border: reorderMode ? '2px dashed #94a3b8' : undefined, borderRadius: 12, padding: reorderMode ? 8 : 0, background: dragOverArea === area ? 'rgba(148,163,184,0.15)' : undefined, transition: 'background 120ms' }}
              onDragEnter={e => {
                if (!reorderMode) return
                setDragOverArea(area)
              }}
              onDragOver={e => { if (reorderMode) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }}
              onDrop={e => {
                if (!reorderMode) return
                e.preventDefault()
                const from = draggingIdRef.current || e.dataTransfer.getData('text/plain')
                if (from) {
                  const currentArea = (sectionAreas[from] || 'main') as AreaId
                  if (currentArea !== area) setSectionAreas(a => ({ ...a, [from]: area }))
                }
                draggingIdRef.current = null
                setDragOverId(null)
                setDragOverArea(null)
              }}
              onDragLeave={e => {
                if (!reorderMode) return
                if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                  setDragOverArea(prev => prev === area ? null : prev)
                }
              }}
            >
              {reorderMode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: '.5px', color: '#64748b', margin: '0 0 8px 4px' }}>
                  <span>{areaLabel}</span>
                  {area.startsWith('extra-') && (
                    <button style={{ ...btn, padding: '2px 6px', fontSize: 10 }} onClick={() => {
                      // remove area: move its sections to main
                      setSectionAreas(sa => {
                        const next = { ...sa }
                        Object.entries(next).forEach(([sec, a]) => { if (a === area) next[sec] = 'main' })
                        return next
                      })
                      setExtraAreas(a => a.filter(x => x !== area))
                    }}>Remove</button>
                  )}
                </div>
              )}
              <div style={ area === 'main' ? { columnCount: colCount, columnGap: 20 } : { display: 'flex', flexDirection: 'column', gap: 20 } }>
                {areaSections.map(id => {
                  const wrap = (children: React.ReactNode) => {
                    const isDragOver = dragOverId === id && reorderMode
                    return (
                      <div
                        key={id}
                        style={{ ...card(), position: 'relative', outline: isDragOver ? '2px dashed #3b82f6' : undefined, cursor: reorderMode ? 'move' : undefined, opacity: draggingIdRef.current === id ? 0.5 : 1 }}
                        data-section-id={id}
                        draggable={reorderMode}
                        onDragStart={e => {
                          if (!reorderMode) return
                          draggingIdRef.current = id
                          e.dataTransfer.effectAllowed = 'move'
                          try { e.dataTransfer.setData('text/plain', id) } catch {}
                          setDragOverArea(null)
                        }}
                        onDragEnter={e => {
                          if (!reorderMode) return
                          if (id !== draggingIdRef.current) setDragOverId(id)
                          setDragOverArea(null)
                        }}
                        onDragOver={e => { if (reorderMode) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }}
                        onDrop={e => {
                          if (!reorderMode) return
                          e.preventDefault()
                          const from = draggingIdRef.current
                          const to = id
                          if (from && to && from !== to) {
                            setSectionOrder(o => {
                              const arr = [...o]
                              const fromIdx = arr.indexOf(from)
                              const toIdx = arr.indexOf(to)
                              if (fromIdx === -1 || toIdx === -1) return o
                              arr.splice(fromIdx,1)
                              const insertIdx = fromIdx < toIdx ? toIdx : toIdx
                              arr.splice(insertIdx,0,from)
                              return arr
                            })
                            const targetArea = area
                            const currentArea = (sectionAreas[from] || 'main') as AreaId
                            if (currentArea !== targetArea) setSectionAreas(a => ({ ...a, [from]: targetArea }))
                          }
                          draggingIdRef.current = null
                          setDragOverId(null)
                          setDragOverArea(null)
                        }}
                        onDragEnd={() => { draggingIdRef.current = null; setDragOverId(null); setDragOverArea(null) }}
                      >
                        {reorderMode && (
                          <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ fontSize: 14, lineHeight: 1, cursor: 'move', userSelect: 'none', padding: '2px 4px', color: '#64748b' }} title="Drag to move">⋮⋮</div>
                            <span style={{ fontSize: 10, background: 'var(--card-bg-alt, #f1f5f9)', padding: '2px 6px', borderRadius: 6, letterSpacing: '.5px', color: '#475569' }}>{(sectionAreas[id]||'main').toUpperCase()}</span>
                            <button title="Remove" style={{ ...btn, padding: '2px 6px', color: '#b91c1c' }} onClick={() => setSectionOrder(o => o.filter(s => s !== id))}>✕</button>
                          </div>
                        )}
                        {children}
                      </div>
                    )
                  }
                  switch(id) {
                    case 'hp':
                      return wrap(<>
                        <h3 style={h3()}>Hit Points</h3>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button onClick={() => adjustHp(-10)} style={btn}>-10</button>
                            <button onClick={() => adjustHp(-5)} style={btn}>-5</button>
                            <button onClick={() => adjustHp(-1)} style={btn}>-1</button>
                            <div style={{ fontWeight: 600 }}>{sheet.hpCurrent} / {(sheet.reducedMax && sheet.reducedMax < maxHp) ? `${sheet.reducedMax} (base ${maxHp})` : maxHp}</div>
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
                        <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button type="button" style={{ ...btn, padding: '4px 8px', fontSize: 11 }} onClick={() => setShowReducedInput(s => !s)}>
                            {showReducedInput ? 'Hide Max Reduction' : 'Max Reduction'}
                          </button>
                          {(sheet.reducedMax && sheet.reducedMax < maxHp) && (
                            <span style={{ fontSize: 11, background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: 6 }}>Effective Max {sheet.reducedMax}</span>
                          )}
                          {showReducedInput && (
                            <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>Set:</span>
                              <input type="number" min={0} max={maxHp} value={sheet.reducedMax ?? maxHp} style={{ ...input(), width: 70, padding: '4px 6px' }} onChange={e => {
                                const val = Number(e.target.value)
                                setSheet(s => {
                                  if (isNaN(val)) return { ...s }
                                  const eff = clamp(0, maxHp, val)
                                  const reduced = eff < maxHp ? eff : undefined
                                  const hpCurrent = s.hpCurrent > (reduced ?? maxHp) ? (reduced ?? maxHp) : s.hpCurrent
                                  return { ...s, reducedMax: reduced, hpCurrent }
                                })
                              }} />
                              <button type="button" style={{ ...btn, padding: '4px 6px' }} onClick={() => setSheet(s => ({ ...s, reducedMax: undefined }))}>Clear</button>
                            </label>
                          )}
                        </div>
                      </>)
                    case 'hpChart':
                      return wrap(<HPChartSection current={sheet.hpCurrent} temp={sheet.tempHp} max={maxHp} reducedMax={sheet.reducedMax} />)
                    case 'skills':
                      return wrap(<SkillsSection character={activeCharacter} derived={activeDerived} abilitiesFinal={abilitiesFinal} />)
                    case 'otherProficiencies':
                      return wrap(<OtherProficienciesSection character={activeCharacter} />)
                    case 'abilities':
                      return wrap(<><h3 style={h3()}>Abilities & Saves</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 12 }}>{(['str','dex','con','int','wis','cha'] as AbilityKey[]).map(ab => (
                        <div key={ab} style={{ border: '1px solid var(--muted-border)', padding: 8, borderRadius: 8, textAlign: 'center', background: 'var(--card-bg)' }}>
                          <div style={{ fontSize: 12, letterSpacing: '.5px', fontWeight: 600 }}>{ab.toUpperCase()}</div>
                          <div style={{ fontSize: 20, fontWeight: 700 }}>{abilitiesFinal[ab]}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>{mod(abilitiesFinal[ab]) >= 0 ? '+'+mod(abilitiesFinal[ab]) : mod(abilitiesFinal[ab])}</div>
                          <div style={{ fontSize: 11, marginTop: 2 }}>Save {formatBonus(activeDerived?.saves?.[ab] ?? 0)}</div>
                        </div>))}</div></>)
                    case 'attacks':
                      return wrap(<AttackOptionsSection character={activeCharacter} derived={activeDerived} sheet={sheet} abilitiesFinal={abilitiesFinal} />)
                    case 'rage':
                      if (!(sheet.rageRemaining || activeDerived?.rageUses)) return null
                      return wrap(<><h3 style={h3()}>Rage</h3><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div>Remaining: <b>{sheet.rageRemaining === 'unlimited' ? '∞' : sheet.rageRemaining}</b> / {activeDerived?.rageUses === 'unlimited' ? '∞' : activeDerived?.rageUses}</div>{sheet.rageRemaining !== 'unlimited' && typeof sheet.rageRemaining === 'number' && (<><button style={btn} onClick={() => adjustRage(-1)} disabled={sheet.rageRemaining <= 0}>Spend</button><button style={btn} onClick={() => adjustRage(+1)} disabled={sheet.rageRemaining >= (activeDerived?.rageUses||0)}>+1</button></>)}</div></>)
                    case 'slots':
                      if (!(sheet.spellSlots && Object.keys(sheet.spellSlots).length > 0)) return null
                      return wrap(<><h3 style={h3()}>Spell Slots</h3><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{Object.entries(sheet.spellSlots).map(([lvl, rec]) => (<div key={lvl} style={{ border: '1px solid var(--muted-border)', borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 12, fontWeight: 600 }}>{lvl === 'pact' ? 'Pact' : lvl}</span><span style={{ fontSize: 12 }}>{rec.current}/{rec.max}</span><button onClick={() => spendSlot(lvl)} style={btn} disabled={rec.current <= 0}>Cast</button></div>))}<button onClick={restoreSlots} style={btn}>Restore All</button></div></>)
                    case 'custom':
                      return wrap(<><h3 style={h3()}>Custom Resources</h3><CustomResources sheet={sheet} addCustom={addCustom} updateCustom={updateCustom} resetCustom={resetCustom} removeCustom={removeCustom} /></>)
                    case 'actions':
                      return wrap(<><h3 style={h3()}>Actions / Features</h3><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Subactions</div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(activeDerived?.subactions || []).map((s: string) => <span key={s} style={pill}>{s}</span>)}{(!activeDerived?.subactions || !activeDerived.subactions.length) && <span style={{ fontSize: 12, opacity: 0.6 }}>None</span>}</div><FeaturesList character={activeCharacter} /></div></>)
                    case 'dice':
                      return wrap(<><h3 style={h3()}>Dice Roller</h3><form onSubmit={roll} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}><input value={expr} onChange={e => setExpr(e.target.value)} style={input()} /><button type="submit" style={primaryBtn}>Roll</button><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{['d20','1d20+${mod(abilitiesFinal.dex)||0}','1d20+${mod(abilitiesFinal.str)||0}','d12','d10','d8','d6','d4'].map(k => (<button key={k} type="button" style={btn} onClick={() => quick(expandTemplate(k))}>{k.replace('${mod(abilitiesFinal.dex)||0}', 'DEX').replace('${mod(abilitiesFinal.str)||0}', 'STR')}</button>))}</div></form><ol style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'grid', gap: 4 }}>{log.map(r => (<li key={r.id} style={{ fontSize: 12, background: 'var(--card-bg-alt, #f1f5f9)', padding: '6px 8px', borderRadius: 6 }}><b>{r.expr}</b>: {r.total} <span style={{ opacity: 0.7 }}>({r.parts})</span></li>))}{log.length === 0 && <li style={{ fontSize: 12, opacity: 0.6 }}>No rolls yet.</li>}</ol></>)
                    case 'loadout':
                      if (!activeCharacter) return null
                      return wrap(<><h3 style={h3()}>Loadout Manager</h3><LoadoutManager character={activeCharacter} onChange={c => onCharacterChange && onCharacterChange(c)} /></>)
                    case 'acFormulas':
                      if (!(Array.isArray(activeDerived?.acFormulas) && activeDerived.acFormulas.some((f: any) => !f.conditionMet || f.label.toLowerCase().includes('unarmored')))) return null
                      return wrap(<><h3 style={h3()}>Armor Class Formulas</h3><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}><thead><tr style={{ background: 'var(--card-bg-alt, #f1f5f9)' }}><th style={atkTh}>Source</th><th style={atkTh}>Formula</th><th style={atkTh}>Result</th><th style={atkTh}>Status</th></tr></thead><tbody>{activeDerived.acFormulas.map((f: any, i: number) => { const active = f.value === activeDerived.ac && f.conditionMet; return (<tr key={i} style={{ borderTop: '1px solid var(--muted-border)', background: active ? 'rgba(34,197,94,0.12)' : undefined, opacity: f.conditionMet === false ? 0.6 : 1 }}><td style={atkTd} title={f.detail}>{f.label}</td><td style={atkTd}>{f.detail}</td><td style={atkTd}>{f.value}</td><td style={atkTd}>{active ? 'Active' : (f.conditionMet === false ? (f.inactiveDetail || 'Unavailable') : 'Inactive')}</td></tr>) })}</tbody></table></div><div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>Inactive rows show formulas requiring different equipment conditions.</div></>)
                    default:
                      return null
                  }
                })}
              </div>
            </div>
          )
        })}
  </MultiAreas>
    </div>
  )
}

// Draggable area wrapper component
function ResizableAreas(props: { reorderMode: boolean; leftWidth: number; rightWidth: number; setLeftWidth: (n: number)=>void; setRightWidth: (n: number)=>void; children: React.ReactNode }) {
  const { reorderMode, leftWidth, rightWidth, setLeftWidth, setRightWidth, children } = props
  const dragState = useRef<{ handle: 'left' | 'right' | null; startX: number; startLeft: number; startRight: number }>({ handle: null, startX: 0, startLeft: leftWidth, startRight: rightWidth })
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current.handle) return
      const dx = e.clientX - dragState.current.startX
      if (dragState.current.handle === 'left') {
        setLeftWidth(dragState.current.startLeft + dx)
      } else {
        setRightWidth(dragState.current.startRight - dx) // drag left handle moves right boundary from right side
      }
    }
    const onUp = () => { dragState.current.handle = null; document.body.style.cursor = '' }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [setLeftWidth, setRightWidth])
  const startDrag = (handle: 'left'|'right', e: React.MouseEvent) => {
    dragState.current = { handle, startX: e.clientX, startLeft: leftWidth, startRight: rightWidth }
    document.body.style.cursor = 'col-resize'
    e.preventDefault()
  }
  return (
    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `${leftWidth}px 8px 1fr 8px ${rightWidth}px`, alignItems: 'start', gap: 0 }}>
      <div style={{ gridColumn: 1 }}>{(children as any)[0]}</div>
      <div
        style={{ gridColumn: 2, cursor: reorderMode ? 'col-resize' : 'default', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}
        onMouseDown={e => reorderMode && startDrag('left', e)}
        aria-hidden={!reorderMode}
        title={reorderMode ? 'Drag to resize left sidebar' : undefined}
      >{reorderMode && <div style={{ width: 2, background: 'repeating-linear-gradient( to bottom, #94a3b8 0 6px, transparent 6px 12px )', borderRadius: 2 }} />}</div>
      <div style={{ gridColumn: 3 }}>{(children as any)[1]}</div>
      <div
        style={{ gridColumn: 4, cursor: reorderMode ? 'col-resize' : 'default', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}
        onMouseDown={e => reorderMode && startDrag('right', e)}
        aria-hidden={!reorderMode}
        title={reorderMode ? 'Drag to resize right sidebar' : undefined}
      >{reorderMode && <div style={{ width: 2, background: 'repeating-linear-gradient( to bottom, #94a3b8 0 6px, transparent 6px 12px )', borderRadius: 2 }} />}</div>
      <div style={{ gridColumn: 5 }}>{(children as any)[2]}</div>
    </div>
  )
}

// Extended version supporting dynamic middle extra areas (between left and right)
function MultiAreas(props: { reorderMode: boolean; leftWidth: number; rightWidth: number; setLeftWidth: (n: number)=>void; setRightWidth: (n: number)=>void; extraAreas: string[]; children: React.ReactNode }) {
  const { reorderMode, leftWidth, rightWidth, setLeftWidth, setRightWidth, extraAreas, children } = props
  const dragState = useRef<{ handle: 'left' | 'right' | null; startX: number; startLeft: number; startRight: number }>({ handle: null, startX: 0, startLeft: leftWidth, startRight: rightWidth })
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current.handle) return
      const dx = e.clientX - dragState.current.startX
      if (dragState.current.handle === 'left') setLeftWidth(dragState.current.startLeft + dx)
      else setRightWidth(dragState.current.startRight - dx)
    }
    const onUp = () => { dragState.current.handle = null; document.body.style.cursor = '' }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [setLeftWidth, setRightWidth])
  const startDrag = (handle: 'left'|'right', e: React.MouseEvent) => { dragState.current = { handle, startX: e.clientX, startLeft: leftWidth, startRight: rightWidth }; document.body.style.cursor = 'col-resize'; e.preventDefault() }
  // Children order: left, main, ...extra, right
  const arr = React.Children.toArray(children)
  const gridCols = `${leftWidth}px 8px 1fr 8px repeat(${extraAreas.length}, minmax(220px, 1fr) 8px) ${rightWidth}px`
  return (
    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: gridCols, alignItems: 'start' }}>
      <div style={{ gridColumn: 1 }}>{arr[0]}</div>
      <div style={{ gridColumn: 2, cursor: reorderMode ? 'col-resize' : 'default', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }} onMouseDown={e => reorderMode && startDrag('left', e)} aria-hidden={!reorderMode} title={reorderMode ? 'Drag to resize left sidebar' : undefined}>{reorderMode && <div style={{ width: 2, background: 'repeating-linear-gradient( to bottom, #94a3b8 0 6px, transparent 6px 12px )', borderRadius: 2 }} />}</div>
      <div style={{ gridColumn: 3 }}>{arr[1]}</div>
      <div style={{ gridColumn: 4 }} />
      {extraAreas.map((id, i) => (
        <React.Fragment key={id}>
          <div style={{ gridColumn: 5 + i*2 }}>{arr[2 + i]}</div>
          <div style={{ gridColumn: 6 + i*2 }} />
        </React.Fragment>
      ))}
      <div style={{ gridColumn: 5 + extraAreas.length*2, position: 'relative' }}>{arr[2 + extraAreas.length]}</div>
      <div style={{ gridColumn: 6 + extraAreas.length*2, cursor: reorderMode ? 'col-resize' : 'default', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }} onMouseDown={e => reorderMode && startDrag('right', e)} aria-hidden={!reorderMode} title={reorderMode ? 'Drag to resize right sidebar' : undefined}>{reorderMode && <div style={{ width: 2, background: 'repeating-linear-gradient( to bottom, #94a3b8 0 6px, transparent 6px 12px )', borderRadius: 2 }} />}</div>
    </div>
  )
}

// Helpers & subcomponents
function initEmpty(): SheetState { return { hpCurrent: 0, tempHp: 0, hitDice: {}, custom: [] } }
function initFresh(maxHp: number, hitDiceTotals: Record<string, number>, slots: Record<string, { max: number }> | undefined, rageUses: any): SheetState {
  const hitDice: SheetState['hitDice'] = {}
  Object.entries(hitDiceTotals).forEach(([die, total]) => hitDice[die] = { total, remaining: total })
  const spellSlots: SheetState['spellSlots'] | undefined = slots ? Object.fromEntries(Object.entries(slots).map(([k,v]) => [k, { max: v.max, current: v.max }])) : undefined
  return { hpCurrent: maxHp, tempHp: 0, hitDice, rageRemaining: rageUses ?? undefined, custom: [], spellSlots, inspiration: false }
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
    if (typeof prev.reducedMax === 'number' && prev.reducedMax > 0 && prev.reducedMax < maxHp) {
      base.reducedMax = clamp(0, maxHp, prev.reducedMax)
      if (base.hpCurrent > base.reducedMax) base.hpCurrent = base.reducedMax
    }
  if (typeof prev.inspiration === 'boolean') base.inspiration = prev.inspiration
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
  if (next.reducedMax && next.hpCurrent > next.reducedMax) next.hpCurrent = next.reducedMax
  return next
}

function clamp(min: number, max: number, v: number) { return Math.max(min, Math.min(max, v)) }
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
function formatBonus(v: number) { return v >= 0 ? `+${v}` : `${v}` }
function h3(): React.CSSProperties { return { margin: '0 0 12px', fontSize: 16 } }
function input(): React.CSSProperties { return { padding: '6px 8px', border: '1px solid var(--muted-border)', borderRadius: 6, background: 'var(--card-bg)', minWidth: 80 } }
function card(): React.CSSProperties { return { border: '1px solid var(--muted-border)', borderRadius: 12, background: 'var(--card-bg)', padding: 16, breakInside: 'avoid', marginBottom: 20 } }

function Stat(p: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ minWidth: 70, textAlign: 'center', padding: '6px 10px', border: '1px solid var(--muted-border)', borderRadius: 10, background: 'var(--card-bg)' }}>
      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{p.value}</div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.5px', color: '#64748b', marginTop: 2 }}>{p.label.toUpperCase()}</div>
    </div>
  )
}

// Highlight add menu (simple inline pill list of remaining options)
function AddHighlightsMenu(props: { all: readonly string[]; current: string[]; add: (id: any) => void }) {
  const remaining = props.all.filter(a => !props.current.includes(a))
  if (!remaining.length) return <div style={{ fontSize: 11, opacity: 0.6 }}>All added</div>
  return (
    <div style={{ position: 'absolute', top: '110%', left: 0, background: 'var(--card-bg)', border: '1px solid var(--muted-border)', borderRadius: 8, padding: 8, display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 260, zIndex: 40 }}>
      {remaining.map(r => <button key={r} style={{ ...btn, fontSize: 11, padding: '4px 6px' }} onClick={() => props.add(r)}>{r}</button>)}
    </div>
  )
}

function HighlightPill(props: { id: string; sheet: SheetState; setSheet: React.Dispatch<React.SetStateAction<SheetState>>; activeDerived: any; abilitiesFinal: Record<AbilityKey, number>; maxHp: number; edit: boolean; remove: () => void; draggable: boolean; isDragOver: boolean; onDragStart: () => void; onDragEnter: () => void; onDrop: () => void; onDragEnd: () => void; onDragOverCapture?: (e: React.DragEvent) => void }) {
  const { id, sheet, setSheet, activeDerived, abilitiesFinal, maxHp, edit, remove, draggable, isDragOver, onDragStart, onDragEnter, onDrop, onDragEnd, onDragOverCapture } = props
  let label = id
  let value: React.ReactNode = '—'
  switch(id) {
    case 'ac': label='AC'; value=activeDerived?.ac ?? '—'; break
    case 'hp': label='HP'; value=<span>{sheet.hpCurrent}/{maxHp}</span>; break
    case 'init': label='Init'; {
      const v = activeDerived?.initiative ?? 0; value = v>=0?`+${v}`:v
    } break
    case 'speed': label='Speed'; value=activeDerived?.speed ?? '—'; break
    case 'prof': label='Prof'; value=activeDerived?.totalLevel?`+${proficiencyBonus(activeDerived.totalLevel)}`:'—'; break
    case 'passivePerception': label='PPerc'; {
      const wis = abilitiesFinal.wis || 0
      const base = 10 + mod(wis)
      // naive: add proficiency if proficiency exists in derived? else check race feats? For now simple.
      const profBonus = activeDerived?.totalLevel ? proficiencyBonus(activeDerived.totalLevel) : 0
      const hasFeatBoost = false // placeholder detection
      const passive = base + profBonus + (hasFeatBoost?5:0)
      value = passive
    } break
    case 'inspiration': label='Insp'; value = <button onClick={() => setSheet(s => ({ ...s, inspiration: !s.inspiration }))} style={{ ...btn, padding: '2px 6px', fontSize: 10, background: sheet.inspiration ? 'gold' : undefined }}>{sheet.inspiration ? 'Yes' : 'No'}</button>; break
    default: value='—'
  }
  return (
    <div
      style={{ position: 'relative', borderRadius: 12, cursor: draggable ? 'move' : undefined }}
      draggable={draggable}
      onDragStart={(e) => { if (!draggable) return; onDragStart(); try { e.dataTransfer.setData('text/plain', id) } catch {} e.dataTransfer.effectAllowed='move' }}
      onDragEnter={() => { if (draggable) onDragEnter() }}
      onDragOver={e => { if (draggable) { e.preventDefault(); e.dataTransfer.dropEffect='move' } }}
      onDrop={e => { if (draggable) { e.preventDefault(); onDrop() } }}
      onDragEnd={() => { if (draggable) onDragEnd() }}
      onDragOverCapture={onDragOverCapture}
    >
      <Stat label={label} value={value} />
      {edit && (
        <div style={{ position: 'absolute', top: -6, right: -6, display: 'flex', gap: 2 }}>
          <div style={{ fontSize: 12, lineHeight: 1, cursor: 'move', userSelect: 'none', padding: '2px 4px', color: '#64748b' }} title="Drag">⋮</div>
          <button style={{ ...btn, padding: '2px 4px', fontSize: 10, color: '#b91c1c' }} onClick={remove}>✕</button>
        </div>
      )}
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
      <form onSubmit={e => { e.preventDefault(); submit() }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} style={input()} />
        <input placeholder="Max" type="number" value={max} onChange={e => setMax(e.target.value === '' ? '' : Number(e.target.value))} style={{ ...input(), width: 80 }} />
        <button type="submit" style={primaryBtn}>Add</button>
      </form>
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
  const feats: { name: string; source: string; level: number }[] = []
  character.classes.forEach(c => {
    const lvl = c.level || 0
    for (let i=1;i<=lvl;i++) feats.push({ name: `${c.klass.name} Feature L${i}`, source: c.klass.name, level: i })
  })
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

function parseDice(expr: string): { total: number; detail: string } | null {
  const cleaned = expr.replace(/\s+/g,'')
  if (!/^[0-9dD+\-]+$/.test(cleaned)) return null
  const tokens = cleaned.match(/[+-]?[^+-]+/g) || []
  let total = 0
  const detail: string[] = []
  for (const tok of tokens) {
    const sign = tok.startsWith('-') ? -1 : 1
    const core = tok.replace(/^[-+]/,'')
    const m = core.match(/^(\d*)d(\d+)$/i)
    if (m) {
      const count = Number(m[1] || 1)
      const sides = Number(m[2])
      const rolls: number[] = []
      for (let i=0;i<count;i++) rolls.push(1 + Math.floor(Math.random()*sides))
      const subtotal = rolls.reduce((a,b)=>a+b,0) * sign
      total += subtotal
      detail.push(`${sign<0?'-':''}[${rolls.join(',')}]`)
      continue
    }
    if (/^\d+$/.test(core)) { const val = Number(core); total += sign * val; detail.push(`${sign<0?'-':''}${Math.abs(val)}`); continue }
    return null
  }
  return { total, detail: detail.join(' + ') }
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
  const [includeSmite, setIncludeSmite] = useState<boolean>(false)
  const [smiteDice, setSmiteDice] = useState<number>(2) // number of d8s to add on hit
  const [includeBardic, setIncludeBardic] = useState<boolean>(false)

  // Auto-enable rage toggle if character has rage remaining and not already toggled when section mounts
  useEffect(() => {
    if (!includeRage && typeof sheet.rageRemaining !== 'undefined') {
      // leave off by default; user can toggle
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const prof = derived?.totalLevel ? proficiencyBonus(derived.totalLevel) : 0
  const rageBonus = includeRage && derived?.rageDamageBonus && sheet.rageRemaining ? derived.rageDamageBonus : 0
  // Class level lookups (simple aggregation)
  const paladinLevel = character.classes?.filter(c => c.klass.id === 'paladin').reduce((s,c)=>s+(c.level||0),0) || 0
  const bardLevel = character.classes?.filter(c => c.klass.id === 'bard').reduce((s,c)=>s+(c.level||0),0) || 0
  // Bardic Inspiration die size by level (approximate core 5e progression)
  let bardDie: number | null = null
  if (bardLevel > 0) {
    if (bardLevel >= 15) bardDie = 12
    else if (bardLevel >= 10) bardDie = 10
    else if (bardLevel >= 5) bardDie = 8
    else bardDie = 6
  }
  const bardicHitBonusAvg = includeBardic && bardDie ? (bardDie + 1) / 2 : 0 // simplified: unconditional average added to attack bonus

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
      const attackBonus = abilityMod + prof + bardicHitBonusAvg // assume proficiency; bardic inspiration avg if toggled
      // Parse damage dice (e.g., "2d6 slashing")
      const diceMatch = weapon.dmg.match(/(\d*)d(\d+)/i)
      let diceCount = 1, diceSides = 6
      if (diceMatch) {
        diceCount = Number(diceMatch[1] || 1)
        diceSides = Number(diceMatch[2])
      }
      const avgDice = diceCount * (diceSides + 1) / 2
      // Smite only applies to melee weapon attacks; model as extra radiant dice on hit (double on crit)
      const melee = !tags.includes('ranged')
      const smiteDiceCount = (includeSmite && paladinLevel > 0 && melee) ? smiteDice : 0
      const smiteNormal = smiteDiceCount * 4.5
      const smiteCrit = smiteDiceCount * 9
      const avgNormal = avgDice + abilityMod + rageBonus + smiteNormal
      const avgCrit = avgDice * 2 + abilityMod + rageBonus + smiteCrit
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
        notes: [
          ability.toUpperCase(),
          rageBonus ? 'Rage' : null,
          smiteDiceCount ? `Smite ${smiteDiceCount}d8` : null,
          bardicHitBonusAvg ? `+BI≈${round2(bardicHitBonusAvg)} hit` : null
        ].filter(Boolean).join(' + ')
      })
    })
    // Sort by expected descending
    out.sort((a,b)=> b.expected - a.expected)
    return out
  }, [character, abilitiesFinal, prof, targetAC, advMode, rageBonus, includeSmite, smiteDice, paladinLevel, bardicHitBonusAvg])

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
        {paladinLevel > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={includeSmite} onChange={e=> setIncludeSmite(e.target.checked)} /> Smite
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: includeSmite ? 1 : 0.5 }}>
              d8s <input type="number" min={0} max={5} value={smiteDice} disabled={!includeSmite} onChange={e=> setSmiteDice(Math.max(0, Math.min(5, Number(e.target.value)||0)))} style={{ ...input(), width: 50, padding: '2px 4px' }} />
            </label>
          </div>
        )}
        {bardLevel > 0 && bardDie && (
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={includeBardic} onChange={e=> setIncludeBardic(e.target.checked)} /> Bardic Insp. (≈+{((bardDie+1)/2).toFixed(1)} hit)
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

// ---------------- HP Chart ----------------
function HPChartSection({ current, temp, max, reducedMax }: { current: number; temp: number; max: number; reducedMax?: number }) {
  const [mode, setMode] = useState<'bar' | 'pie' | 'gauge'>('bar')
  return (
    <section style={card()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h3 style={h3()}>HP Visualization</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['bar','pie','gauge'] as const).map(m => (
            <button key={m} style={mode===m?primaryBtn:btn} onClick={()=> setMode(m)}>{m.charAt(0).toUpperCase()+m.slice(1)}</button>
          ))}
        </div>
      </div>
      <HPChart current={current} temp={temp} max={max} reducedMax={reducedMax} variant={mode} />
    </section>
  )
}

function HPChart({ current, temp, max, reducedMax, variant }: { current: number; temp: number; max: number; reducedMax?: number; variant: 'bar' | 'pie' | 'gauge' }) {
  const safeMax = Math.max(0, max || 0)
  const effMax = (reducedMax && reducedMax > 0 && reducedMax < safeMax) ? reducedMax : safeMax
  const clampedCurrent = clamp(0, effMax, current)
  const overTemp = Math.max(0, temp)
  const width = 320
  const height = 32
  const pctCurrent = safeMax ? clampedCurrent / safeMax : 0
  const pctTemp = safeMax ? Math.min(1, (clampedCurrent + overTemp) / safeMax) : 0
  const pctReduced = effMax / safeMax
  const currentW = Math.round(pctCurrent * width)
  const tempW = Math.round(pctTemp * width)
  const effW = Math.round(pctReduced * width)
  // Color decisions
  let hpColor = '#16a34a' // green
  const ratio = pctCurrent
  if (ratio < 0.25) hpColor = '#dc2626' // red
  else if (ratio < 0.5) hpColor = '#f59e0b' // amber
  const tempColor = '#38bdf8'
  if (variant === 'bar') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <svg width={width} height={height} role="img" aria-label={`HP ${clampedCurrent} of ${effMax}${effMax!==safeMax?` (base ${safeMax})`:''}${overTemp?`, plus ${overTemp} temporary`:''}`} style={{ maxWidth: '100%', height: 'auto' }}>
          <rect x={0} y={0} width={width} height={height} rx={8} ry={8} fill="var(--card-bg-alt, #f1f5f9)" stroke="var(--muted-border)" />
          {tempW > currentW && (
            <rect x={currentW} y={0} width={tempW - currentW} height={height} rx={0} ry={0} fill={tempColor} fillOpacity={0.35} />
          )}
          {currentW > 0 && (
            <rect x={0} y={0} width={currentW} height={height} rx={8} ry={8} fill={hpColor} />
          )}
          {effMax !== safeMax && (
            <>
              <rect x={effW} y={0} width={width - effW} height={height} fill="#000" fillOpacity={0.06} />
              <line x1={effW} y1={0} x2={effW} y2={height} stroke="#dc2626" strokeDasharray="4 3" strokeWidth={2} />
            </>
          )}
          <rect x={0} y={0} width={width} height={height} rx={8} ry={8} fill="none" stroke="var(--muted-border)" />
          <text x={width/2} y={height/2 + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="#0f172a">{clampedCurrent}/{effMax}{overTemp?` (+${overTemp})`:''}</text>
        </svg>
        <Legend hpColor={hpColor} tempColor={tempColor} showTemp={overTemp>0} reduced={effMax!==safeMax} />
      </div>
    )
  }
  if (variant === 'pie') {
    const size = 140
    const radius = 60
    const center = size / 2
    const circ = 2 * Math.PI * radius
    const currentLen = circ * pctCurrent
    const tempExtra = Math.max(0, pctTemp - pctCurrent)
    const tempLen = circ * tempExtra
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`HP ${clampedCurrent} of ${effMax}${effMax!==safeMax?` (base ${safeMax})`:''}${overTemp?`, plus ${overTemp} temporary`:''}`}> 
          <circle cx={center} cy={center} r={radius} fill="var(--card-bg-alt, #f1f5f9)" stroke="var(--muted-border)" strokeWidth={4} />
          {effMax!==safeMax && (
            <circle cx={center} cy={center} r={radius} fill="transparent" stroke="#000" strokeOpacity={0.08} strokeWidth={radius} strokeDasharray={`${circ*(1-pctReduced)} ${circ}`} strokeDashoffset={circ*pctReduced} />
          )}
          {/* Temp overlay arc */}
          {tempLen > 0 && (
            <circle cx={center} cy={center} r={radius} fill="transparent" stroke={tempColor} strokeOpacity={0.35} strokeWidth={12} strokeDasharray={`${tempLen} ${circ - tempLen}`} strokeDashoffset={-(circ * 0.25 + currentLen)} strokeLinecap="butt" />
          )}
          {/* Current HP arc */}
          <circle cx={center} cy={center} r={radius} fill="transparent" stroke={hpColor} strokeWidth={12} strokeDasharray={`${currentLen} ${circ - currentLen}`} strokeDashoffset={-circ * 0.25} strokeLinecap="round" />
          <text x={center} y={center} textAnchor="middle" fontSize={14} fontWeight={700} fill="#0f172a" dominantBaseline="middle">{clampedCurrent}/{effMax}</text>
          {overTemp>0 && <text x={center} y={center+18} textAnchor="middle" fontSize={11} fill="#0369a1">+{overTemp}</text>}
        </svg>
        <Legend hpColor={hpColor} tempColor={tempColor} showTemp={overTemp>0} reduced={effMax!==safeMax} />
      </div>
    )
  }
  // gauge variant (semi-circle)
  const gaugeW = 320
  const gaugeH = 110
  const r = 100
  const cx = gaugeW/2
  const cy = r + 4
  const startAngle = Math.PI
  const endAngle = 0
  const path = describeArc(cx, cy, r, startAngle*180/Math.PI, endAngle*180/Math.PI)
  const currentAngle = startAngle + (endAngle - startAngle) * pctCurrent
  const tempAngle = startAngle + (endAngle - startAngle) * pctTemp
  const currentPath = describeArc(cx, cy, r, startAngle*180/Math.PI, currentAngle*180/Math.PI)
  const tempPath = tempAngle > currentAngle ? describeArc(cx, cy, r, currentAngle*180/Math.PI, tempAngle*180/Math.PI) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
      <svg width={gaugeW} height={gaugeH} viewBox={`0 0 ${gaugeW} ${gaugeH}`} role="img" aria-label={`HP ${clampedCurrent} of ${effMax}${effMax!==safeMax?` (base ${safeMax})`:''}${overTemp?`, plus ${overTemp} temporary`:''}`}> 
        <path d={path} fill="none" stroke="var(--card-bg-alt, #f1f5f9)" strokeWidth={18} strokeLinecap="round" />
        {effMax!==safeMax && (
          <path d={describeArc(cx, cy, r, (startAngle*180/Math.PI)+(pctReduced*180), endAngle*180/Math.PI)} fill="none" stroke="#000" strokeOpacity={0.08} strokeWidth={18} />
        )}
        {tempPath && <path d={tempPath} fill="none" stroke={tempColor} strokeOpacity={0.35} strokeWidth={18} strokeLinecap="butt" />}
        <path d={currentPath} fill="none" stroke={hpColor} strokeWidth={18} strokeLinecap="round" />
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize={18} fontWeight={700} fill="#0f172a">{clampedCurrent}/{effMax}</text>
        {overTemp>0 && <text x={cx} y={cy + 10} textAnchor="middle" fontSize={12} fill="#0369a1">+{overTemp} temp</text>}
      </svg>
      <Legend hpColor={hpColor} tempColor={tempColor} showTemp={overTemp>0} reduced={effMax!==safeMax} />
    </div>
  )
}

function Legend({ hpColor, tempColor, showTemp, reduced }: { hpColor: string; tempColor: string; showTemp: boolean; reduced?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 10, background: hpColor, border: '1px solid var(--muted-border)', borderRadius: 2 }} /> Current</span>
      {showTemp && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 10, background: tempColor, opacity: 0.35, border: '1px solid var(--muted-border)', borderRadius: 2 }} /> Temp</span>}
      {reduced && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 10, background: '#000', opacity: 0.08, border: '1px solid var(--muted-border)', borderRadius: 2 }} /> Lost Max</span>}
    </div>
  )
}

// ---------------- Skills Section ----------------
function SkillsSection({ character, derived, abilitiesFinal }: { character: any; derived: any; abilitiesFinal: Record<string, number> }) {
  const profBonus = derived?.totalLevel ? proficiencyBonus(derived.totalLevel) : 0
  const skillProfs: Set<string> = new Set(character?.skillProficiencies || [])
  const skillExpertise: Set<string> = new Set(character?.skillExpertise || [])
  // Local UI state for configurability
  const [showAbility, setShowAbility] = useState(true)
  const [showProfCols, setShowProfCols] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<'name'|'bonus'>('name')
  const [desc, setDesc] = useState(false)
  const rows = useMemo(() => {
    const base = SKILLS.map(s => {
      const baseMod = mod(abilitiesFinal[s.ability as AbilityKey])
      let bonus = baseMod
      if (skillProfs.has(s.id)) bonus += profBonus
      if (skillExpertise.has(s.id)) bonus += profBonus
      return { id: s.id, name: s.name, ability: s.ability, total: bonus, proficient: skillProfs.has(s.id), expertise: skillExpertise.has(s.id) }
    }).filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    base.sort((a,b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name) * (desc?-1:1)
      if (sortKey === 'bonus') return (a.total - b.total) * (desc? -1:1)
      return 0
    })
    return base
  }, [abilitiesFinal, profBonus, skillProfs, skillExpertise, search, sortKey, desc])
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h3 style={h3()}>Skills</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search" value={search} onChange={e=>setSearch(e.target.value)} style={input()} />
        <button style={btn} onClick={() => { setSortKey('name'); setDesc(d => sortKey==='name' ? !d : false) }}>Sort: Name{sortKey==='name' ? (desc?' ↓':' ↑'):''}</button>
        <button style={btn} onClick={() => { setSortKey('bonus'); setDesc(d => sortKey==='bonus' ? !d : false) }}>Sort: Bonus{sortKey==='bonus' ? (desc?' ↓':' ↑'):''}</button>
        <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={showAbility} onChange={e=>setShowAbility(e.target.checked)} /> Ability</label>
        <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={showProfCols} onChange={e=>setShowProfCols(e.target.checked)} /> Prof/Expert</label>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 320 }}>
          <thead>
            <tr style={{ background: 'var(--card-bg-alt, #f1f5f9)' }}>
              <th style={atkTh}>Skill</th>
              {showAbility && <th style={atkTh}>Ability</th>}
              <th style={atkTh}>Bonus</th>
              {showProfCols && <th style={atkTh}>Prof</th>}
              {showProfCols && <th style={atkTh}>Expert</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--muted-border)' }}>
                <td style={atkTd} title={r.id}>{r.name}</td>
                {showAbility && <td style={atkTd}>{r.ability.toUpperCase()}</td>}
                <td style={atkTd}>{formatBonus(r.total)}</td>
                {showProfCols && <td style={atkTd}>{r.proficient ? '•' : ''}</td>}
                {showProfCols && <td style={atkTd}>{r.expertise ? '★' : ''}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, opacity: 0.6 }}>Expertise assumes duplicate proficiency source; future enhancement will track precise sources.</div>
    </div>
  )
}

// ---------------- Other Proficiencies Section ----------------
function OtherProficienciesSection({ character }: { character: any }) {
  const profs = computeOtherProficiencies({ classes: character.classes, background: character.background })
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h3 style={h3()}>Other Proficiencies</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        <SkillProfGroup label="Weapons" items={profs.weapons} />
        <SkillProfGroup label="Armor" items={[...profs.armorCategories, ...profs.armorSpecific]} />
        <SkillProfGroup label="Tools" items={profs.tools} />
        <SkillProfGroup label="Instruments" items={profs.instruments} />
        <SkillProfGroup label="Vehicles" items={profs.vehicles} />
      </div>
    </div>
  )
}

function SkillProfGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div style={{ display: 'grid', gap: 4, minWidth: 140 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.5px', color: '#64748b', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.length === 0 && <span style={{ fontSize: 11, opacity: 0.5 }}>None</span>}
        {items.map(i => <span key={i} style={{ fontSize: 11, background: 'var(--card-bg-alt, #f1f5f9)', padding: '2px 6px', borderRadius: 6 }}>{i}</span>)}
      </div>
    </div>
  )
}

// Utility to describe SVG arc (used for gauge)
function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle)
  const end = polarToCartesian(x, y, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ')
}
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = (angleDeg - 90) * Math.PI / 180.0
  return { x: cx + (r * Math.cos(angleRad)), y: cy + (r * Math.sin(angleRad)) }
}

// ---------------- Loadout Manager ----------------
function LoadoutManager({ character, onChange }: { character: BuilderState; onChange: (c: BuilderState) => void }) {
  const [filter, setFilter] = useState('')
  const equip = character.loadout
  const handsUsed = equip.reduce((s,i:any)=> s + (typeof i.hands==='number'? i.hands:0),0)
  const armor = equip.find(i=>i.type==='armor')
  const shield = equip.find(i=>i.type==='shield')
  const filtered = useMemo(() => EQUIPMENT.filter(e => e.name.toLowerCase().includes(filter.toLowerCase())), [filter])
  const addItem = (id: string) => {
    const item = EQUIPMENT.find(e => e.id === id)
    if (!item) return
    // Only one armor & one shield constraint
    if (item.type==='armor' && armor) return
    if (item.type==='shield' && shield) return
    const next: BuilderState = { ...character, loadout: [...character.loadout, item] }
    onChange(next)
  }
  const removeItem = (idx: number) => {
    const next: BuilderState = { ...character, loadout: character.loadout.filter((_,i)=> i!==idx) }
    onChange(next)
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 12, color: '#64748b' }}>Hands Used: {handsUsed} / 2</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {equip.map((i,idx) => (
          <div key={idx} style={{ display: 'flex', gap: 4, alignItems: 'center', border: '1px solid var(--muted-border)', padding: '4px 6px', borderRadius: 6, fontSize: 12 }}>
            <span>{i.name}</span>
            <button style={btn} onClick={() => removeItem(idx)} title="Remove">×</button>
          </div>
        ))}
        {equip.length===0 && <div style={{ fontSize: 12, opacity: 0.6 }}>No items equipped.</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={filter} onChange={e=> setFilter(e.target.value)} placeholder="Search" style={input()} />
        <select onChange={e => { if (e.target.value) { addItem(e.target.value); e.target.value='' } }} style={input()} value="">
          <option value="">Add Item…</option>
          {filtered.map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>
      <div style={{ fontSize: 11, opacity: 0.7 }}>Auto‑recomputes AC & derived stats. One armor & shield enforced. Barbarian/Monk formulas adjust when armor/shield removed.</div>
    </div>
  )
}
