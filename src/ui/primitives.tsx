import React from 'react'

// Reusable UI primitives extracted from Builder

export function Pill(props: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <span style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--pill-bg, #f1f5f9)', color: 'var(--fg)', fontSize: 12, whiteSpace: 'nowrap', ...(props.style || {}) }}>{props.children}</span>
}

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost'; size?: 'sm' | 'md' | 'icon' }) {
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

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{children}</div>
}

export function ProficiencyPills({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return <div style={{ fontSize: 12, opacity: 0.6 }}>None</div>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.sort().map(i => <Pill key={i}>{i}</Pill>)}
    </div>
  )
}

// Simple Card primitives
const card: React.CSSProperties = { border: '1px solid var(--muted-border)', borderRadius: 12, background: 'var(--card-bg)', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', position: 'relative' }
export function Card(props: { children: React.ReactNode }) { return <section style={card}>{props.children}</section> }
export function CardHeader(props: { children: React.ReactNode }) { return <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0' }}>{props.children}</div> }
export function CardTitle(props: { children: React.ReactNode; style?: React.CSSProperties }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 15, ...(props.style || {}) }}>{props.children}</div> }
export function CardContent(props: { children: React.ReactNode }) { return <div style={{ padding: 16, display: 'grid', gap: 12 }}>{props.children}</div> }

// Local ErrorBoundary (could have more generic version later)
export class ErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err: any) { console.error('ErrorBoundary caught', err) }
  render() { if (this.state.hasError) return this.props.fallback; return this.props.children }
}
