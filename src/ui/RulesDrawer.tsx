import React from 'react'
import { useRules } from './RulesContext'

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost'; size?: 'sm' | 'md' | 'icon' }) {
  const { variant = 'default', size = 'md', style, ...rest } = props
  const base: React.CSSProperties = {
    borderRadius: 8,
    border: '1px solid var(--button-border)',
    background: variant === 'default' ? 'var(--button-active-bg)' : 'var(--button-bg)',
    color: variant === 'default' ? 'var(--button-active-fg)' : 'var(--button-fg)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
  if (variant === 'outline') { base.background = 'var(--button-bg)' }
  if (variant === 'ghost') { base.background = 'transparent'; base.border = '1px solid transparent' }
  if (size === 'sm') { base.padding = '6px 10px'; base.fontSize = 12 }
  else if (size === 'icon') { base.padding = 6 }
  else { base.padding = '8px 12px' }
  return <button {...rest} style={{ ...base, ...style }} />
}

export function RulesDrawer() {
  const {
    open, setOpen,
    tceCustomAsi, setTceCustomAsi,
    multiclassReqs, setMulticlassReqs,
    tceMode, setTceMode,
    tceAlloc, setTceAlloc,
    resetTceAllocForMode,
  } = useRules()

  if (!open) return null

  const emptyAlloc: any = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
  const budget = 3
  const limits: any = { str: tceMode==='2+1'?2:1, dex: tceMode==='2+1'?2:1, con: tceMode==='2+1'?2:1, int: tceMode==='2+1'?2:1, wis: tceMode==='2+1'?2:1, cha: tceMode==='2+1'?2:1 }
  const total = ['str','dex','con','int','wis','cha'].reduce((s,k)=> s + (tceAlloc[k]||0), 0)
  const maxSlots = tceMode === '2+1' ? 2 : 3
  const usedSlots = ['str','dex','con','int','wis','cha'].filter(k => (tceAlloc[k]||0) > 0).length
  const canInc = (k: any) => {
    const curr = tceAlloc[k] || 0
    if (curr >= limits[k]) return false
    if (total >= budget) return false
    if (tceMode === '2+1') {
      if (usedSlots >= maxSlots && (tceAlloc[k]||0) === 0) return false
      const alreadyTwo = ['str','dex','con','int','wis','cha'].some((x:any) => (tceAlloc[x]||0) >= 2)
      if (alreadyTwo && curr >= 1) return false
    }
    return true
  }
  const canDec = (k: any) => (tceAlloc[k]||0) > 0

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
      <div onClick={() => setOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.5)' }} />
      <aside style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 360, background: 'var(--card-bg)', borderLeft: '1px solid var(--muted-border)', boxShadow: '0 12px 32px rgba(15,23,42,0.35)', padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700 }}>Rules</div>
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>TCE Custom Racial Bonuses</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Replace racial ASIs with flexible allocation</div>
            </div>
            <Button size="sm" variant={tceCustomAsi ? 'default' : 'outline'} onClick={() => setTceCustomAsi(!tceCustomAsi)}>{tceCustomAsi ? 'On' : 'Off'}</Button>
          </div>
          {tceCustomAsi ? (
            <div style={{ padding: 8, border: '1px solid var(--muted-border)', borderRadius: 8, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Mode</div>
                <Button size="sm" variant={tceMode === '2+1' ? 'default' : 'outline'} onClick={() => { setTceMode('2+1'); setTceAlloc((prev)=>{ const next={...emptyAlloc, ...prev}; const t=Object.values(next).reduce((a:any,b:any)=>a+b,0); return t? next: { ...emptyAlloc, str: 2, dex: 1 } }) }}>+2 and +1</Button>
                <Button size="sm" variant={tceMode === '1+1+1' ? 'default' : 'outline'} onClick={() => { setTceMode('1+1+1'); setTceAlloc((prev)=>{ const next={...emptyAlloc, ...prev}; const t=Object.values(next).reduce((a:any,b:any)=>a+b,0); return t? next: { ...emptyAlloc, str: 1, dex: 1, con: 1 } }) }}>+1/+1/+1</Button>
                <Button size="sm" variant="ghost" onClick={() => resetTceAllocForMode()}>Reset</Button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                {(['str','dex','con','int','wis','cha'] as const).map((k) => (
                  <div key={k} style={{ display: 'grid', gap: 4, alignContent: 'start' }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b', textAlign: 'center' }}>{k}</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                      <Button size="icon" variant="outline" onClick={() => setTceAlloc((p:any)=>({ ...p, [k]: Math.max(0, (p[k]||0)-1) }))} disabled={!canDec(k)}>−</Button>
                      <div style={{ minWidth: 16, textAlign: 'center', fontWeight: 600 }}>{tceAlloc[k] || 0}</div>
                      <Button size="icon" variant="outline" onClick={() => { if (!canInc(k)) return; setTceAlloc((p:any)=>({ ...p, [k]: Math.min(limits[k], (p[k]||0)+1) })) }}>+</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Allocated {total} / {budget}</div>
            </div>
          ) : null}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Enforce Multiclassing Requirements</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Require ability score minimums for additional classes</div>
            </div>
            <Button size="sm" variant={multiclassReqs ? 'default' : 'outline'} onClick={() => setMulticlassReqs(!multiclassReqs)}>{multiclassReqs ? 'On' : 'Off'}</Button>
          </div>
        </div>
      </aside>
    </div>
  )
}
