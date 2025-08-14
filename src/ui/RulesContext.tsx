import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { AbilityKey } from '../data/types'

export type RulesState = {
  tceCustomAsi: boolean
  tceMode: '2+1' | '1+1+1'
  tceAlloc: Record<AbilityKey, number>
  multiclassReqs: boolean
  featsEnabled: boolean
  customOrigin: boolean
  optionalClassRules?: Record<string, Record<string, boolean>>
}

type RulesContextValue = RulesState & {
  open: boolean
  setOpen: (v: boolean) => void
  setTceCustomAsi: (v: boolean) => void
  setMulticlassReqs: (v: boolean) => void
  setFeatsEnabled: (v: boolean) => void
  setCustomOrigin: (v: boolean) => void
  setTceMode: (m: '2+1' | '1+1+1') => void
  setTceAlloc: (alloc: Record<AbilityKey, number>) => void
  resetTceAllocForMode: () => void
  optionalClassRules: Record<string, Record<string, boolean>>
  setOptionalClassRule: (classId: string, ruleKey: string, value: boolean) => void
}

const defaultAlloc: Record<AbilityKey, number> = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }

const RulesContext = createContext<RulesContextValue | undefined>(undefined)

export function RulesProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [tceCustomAsi, setTceCustomAsi] = useState(false)
  const [multiclassReqs, setMulticlassReqs] = useState(false)
  const [featsEnabled, setFeatsEnabled] = useState(true)
  const [customOrigin, setCustomOrigin] = useState(false)
  const [tceMode, setTceMode] = useState<'2+1' | '1+1+1'>('2+1')
  const [tceAlloc, setTceAlloc] = useState<Record<AbilityKey, number>>({ ...defaultAlloc, str: 2, dex: 1 })
  const [optionalClassRules, setOptionalClassRules] = useState<Record<string, Record<string, boolean>>>({})

  // Persist globally so it works across pages and sessions
  useEffect(() => {
    try {
    const payload: RulesState = { tceCustomAsi, tceMode, tceAlloc, multiclassReqs, featsEnabled, customOrigin, optionalClassRules }
    localStorage.setItem('rules.global.v1', JSON.stringify(payload))
    } catch {}
  }, [tceCustomAsi, tceMode, JSON.stringify(tceAlloc), multiclassReqs, featsEnabled, customOrigin, JSON.stringify(optionalClassRules)])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('rules.global.v1')
      if (!raw) return
      const saved = JSON.parse(raw)
      if (typeof saved?.tceCustomAsi === 'boolean') setTceCustomAsi(saved.tceCustomAsi)
      if (saved?.tceMode === '2+1' || saved?.tceMode === '1+1+1') setTceMode(saved.tceMode)
  if (saved?.tceAlloc && typeof saved.tceAlloc === 'object') setTceAlloc({ ...defaultAlloc, ...saved.tceAlloc })
  if (typeof saved?.multiclassReqs === 'boolean') setMulticlassReqs(saved.multiclassReqs)
  if (typeof saved?.featsEnabled === 'boolean') setFeatsEnabled(saved.featsEnabled)
  if (typeof saved?.customOrigin === 'boolean') setCustomOrigin(saved.customOrigin)
  if (saved?.optionalClassRules && typeof saved.optionalClassRules === 'object') setOptionalClassRules(saved.optionalClassRules)
    } catch {}
  }, [])

  const resetTceAllocForMode = () => {
    if (tceMode === '2+1') setTceAlloc({ ...defaultAlloc, str: 2, dex: 1 })
    else setTceAlloc({ ...defaultAlloc, str: 1, dex: 1, con: 1 })
  }

  const setOptionalClassRule = (classId: string, ruleKey: string, value: boolean) => {
    setOptionalClassRules(prev => ({
      ...prev,
      [classId]: { ...(prev[classId] || {}), [ruleKey]: value }
    }))
  }

  const value = useMemo<RulesContextValue>(() => ({
    open,
    setOpen,
    tceCustomAsi,
    multiclassReqs,
    featsEnabled,
    customOrigin,
    tceMode,
    tceAlloc,
    setTceCustomAsi,
    setMulticlassReqs,
    setFeatsEnabled,
    setCustomOrigin,
    setTceMode,
    setTceAlloc,
    resetTceAllocForMode,
    optionalClassRules,
    setOptionalClassRule,
  }), [open, tceCustomAsi, multiclassReqs, featsEnabled, customOrigin, tceMode, JSON.stringify(tceAlloc), JSON.stringify(optionalClassRules)])

  return <RulesContext.Provider value={value}>{children}</RulesContext.Provider>
}

export function useRules() {
  const ctx = useContext(RulesContext)
  if (!ctx) throw new Error('useRules must be used within a RulesProvider')
  return ctx
}
