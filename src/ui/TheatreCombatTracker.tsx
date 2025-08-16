import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRules } from './RulesContext'

// Theatre of the Mind Combat Tracker
// Focuses on abstract positioning (zones), quick condition tagging, and fast HP adjudication.
// Persisted locally so a DM can prep and resume mid-session.

export type TheatreCombatant = {
  id: string
  name: string
  side: 'party' | 'enemy' | 'ally' | 'neutral'
  maxHp: number
  hp: number
  zone: Zone // legacy coarse positioning; kept for now but superseded by pairwise distances
  init: number | null
  conditions: string[]
  note?: string
  hidden?: boolean
  obscured?: 'none' | 'light' | 'heavy'
  cover?: 'none' | 'half' | 'three-quarters' | 'full'
}

export type Zone = 'engaged' | 'near' | 'far' | 'distant'

const ZONES: Zone[] = ['engaged', 'near', 'far', 'distant']
type DistanceCategory = Zone // reuse same buckets for relational distances

function uid() { return Math.random().toString(36).slice(2, 10) }

export default function TheatreCombatTracker() {
  const [combatants, setCombatants] = useState<TheatreCombatant[]>(() => {
    try { const raw = localStorage.getItem('theatre.combatants.v1'); return raw ? JSON.parse(raw) : [] } catch { return [] }
  })
  // Areas & Targets (environment shapes and inanimate targets) on the visual canvas
  const [obstacles, setObstacles] = useState<Obstacle[]>(() => {
    try { const raw = localStorage.getItem('theatre.obstacles.v1'); return raw ? JSON.parse(raw) : [] } catch { return [] }
  })
  const [selectedObstacleId, setSelectedObstacleId] = useState<string | null>(null)
  const [round, setRound] = useState<number>(() => { try { return Number(localStorage.getItem('theatre.round.v1')||'1') } catch { return 1 } })
  const [activeId, setActiveId] = useState<string | null>(() => { try { return localStorage.getItem('theatre.activeId.v1') } catch { return null } })
  // Directional facing: global toggle from rules menu
  const { directionalFacing: facingEnabled } = useRules()
  const [facing, setFacing] = useState<Record<string, number>>(() => { try { return JSON.parse(localStorage.getItem('theatre.facing.v1')||'{}') } catch { return {} } })
  // Distance lines (explicit numeric distance annotations between two ids)
  const [distanceLines, setDistanceLines] = useState<DistanceLine[]>(() => { try { return JSON.parse(localStorage.getItem('theatre.distanceLines.v1')||'[]') } catch { return [] } })
  const [addingLine, setAddingLine] = useState(false)
  const [pendingLineFirst, setPendingLineFirst] = useState<string | null>(null)

  // Pairwise distances: distances[A][B] = category (symmetric). Only persisted once here.
  const [distances, setDistances] = useState<Record<string, Record<string, DistanceCategory>>>(() => {
    try { const raw = localStorage.getItem('theatre.distances.v1'); return raw ? JSON.parse(raw) : {} } catch { return {} }
  })
  // Angular placement (radians) per combatant id for visual mode
  const [angles, setAngles] = useState<Record<string, number>>(() => {
    try { const raw = localStorage.getItem('theatre.angles.v1'); return raw ? JSON.parse(raw) : {} } catch { return {} }
  })

  useEffect(() => { try { localStorage.setItem('theatre.combatants.v1', JSON.stringify(combatants)) } catch {} }, [combatants])
  useEffect(() => { try { localStorage.setItem('theatre.obstacles.v1', JSON.stringify(obstacles)) } catch {} }, [obstacles])
  useEffect(() => { try { localStorage.setItem('theatre.round.v1', String(round)) } catch {} }, [round])
  useEffect(() => { if (activeId) try { localStorage.setItem('theatre.activeId.v1', activeId) } catch {} }, [activeId])
  useEffect(() => { try { localStorage.setItem('theatre.distances.v1', JSON.stringify(distances)) } catch {} }, [distances])
  useEffect(() => { try { localStorage.setItem('theatre.angles.v1', JSON.stringify(angles)) } catch {} }, [angles])
  // facingEnabled persisted at global rules layer; only persist headings per entity here
  useEffect(() => { try { localStorage.setItem('theatre.facing.v1', JSON.stringify(facing)) } catch {} }, [facing])
  useEffect(() => { try { localStorage.setItem('theatre.distanceLines.v1', JSON.stringify(distanceLines)) } catch {} }, [distanceLines])
  useEffect(() => { // prune lines whose endpoints vanished
    setDistanceLines(ls => ls.filter(l => {
      const ids = new Set<string>([...combatants.map(c=>c.id), ...obstacles.map(o=>o.id)])
      return ids.has(l.a) && ids.has(l.b)
    }))
  }, [combatants, obstacles])

  // Form state
  const [name, setName] = useState('')
  const [side, setSide] = useState<'party' | 'enemy' | 'ally' | 'neutral'>('enemy')
  const [hp, setHp] = useState<number | ''>('')
  const [init, setInit] = useState<number | ''>('')

  const ordered = useMemo(() => {
    const withInit = [...combatants].sort((a, b) => (b.init || -999) - (a.init || -999))
    return withInit
  }, [combatants])

  // Ensure activeId always points at something valid
  useEffect(() => {
    if (!activeId && ordered.length) setActiveId(ordered[0].id)
    else if (activeId && !ordered.some(c => c.id === activeId)) setActiveId(ordered[0]?.id || null)
  }, [ordered, activeId])

  const add = () => {
    if (!name || hp === '' ) return
    const c: TheatreCombatant = {
      id: uid(),
      name: name.trim(),
      side,
      maxHp: Number(hp),
      hp: Number(hp),
      zone: 'near',
      init: init === '' ? null : Number(init),
      conditions: [],
  hidden: false,
  obscured: 'none',
  cover: 'none'
    }
    setCombatants(cs => [...cs, c])
    // Initialize distances from new combatant to others as 'near' (neutral starting point)
    setDistances(d => {
      const next = { ...d }
      next[c.id] = next[c.id] ? { ...next[c.id] } : {}
      for (const other of combatants) {
        if (other.id === c.id) continue
        next[c.id][other.id] = next[c.id][other.id] || 'near'
        next[other.id] = next[other.id] ? { ...next[other.id], [c.id]: next[other.id][c.id] || 'near' } : { [c.id]: 'near' }
      }
      return next
    })
    setName(''); setHp(''); setInit('')
  }

  const remove = (id: string) => setCombatants(cs => cs.filter(c => c.id !== id))

  const adjustHp = (id: string, delta: number) => setCombatants(cs => cs.map(c => c.id === id ? { ...c, hp: Math.max(0, Math.min(c.maxHp, c.hp + delta)) } : c))

  // Legacy zone adjuster (still available via keyboard maybe) – could remove later
  const moveZone = (id: string, dir: (-1) | 1) => {
    setCombatants(cs => cs.map(c => {
      if (c.id !== id) return c
      const idx = ZONES.indexOf(c.zone)
      const n = Math.min(ZONES.length - 1, Math.max(0, idx + dir))
      return { ...c, zone: ZONES[n] }
    }))
  }

  const setDistance = (a: string, b: string, cat: DistanceCategory) => {
    if (a === b) return
    setDistances(d => {
      const next = { ...d }
      next[a] = { ...(next[a] || {}), [b]: cat }
      next[b] = { ...(next[b] || {}), [a]: cat }
      return next
    })
  }

  const toggleCondition = (id: string, tag: string) => setCombatants(cs => cs.map(c => c.id === id ? { ...c, conditions: c.conditions.includes(tag) ? c.conditions.filter(t => t !== tag) : [...c.conditions, tag] } : c))
  const addCustomCondition = (id: string, tag: string) => {
    const clean = tag.trim()
    if (!clean) return
    toggleCondition(id, clean)
  }

  const advanceTurn = () => {
    if (!ordered.length) return
    if (!activeId) { setActiveId(ordered[0].id); return }
    const idx = ordered.findIndex(c => c.id === activeId)
    const nextIdx = (idx + 1) % ordered.length
    if (nextIdx === 0) setRound(r => r + 1)
    setActiveId(ordered[nextIdx].id)
  }

  const resetEncounter = () => {
    setRound(1)
    setActiveId(ordered[0]?.id || null)
    setCombatants(cs => cs.map(c => ({ ...c, hp: c.maxHp, zone: 'near', conditions: [] })))
    // Keep distances – assume same battlefield layout across resets
  }

  const quickConditions = ['blinded','charmed','frightened','grappled','incapacitated','invisible','paralyzed','poisoned','prone','restrained','stunned']
  const coverCycle: TheatreCombatant['cover'][] = ['none','half','three-quarters','full']
  const obscuredCycle: NonNullable<TheatreCombatant['obscured']>[] = ['none','light','heavy']

  const toggleHidden = (id: string) => setCombatants(cs => cs.map(c => c.id === id ? { ...c, hidden: !c.hidden } : c))
  const cycleCover = (id: string) => setCombatants(cs => cs.map(c => c.id === id ? { ...c, cover: coverCycle[(coverCycle.indexOf(c.cover || 'none') + 1) % coverCycle.length] } : c))
  const cycleObscured = (id: string) => setCombatants(cs => cs.map(c => c.id === id ? { ...c, obscured: obscuredCycle[(obscuredCycle.indexOf(c.obscured || 'none') + 1) % obscuredCycle.length] } : c))

  const [showViz, setShowViz] = useState(false)
  const [fullScreen, setFullScreen] = useState(false)
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullScreen(false) }
    if (fullScreen) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullScreen])

  const active = combatants.find(c => c.id === activeId) || null
  const distFromActive = useMemo(() => {
    if (!activeId) return {}
    return distances[activeId] || {}
  }, [distances, activeId])

  const distanceIndex = (d: DistanceCategory | undefined) => {
    switch (d) {
      case 'engaged': return 0
      case 'near': return 1
      case 'far': return 2
      case 'distant': return 3
      default: return 1
    }
  }

  const ringR = [60, 140, 220, 300]
  const radialLayout = useMemo(() => {
    if (!active) return [] as { c: TheatreCombatant; x: number; y: number; d: DistanceCategory | undefined; angle: number }[]
    const others = combatants.filter(c => c.id !== active.id)
    const buckets: Record<string, TheatreCombatant[]> = {}
    for (const o of others) {
      const d = distFromActive[o.id] || 'near'
      ;(buckets[d] = buckets[d] || []).push(o)
    }
    const W = 640, H = 420, cx = W/2, cy = H/2
    const out: { c: TheatreCombatant; x: number; y: number; d: DistanceCategory | undefined; angle: number }[] = []
    ZONES.forEach(z => {
      const arr = buckets[z] || []
      const r = ringR[distanceIndex(z)]
      arr.forEach((c, i) => {
        const stored = angles[c.id]
        const base = (i / Math.max(1, arr.length)) * Math.PI * 2 + (distanceIndex(z) * 0.2)
        const angle = typeof stored === 'number' ? stored : base
        const x = cx + Math.cos(angle) * (r + 1)
        const y = cy + Math.sin(angle) * (r + 1)
        out.push({ c, x, y, d: z as DistanceCategory, angle })
      })
    })
    return out
  }, [combatants, active, distFromActive, angles])

  const cycleDistance = (targetId: string) => {
    if (!activeId || activeId === targetId) return
    const current = distFromActive[targetId] || 'near'
    const order: DistanceCategory[] = ['engaged','near','far','distant']
    const idx = order.indexOf(current)
    const next = order[(idx + 1) % order.length]
    setDistance(activeId, targetId, next)
  }

  // Obstacles helpers
  const addCircleObstacle = () => {
    const id = uid()
    setObstacles(o => [...o, { id, kind: 'circle', x: 0, y: 0, r: 40, label: 'Area', blocking: true, color: '#0ea5e9' }])
    // initialize distances symmetric with combatants & existing obstacles
    setDistances(d => {
      const next = { ...d }
      next[id] = next[id] ? { ...next[id] } : {}
      for (const c of combatants) {
        next[id][c.id] = next[id][c.id] || 'near'
        next[c.id] = { ...(next[c.id]||{}), [id]: next[c.id]?.[id] || 'near' }
      }
      for (const o of obstacles) {
        next[id][o.id] = next[id][o.id] || 'near'
        next[o.id] = { ...(next[o.id]||{}), [id]: next[o.id]?.[id] || 'near' }
      }
      return next
    })
    setAngles(a => ({ ...a, [id]: Math.random()*Math.PI*2 }))
  }
  const addRectObstacle = () => {
    const id = uid()
    setObstacles(o => [...o, { id, kind: 'rect', x: 0, y: 0, w: 110, h: 70, label: 'Target', blocking: true, color: '#14b8a6' }])
    setDistances(d => {
      const next = { ...d }
      next[id] = next[id] ? { ...next[id] } : {}
      for (const c of combatants) {
        next[id][c.id] = next[id][c.id] || 'near'
        next[c.id] = { ...(next[c.id]||{}), [id]: next[c.id]?.[id] || 'near' }
      }
      for (const o of obstacles) {
        next[id][o.id] = next[id][o.id] || 'near'
        next[o.id] = { ...(next[o.id]||{}), [id]: next[o.id]?.[id] || 'near' }
      }
      return next
    })
    setAngles(a => ({ ...a, [id]: Math.random()*Math.PI*2 }))
  }
  const updateObstacle = (id: string, patch: Partial<Obstacle>) => setObstacles(o => o.map(ob => ob.id === id ? { ...ob, ...patch } : ob))
  const removeObstacle = (id: string) => { setObstacles(o => o.filter(ob => ob.id !== id)); setSelectedObstacleId(s => s === id ? null : s) }
  const toggleObstacleBlocking = (id: string) => setObstacles(o => o.map(ob => ob.id === id ? { ...ob, blocking: !ob.blocking } : ob))
  const resizeObstacle = (id: string, delta: number) => setObstacles(o => o.map(ob => {
    if (ob.id !== id) return ob
    if (ob.kind === 'circle') return { ...ob, r: Math.max(5, (ob.r || 0) + delta) }
    return { ...ob, w: Math.max(10, (ob.w || 0) + delta), h: Math.max(10, (ob.h || 0) + delta) }
  }))

  return (
    <div>
  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <label style={label}>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={input} placeholder="Bandit / Cleric" />
        </div>
        <div>
          <label style={label}>Side</label>
          <select value={side} onChange={e => setSide(e.target.value as any)} style={input}>
            <option value="party">Party</option>
            <option value="ally">Ally</option>
            <option value="enemy">Enemy</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>
        <div>
          <label style={label}>Max HP</label>
            <input type="number" min={0} value={hp} onChange={e => setHp(e.target.value === '' ? '' : Number(e.target.value))} style={input} />
        </div>
        <div>
          <label style={label}>Init</label>
          <input type="number" value={init} onChange={e => setInit(e.target.value === '' ? '' : Number(e.target.value))} style={input} />
        </div>
        <button onClick={add} style={primaryBtn}>Add</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <div style={pill}>Round <b>{round}</b></div>
          <button onClick={advanceTurn} style={btn}>Next Turn →</button>
          <button onClick={resetEncounter} style={btn}>Reset</button>
          <button onClick={() => setShowViz(v => !v)} style={{ ...btn, background: showViz ? '#0ea5e9' : 'white', color: showViz ? 'white' : '#0f172a' }}>{showViz ? 'List Mode' : 'Visual Mode'}</button>
          {/* Full Screen trigger moved inside visualizer itself */}
        </div>
      </div>

      {ordered.length === 0 ? (
        <div style={{ padding: 16, border: '1px dashed #cbd5e1', borderRadius: 12, fontSize: 14, color: '#475569' }}>
          Add combatants with optional initiative. Use distance selectors (relative to Active) for theatre-of-the-mind positioning.
        </div>
      ) : (
        showViz ? (
          <Visualizer
            combatants={combatants}
            active={active || undefined}
            layout={radialLayout}
            onSetActive={setActiveId}
            onCycleDistance={cycleDistance}
            distances={distFromActive}
            hpAdjust={adjustHp}
            setDistance={(a,b,cat) => setDistance(a,b,cat)}
            setAngle={(id,ang) => setAngles(a => ({ ...a, [id]: ang }))}
            ringR={ringR}
            fullScreen={false}
            onFullScreen={() => setFullScreen(true)}
            toggleHidden={toggleHidden}
            cycleCover={cycleCover}
            cycleObscured={cycleObscured}
            obstacles={obstacles}
            onObstacleChange={updateObstacle}
            onObstacleSelect={setSelectedObstacleId}
            selectedObstacleId={selectedObstacleId}
            onAddCircleObstacle={addCircleObstacle}
            onAddRectObstacle={addRectObstacle}
            onRemoveObstacle={removeObstacle}
            onToggleObstacleBlocking={toggleObstacleBlocking}
            onResizeObstacle={resizeObstacle}
            anglesMap={angles}
            facingEnabled={facingEnabled}
            facing={facing}
            setFacing={(id,deg) => setFacing(f => ({ ...f, [id]: ((deg%360)+360)%360 }))}
            distanceLines={distanceLines}
            addingLine={addingLine}
            pendingLineFirst={pendingLineFirst}
            onPickLinePoint={(id) => {
              if (!addingLine) return
              if (!pendingLineFirst) { setPendingLineFirst(id); return }
              if (pendingLineFirst === id) { setPendingLineFirst(null); setAddingLine(false); return }
              const valStr = window.prompt('Enter distance value','30')
              if (valStr) {
                const v = Number(valStr)
                if (!isNaN(v)) setDistanceLines(ls => [...ls, { id: uid(), a: pendingLineFirst, b: id, value: v }])
              }
              setPendingLineFirst(null); setAddingLine(false)
            }}
            setAddingLine={setAddingLine}
            setPendingLineFirst={setPendingLineFirst}
            setDistanceLines={setDistanceLines}
          />
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {ordered.map(c => {
              const isActive = c.id === activeId
              const distToActive = isActive ? null : (activeId && distances[activeId]?.[c.id]) || 'near'
              return (
                <div key={c.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, background: isActive ? '#f0f9ff' : '#ffffff', padding: 12, display: 'grid', gap: 12, gridTemplateColumns: 'auto 1fr auto', alignItems: 'center' }}>
                  <div style={{ width: 46, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{c.init ?? '—'}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                      <span style={{ ...tag, background: sideColor(c.side).bg, color: sideColor(c.side).fg }}>{c.side}</span>
                      {isActive ? (
                        <span style={{ ...tag, background: '#0ea5e9', color: 'white' }}>reference</span>
                      ) : (
                        <span style={{ ...tag, background: distToActive ? distanceColor(distToActive).bg : '#e2e8f0', color: distToActive ? distanceColor(distToActive).fg : '#334155' }}>{distToActive}</span>
                      )}
                      <span style={{ ...tag, background: hpColor(c).bg, color: hpColor(c).fg }}>{c.hp}/{c.maxHp}</span>
                    </div>
                    {!isActive && activeId && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
                        <label style={{ fontSize: 11, color: '#475569' }}>Distance to Active:</label>
                        <select value={distToActive || 'near'} onChange={e => setDistance(activeId, c.id, e.target.value as DistanceCategory)} style={select}>
                          {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                        </select>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {c.conditions.map(cond => (
                        <button key={cond} onClick={() => toggleCondition(c.id, cond)} title="Remove" style={{ ...condTag, background: '#334155', color: 'white' }}>{cond} ✕</button>
                      ))}
                      <ConditionAdder onAdd={t => addCustomCondition(c.id, t)} />
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {quickConditions.map(q => (
                        <button key={q} onClick={() => toggleCondition(c.id, q)} style={{ ...miniBtn, background: c.conditions.includes(q) ? '#334155' : '#e2e8f0', color: c.conditions.includes(q) ? 'white' : '#334155' }}>{q}</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => adjustHp(c.id, -1)} style={smallBtn}>-1</button>
                      <button onClick={() => adjustHp(c.id, -5)} style={smallBtn}>-5</button>
                      <button onClick={() => adjustHp(c.id, -10)} style={smallBtn}>-10</button>
                      <button onClick={() => adjustHp(c.id, +1)} style={smallBtn}>+1</button>
                      <button onClick={() => adjustHp(c.id, +5)} style={smallBtn}>+5</button>
                      <button onClick={() => adjustHp(c.id, +10)} style={smallBtn}>+10</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    <button onClick={() => setActiveId(c.id)} style={{ ...btn, padding: '6px 10px', background: isActive ? '#0ea5e9' : '#fff', color: isActive ? 'white' : '#0f172a' }}>{isActive ? 'Active' : 'Make Active'}</button>
                    <button onClick={() => remove(c.id)} style={{ ...btn, padding: '6px 10px', color: '#dc2626', borderColor: '#fecaca' }}>Remove</button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
      {fullScreen && showViz && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: 'white', fontWeight: 600 }}>Theatre Visualizer</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setFullScreen(false)} style={{ ...btn, background: '#0ea5e9', color: 'white' }}>Exit Full Screen (Esc)</button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            {(() => {
              const baseW = 640, baseH = 420
              // Provide generous padding and account for header height; avoid over-zooming which can push content off center.
              const padding = 48
              const headerH = 72 // approx header + top padding
              const maxScale = 1.25 // cap so we don't zoom excessively on huge monitors
              const scale = Math.min((vp.w - padding * 2) / baseW, (vp.h - headerH - padding * 2) / baseH, maxScale)
              const scaledW = baseW * scale
              const scaledH = baseH * scale
              return (
                <div style={{ width: scaledW, height: scaledH, position: 'relative' }}>
                  <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: baseW, height: baseH }}>
                    <Visualizer
                      combatants={combatants}
                      active={active || undefined}
                      layout={radialLayout}
                      onSetActive={setActiveId}
                      onCycleDistance={cycleDistance}
                      distances={distFromActive}
                      hpAdjust={adjustHp}
                      setDistance={(a,b,cat) => setDistance(a,b,cat)}
                      setAngle={(id,ang) => setAngles(a => ({ ...a, [id]: ang }))}
                      ringR={ringR}
                      fullScreen={true}
                      onFullScreen={() => {}}
                      toggleHidden={toggleHidden}
                      cycleCover={cycleCover}
                      cycleObscured={cycleObscured}
                      obstacles={obstacles}
                      onObstacleChange={updateObstacle}
                      onObstacleSelect={setSelectedObstacleId}
                      selectedObstacleId={selectedObstacleId}
                      onAddCircleObstacle={addCircleObstacle}
                      onAddRectObstacle={addRectObstacle}
                      onRemoveObstacle={removeObstacle}
                      onToggleObstacleBlocking={toggleObstacleBlocking}
                      onResizeObstacle={resizeObstacle}
                      anglesMap={angles}
                      facingEnabled={facingEnabled}
                      facing={facing}
                      setFacing={(id,deg) => setFacing(f => ({ ...f, [id]: ((deg%360)+360)%360 }))}
                      distanceLines={distanceLines}
                      addingLine={addingLine}
                      pendingLineFirst={pendingLineFirst}
                      onPickLinePoint={(id) => {
                        if (!addingLine) return
                        if (!pendingLineFirst) { setPendingLineFirst(id); return }
                        if (pendingLineFirst === id) { setPendingLineFirst(null); setAddingLine(false); return }
                        const valStr = window.prompt('Enter distance value','30')
                        if (valStr) {
                          const v = Number(valStr)
                          if (!isNaN(v)) setDistanceLines(ls => [...ls, { id: uid(), a: pendingLineFirst, b: id, value: v }])
                        }
                        setPendingLineFirst(null); setAddingLine(false)
                      }}
                      setAddingLine={setAddingLine}
                      setPendingLineFirst={setPendingLineFirst}
                      setDistanceLines={setDistanceLines}
                    />
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

function Visualizer({ combatants, active, layout, onSetActive, onCycleDistance, distances, hpAdjust, setDistance, setAngle, ringR, fullScreen, onFullScreen, toggleHidden, cycleCover, cycleObscured, obstacles, onObstacleChange, onObstacleSelect, selectedObstacleId, onAddCircleObstacle, onAddRectObstacle, onRemoveObstacle, onToggleObstacleBlocking, onResizeObstacle, anglesMap, facingEnabled, facing, setFacing, distanceLines, addingLine, pendingLineFirst, onPickLinePoint, setAddingLine, setPendingLineFirst, setDistanceLines }: {
  combatants: TheatreCombatant[]
  active?: TheatreCombatant
  layout: { c: TheatreCombatant; x: number; y: number; d: DistanceCategory | undefined; angle: number }[]
  onSetActive: (id: string) => void
  onCycleDistance: (id: string) => void
  distances: Record<string, DistanceCategory>
  hpAdjust: (id: string, delta: number) => void
  setDistance: (a: string, b: string, cat: DistanceCategory) => void
  setAngle: (id: string, ang: number) => void
  ringR: number[]
  fullScreen: boolean
  onFullScreen: () => void
  toggleHidden: (id: string) => void
  cycleCover: (id: string) => void
  cycleObscured: (id: string) => void
  obstacles: Obstacle[]
  onObstacleChange: (id: string, patch: Partial<Obstacle>) => void
  onObstacleSelect: (id: string | null) => void
  selectedObstacleId: string | null
  onAddCircleObstacle: () => void
  onAddRectObstacle: () => void
  onRemoveObstacle: (id: string) => void
  onToggleObstacleBlocking: (id: string) => void
  onResizeObstacle: (id: string, delta: number) => void
  anglesMap: Record<string, number>
  facingEnabled: boolean
  facing: Record<string, number>
  setFacing: (id: string, deg: number) => void
  distanceLines: DistanceLine[]
  addingLine: boolean
  pendingLineFirst: string | null
  onPickLinePoint: (id: string) => void
  setAddingLine: React.Dispatch<React.SetStateAction<boolean>>
  setPendingLineFirst: React.Dispatch<React.SetStateAction<string | null>>
  setDistanceLines: React.Dispatch<React.SetStateAction<DistanceLine[]>>
}) {
  const W = 640
  const H = 420
  const cx = W/2, cy = H/2
  // Track recently dragged token ids to suppress the subsequent click selecting them unintentionally
  const recentlyDraggedRef = useRef<Record<string, number>>({})
  // Field of view config (triangle wedge) when facing enabled
  const FOV_DEG = 120
  const FOV_RAD = FOV_DEG * Math.PI / 180
  const maxRadius = ringR[ringR.length - 1] + 60
  const handleDrag = (id: string) => {
    let dragging = true
    let moved = false
    let startX = 0, startY = 0
    const prevSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    const onMove = (e: MouseEvent) => {
      if (!dragging || !active) return
      e.preventDefault()
      const rect = (e.target as HTMLElement).closest('svg')?.getBoundingClientRect()
      if (!rect) return
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      if (!moved) { // capture initial position first move
        if (startX === 0 && startY === 0) { startX = mx; startY = my }
        const dx0 = mx - startX
        const dy0 = my - startY
        if (Math.abs(dx0) > 3 || Math.abs(dy0) > 3) moved = true
      }
      const dx = mx - cx
      const dy = my - cy
      const ang = Math.atan2(dy, dx)
      // compute radius & derive distance bucket
      const r = Math.sqrt(dx*dx + dy*dy)
      // find closest ring
      const thresholds = ringR
      let idx = 0
      for (let i=0;i<thresholds.length;i++) {
        if (r <= thresholds[i] + 40) { idx = i; break }
        idx = i
  }
      const cat: DistanceCategory = ['engaged','near','far','distant'][idx] as DistanceCategory
      setAngle(id, ang)
      setDistance(active.id, id, cat)
    }
    const onUp = () => {
      dragging = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = prevSelect
      if (moved) {
        recentlyDraggedRef.current[id] = Date.now()
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  const handleObstacleDrag = (obsId: string) => {
    if (!active) return
  const cx = W/2, cy = H/2
  let dragging = true
    const prevSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    const onMove = (e: MouseEvent) => {
      if (!dragging) return
      e.preventDefault()
      const rect = (e.target as HTMLElement).closest('svg')?.getBoundingClientRect()
      if (!rect) return
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const dx = mx - cx
      const dy = my - cy
      const ang = Math.atan2(dy, dx)
      const r = Math.sqrt(dx*dx + dy*dy)
      let idx = 0
      for (let i=0;i<ringR.length;i++) {
        if (r <= ringR[i] + 40) { idx = i; break }
        idx = i
      }
      const cat: DistanceCategory = ['engaged','near','far','distant'][idx] as DistanceCategory
      setAngle(obsId, ang)
      setDistance(active.id, obsId, cat)
    }
  const onUp = () => { dragging = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); document.body.style.userSelect = prevSelect }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', border: '1px solid #e2e8f0', borderRadius: 16, background: '#fff', padding: 12 }}>
        {!fullScreen && (
          <button onClick={onFullScreen} aria-label="Full Screen" title="Full Screen" style={{ position: 'absolute', top: 8, right: 8, padding: '4px 8px', borderRadius: 8, border: '1px solid #cbd5e1', background: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 16, lineHeight: '16px' }}>⛶</button>
        )}
        <svg width={W} height={H} style={{ display: 'block', touchAction: 'none' }}>
          <Rings W={W} H={H} />
          {active && facingEnabled && (() => {
            const baseDeg = facing[active.id] ?? 0
            const baseRad = (baseDeg - 90) * Math.PI / 180
            const leftAng = baseRad - FOV_RAD/2
            const rightAng = baseRad + FOV_RAD/2
            const x1 = cx + Math.cos(leftAng) * maxRadius
            const y1 = cy + Math.sin(leftAng) * maxRadius
            const x2 = cx + Math.cos(rightAng) * maxRadius
            const y2 = cy + Math.sin(rightAng) * maxRadius
            const dPath = `M ${cx} ${cy} L ${x1} ${y1} L ${x2} ${y2} Z`
            return <path d={dPath} fill="rgba(14,165,233,0.10)" stroke="rgba(14,165,233,0.6)" strokeDasharray="6 8" />
          })()}
          {active && obstacles.map((o, i) => {
            const dCat = (distances as Record<string, DistanceCategory>)[o.id] || 'near'
            const idx = dCat === 'engaged' ? 0 : dCat === 'near' ? 1 : dCat === 'far' ? 2 : 3
            const ang = anglesMap[o.id] ?? (i / Math.max(1, obstacles.length)) * Math.PI * 2 + idx * 0.15
            const rad = ringR[idx]
            const ox = (W/2) + Math.cos(ang) * (rad + 1)
            const oy = (H/2) + Math.sin(ang) * (rad + 1)
            const base = o.color || (o.blocking ? '#475569' : '#0ea5e9')
            const fill = hexToRgba(base, o.blocking ? 0.30 : 0.20)
            const stroke = o.id === selectedObstacleId ? base : '#475569'
            return (
              <g key={o.id} transform={`translate(${ox},${oy})`} style={{ cursor: addingLine ? 'crosshair' : 'move' }} onMouseDown={(e) => { e.stopPropagation(); handleObstacleDrag(o.id) }} onClick={(e) => { e.stopPropagation(); if (addingLine) { onPickLinePoint(o.id) } else { onObstacleSelect(o.id) } }}>
                {o.kind === 'circle'
                  ? <circle r={o.r || 20} fill={fill} stroke={stroke} strokeDasharray={o.blocking ? '0' : '4 4'} />
                  : <rect x={-(o.w||40)/2} y={-(o.h||40)/2} width={o.w||40} height={o.h||40} rx={6} fill={fill} stroke={stroke} strokeDasharray={o.blocking ? '0' : '4 4'} />}
                {o.label && <text textAnchor="middle" fontSize={10} dy={4} fill="#0f172a" pointerEvents="none">{o.label.slice(0,14)}</text>}
                {!fullScreen && <text textAnchor="middle" fontSize={7} fill="#334155" dy={-((o.r|| (o.h||20)/2)+10)} pointerEvents="none">{dCat}</text>}
              </g>
            )
          })}
          {(() => {
            let seen: Record<string, boolean> = {}
            if (active && facingEnabled) {
              const baseRad = ((facing[active.id] ?? 0) - 90) * Math.PI / 180
              const norm = (a: number) => {
                while (a > Math.PI) a -= Math.PI*2
                while (a < -Math.PI) a += Math.PI*2
                return a
              }
              for (const p of layout) {
                if (p.c.id === active.id) continue
                const dx = p.x - cx
                const dy = p.y - cy
                const ang = Math.atan2(dy, dx)
                const diff = Math.abs(norm(ang - baseRad))
                if (diff <= FOV_RAD/2) seen[p.c.id] = true
              }
              seen[active.id] = true
            }
            return (
              <g>
                {active && (
                  <Token
                    key={active.id}
                    x={cx}
                    y={cy}
                    r={28}
                    label={active.name}
                    side={active.side}
                    hp={`${active.hp}/${active.maxHp}`}
                    active
                    facing={facingEnabled ? facing[active.id] : undefined}
                    onClick={(e) => { e.stopPropagation(); if (addingLine) { onPickLinePoint(active.id) } }}
                  />
                )}
                {layout.map(({ c, x, y, d }) => (
                  <Token
                    key={c.id}
                    x={x}
                    y={y}
                    r={22}
                    label={c.name}
                    side={c.side}
                    hp={`${c.hp}/${c.maxHp}`}
                    distance={d}
                    conditions={c.conditions}
                    draggable
                    hiddenState={c.hidden}
                    obscured={c.obscured}
                    cover={c.cover}
                    onMouseDown={(e) => { e.stopPropagation(); handleDrag(c.id) }}
                    onClick={(e) => {
                      if (addingLine) { e.stopPropagation(); onPickLinePoint(c.id); return }
                      const ts = recentlyDraggedRef.current[c.id]
                      if (ts && Date.now() - ts < 250) { delete recentlyDraggedRef.current[c.id]; return }
                      if (e.altKey || e.shiftKey) onCycleDistance(c.id); else onSetActive(c.id)
                    }}
                    onWheel={(e) => { e.preventDefault(); if (e.altKey && facingEnabled) { setFacing(c.id, (facing[c.id] ?? 0) + (e.deltaY < 0 ? 15 : -15)) } else { hpAdjust(c.id, e.deltaY < 0 ? +1 : -1) } }}
                    facing={facingEnabled ? facing[c.id] : undefined}
                    dimmed={facingEnabled && active ? !seen[c.id] && c.id !== active.id : false}
                  />
                ))}
                {distanceLines.map(l => {
                  const pos = (id: string): {x:number;y:number}|null => {
                    if (active && id === active.id) return { x: cx, y: cy }
                    const lay = layout.find(p=>p.c.id===id)
                    if (lay) return { x: lay.x, y: lay.y }
                    if (active) {
                      const dCat = (distances as any)[id] || 'near'
                      const idx = dCat === 'engaged' ? 0 : dCat === 'near' ? 1 : dCat === 'far' ? 2 : 3
                      const ang = anglesMap[id]
                      if (typeof ang === 'number') {
                        const rad = ringR[idx]
                        return { x: (W/2)+Math.cos(ang)*(rad+1), y: (H/2)+Math.sin(ang)*(rad+1) }
                      }
                    }
                    return null
                  }
                  const A = pos(l.a)
                  const B = pos(l.b)
                  if (!A || !B) return null
                  const mx = (A.x + B.x)/2
                  const my = (A.y + B.y)/2
                  return (
                    <g key={l.id} pointerEvents="none">
                      <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={l.color || '#6366f1'} strokeWidth={2} strokeDasharray="4 4" />
                      <rect x={mx-14} y={my-9} width={28} height={14} rx={3} fill="#1e293b" opacity={0.85} />
                      <text x={mx} y={my} textAnchor="middle" dy={1} fontSize={9} fill="white" style={{ fontWeight: 600 }}>{l.value}</text>
                    </g>
                  )
                })}
                {addingLine && pendingLineFirst && (
                  <text x={8} y={16} fontSize={11} fill="#0f172a">Select second point…</text>
                )}
              </g>
            )
          })()}
        </svg>
        <div style={{ fontSize: 11, color: '#475569', marginTop: 8, maxWidth: W }}>
          Drag tokens to change angle & distance (snaps to ring). Click to set active. Shift/Alt+Click cycles distance. Wheel changes HP.
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 260 }}>
        <h4 style={{ margin: '4px 0 8px' }}>Summary</h4>
        <div style={{ display: 'grid', gap: 6 }}>
          {combatants.map(c => {
            const isActive = active && c.id === active.id
            const d = isActive ? '—' : (active ? distances[c.id] || 'near' : '—')
            return (
              <div key={c.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '6px 10px', display: 'flex', gap: 8, alignItems: 'center', background: isActive ? '#f0f9ff' : 'white' }}>
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                <span style={{ ...tag, background: sideColor(c.side).bg, color: sideColor(c.side).fg }}>{c.side}</span>
                <span style={{ ...tag, background: isActive ? '#0ea5e9' : distanceColor(d as any)?.bg || '#e2e8f0', color: isActive ? 'white' : distanceColor(d as any)?.fg || '#334155' }}>{d}</span>
                <span style={{ ...tag, background: hpColor(c).bg, color: hpColor(c).fg }}>{c.hp}/{c.maxHp}</span>
                {c.hidden && <span style={{ ...tag, background: '#0f172a', color: 'white' }}>hidden</span>}
                {c.obscured && c.obscured !== 'none' && <span style={{ ...tag, background: c.obscured === 'light' ? '#94a3b8' : '#475569', color: 'white' }}>{c.obscured} obs</span>}
                {c.cover && c.cover !== 'none' && <span style={{ ...tag, background: '#334155', color: 'white' }}>{c.cover.replace('three-quarters','3/4')}</span>}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  <button onClick={() => hpAdjust(c.id, -1)} style={miniBtn}>-1</button>
                  <button onClick={() => hpAdjust(c.id, +1)} style={miniBtn}>+1</button>
                  <button onClick={() => onSetActive(c.id)} style={{ ...miniBtn, background: isActive ? '#0ea5e9' : 'white', color: isActive ? 'white' : '#0f172a' }}>★</button>
                  <button onClick={() => toggleHidden(c.id)} title="Toggle Hidden" style={{ ...miniBtn, background: c.hidden ? '#0f172a' : '#e2e8f0', color: c.hidden ? 'white' : '#334155' }}>H</button>
                  <button onClick={() => cycleObscured(c.id)} title="Cycle Obscured" style={{ ...miniBtn }}>{c.obscured?.[0] === 'n' ? 'O' : c.obscured?.[0].toUpperCase()+'O'}</button>
                  <button onClick={() => cycleCover(c.id)} title="Cycle Cover" style={{ ...miniBtn }}>{coverAbbrev(c.cover)}</button>
                </div>
              </div>
            )
          })}
          <div style={{ marginTop: 12 }}>
            <h5 style={{ margin: '12px 0 6px', fontSize: 13 }}>Areas & Targets</h5>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              <button onClick={onAddCircleObstacle} style={miniBtn}>+ Area</button>
              <button onClick={onAddRectObstacle} style={miniBtn}>+ Rect</button>
              <button onClick={() => { setAddingLine(a => !a); setPendingLineFirst(null) }} style={{ ...miniBtn, background: addingLine ? '#0ea5e9' : 'white', color: addingLine ? 'white' : '#0f172a' }}>{addingLine ? 'Cancel Line' : '+ Distance Line'}</button>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {obstacles.map(o => (
                <div key={o.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 8px', background: o.id === selectedObstacleId ? '#f1f5f9' : 'white', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <input value={o.label || ''} placeholder={o.kind} onChange={e => onObstacleChange(o.id, { label: e.target.value })} style={{ ...condInput, width: 120 }} />
                    <button onClick={() => onToggleObstacleBlocking(o.id)} style={{ ...miniBtn, background: o.blocking ? '#334155' : 'white', color: o.blocking ? 'white' : '#334155' }}>{o.blocking ? 'Blocking' : 'Passable'}</button>
                    <button onClick={() => onObstacleSelect(o.id)} style={{ ...miniBtn, background: o.id === selectedObstacleId ? '#0ea5e9' : 'white', color: o.id === selectedObstacleId ? 'white' : '#0f172a' }}>Sel</button>
                    <button onClick={() => onResizeObstacle(o.id, +10)} style={miniBtn}>Bigger</button>
                    <button onClick={() => onResizeObstacle(o.id, -10)} style={miniBtn}>Smaller</button>
                    <button onClick={() => onRemoveObstacle(o.id)} style={{ ...miniBtn, color: '#dc2626', borderColor: '#fecaca' }}>✕</button>
                  </div>
                </div>
              ))}
              {obstacles.length === 0 && <div style={{ fontSize: 11, color: '#64748b' }}>No areas or targets yet.</div>}
              {distanceLines.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <h5 style={{ margin: '8px 0 4px', fontSize: 12 }}>Distance Lines</h5>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {distanceLines.map(l => {
                      const aName = combatants.find(c=>c.id===l.a)?.name || obstacles.find(o=>o.id===l.a)?.label || '—'
                      const bName = combatants.find(c=>c.id===l.b)?.name || obstacles.find(o=>o.id===l.b)?.label || '—'
                      return (
                        <div key={l.id} style={{ display: 'flex', gap: 6, alignItems: 'center', border: '1px solid #e2e8f0', padding: '4px 6px', borderRadius: 6 }}>
                          <span style={{ fontSize: 11, flex: 1 }}>{aName} ↔ {bName}</span>
                          <input type="number" value={l.value} min={0} onChange={e => { const v = Number(e.target.value); if (!isNaN(v)) setDistanceLines(ls => ls.map(x => x.id===l.id?{...x,value:v}:x)) }} style={{ width: 54, fontSize: 11, padding: '2px 4px' }} />
                          <button onClick={() => setDistanceLines(ls => ls.filter(x=>x.id!==l.id))} style={{ ...miniBtn, color: '#dc2626', borderColor: '#fecaca' }}>✕</button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Rings({ W, H }: { W: number; H: number }) {
  const cx = W/2, cy = H/2
  const radii = [60,140,220,300]
  const labels: DistanceCategory[] = ['engaged','near','far','distant']
  return (
    <g>
      {radii.map((r,i) => (
        <g key={r}>
          <circle cx={cx} cy={cy} r={r} fill={i===0?'#fef2f2':'none'} stroke="#e2e8f0" strokeDasharray={i===0? '0':'4 6'} />
          <text x={cx} y={cy - r + 14} textAnchor="middle" fontSize={12} fill="#475569" style={{ userSelect: 'none' }}>{labels[i]}</text>
        </g>
      ))}
    </g>
  )
}

function Token({ x, y, r, label, side, hp, active, distance, conditions, onClick, onWheel, onMouseDown, draggable, hiddenState, obscured, cover, facing, dimmed }: {
  x: number; y: number; r: number; label: string; side: TheatreCombatant['side']; hp: string; active?: boolean; distance?: DistanceCategory; conditions?: string[]; onClick?: (e: React.MouseEvent<SVGGElement, MouseEvent>) => void; onWheel?: (e: React.WheelEvent<SVGGElement>) => void; onMouseDown?: (e: React.MouseEvent<SVGGElement, MouseEvent>) => void; draggable?: boolean; hiddenState?: boolean; obscured?: TheatreCombatant['obscured']; cover?: TheatreCombatant['cover']; facing?: number; dimmed?: boolean
}) {
  const palette = sideColor(side)
  return (
    <g transform={`translate(${x},${y})`} style={{ cursor: draggable ? 'grab' : 'pointer', opacity: dimmed ? 0.35 : 1 }} onClick={onClick} onWheel={onWheel} onMouseDown={onMouseDown}>
  <circle r={r} fill={palette.bg} stroke={active ? '#0ea5e9' : '#ffffff'} strokeWidth={active ? 4 : 2} style={{ filter: draggable ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' : undefined, opacity: hiddenState ? 0.6 : 1 }} />
      {typeof facing === 'number' && (
        <g transform={`rotate(${facing})`} pointerEvents="none">
          <path d={`M0 ${-r+4} L5 ${-r+12} L-5 ${-r+12} Z`} fill={active ? '#0ea5e9' : '#475569'} opacity={0.85} />
        </g>
      )}
      <text textAnchor="middle" fontSize={11} fill={palette.fg} fontWeight={600} dy={-4} pointerEvents="none">{label.slice(0,10)}</text>
      <text textAnchor="middle" fontSize={9} fill={palette.fg} dy={10} pointerEvents="none">{hp}</text>
      {conditions && conditions.length > 0 && (
        <text textAnchor="middle" fontSize={8} fill={palette.fg} dy={22} pointerEvents="none">{conditions.slice(0,3).join(',')}</text>
      )}
      {distance && !active && (
        <text textAnchor="middle" fontSize={7.5} fill="#334155" dy={-r-6} pointerEvents="none">{distance}</text>
      )}
      {(hiddenState || (obscured && obscured !== 'none') || (cover && cover !== 'none')) && (
        <text textAnchor="middle" fontSize={7} fill="#0f172a" dy={-r-18} pointerEvents="none">
          {[hiddenState?'H':null, obscured && obscured!=='none' ? (obscured==='light'?'LO':'HO'):null, cover && cover!=='none'?coverAbbrev(cover):null].filter(Boolean).join(' ')}
        </text>
      )}
    </g>
  )
}

function coverAbbrev(c?: TheatreCombatant['cover']) {
  switch (c) {
    case 'half': return '1/2'
    case 'three-quarters': return '3/4'
    case 'full': return 'F'
    default: return '—'
  }
}

function ConditionAdder({ onAdd }: { onAdd: (t: string) => void }) {
  const [val, setVal] = useState('')
  const submit = useCallback(() => { if (val.trim()) { onAdd(val.trim()); setVal('') } }, [val, onAdd])
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }} placeholder="+cond" style={{ ...condInput }} />
      {val && <button onClick={submit} style={{ ...miniBtn }}>Add</button>}
    </span>
  )
}

// Styling helpers & palettes
const label: React.CSSProperties = { display: 'block', fontSize: 12, color: '#334155', marginBottom: 4 }
const input: React.CSSProperties = { padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 10, minWidth: 130 }
const btn: React.CSSProperties = { padding: '8px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontSize: 14 }
const primaryBtn: React.CSSProperties = { ...btn, background: '#0ea5e9', color: 'white', borderColor: '#38bdf8' }
const pill: React.CSSProperties = { padding: '6px 10px', borderRadius: 30, border: '1px solid #cbd5e1', background: 'white', display: 'flex', gap: 4 }
const tag: React.CSSProperties = { padding: '2px 8px', borderRadius: 20, fontSize: 11, textTransform: 'capitalize', lineHeight: '16px' }
const condTag: React.CSSProperties = { ...tag, cursor: 'pointer' }
const smallBtn: React.CSSProperties = { ...btn, padding: '6px 10px', fontSize: 12 }
const miniBtn: React.CSSProperties = { ...btn, padding: '4px 8px', fontSize: 11 }
const condInput: React.CSSProperties = { padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 11, width: 90 }
const select: React.CSSProperties = { padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12, background: 'white' }

function sideColor(side: TheatreCombatant['side']) {
  switch (side) {
    case 'party': return { bg: '#0d9488', fg: 'white' }
    case 'ally': return { bg: '#3b82f6', fg: 'white' }
    case 'enemy': return { bg: '#dc2626', fg: 'white' }
    case 'neutral': return { bg: '#64748b', fg: 'white' }
  }
}
function zoneColor(zone: Zone) {
  switch (zone) {
    case 'engaged': return { bg: '#be123c', fg: 'white' }
    case 'near': return { bg: '#2563eb', fg: 'white' }
    case 'far': return { bg: '#7c3aed', fg: 'white' }
    case 'distant': return { bg: '#475569', fg: 'white' }
  }
}
const distanceColor = zoneColor
function hpColor(c: TheatreCombatant) {
  const pct = c.hp / Math.max(1, c.maxHp)
  if (c.hp <= 0) return { bg: '#334155', fg: 'white' }
  if (pct < 0.25) return { bg: '#dc2626', fg: 'white' }
  if (pct < 0.6) return { bg: '#f59e0b', fg: '#1e293b' }
  return { bg: '#16a34a', fg: 'white' }
}

// Obstacle type
type Obstacle = {
  id: string
  kind: 'circle' | 'rect'
  x: number
  y: number
  r?: number
  w?: number
  h?: number
  label?: string
  blocking?: boolean
  color?: string
}
type DistanceLine = { id: string; a: string; b: string; value: number; color?: string }

function hexToRgba(hex: string, alpha: number) {
  let h = hex.replace('#','')
  if (h.length === 3) h = h.split('').map(c => c+c).join('')
  const bigint = parseInt(h, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r},${g},${b},${alpha})`
}
