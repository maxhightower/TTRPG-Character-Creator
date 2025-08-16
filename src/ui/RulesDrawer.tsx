          {/* Rules Section (TCE controls removed as requested) */}
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

type RulesDrawerProps = { theme: 'light' | 'dark'; setTheme: (t: 'light' | 'dark') => void; activeClassIds?: string[] }
// Define a lightweight catalog of optional class rules keyed by class id
const OPTIONAL_CLASS_RULES: Record<string, Array<{ key: string; name: string; desc: string }>> = {
  barbarian: [
    { key: 'recklessDamageVariant', name: 'Reckless Damage Variant', desc: 'Reckless Attack also adds +1 damage (homebrew demo).' },
  ],
  ranger: [
    { key: 'revisedFavoredEnemy', name: 'Revised Favored Enemy', desc: 'Use alternative Favored Foe style tracking (demo).' },
    { key: 'expandedSpellList', name: 'Expanded Spell List', desc: 'Adds a few utility spells (demo).' },
  ],
  rogue: [
    { key: 'steadyAim', name: 'Steady Aim', desc: 'Gain Steady Aim option (TCE style, demo).' },
  ],
  fighter: [
    { key: 'maneuverSwap', name: 'Maneuver Swap', desc: 'Allow swapping one maneuver on level up (demo).' },
  ],
}

export function RulesDrawer({ theme, setTheme, activeClassIds = [] }: RulesDrawerProps) {
  const { open, setOpen, multiclassReqs, setMulticlassReqs, tceCustomAsi, setTceCustomAsi, featsEnabled, setFeatsEnabled, customOrigin, setCustomOrigin, manualAbilityAdjust, setManualAbilityAdjust, manualHitPoints, setManualHitPoints, optionalClassRules, setOptionalClassRule, directionalFacing, setDirectionalFacing } = useRules()
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
      <div onClick={() => setOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.5)' }} />
      <aside style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 360, background: 'var(--card-bg)', borderLeft: '1px solid var(--muted-border)', boxShadow: '0 12px 32px rgba(15,23,42,0.35)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: '0 0 auto' }}>
          <div style={{ fontWeight: 700 }}>Menu</div>
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </div>
        <div style={{ display: 'grid', gap: 18, flex: '1 1 auto', overflowY: 'auto', alignContent: 'start' }}>
          <section style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', color: '#64748b' }}>Settings</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Theme</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Switch between light and dark</div>
              </div>
              <Button size="sm" variant="outline" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? '🌙' : '☀️'} {theme === 'dark' ? 'Dark' : 'Light'}
              </Button>
            </div>
          </section>
          <section style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', color: '#64748b' }}>Rules</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Enforce Multiclassing Requirements</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Require ability score minimums for additional classes</div>
              </div>
              <Button size="sm" variant={multiclassReqs ? 'default' : 'outline'} onClick={() => setMulticlassReqs(!multiclassReqs)}>{multiclassReqs ? 'On' : 'Off'}</Button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Enable Feats</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Allow spending ASI points on feats</div>
              </div>
              <Button size="sm" variant={featsEnabled ? 'default' : 'outline'} onClick={() => setFeatsEnabled(!featsEnabled)}>{featsEnabled ? 'On' : 'Off'}</Button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Enable Manual Score Adjustment</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Allow direct +/- editing when not using Point Buy</div>
              </div>
              <Button size="sm" variant={manualAbilityAdjust ? 'default' : 'outline'} onClick={() => setManualAbilityAdjust(!manualAbilityAdjust)}>{manualAbilityAdjust ? 'On' : 'Off'}</Button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Manual Hit Points</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Enable rolling & custom HP calculation methods</div>
              </div>
              <Button size="sm" variant={manualHitPoints ? 'default' : 'outline'} onClick={() => setManualHitPoints(!manualHitPoints)}>{manualHitPoints ? 'On' : 'Off'}</Button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Custom Origin</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Replace racial ASIs with +2 and +1 of your choice</div>
              </div>
              <Button size="sm" variant={customOrigin ? 'default' : 'outline'} onClick={() => setCustomOrigin(!customOrigin)}>{customOrigin ? 'On' : 'Off'}</Button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>TCE Custom Racial Bonus</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Enable custom racial ability allocation</div>
              </div>
              <Button size="sm" variant={tceCustomAsi ? 'default' : 'outline'} onClick={() => setTceCustomAsi(!tceCustomAsi)}>{tceCustomAsi ? 'On' : 'Off'}</Button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Directional Facing (Experimental)</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Tokens show facing; Alt+Wheel rotate (15°)</div>
              </div>
              <Button size="sm" variant={directionalFacing ? 'default' : 'outline'} onClick={() => setDirectionalFacing(!directionalFacing)}>{directionalFacing ? 'On' : 'Off'}</Button>
            </div>
            {/* Optional Class Rules */}
            {activeClassIds.length > 0 && (
              <div style={{ marginTop: 4, borderTop: '1px solid var(--muted-border)', paddingTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>Optional Class Rules</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {Array.from(new Set(activeClassIds)).map(cid => {
                    const rules = OPTIONAL_CLASS_RULES[cid]
                    if (!rules) return null
                    return (
                      <div key={cid} style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{cid.charAt(0).toUpperCase() + cid.slice(1)}</div>
                        {rules.map(r => {
                          const enabled = !!optionalClassRules[cid]?.[r.key]
                          return (
                            <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 500 }}>{r.name}</div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>{r.desc}</div>
                              </div>
                              <Button size="sm" variant={enabled ? 'default' : 'outline'} onClick={() => setOptionalClassRule(cid, r.key, !enabled)}>{enabled ? 'On' : 'Off'}</Button>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}
