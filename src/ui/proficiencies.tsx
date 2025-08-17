import React from 'react'
import { Background } from '../data/types'
import { Pill, Button, SectionHeading, ProficiencyPills } from './primitives'

// computeOtherProficiencies was inline; export for reuse
export function computeOtherProficiencies(ctx: { classes: Array<{ klass: any; level: number; subclass?: any }>; background?: Background }) {
  const weapons = new Set<string>()
  const armorCategories = new Set<string>()
  const armorSpecific = new Set<string>()
  const tools = new Set<string>()
  const instruments = new Set<string>()
  const vehicles = new Set<string>()

  ctx.classes.forEach(c => {
    switch (c.klass.id) {
      case 'barbarian': armorCategories.add('Light'); armorCategories.add('Medium'); armorCategories.add('Shields'); weapons.add('Simple Weapons'); weapons.add('Martial Weapons'); break
      case 'fighter': armorCategories.add('All Armor'); armorCategories.add('Shields'); weapons.add('Simple Weapons'); weapons.add('Martial Weapons'); break
      case 'paladin': armorCategories.add('All Armor'); armorCategories.add('Shields'); weapons.add('Simple Weapons'); weapons.add('Martial Weapons'); break
      case 'ranger': armorCategories.add('Light'); armorCategories.add('Medium'); armorCategories.add('Shields'); weapons.add('Simple Weapons'); weapons.add('Martial Weapons'); break
      case 'rogue': armorCategories.add('Light'); weapons.add('Simple Weapons'); weapons.add('Hand Crossbows'); weapons.add('Longswords'); weapons.add('Rapiers'); weapons.add('Shortswords'); tools.add("Thieves' Tools"); break
      case 'bard': armorCategories.add('Light'); weapons.add('Simple Weapons'); weapons.add('Hand Crossbows'); weapons.add('Longswords'); weapons.add('Rapiers'); weapons.add('Shortswords'); instruments.add('Three Musical Instruments'); break
      case 'cleric': armorCategories.add('Light'); armorCategories.add('Medium'); armorCategories.add('Shields'); weapons.add('Simple Weapons'); break
      case 'druid': armorCategories.add('Light'); armorCategories.add('Medium'); armorCategories.add('Shields'); weapons.add('Clubs'); weapons.add('Daggers'); weapons.add('Darts'); weapons.add('Javelins'); weapons.add('Maces'); weapons.add('Quarterstaffs'); weapons.add('Scimitars'); weapons.add('Sickles'); weapons.add('Slings'); weapons.add('Spears'); break
      case 'sorcerer': weapons.add('Daggers'); weapons.add('Darts'); weapons.add('Slings'); weapons.add('Quarterstaffs'); weapons.add('Light Crossbows'); break
      case 'warlock': weapons.add('Simple Weapons'); break
      case 'wizard': weapons.add('Daggers'); weapons.add('Darts'); weapons.add('Slings'); weapons.add('Quarterstaffs'); weapons.add('Light Crossbows'); break
      case 'monk': armorCategories.add('None (Monk)'); weapons.add('Simple Weapons'); weapons.add('Shortswords'); break
      default: break
    }
  })

  switch (ctx.background?.id) {
    case 'soldier': weapons.add('Simple Weapons'); weapons.add('Martial Weapons'); tools.add('Gaming Set'); vehicles.add('Land Vehicles'); break
    case 'sailor': weapons.add('Simple Weapons'); tools.add("Navigator's Tools"); vehicles.add('Water Vehicles'); break
    case 'urchin': tools.add('Disguise Kit'); tools.add("Thieves' Tools"); break
    case 'entertainer': instruments.add('Disguise Kit'); instruments.add('One Musical Instrument'); break
    default: break
  }

  return {
    weapons: Array.from(weapons),
    armorCategories: Array.from(armorCategories),
    armorSpecific: Array.from(armorSpecific),
    tools: Array.from(tools),
    instruments: Array.from(instruments),
    vehicles: Array.from(vehicles),
  }
}

export function CombatProficiencyList({ classes, background }: { classes: Array<{ klass: any; level: number; subclass?: any }>; background?: Background }) {
  let profs: ReturnType<typeof computeOtherProficiencies>
  try { profs = computeOtherProficiencies({ classes, background }) } catch { profs = { weapons: [], armorCategories: [], armorSpecific: [], tools: [], instruments: [], vehicles: [] } }
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <SectionHeading>Weapon Proficiencies</SectionHeading>
        <ProficiencyPills items={profs.weapons} />
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <SectionHeading>Armor Categories</SectionHeading>
        <ProficiencyPills items={profs.armorCategories} />
      </div>
      {profs.armorSpecific.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <SectionHeading>Specific Armor</SectionHeading>
          <ProficiencyPills items={profs.armorSpecific} />
        </div>
      )}
      <div style={{ fontSize: 11, opacity: 0.7 }}>Derived from class & background only (feats & racial armor/weapon proficiencies pending).</div>
    </div>
  )
}

export function CombatProficiencySources() {
  return <div style={{ fontSize: 12, opacity: 0.75 }}>Source breakdown visualization not yet implemented.</div>
}

export function OtherProficiencyList({ classes, background }: { classes: Array<{ klass: any; level: number; subclass?: any }>; background?: Background }) {
  let profs: ReturnType<typeof computeOtherProficiencies>
  try { profs = computeOtherProficiencies({ classes, background }) } catch { profs = { weapons: [], armorCategories: [], armorSpecific: [], tools: [], instruments: [], vehicles: [] } }
  const languages: string[] = []
  const games: string[] = []
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <SectionHeading>Tools</SectionHeading>
        <ProficiencyPills items={profs.tools} />
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <SectionHeading>Musical Instruments</SectionHeading>
        <ProficiencyPills items={profs.instruments} />
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <SectionHeading>Vehicles</SectionHeading>
        <ProficiencyPills items={profs.vehicles} />
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <SectionHeading>Languages</SectionHeading>
        <ProficiencyPills items={languages} />
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <SectionHeading>Games / Gaming Sets</SectionHeading>
        <ProficiencyPills items={games} />
      </div>
      <div style={{ fontSize: 11, opacity: 0.7 }}>Languages & game sets placeholder. Extend race/background data to populate.</div>
    </div>
  )
}

export function OtherProficiencySources() { return <div style={{ fontSize: 12, opacity: 0.75 }}>Source breakdown visualization not yet implemented.</div> }
