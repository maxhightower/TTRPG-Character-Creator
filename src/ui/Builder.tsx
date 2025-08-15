import React, { useMemo, useState, useEffect, useRef } from 'react'
import { Plus, Info, Redo2, Scale, Settings2, Shield, Sparkles, Sword, Undo2, List, Columns, LayoutGrid, ChevronDown, ChevronRight, Heart as HeartIcon } from 'lucide-react'
import { useRules } from './RulesContext.tsx'
// Externalized shared types and data
import type { AbilityKey, Background, Spell, MagicSchool, DamageType, Equipment, Feat } from '../data/types'
import { CLASSES, Klass, Subclass } from '../data/classes'
import { RACES, Race } from '../data/races'
import { SKILLS } from '../data/skills'
import { BACKGROUNDS } from '../data/backgrounds'
import { SPELLS, SPELL_META, ALL_SPELL_SCHOOLS, ALL_DAMAGE_TYPES, ALL_SAVE_ABILITIES } from '../data/spells'
import { EQUIPMENT, SUBACTIONS_BY_ITEM } from '../data/equipment'
import { FEATS } from '../data/feats'

// ---------------- Demo Data (typed) ----------------

// Reconstruct a per-level sequence array from aggregated class levels and the chronological class id list.
// classes: current aggregated class objects (some with level >1)
// order: chronological log of class ids for each level-up in the order buttons were pressed
// Returns an array where each element is a level-up entry { klass, level:1, subclass? } preserving original subclass refs.
function reconstructSequence(classes: Array<{ klass: Klass; level: number; subclass?: Subclass }>, order: string[]) {
  if (!order.length) return classes
  // Build counts to ensure we don't exceed current levels
  const levelTally: Record<string, number> = {}
  const maxLevels: Record<string, number> = {}
  classes.forEach(c => { maxLevels[c.klass.id] = c.level })
  const out: Array<{ klass: Klass; level: number; subclass?: Subclass }> = []
  for (const id of order) {
    const max = maxLevels[id]
    if (!max) continue // class removed
    const current = (levelTally[id] || 0) + 1
    if (current > max) continue // extra historical entry beyond present level count
    levelTally[id] = current
    const ref = classes.find(c => c.klass.id === id)
    if (ref) out.push({ klass: ref.klass, level: 1, subclass: ref.subclass })
  }
  // If counts don't add up (e.g., new class added externally), append remaining levels in original class order
  classes.forEach(c => {
    const need = c.level - (levelTally[c.klass.id] || 0)
    for (let i = 0; i < need; i++) out.push({ klass: c.klass, level: 1, subclass: c.subclass })
  })
  return out
}

// Lightweight custom Armor icon (breastplate) for items of type 'armor'
const ArmorIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 2h12v2c0 3.5-2.5 7-6 10C4.5 11 2 7.5 2 4V2z" stroke={color} strokeWidth="1.5" fill="none" />
  </svg>
)

// (progression table injected within Builder component return)
// Added optional future flag: future levels are displayed (greyed) but excluded from cumulative stat math.
function renderProgressionTable(classes: Array<{ klass: Klass; level: number; subclass?: Subclass; future?: boolean }>, fullscreen = false) {
  // Helper data
  const profBonus = (lvl: number) => 2 + Math.floor((lvl - 1) / 4)
  const rageByLevel = [2, 3, 4, 4, 5, 5, 6, 6, 6, 6, 7, 7, 7, 8, 8, 8, 8, 8, 8, 'unlimited']
  const rageDmgByLevel = [2,2,2,2,2,2,2,2,3,3,3,3,3,3,3,4,4,4,4,4]

  // Full caster slot progression (effective caster level 1..20)
  const SHARED_SLOTS: number[][] = [
    [2], [3], [4,2], [4,3], [4,3,2], [4,3,3], [4,3,3,1], [4,3,3,2], [4,3,3,3,1], [4,3,3,3,2],
    [4,3,3,3,2,1], [4,3,3,3,2,1], [4,3,3,3,2,1,1], [4,3,3,3,2,1,1], [4,3,3,3,2,1,1,1], [4,3,3,3,2,1,1,1],
    [4,3,3,3,2,1,1,1,1], [4,3,3,3,2,1,1,1,1], [4,3,3,3,2,1,1,1,1], [4,3,3,3,2,1,1,1,1]
  ]
  // Pact (Warlock) slots by warlock class level (slot count, slot level)
  const PACT_SLOTS: Array<{ slots: number; level: number }> = [
    { slots:1, level:1 }, { slots:2, level:1 }, { slots:2, level:2 }, { slots:2, level:2 }, { slots:2, level:3 },
    { slots:2, level:3 }, { slots:2, level:4 }, { slots:2, level:4 }, { slots:2, level:5 }, { slots:2, level:5 },
    { slots:3, level:5 }, { slots:3, level:5 }, { slots:3, level:5 }, { slots:3, level:5 }, { slots:3, level:5 },
    { slots:3, level:5 }, { slots:4, level:5 }, { slots:4, level:5 }, { slots:4, level:5 }, { slots:4, level:5 },
  ]

  const FULL_CASTERS = new Set(['wizard','sorcerer','cleric','druid','bard'])
  const HALF_CASTERS = new Set(['paladin','ranger'])
  // THIRD casters (if subclasses implemented later)
  const THIRD_SUBCLASS_IDS = new Set(['eldritch-knight','arcane-trickster'])
  const PACT_CASTER = 'warlock'

  // Determine if classes array represents an explicit per-level sequence (every entry level ===1)
  const totalLevels = classes.reduce((s,c)=>s+(c.level||0),0)
  const sequenceMode = classes.length === totalLevels && classes.every(c=>c.level===1)

  let charLevel = 0
  const rows: Array<{ charLevel: number; klass: Klass; classLevel: number; subclass?: Subclass; features: Array<{ name: string; text: string }>; future?: boolean }> = []
  if (sequenceMode) {
    const classCount: Record<string, number> = {}
    classes.forEach(c => {
      charLevel += 1
      classCount[c.klass.id] = (classCount[c.klass.id]||0)+1
      const classLevel = classCount[c.klass.id]
      const feats = (c.klass.featuresByLevel?.[classLevel] || []).slice()
      if (c.subclass && classLevel === c.subclass.unlockLevel) {
        feats.push({ name: `${c.subclass.name} Features`, text: 'Subclass features gained.' })
      }
      rows.push({ charLevel, klass: c.klass, classLevel, subclass: c.subclass, features: feats, future: c.future })
    })
  } else {
    // Preserve original order of classes array, do not sort
  classes.forEach(c => {
      for (let lvl = 1; lvl <= c.level; lvl++) {
        charLevel += 1
        const feats = (c.klass.featuresByLevel?.[lvl] || []).slice()
        if (c.subclass && lvl === c.subclass.unlockLevel) {
          feats.push({ name: `${c.subclass.name} Features`, text: 'Subclass features gained.' })
        }
    rows.push({ charLevel, klass: c.klass, classLevel: lvl, subclass: c.subclass, features: feats, future: c.future })
      }
    })
  }

  if (!rows.length) return <div style={{ fontSize: 12, color: '#64748b' }}>No levels yet.</div>

  // Precompute cumulative class level tallies for spellcasting math at each row
  const cumulative = rows.map((_r, idx) => {
    // Only count non-future rows up to this point
    const slice = rows.slice(0, idx + 1).filter(r => !r.future)
    let full = 0, half = 0, third = 0, warlock = 0
    slice.forEach(r => {
      if (FULL_CASTERS.has(r.klass.id)) full += 1
      else if (HALF_CASTERS.has(r.klass.id)) half += 1
      else if (r.klass.id === PACT_CASTER) warlock += 1
      else if (r.subclass && THIRD_SUBCLASS_IDS.has(r.subclass.id)) third += 1
    })
    const effective = full + Math.floor(half / 2) + Math.floor(third / 3)
    return { full, half, third, warlock, effective }
  })

  const formatShared = (slots: number[]) => slots.map((n,i)=>`${i+1}:${n}`).join(' ') // e.g. "1:4 2:3 3:3 4:2"

  const hasBarbarian = rows.some(r => r.klass.id === 'barbarian')

  return (
    <div style={{ overflowX: 'auto', maxHeight: fullscreen ? undefined : 360, overflowY: fullscreen ? undefined : 'auto', border: '1px solid var(--muted-border)', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--card-bg-alt, #f1f5f9)' }}>
            <th style={progTh}>Char Lvl</th>
            <th style={progTh}>Class</th>
            <th style={progTh}>Class Lvl</th>
            <th style={progTh}>Prof Bonus</th>
            {hasBarbarian && <th style={progTh}>Rage Uses</th>}
            {hasBarbarian && <th style={progTh}>Rage Dmg</th>}
            <th style={progTh}>1st</th>
            <th style={progTh}>2nd</th>
            <th style={progTh}>3rd</th>
            <th style={progTh}>4th</th>
            <th style={progTh}>5th</th>
            <th style={progTh}>6th</th>
            <th style={progTh}>7th</th>
            <th style={progTh}>8th</th>
            <th style={progTh}>9th</th>
            <th style={progTh}>Pact</th>
            <th style={progTh}>Features Gained / Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const cum = cumulative[i]
            const sharedSlots = cum.effective > 0 ? SHARED_SLOTS[Math.min(cum.effective, 20) - 1] : undefined
            const pact = cum.warlock > 0 ? PACT_SLOTS[Math.min(cum.warlock, 20) - 1] : undefined
            return (
              <tr key={r.charLevel} style={{ borderTop: '1px solid var(--muted-border)', opacity: r.future ? 0.5 : 1, background: r.future ? 'rgba(148,163,184,0.12)' : undefined }} title={r.future ? 'Planned (future) level' : undefined}>
                <td style={progTd}>{r.charLevel}</td>
                <td style={progTd}>{r.klass.name}</td>
                <td style={progTd}>{r.classLevel}</td>
                <td style={progTd}>+{profBonus(r.charLevel)}</td>
                {hasBarbarian && <td style={progTd}>{r.klass.id === 'barbarian' ? (rageByLevel[r.classLevel - 1] ?? '—') : '—'}</td>}
                {hasBarbarian && <td style={progTd}>{r.klass.id === 'barbarian' ? `+${rageDmgByLevel[r.classLevel - 1] ?? 2}` : '—'}</td>}
                {Array.from({ length: 9 }).map((_, si) => (
                  <td key={si} style={progTd}>{sharedSlots && sharedSlots[si] ? sharedSlots[si] : '—'}</td>
                ))}
                <td style={progTd}>{pact ? `${pact.slots}@${pact.level}` : '—'}</td>
                <td style={{ ...progTd, textAlign: 'left' }}>
                  {r.features.length === 0 ? <span style={{ opacity: 0.5 }}>—</span> : (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 2 }}>
                      {r.features.map(f => (
                        <li key={f.name} style={{ lineHeight: 1.25 }}>
                          <strong>{f.name}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
// ---------------- Class Feature Decision Specs ----------------
interface ClassFeatureDecisionSpecOption { id: string; name: string; text: string }
interface ClassFeatureDecisionSpec { id: string; name: string; level: number; picks: number; options: ClassFeatureDecisionSpecOption[] }

const CLASS_FEATURE_DECISIONS: Record<string, ClassFeatureDecisionSpec[]> = {
  barbarian: [
    // Minimal subset (original first totem choice truncated during refactor)
    {
      id: 'path-feature-6',
      name: 'Path Feature (6th)',
      level: 6,
      picks: 1,
      options: [
        { id: 'berserker-mindless-rage', name: 'Mindless Rage', text: 'While raging you can’t be charmed or frightened.' },
        { id: 'totem-warrior-aspect', name: 'Aspect of the Beast', text: 'Gain passive beast aspect boon (e.g., bear might, eagle eyes).' },
        { id: 'ancestral-guardian-spirit-shield', name: 'Spirit Shield', text: 'Reaction: reduce damage to ally within 30 ft.' },
        { id: 'storm-herald-storm-soul', name: 'Storm Soul', text: 'Elemental resistance and minor aura utility.' },
        { id: 'zealot-fanatic-focus', name: 'Fanatical Focus', text: 'Once per rage reroll a failed saving throw.' },
      ],
    },
    {
      id: 'path-feature-10',
      name: 'Path Feature (10th)',
      level: 10,
      picks: 1,
      options: [
        { id: 'berserker-intimidating-presence', name: 'Intimidating Presence', text: 'Frighten a creature with menacing glare (action, save ends).' },
        { id: 'totem-warrior-spirit-walker', name: 'Spirit Walker', text: 'Cast commune with nature as a ritual to consult spirits.' },
        { id: 'ancestral-guardian-consult-spirits', name: 'Consult the Spirits', text: 'Augury / clairvoyance style spirit guidance (demo placeholder).' },
        { id: 'storm-herald-shielding-storm', name: 'Shielding Storm', text: 'Aura grants elemental resistance to allies.' },
        { id: 'zealot-zealous-presence', name: 'Zealous Presence', text: 'Bonus action: grant allies advantage on attacks & saves briefly.' },
      ],
    },
    {
      id: 'path-feature-14',
      name: 'Path Feature (14th)',
      level: 14,
      picks: 1,
      options: [
        { id: 'berserker-retaliation', name: 'Retaliation', text: 'Use reaction to melee attack a creature that damages you.' },
        { id: 'totem-warrior-totemic-attunement', name: 'Totemic Attunement', text: 'Powerful aura/benefit based on chosen totem.' },
        { id: 'ancestral-guardian-vengeful-ancestors', name: 'Vengeful Ancestors', text: 'Spirit Shield damage reflection.' },
        { id: 'storm-herald-raging-storm', name: 'Raging Storm', text: 'Aura imposes control or damage when enemies end turn in it.' },
        { id: 'zealot-rage-beyond-death', name: 'Rage Beyond Death', text: 'Keep fighting at 0 HP while raging; fall only after rage ends.' },
      ],
    },
  ],
  fighter: [
    {
      id: 'fighting-style',
      name: 'Fighting Style',
      level: 1,
      picks: 1,
      options: [
        { id: 'archery', name: 'Archery', text: '+2 to attack rolls with ranged weapons.' },
        { id: 'defense', name: 'Defense', text: '+1 AC while wearing armor.' },
        { id: 'dueling', name: 'Dueling', text: '+2 damage when wielding a single one‑handed weapon.' },
        { id: 'great-weapon', name: 'Great Weapon Fighting', text: 'Reroll 1s and 2s on damage dice with two‑handed weapons.' },
        { id: 'protection', name: 'Protection', text: 'Use a shield to impose disadvantage on an attack (reaction).' },
        { id: 'two-weapon', name: 'Two‑Weapon Fighting', text: 'Add ability mod to off‑hand damage with two‑weapon fighting.' },
      ],
    },
  ],
  paladin: [
    {
      id: 'fighting-style',
      name: 'Fighting Style',
      level: 2,
      picks: 1,
      options: [
        { id: 'defense', name: 'Defense', text: '+1 AC while wearing armor.' },
        { id: 'dueling', name: 'Dueling', text: '+2 damage when wielding a single one‑handed weapon.' },
        { id: 'great-weapon', name: 'Great Weapon Fighting', text: 'Reroll 1s and 2s on damage dice with two‑handed weapons.' },
        { id: 'protection', name: 'Protection', text: 'Use a shield to impose disadvantage on an attack (reaction).' },
      ],
    },
    {
      id: 'sacred-oath',
      name: 'Sacred Oath',
      level: 3,
      picks: 1,
      options: [
        { id: 'oath-devotion', name: 'Oath of Devotion', text: 'Channel Divinity options: Sacred Weapon, Turn the Unholy.' },
        { id: 'oath-vengeance', name: 'Oath of Vengeance', text: 'Channel Divinity options: Abjure Enemy, Vow of Enmity.' },
  { id: 'oath-ancients', name: 'Oath of the Ancients', text: 'Channel Divinity: Nature’s Wrath, Turn the Faithless.' },
  { id: 'oath-conquest', name: 'Oath of Conquest', text: 'Channel Divinity: Conquering Presence, Guided Strike (flavored for conquest).' },
  { id: 'oath-redemption', name: 'Oath of Redemption', text: 'Channel Divinity: Emissary of Peace, Rebuke the Violent.' },
  { id: 'oath-glory', name: 'Oath of Glory', text: 'Channel Divinity: Peerless Athlete, Inspiring Smite.' },
      ],
    },
  ],
  cleric: [
    {
      id: 'divine-domain',
      name: 'Divine Domain',
      level: 1,
      picks: 1,
      options: [
        { id: 'life-domain', name: 'Life Domain', text: 'Healer‑focused domain; Channel Divinity: Preserve Life.' },
        { id: 'light-domain', name: 'Light Domain', text: 'Radiant/Fire domain; Channel Divinity: Radiance of the Dawn.' },
  { id: 'tempest-domain', name: 'Tempest Domain', text: 'Storm power; Channel Divinity: Destructive Wrath.' },
  { id: 'twilight-domain', name: 'Twilight Domain', text: 'Soothing dusk magic; Channel Divinity: Twilight Sanctuary.' },
  { id: 'peace-domain', name: 'Peace Domain', text: 'Harmony & bonds; Channel Divinity: Balm of Peace.' },
  { id: 'forge-domain', name: 'Forge Domain', text: 'Creation & craft; Channel Divinity: Artisan’s Blessing.' },
      ],
    },
  ],
  druid: [
    {
      id: 'druid-circle',
      name: 'Druid Circle',
      level: 2,
      picks: 1,
      options: [
        { id: 'circle-land', name: 'Circle of the Land', text: 'Bonus spells and recovery tied to the land.' },
        { id: 'circle-moon', name: 'Circle of the Moon', text: 'Combat‑focused Wild Shape improvements.' },
  { id: 'circle-dreams', name: 'Circle of Dreams', text: 'Fey‑touched healing & teleportation (Balm of the Summer Court).' },
  { id: 'circle-shepherd', name: 'Circle of the Shepherd', text: 'Summoning & spirit totems to aid allies.' },
  { id: 'circle-spores', name: 'Circle of Spores', text: 'Fungal decay magic; necrotic Halo of Spores.' },
  { id: 'circle-wildfire', name: 'Circle of Wildfire', text: 'Flame‑and‑regrowth magic with Wildfire Spirit companion.' },
      ],
    },
  ],
  bard: [
    {
      id: 'bard-college',
      name: 'Bard College',
      level: 3,
      picks: 1,
      options: [
        { id: 'college-of-lore', name: 'College of Lore', text: 'Additional magical secrets and skills.' },
        { id: 'college-of-valor', name: 'College of Valor', text: 'Martial training with medium armor, shields, and martial weapons.' },
      ],
    },
    {
      id: 'expertise',
      name: 'Expertise',
      level: 3,
      picks: 2,
      options: [
        // Use the global SKILLS list for options
        // Filled just below using a placeholder; this will be replaced at runtime in UI rendering
        // We'll still provide static entries to satisfy types; UI will read from here.
        { id: 'acrobatics', name: 'Acrobatics', text: 'Double proficiency in Acrobatics.' },
        { id: 'animal', name: 'Animal Handling', text: 'Double proficiency in Animal Handling.' },
        { id: 'arcana', name: 'Arcana', text: 'Double proficiency in Arcana.' },
        { id: 'athletics', name: 'Athletics', text: 'Double proficiency in Athletics.' },
        { id: 'deception', name: 'Deception', text: 'Double proficiency in Deception.' },
        { id: 'history', name: 'History', text: 'Double proficiency in History.' },
        { id: 'insight', name: 'Insight', text: 'Double proficiency in Insight.' },
        { id: 'intimidation', name: 'Intimidation', text: 'Double proficiency in Intimidation.' },
        { id: 'investigation', name: 'Investigation', text: 'Double proficiency in Investigation.' },
        { id: 'medicine', name: 'Medicine', text: 'Double proficiency in Medicine.' },
        { id: 'nature', name: 'Nature', text: 'Double proficiency in Nature.' },
        { id: 'perception', name: 'Perception', text: 'Double proficiency in Perception.' },
        { id: 'performance', name: 'Performance', text: 'Double proficiency in Performance.' },
        { id: 'persuasion', name: 'Persuasion', text: 'Double proficiency in Persuasion.' },
        { id: 'religion', name: 'Religion', text: 'Double proficiency in Religion.' },
        { id: 'sleight', name: 'Sleight of Hand', text: 'Double proficiency in Sleight of Hand.' },
        { id: 'stealth', name: 'Stealth', text: 'Double proficiency in Stealth.' },
        { id: 'survival', name: 'Survival', text: 'Double proficiency in Survival.' },
      ],
    },
  ],
  monk: [
    {
      id: 'monastic-tradition',
      name: 'Monastic Tradition',
      level: 3,
      picks: 1,
      options: [
        { id: 'open-hand', name: 'Way of the Open Hand', text: 'Enhance Flurry of Blows with additional effects.' },
        { id: 'shadow', name: 'Way of Shadow', text: 'Ki‑powered stealth and shadow arts.' },
  { id: 'four-elements', name: 'Way of the Four Elements', text: 'Spend ki to cast elemental disciplines (fire, water, earth, air).' },
  { id: 'kensei', name: 'Way of the Kensei', text: 'Weapon‑master monk; agile martial weapon techniques.' },
  { id: 'mercy', name: 'Way of Mercy', text: 'Mask of compassion; healing and necrotic ki strikes.' },
      ],
    },
  ],
  warlock: [
    {
      id: 'otherworldly-patron',
      name: 'Otherworldly Patron',
      level: 1,
      picks: 1,
      options: [
        { id: 'fiend', name: 'The Fiend', text: 'Dark bargains grant destructive power.' },
        { id: 'archfey', name: 'The Archfey', text: 'Fey patrons grant beguiling and trickster magic.' },
        { id: 'great-old-one', name: 'The Great Old One', text: 'Alien entities gift telepathy and mind‑bending magic.' },
  { id: 'celestial', name: 'The Celestial', text: 'Heavenly patron grants healing and radiant power.' },
  { id: 'hexblade', name: 'The Hexblade', text: 'Shadowy weapon pact; martial & curse features.' },
  { id: 'genie', name: 'The Genie', text: 'Elemental vessel bestows wish‑tinged versatility.' },
      ],
    },
    {
      id: 'eldritch-invocations',
      name: 'Eldritch Invocations',
      level: 2,
      picks: 2,
      options: [
        { id: 'agonizing-blast', name: 'Agonizing Blast', text: 'Add CHA to Eldritch Blast damage (demo note).' },
        { id: 'repelling-blast', name: 'Repelling Blast', text: 'Push creatures hit by Eldritch Blast (demo note).' },
        { id: 'devil-sight', name: 'Devil’s Sight', text: 'See normally in magical darkness (demo note).' },
        { id: 'armor-of-shadows', name: 'Armor of Shadows', text: 'Cast Mage Armor at will (demo note).' },
      ],
    },
  ],
  sorcerer: [
    {
      id: 'sorcerous-origin',
      name: 'Sorcerous Origin',
      level: 1,
      picks: 1,
      options: [
        { id: 'draconic-bloodline', name: 'Draconic Bloodline', text: 'Innate draconic magic strengthens body and spells.' },
        { id: 'wild-magic', name: 'Wild Magic', text: 'Unpredictable surges of magic can occur when casting.' },
  { id: 'divine-soul', name: 'Divine Soul', text: 'Blend of arcane & divine; expanded spell access.' },
  { id: 'shadow-magic', name: 'Shadow Magic', text: 'Shadowfell power grants darkness & survival tricks.' },
  { id: 'storm-sorcery', name: 'Storm Sorcery', text: 'Tempestuous magic manipulates wind & lightning.' },
      ],
    },
    {
      id: 'metamagic',
      name: 'Metamagic',
      level: 3,
      picks: 2,
      options: [
        { id: 'quickened-spell', name: 'Quickened Spell', text: 'Cast a spell as a bonus action (demo note).' },
        { id: 'twinned-spell', name: 'Twinned Spell', text: 'Target a second creature with a single-target spell (demo note).' },
        { id: 'subtle-spell', name: 'Subtle Spell', text: 'Cast without verbal or somatic components (demo note).' },
        { id: 'careful-spell', name: 'Careful Spell', text: 'Protect allies from your spells’ effects (demo note).' },
      ],
    },
  ],
  ranger: [
    {
      id: 'fighting-style',
      name: 'Fighting Style',
      level: 2,
      picks: 1,
      options: [
        { id: 'archery', name: 'Archery', text: '+2 to attack rolls with ranged weapons.' },
        { id: 'defense', name: 'Defense', text: '+1 AC while wearing armor.' },
        { id: 'dueling', name: 'Dueling', text: '+2 damage when wielding a single one‑handed weapon.' },
        { id: 'two-weapon', name: 'Two‑Weapon Fighting', text: 'Add ability mod to off‑hand damage with two‑weapon fighting.' },
      ],
    },
    {
      id: 'ranger-archetype',
      name: 'Ranger Archetype',
      level: 3,
      picks: 1,
      options: [
        { id: 'hunter', name: 'Hunter', text: 'Gain defensive and offensive options tailored to hunting prey.' },
        { id: 'beast-master', name: 'Beast Master', text: 'Bond with a beast companion that fights alongside you.' },
  { id: 'gloom-stalker', name: 'Gloom Stalker', text: 'Ambusher of the dark; excels in the first round and in darkness.' },
  { id: 'horizon-walker', name: 'Horizon Walker', text: 'Planar guardian; detects portals and infuses attacks with force.' },
  { id: 'monster-slayer', name: 'Monster Slayer', text: 'Focus on studying and defeating supernatural foes.' },
  { id: 'swarmkeeper', name: 'Swarmkeeper', text: 'Command a nature spirit swarm for movement, damage, control.' },
      ],
    },
  ],
  rogue: [
    {
      id: 'expertise',
      name: 'Expertise',
      level: 1,
      picks: 2,
      options: [
        { id: 'acrobatics', name: 'Acrobatics', text: 'Double proficiency in Acrobatics.' },
        { id: 'animal', name: 'Animal Handling', text: 'Double proficiency in Animal Handling.' },
        { id: 'arcana', name: 'Arcana', text: 'Double proficiency in Arcana.' },
        { id: 'athletics', name: 'Athletics', text: 'Double proficiency in Athletics.' },
        { id: 'deception', name: 'Deception', text: 'Double proficiency in Deception.' },
        { id: 'history', name: 'History', text: 'Double proficiency in History.' },
        { id: 'insight', name: 'Insight', text: 'Double proficiency in Insight.' },
        { id: 'intimidation', name: 'Intimidation', text: 'Double proficiency in Intimidation.' },
        { id: 'investigation', name: 'Investigation', text: 'Double proficiency in Investigation.' },
        { id: 'medicine', name: 'Medicine', text: 'Double proficiency in Medicine.' },
        { id: 'nature', name: 'Nature', text: 'Double proficiency in Nature.' },
        { id: 'perception', name: 'Perception', text: 'Double proficiency in Perception.' },
        { id: 'performance', name: 'Performance', text: 'Double proficiency in Performance.' },
        { id: 'persuasion', name: 'Persuasion', text: 'Double proficiency in Persuasion.' },
        { id: 'religion', name: 'Religion', text: 'Double proficiency in Religion.' },
        { id: 'sleight', name: 'Sleight of Hand', text: 'Double proficiency in Sleight of Hand.' },
        { id: 'stealth', name: 'Stealth', text: 'Double proficiency in Stealth.' },
        { id: 'survival', name: 'Survival', text: 'Double proficiency in Survival.' },
      ],
    },
    {
      id: 'roguish-archetype',
      name: 'Roguish Archetype',
      level: 3,
      picks: 1,
      options: [
        { id: 'thief', name: 'Thief', text: 'Fast Hands and Second-Story Work (demo note).' },
        { id: 'assassin', name: 'Assassin', text: 'Bonus to disguises/poisons; devastating ambushes (demo note).' },
        { id: 'arcane-trickster', name: 'Arcane Trickster', text: 'Learn minor spells from the wizard list (demo note).' },
  { id: 'swashbuckler', name: 'Swashbuckler', text: 'Flashy duelist; Rakish Audacity initiative & panache.' },
  { id: 'soulknife', name: 'Soulknife', text: 'Psionic blades; telepathy & psychic utility.' },
  { id: 'phantom', name: 'Phantom', text: 'Ghostly tokens; wails & necrotic versatility.' },
      ],
    },
  ],
}

// Filter & adapt class feature decision specs based on current subclass/path selections.
function filteredClassFeatureDecisions(c: { klass: Klass; level?: number; subclass?: Subclass }): ClassFeatureDecisionSpec[] {
  let specs = CLASS_FEATURE_DECISIONS[c.klass.id] || []
  if (c.klass.id === 'barbarian') {
    const path = c.subclass?.id
    specs = specs
      .filter(d => {
        if (['totem-spirit','aspect-of-the-beast','totemic-attunement'].includes(d.id)) return path === 'totem-warrior'
        if (d.id === 'storm-aura-type') return path === 'storm-herald'
        return true
      })
      .map(d => {
        if (path && d.id.startsWith('path-feature-')) {
          const filtered = d.options.filter(o => o.id.startsWith(path))
          if (filtered.length) return { ...d, options: filtered }
        }
        return d
      })
  }
  return specs
}

// Backgrounds moved to ../data/backgrounds

// Spells, metadata, and derived constants moved to ../data/spells

// ---------------- Utilities ----------------

function mod(score: number) { return Math.floor((score - 10) / 2) }
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)) }
function dedupe<T>(arr: T[]): T[] { return Array.from(new Set(arr)) }
function proficiencyBonus(level: number) {
  if (level >= 17) return 6
  if (level >= 13) return 5
  if (level >= 9) return 4
  if (level >= 5) return 3
  return 2
}

// Helper to safely read 'hands' across Equipment union
function getHands(i: Equipment): number {
  return typeof (i as any).hands === 'number' ? ((i as any).hands as number) : 0
}

// ---------------- Permit / Validation Stubs ----------------

type Issue = { level: 'error' | 'warn' | 'hint'; msg: string }

type RuleOpts = { tceActive?: boolean; tceMode?: '2+1' | '1+1+1'; tceAlloc?: Record<AbilityKey, number>; multiclassReqs?: boolean; customOrigin?: boolean; originAlloc?: { plus2?: AbilityKey; plus1?: AbilityKey } }

function validateChoice(state: AppState, opts?: RuleOpts): Issue[] {
  const issues: Issue[] = []
  const hasShield = state.loadout.some((i) => i.type === 'shield')
  const armor = state.loadout.find((i) => i.type === 'armor') as Extract<Equipment, { type: 'armor' }> | undefined
  const handsInUse = state.loadout.reduce((acc, i) => acc + getHands(i), 0)
  const twoHandedWeapon = state.loadout.find((i) => (i as any).tags?.includes('two‑handed'))

  const fa = finalAbility(state.abilities, state.race, state.asi, opts)
  if (twoHandedWeapon && hasShield) {
    issues.push({ level: 'error', msg: 'Two‑handed weapon cannot be used with a shield equipped.' })
  }

  if (armor?.id === 'chain' && (fa.str || 10) < 13) {
    issues.push({ level: 'warn', msg: 'Chain Mail requires STR 13 for optimal use (speed penalties otherwise).' })
  }

  if (state.classes.some((c) => c.klass.id === 'wizard') && armor) {
    issues.push({ level: 'warn', msg: 'Wizards are not proficient with armor by default (toy rule).' })
  }

  if (state.classes.some((c) => c.klass.id === 'barbarian') && !armor) {
    issues.push({ level: 'hint', msg: 'Unarmored Defense active: AC = 10 + DEX + CON. Shield allowed.' })
  }

  if (handsInUse > 2) {
    issues.push({ level: 'error', msg: 'You cannot hold more than two hands worth of equipment.' })
  }

  // Multiclass prerequisites (simplified 5e): enforce if enabled
  if (opts?.multiclassReqs) {
    const reqs: Record<string, Array<{ ab: AbilityKey; min: number }> | ((fa: Record<AbilityKey, number>) => boolean)> = {
      barbarian: [{ ab: 'str', min: 13 }],
      bard: [{ ab: 'cha', min: 13 }],
      cleric: [{ ab: 'wis', min: 13 }],
      druid: [{ ab: 'wis', min: 13 }],
      fighter: (fa) => (fa.str >= 13 || fa.dex >= 13),
      monk: [{ ab: 'dex', min: 13 }, { ab: 'wis', min: 13 }],
      paladin: [{ ab: 'str', min: 13 }, { ab: 'cha', min: 13 }],
      ranger: [{ ab: 'dex', min: 13 }, { ab: 'wis', min: 13 }],
      rogue: [{ ab: 'dex', min: 13 }],
      sorcerer: [{ ab: 'cha', min: 13 }],
      warlock: [{ ab: 'cha', min: 13 }],
      wizard: [{ ab: 'int', min: 13 }],
      bardic: [],
    }
    state.classes.forEach((c, idx) => {
      if (!c?.klass?.id) return
      const r = reqs[c.klass.id]
      if (!r) return
      let ok = true
      if (typeof r === 'function') ok = r(fa)
      else ok = (r as Array<{ ab: AbilityKey; min: number }>).every((rq) => (fa[rq.ab] || 0) >= rq.min)
      if (!ok) {
        issues.push({ level: 'warn', msg: `${c.klass.name} requires ${(() => {
          if (typeof r === 'function') return 'ability prerequisites (Dex or Str 13 for Fighter)'
          const parts = (r as Array<{ ab: AbilityKey; min: number }>).map((rq) => `${rq.ab.toUpperCase()} ${rq.min}+`)
          return parts.join(' & ')
        })()} to multiclass.` })
      }
    })
  }

  return issues
}

// ---------------- Derived & Simulation ----------------

function computeDerived(state: AppState, opts?: RuleOpts) {
  // Use final abilities including race ASIs and allocated ASIs
  const fa = finalAbility(state.abilities, state.race, state.asi, opts)
  const dexMod = mod(fa.dex)
  const conMod = mod(fa.con)
  const strMod = mod(fa.str)

  const armor = state.loadout.find((i) => i.type === 'armor') as Extract<Equipment, { type: 'armor' }> | undefined
  const shield = state.loadout.find((i) => i.type === 'shield') as Extract<Equipment, { type: 'shield' }> | undefined

  const rawTotal = state.classes.reduce((s, c) => s + (c.level || 0), 0)
  const totalLevel = state.classes.length ? rawTotal : 0

  let ac = 10 + dexMod
  if (armor) {
    const dexCap = typeof armor.dexMax === 'number' ? armor.dexMax : Infinity
    ac = armor.ac + clamp(dexMod, -Infinity, dexCap)
  }
  if (!armor && state.classes.some((c) => c.klass.id === 'barbarian')) {
    ac = 10 + dexMod + conMod
  }
  if (shield) ac += shield.ac ?? 2

  // HP: base at first level from the first selected class, then average per-level per class
  let hp = 0
  if (state.classes.length) {
    const firstHitDie = state.classes[0]?.klass.hitDie ?? 8
    hp = firstHitDie + conMod
    state.classes.forEach((c, idx) => {
      const perLevel = Math.max(1, Math.floor(c.klass.hitDie / 2) + 1 + conMod)
      const extraLevels = Math.max(0, (c.level || 0) - (idx === 0 ? 1 : 0))
      hp += extraLevels * perLevel
    })
  }
  // Feat: Tough adds +2 HP per total level
  if ((state.feats || []).includes('tough')) {
    hp += 2 * totalLevel
  }

  const speed = state.race?.speed ?? 30

  const classSubs = state.classes.filter(c => (c.level||0) > 0).flatMap((c) => c.klass.grants?.subactions ?? [])
  const subclassSubs = state.classes.filter(c => (c.level||0) > 0).flatMap((c) => c.subclass?.grants?.subactions ?? [])
  const itemSubs = state.loadout.flatMap((i) => SUBACTIONS_BY_ITEM[(i as any).id] ?? [])
  const subactions = dedupe([...classSubs, ...subclassSubs, ...itemSubs])

  // Barbarian specific derived data: rage uses & damage bonus, path tags
  let rageUses: number | 'unlimited' | null = null
  let rageDamageBonus = 0
  let barbarianLevel = state.classes.filter(c => c.klass.id === 'barbarian').reduce((s,c)=>s+(c.level||0),0)
  if (barbarianLevel > 0) {
    // 5e progression approximation
    // Uses by level: 1-2:2,3-5:3,6-10:4,11-15:5,16-19:6,20:unlimited
    if (barbarianLevel >= 20) rageUses = 'unlimited'
    else if (barbarianLevel >= 16) rageUses = 6
    else if (barbarianLevel >= 11) rageUses = 5
    else if (barbarianLevel >= 6) rageUses = 4
    else if (barbarianLevel >= 3) rageUses = 3
    else rageUses = 2
    // Damage bonus: levels 1-8: +2, 9-15: +3, 16+: +4 (matches feature entries added earlier)
    if (barbarianLevel >= 16) rageDamageBonus = 4
    else if (barbarianLevel >= 9) rageDamageBonus = 3
    else rageDamageBonus = 2
  }

  // Storm Herald hook: if subclass is storm-herald, add aura tag to subactions for visibility
  const hasStormHerald = state.classes.some(c => c.subclass?.id === 'storm-herald')
  if (hasStormHerald && !subactions.includes('Storm Aura')) subactions.push('Storm Aura')

  // Saving throws (union of class save proficiencies)
  const final = finalAbility(state.abilities, state.race, state.asi, opts)
  const prof = proficiencyBonus(totalLevel)
  // Saving throw proficiencies: per 5e core rules only the FIRST class taken grants save proficiencies.
  // Previously this was a union of all class save arrays; that incorrectly awarded extra proficiencies on multiclass dips.
  let saveProfs = state.classes.length ? ([...(state.classes[0].klass.saves || [])] as AbilityKey[]) : []
  if ((state.feats || []).includes('resilient')) {
    const ra = (state as any).featChoices?.resilientAbility as AbilityKey | undefined
    if (ra && !saveProfs.includes(ra)) saveProfs = [...saveProfs, ra]
  }
  const saves: Record<AbilityKey, number> = {
    str: mod(final.str) + (saveProfs.includes('str') ? prof : 0),
    dex: mod(final.dex) + (saveProfs.includes('dex') ? prof : 0),
    con: mod(final.con) + (saveProfs.includes('con') ? prof : 0),
    int: mod(final.int) + (saveProfs.includes('int') ? prof : 0),
    wis: mod(final.wis) + (saveProfs.includes('wis') ? prof : 0),
    cha: mod(final.cha) + (saveProfs.includes('cha') ? prof : 0),
  }

  // Initiative (DEX mod plus Alert +5)
  const initiative = dexMod + ((state.feats || []).includes('alert') ? 5 : 0)
  return { ac, hp, speed, subactions, dexMod, conMod, strMod, saves, saveProfs, totalLevel, initiative, rageUses, rageDamageBonus, barbarianLevel }
}

// simulateReadiness removed

// ---------------- Local UI helpers ----------------

function Labeled(props: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 6, alignContent: 'start', justifyItems: 'start' }}>
      <div style={{ fontSize: 12, color: 'var(--muted-fg, #64748b)', letterSpacing: 0.3, textTransform: 'uppercase' }}>{props.label}</div>
      {props.children}
    </div>
  )
}

function Pill(props: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <span style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--pill-bg, #f1f5f9)', color: 'var(--fg)', fontSize: 12, whiteSpace: 'nowrap', ...(props.style || {}) }}>{props.children}</span>
}

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

// Progress component removed (no longer used)

// ---------------- Simple Card primitives ----------------

function Card(props: { children: React.ReactNode }) {
  return <section style={card}>{props.children}</section>
}
function CardHeader(props: { children: React.ReactNode }) {
  return <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0' }}>{props.children}</div>
}
function CardTitle(props: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 15, ...(props.style || {}) }}>{props.children}</div>
}
function CardContent(props: { children: React.ReactNode }) {
  return <div style={{ padding: 16, display: 'grid', gap: 12 }}>{props.children}</div>
}

// ---------------- Styles ----------------

const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--muted-border)', color: 'var(--fg)', background: 'var(--card-bg)' }
const badgeSecondary: React.CSSProperties = { padding: '2px 8px', borderRadius: 999, background: 'var(--pill-bg, #f1f5f9)', border: '1px solid var(--muted-border)', fontSize: 12, color: 'var(--fg)' }
const badgeOutline: React.CSSProperties = { padding: '2px 8px', borderRadius: 999, border: '1px solid var(--muted-border)', fontSize: 12, color: 'var(--fg)' }
const card: React.CSSProperties = { border: '1px solid var(--muted-border)', borderRadius: 12, background: 'var(--card-bg)', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', position: 'relative' }
const progTh: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', borderLeft: '1px solid var(--muted-border)', whiteSpace: 'nowrap' }
const progTd: React.CSSProperties = { padding: '6px 8px', textAlign: 'center', fontSize: 12, verticalAlign: 'top' }

// Compact prominent stat badge used in Live Summary
function StatBadge({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ minWidth: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.5px', color: '#64748b', marginTop: 2 }}>{label.toUpperCase()}</div>
    </div>
  )
}

// Placeholder maps restored after refactor (simplified). Replace with richer data as needed.
const RACE_TRAIT_SKILLS: Record<string, string[]> = {}
const CLASS_SKILL_CHOICES: Record<string, { picks: number; options: string[] }> = {}

// ---------------- App State ----------------

export type AppState = {
  name: string
  race: Race
  classes: Array<{ klass: Klass; level: number; subclass?: Subclass }>
  abilities: Record<AbilityKey, number>
  loadout: Equipment[]
  background?: Background
  // Minimal spell tracking: known (for bards/wizards demo), prepared (for cleric demo)
  spells?: {
    known: Record<string, string[]> // by classId -> spell ids known (cantrips + 1st in this demo)
    prepared: Record<string, string[]> // by classId -> prepared spell ids (cleric)
  }
  // ASI allocation (+1 steps per ability) and selected feats (each costs 2 points)
  asi?: Record<AbilityKey, number>
  feats?: string[] // feat ids
  featChoices?: Record<string, any>
}

// Branch selector component (placed above Builder to avoid redeclaration on renders)
function BranchProgressionSelector(props: { characterName?: string; currentClasses: Array<{ klass: Klass; level: number; subclass?: Subclass }>; onSelectSequence: (seq: Array<{ klass: Klass; level: number; subclass?: Subclass }>, seqOrder: string[]) => void }) {
  const [branchOptions, setBranchOptions] = React.useState<Array<{ id: string; label: string; seq: string[] }>>([])
  const [selected, setSelected] = React.useState('')

  React.useEffect(() => {
    try {
  const allKeys = Object.keys(localStorage).filter(k => k.startsWith('progressionPlanner.v1:'))
  const activeRootKey = `progressionPlanner.activeRoot.v1:${props.characterName || 'default'}`
  const activeRootId = localStorage.getItem(activeRootKey) || undefined
      const opts: Array<{ id: string; label: string; seq: string[] }> = []
      for (const key of allKeys) {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const parsed = JSON.parse(raw)
        if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) continue
        // Derive branch sequences: each root defines one branch following first-edge chaining similar to planner signature logic
        const nodes: any[] = parsed.nodes
        const edges: any[] = parsed.edges
        const idToNode = new Map(nodes.map(n => [n.id, n]))
        const roots = nodes.filter(n => n.type === 'root')
        roots.forEach(root => {
          const seq: string[] = []
            let cur = root.id
            let guard = 0
            while (cur && guard < 256) {
              guard++
              const outs = edges.filter(e => e.source === cur)
              if (!outs.length) break
              const nextId = outs
                .map(e => ({ e, n: idToNode.get(e.target) }))
                .filter(x => !!x.n)
                .sort((a,b)=> (a.n.position?.y||0)-(b.n.position?.y||0))[0]?.n?.id
              if (!nextId) break
              const nn = idToNode.get(nextId)
              if (nn?.type === 'progressStep' && nn.data?.type === 'class' && nn.data?.className) {
                seq.push(nn.data.className)
              }
              cur = nextId
            }
          if (seq.length) {
            const labelBase = `${root.data?.race || 'Race'} • ${root.data?.background || 'Background'}`
            const optionId = `${key}::${root.id}`
            opts.push({ id: optionId, label: `${labelBase} (${seq.length} lvls)`, seq })
            if (activeRootId && root.id === activeRootId) {
              // Preselect active branch
              setSelected(optionId)
              // If builder still default single level, auto import
              if (props.currentClasses.length === 1 && props.currentClasses[0].level === 1) {
                // apply immediately (aggregate duplicate classes into levels)
                const count: Record<string, { klass: Klass; level: number }> = {}
                seq.forEach(name => {
                  const k = CLASSES.find(c => c.name === name)
                  if (!k) return
                  if (count[k.id]) count[k.id].level += 1; else count[k.id] = { klass: k, level: 1 }
                })
                const out = Object.values(count)
                props.onSelectSequence(out, seq.map(n => (CLASSES.find(c => c.name === n)) ).filter(Boolean).map(k => (k as Klass).id))
              }
            }
          }
        })
      }
      setBranchOptions(opts)
    } catch {}
  }, [props.characterName, props.currentClasses.length])

  const applySeq = (seq: string[]) => {
    // Aggregate duplicates so UI shows one card per class while preserving chronological order separately
    const count: Record<string, { klass: Klass; level: number; subclass?: Subclass }> = {}
    seq.forEach(name => {
      const k = CLASSES.find(c => c.name === name)
      if (!k) return
      if (count[k.id]) count[k.id].level += 1; else count[k.id] = { klass: k, level: 1 }
    })
    const out = Object.values(count)
    const orderIds = seq.map(n => CLASSES.find(c => c.name === n)).filter(Boolean).map(k => (k as Klass).id)
    props.onSelectSequence(out, orderIds)
  }

  if (!branchOptions.length) return null
  return (
    <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <label style={{ fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontWeight: 600 }}>Import Branch Sequence</span>
  <select value={selected} onChange={e => { const v = e.target.value; setSelected(v); const opt = branchOptions.find(o => o.id === v); if (opt) applySeq(opt.seq) }} style={{ fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid #cbd5e1', background: 'white' }}>
          <option value="">(select branch)</option>
          {branchOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <div style={{ fontSize: 11, color: '#64748b' }}>Selecting imports per-level class order. Existing list replaced.</div>
    </div>
  )
}

// ---------------- Main Component ----------------

export function Builder(props: { onCharacterChange?: (state: AppState, derived?: any) => void; importPlan?: any }) {
  const [mode, setMode] = useState<'guided' | 'power'>('power')
  const [name, setName] = useState('New Hero')
  const [race, setRace] = useState<Race>(RACES[0])
  const [classes, setClasses] = useState<Array<{ klass: Klass; level: number; subclass?: Subclass }>>([])
  // Chronological record of each level pick in order pressed (stores class ids in sequence)
  const [classLevelOrder, setClassLevelOrder] = useState<string[]>([])
  // Collapse duplicate single-level class entries (artifact from earlier sequence mode) into aggregated levels
  useEffect(() => {
    if (classes.length <= 1) return
    // Detect artifact: multiple entries of same class all with level 1
    const dupIds = classes.filter(c => c.level === 1).map(c => c.klass.id)
    const freq: Record<string, number> = {}
    dupIds.forEach(id => { freq[id] = (freq[id]||0)+1 })
    const needsCollapse = Object.values(freq).some(n => n > 1)
    if (!needsCollapse) return
    const agg: Record<string, { klass: Klass; level: number; subclass?: Subclass }> = {}
    classes.forEach(c => {
      if (agg[c.klass.id]) agg[c.klass.id].level += c.level
      else agg[c.klass.id] = { ...c }
    })
    const collapsed = Object.values(agg)
    if (collapsed.length !== classes.length) setClasses(collapsed)
  }, [classes])
  const [abilities, setAbilities] = useState<Record<AbilityKey, number>>({ str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 8 })
  const [loadout, setLoadout] = useState<Equipment[]>([EQUIPMENT[0], EQUIPMENT[1]]) // greataxe + shield
  // Background selection
  const [background, setBackground] = useState<Background | undefined>(BACKGROUNDS[0])
  // Skills proficiency & sorting state
  type ProfType = 'none' | 'half' | 'prof' | 'expert'
  const [skillProf, setSkillProf] = useState<Record<string, ProfType>>({})
  const [skillSort, setSkillSort] = useState<'ability' | 'alpha' | 'bonus' | 'proftype'>('ability')
  // Skills list layout mode
  const [skillLayout, setSkillLayout] = useState<'single' | 'double' | 'grid'>('grid')
  // Track sources that grant a skill (bg, race, class:<id>) to avoid orange toggling issues
  const [skillSources, setSkillSources] = useState<Record<string, string[]>>({})
  // Ref mirror to allow snapshot comparisons without creating dependency loops
  const skillSourcesRef = useRef<Record<string, string[]>>({})
  useEffect(() => { skillSourcesRef.current = skillSources }, [skillSources])
  // Skills tab view
  const [skillTab, setSkillTab] = useState<'list' | 'sources'>('list')
  // Pending choices local selections
  const [classSkillPicks, setClassSkillPicks] = useState<Record<string, string[]>>({})
  const [bgReplPicks, setBgReplPicks] = useState<string[]>([])
  const [raceReplPicks, setRaceReplPicks] = useState<string[]>([])
  // Class feature choices (by classId -> decisionId -> optionId or optionId[] for multi-pick)
  const [classFeatureChoices, setClassFeatureChoices] = useState<Record<string, Record<string, string | string[]>>>({})
  // Pending Choices: toggle to display completed items
  const [showCompleted, setShowCompleted] = useState(true)
  const [history, setHistory] = useState<string[]>([])
  const [future, setFuture] = useState<string[]>([])
  // Catalog search/filter state
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogTags, setCatalogTags] = useState<string[]>([])
  const [catalogFiltersOpen, setCatalogFiltersOpen] = useState(false)
  const [catalogSort, setCatalogSort] = useState<'alpha' | 'weight' | 'cost' | 'damageDie' | 'ac' | 'hands'>('alpha')
  const [catalogSortDir, setCatalogSortDir] = useState<'asc' | 'desc'>('asc')
  const [catalogSortOpen, setCatalogSortOpen] = useState(false)
  const [showFullProgression, setShowFullProgression] = useState(false)
  // Chronological sequence from imported Planner plan (includes future levels). Empty when none imported.
  const [importedPlanSequence, setImportedPlanSequence] = useState<Array<{ klass: Klass; subclass?: Subclass; future?: boolean }>>([])
  // When true, temporarily suppress automatic reconciliation of classes from importedPlanSequence (e.g. right after Apply).
  const [suppressPlanReconcile, setSuppressPlanReconcile] = useState(false)
  // Debug flag
  const debugPlanSync = true
  // Reconcile aggregated class levels with present (non-future) entries of imported plan
  useEffect(() => {
    if (!importedPlanSequence.length) return
    if (suppressPlanReconcile) { if (debugPlanSync) console.log('[PlanSync] Reconcile skipped (suppressed)'); return }
  // Build the exact chronological list of present (non-future) classIds from the plan.
  // NOTE: We now explicitly test for future === false so only entries intentionally
  // marked present (or defaulted to false) are counted. This makes the dependency on
  // the future flag clearer and avoids accidental truthy/undefined coercion changes.
  const presentSequence = importedPlanSequence.filter(e => e.future === false).map(e => e.klass.id)
    if (debugPlanSync) console.log('[PlanSync] Reconcile start', { importedPlanSequence: importedPlanSequence.map(e=>({id:e.klass.id,f:e.future})), presentSequence, currentClasses: classes.map(c=>({id:c.klass.id,l:c.level})) })
    // Derive aggregated levels from that sequence.
    const agg: Record<string, number> = {}
    presentSequence.forEach(id => { agg[id] = (agg[id]||0)+1 })
    // Compare to current aggregated classes; update only if different.
    let needUpdate = false
    const newClasses = Object.entries(agg).map(([id, lvl]) => {
      const existing = classes.find(c => c.klass.id === id)
      if (!existing || existing.level !== lvl) needUpdate = true
      return { klass: existing?.klass || CLASSES.find(k => k.id === id)!, level: lvl, subclass: existing?.subclass }
    })
    // Preserve subclass references for classes removed (not present) is unnecessary; they drop out.
    if (newClasses.length !== classes.length) needUpdate = true
    if (needUpdate) {
      if (debugPlanSync) console.log('[PlanSync] Reconcile applying newClasses', newClasses.map(c=>({id:c.klass.id,l:c.level})))
      setClasses(newClasses)
    } else if (debugPlanSync) console.log('[PlanSync] Reconcile no change')
    // Always set classLevelOrder to the exact presentSequence (this preserves plan order precisely).
    setClassLevelOrder(presentSequence)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importedPlanSequence, suppressPlanReconcile])
  const allTags = useMemo(() => dedupe(EQUIPMENT.flatMap((i) => (((i as any).tags || []) as string[]))), [])
  const filteredEquipment = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase()
    const base = EQUIPMENT.filter((eq) => {
      const tags = (((eq as any).tags || []) as string[])
      const nameMatch = q ? eq.name.toLowerCase().includes(q) : true
      const tagsMatch = catalogTags.length ? catalogTags.every((tg) => tags.includes(tg)) : true
      return nameMatch && tagsMatch
    })
    const parseDie = (d: string): number => {
      // crude heuristic: take max of dice average; e.g., 2d6 -> 7 (avg 2*3.5)
      const m = d.match(/(\d+)d(\d+)/)
      if (m) return (parseInt(m[1]) * (parseInt(m[2]) + 1)) / 2
      return 0
    }
    const getKey = (eq: Equipment) => {
      switch (catalogSort) {
        case 'alpha': return eq.name.toLowerCase()
        case 'weight': return (eq as any).weight ?? 0
        case 'cost': return (eq as any).cost ?? 0
        case 'damageDie': return eq.type === 'weapon' ? parseDie((eq as any).dmg || '') : -999
        case 'ac': return eq.type === 'armor' ? (eq as any).ac : eq.type === 'shield' ? ((eq as any).ac || 2) : -999
        case 'hands': return (eq as any).hands ?? 0
        default: return eq.name.toLowerCase()
      }
    }
    const sorted = [...base].sort((a, b) => {
      const ka = getKey(a)
      const kb = getKey(b)
      if (ka < kb) return catalogSortDir === 'asc' ? -1 : 1
      if (ka > kb) return catalogSortDir === 'asc' ? 1 : -1
      return a.name.localeCompare(b.name)
    })
    return sorted
  }, [catalogQuery, catalogTags, catalogSort, catalogSortDir])
  const toggleTag = (tag: string) => setCatalogTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))

  // Spells state (simple per-class storage)
  const [knownSpells, setKnownSpells] = useState<Record<string, string[]>>({})
  const [preparedSpells, setPreparedSpells] = useState<Record<string, string[]>>({})
  // Spells UI filter
  const [spellsQuery, setSpellsQuery] = useState('')
  const [spellFilters, setSpellFilters] = useState<{
    levels: { 0: boolean; 1: boolean; 2: boolean; 3: boolean }
    selectedOnly: boolean
    schools: MagicSchool[]
    damage: DamageType[]
    saves: (AbilityKey | 'none')[]
  }>({
    levels: { 0: true, 1: true, 2: true, 3: true },
    selectedOnly: false,
    schools: [],
    damage: [],
    saves: [],
  })
  const [spellsFiltersOpen, setSpellsFiltersOpen] = useState(false)
  // ASI & Feats state
  const [asiAlloc, setAsiAlloc] = useState<Record<AbilityKey, number>>({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 })
  const [selectedFeats, setSelectedFeats] = useState<string[]>([])
  const [featChoices, setFeatChoices] = useState<Record<string, any>>({})
  // Custom Origin allocation (+2 / +1) when enabled
  const [originAlloc, setOriginAlloc] = useState<{ plus2?: AbilityKey; plus1?: AbilityKey }>({ plus2: 'str', plus1: 'dex' })
  // Global rules (TCE, multiclass requirements) from context
  const {
    tceCustomAsi,
    tceMode,
    tceAlloc,
    multiclassReqs,
  featsEnabled,
  customOrigin,
    setTceCustomAsi,
    setTceMode,
    setTceAlloc,
    resetTceAllocForMode,
  manualHitPoints,
  } = useRules()

  // If feats disabled globally, ensure none remain selected (auto-clean once)
  useEffect(() => {
    if (!featsEnabled && race?.id !== 'human-variant' && selectedFeats.length) setSelectedFeats([])
  }, [featsEnabled, race?.id])
  // If feats are disabled and Variant Human was selected, revert to base Human (variant requires feat option)
  useEffect(() => {
    if (!featsEnabled && race?.id === 'human-variant') {
      const baseHuman = RACES.find(r => r.id === 'human')
      if (baseHuman) setRace(baseHuman)
    }
  }, [featsEnabled, race?.id])
  // Track previous race to detect leaving variant human when feats are disabled
  const prevRaceRef = useRef<string | undefined>(race?.id)
  useEffect(() => {
    const prev = prevRaceRef.current
    if (prev === 'human-variant' && race?.id === 'human' && !featsEnabled) {
      if (selectedFeats.length) {
        setSelectedFeats([])
        setFeatChoices({})
      }
    }
    prevRaceRef.current = race?.id
  }, [race?.id, featsEnabled, selectedFeats.length])
  // Expose minimal state globally for helper functions (e.g., finalAbility) without threading props
  useEffect(() => {
    ;(window as any).builderState = { selectedFeats, featChoices }
  }, [selectedFeats, featChoices])
  // One-time migration for legacy resilient-con feat id
  useEffect(() => {
    setSelectedFeats(prev => prev.map(f => f === 'resilient-con' ? 'resilient' : f))
    setFeatChoices(prev => {
      if ((selectedFeats.includes('resilient-con') || selectedFeats.includes('resilient')) && !prev.resilientAbility) {
        return { ...prev, resilientAbility: 'con' }
      }
      return prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Ensure origin allocation keys differ
  useEffect(() => {
    if (originAlloc.plus1 && originAlloc.plus2 && originAlloc.plus1 === originAlloc.plus2) {
      // Auto adjust plus1 to next ability
      const order: AbilityKey[] = ['str','dex','con','int','wis','cha']
      const next = order.find(k => k !== originAlloc.plus2) || 'dex'
      setOriginAlloc(o => ({ ...o, plus1: next }))
    }
  }, [originAlloc.plus1, originAlloc.plus2])
  // Persistence (autosave/restore)
  const BUILDER_STORAGE_KEY = 'characterBuilder.v1'
  const restoredRef = useRef(false)
  // Import: file input ref
  const importInputRef = useRef<HTMLInputElement | null>(null)

  // Passive Planner import prompt state
  const [pendingPassivePlan, setPendingPassivePlan] = useState<null | { plan: any; diff: Array<{ key: string; label: string; before?: string; after?: string }>; mapping: any; ts: number }>(null)
  const [lastImportTsHandled, setLastImportTsHandled] = useState<number | null>(null)

  const state: AppState = {
    name,
    race,
    classes,
    abilities,
    loadout,
    background,
    spells: { known: knownSpells, prepared: preparedSpells },
    asi: asiAlloc,
  feats: selectedFeats,
  featChoices,
  }
  const derived = useMemo(() => computeDerived(state, { tceActive: tceCustomAsi, tceMode, tceAlloc }), [state, tceCustomAsi, tceMode, JSON.stringify(tceAlloc)])
  // Manual HP lifted state
  const [hpMethod, setHpMethod] = useState<'fixed' | 'rollEach' | 'maxFirstFixed' | 'maxEach' | 'manual'>('maxFirstFixed')
  const [hpRolls, setHpRolls] = useState<Record<string, number[]>>({})
  const [hpManualTotal, setHpManualTotal] = useState<number | ''>('')
  const computedManualHp = useMemo(() => {
    if (!manualHitPoints) return null
    if (hpMethod === 'manual') return typeof hpManualTotal === 'number' ? hpManualTotal : 0
    const CON_MOD = mod(abilities.con || 10)
    let total = 0
    classes.forEach(c => {
      const hd = c.klass.hitDie
      if (hpMethod === 'maxEach') {
        total += (hd + CON_MOD) * c.level
      } else if (hpMethod === 'maxFirstFixed') {
        const extra = Math.max(0, c.level - 1)
        const avg = Math.ceil((hd / 2) + 0.5)
        total += hd + CON_MOD + extra * (avg + CON_MOD)
      } else if (hpMethod === 'fixed') {
        const avg = Math.ceil((hd / 2) + 0.5)
        total += c.level * (avg + CON_MOD)
      } else if (hpMethod === 'rollEach') {
        const arr = hpRolls[c.klass.id] || []
        total += Array.from({ length: c.level }, (_, i) => arr[i] ?? 0).reduce((s, v) => s + v + CON_MOD, 0)
      }
    })
    return Math.max(1, total)
  }, [manualHitPoints, hpMethod, JSON.stringify(hpRolls), hpManualTotal, abilities.con, classes])
  const issues = useMemo(() => validateChoice(state, { tceActive: tceCustomAsi, tceMode, tceAlloc, multiclassReqs }), [state, tceCustomAsi, multiclassReqs, tceMode, JSON.stringify(tceAlloc)])
  // Removed toy combat readiness computation

  // Detect pending class feature decisions (e.g., subclass unlocked but not chosen)
  const pendingSubclassChoices = useMemo(() => {
    return classes.filter((c) => {
      const subs = c.klass.subclasses || []
      if (!subs.length) return false
      const available = subs.filter((s) => c.level >= s.unlockLevel)
      return available.length > 0 && !c.subclass
    })
  }, [classes])
  function setSubclassChoice(klassId: string, s: Subclass) {
    setClasses((cs) => cs.map((c) => (c.klass.id === klassId ? { ...c, subclass: s } : c)))
  }

  // Sync subclass when a decision picks a subclass-like choice (e.g., Cleric Domain, Bard College)
  useEffect(() => {
    setClasses((cs) => {
      let changed = false
      const out = cs.map((c) => {
  const specs = filteredClassFeatureDecisions(c)
        const sublike = specs.find((d) => (
          d.name === 'Divine Domain' ||
          d.name === 'Bard College' ||
          d.name === 'Otherworldly Patron' ||
          d.name === 'Sorcerous Origin' ||
          d.name === 'Ranger Archetype' ||
          d.name === 'Roguish Archetype'
        ))
        if (!sublike || (c.level || 0) < sublike.level) return c
        const raw = classFeatureChoices[c.klass.id]?.[sublike.id]
        const chosenId = Array.isArray(raw) ? raw[0] : raw
        if (!chosenId) return c
        const target = (c.klass.subclasses || []).find((s) => s.id === chosenId)
        if (target && (!c.subclass || c.subclass.id !== target.id)) {
          changed = true
          return { ...c, subclass: target }
        }
        return c
      })
      return changed ? out : cs
    })
  }, [classFeatureChoices])

  // Auto-apply background/race granted skills. Excludes skillSources from deps to avoid feedback loop.
  useEffect(() => {
    const bgSkills = background?.skills ?? []
    const raceSkills = (race?.traits || []).flatMap((t) => RACE_TRAIT_SKILLS[t.id] || [])
    const desiredBg = new Set(bgSkills)
    const desiredRace = new Set(raceSkills)
    setSkillSources(prev => {
      let changed = false
      const out: Record<string, string[]> = {}
      // Filter stale bg/race grants
      Object.entries(prev).forEach(([skill, sources]) => {
        const filtered = sources.filter(src => {
          if (src === 'bg') return desiredBg.has(skill)
          if (src === 'race') return desiredRace.has(skill)
          return true
        })
        if (filtered.length) out[skill] = filtered
        if (filtered.length !== sources.length) changed = true
      })
      // Add missing bg/race sources
      bgSkills.forEach(s => {
        const curr = out[s] || []
        if (!curr.includes('bg')) { out[s] = [...curr, 'bg']; changed = true }
      })
      raceSkills.forEach(s => {
        const curr = out[s] || []
        if (!curr.includes('race')) { out[s] = [...curr, 'race']; changed = true }
      })
      if (!changed) return prev
      return out
    })
    // Proficiency sync (only add; removal handled when sources drop)
    setSkillProf(prev => {
      const out: Record<string, ProfType> = { ...prev }
      bgSkills.concat(raceSkills).forEach(skill => {
        if (skillSourcesRef.current[skill]) {
          out[skill] = prev[skill] && prev[skill] !== 'none' ? prev[skill] : 'prof'
        }
      })
      return out
    })
  }, [background, race])

  // Feat: Prodigy integration into skillSources graph (acts like its own source)
  useEffect(() => {
    if (!selectedFeats.includes('prodigy')) {
      // Remove stale prodigy source if feat deselected
      setSkillSources(prev => {
        let changed = false
        const out: Record<string,string[]> = {}
        Object.entries(prev).forEach(([skill, sources]) => {
          const filtered = sources.filter(s => s !== 'feat:prodigy')
          if (filtered.length !== sources.length) changed = true
          if (filtered.length) out[skill] = filtered
        })
        return changed ? out : prev
      })
      return
    }
    const sk = featChoices.prodigySkill
    setSkillSources(prev => {
      let changed = false
      const out: Record<string,string[]> = {}
      // First remove existing feat:prodigy from all skills
      Object.entries(prev).forEach(([skill, sources]) => {
        const filtered = sources.filter(s => s !== 'feat:prodigy')
        if (filtered.length !== sources.length) changed = true
        if (filtered.length) out[skill] = filtered
      })
      if (sk) {
        const curr = out[sk] || []
        if (!curr.includes('feat:prodigy')) {
          out[sk] = [...curr, 'feat:prodigy']
          changed = true
        }
      }
      return changed ? out : prev
    })
  }, [selectedFeats, featChoices.prodigySkill])

  // Feat: Skilled (up to 3 skill proficiencies) — represented as single source 'feat:skilled'
  useEffect(() => {
    if (!selectedFeats.includes('skilled')) {
      // remove any feat:skilled sources
      setSkillSources(prev => {
        let changed = false
        const out: Record<string,string[]> = {}
        Object.entries(prev).forEach(([skill, sources]) => {
          // remove legacy numbered markers feat:skilled0/1/2 as well
          const filtered = sources.filter(s => !s.startsWith('feat:skilled'))
            if (filtered.length !== sources.length) changed = true
            if (filtered.length) out[skill] = filtered
        })
        return changed ? out : prev
      })
      return
    }
    const picks: string[] = (featChoices.skilledSkills || []).slice(0,3)
    setSkillSources(prev => {
      let changed = false
      const out: Record<string,string[]> = {}
      // strip old skilled markers
      Object.entries(prev).forEach(([skill, sources]) => {
        const filtered = sources.filter(s => !s.startsWith('feat:skilled'))
        if (filtered.length !== sources.length) changed = true
        if (filtered.length) out[skill] = filtered
      })
      picks.forEach((sid) => {
        const curr = out[sid] || []
        if (!curr.includes('feat:skilled')) {
          out[sid] = [...curr, 'feat:skilled']
          changed = true
        }
      })
      return changed ? out : prev
    })
  }, [selectedFeats, JSON.stringify(featChoices.skilledSkills)])

  // Helpers to add/remove sources with proficiency updates
  function addSkillSource(skillId: string, source: string) {
    setSkillSources((prev) => {
      const curr = prev[skillId] || []
      if (curr.includes(source)) return prev
      const out = { ...prev, [skillId]: [...curr, source] }
      return out
    })
    setSkillProf((prev) => ({ ...prev, [skillId]: prev[skillId] && prev[skillId] !== 'none' ? prev[skillId] : 'prof' }))
  }
  function removeSkillSource(skillId: string, source: string) {
    let willRemain = true
    setSkillSources((prev) => {
      const curr = prev[skillId] || []
      if (!curr.includes(source)) return prev
      const remaining = curr.filter((s) => s !== source)
      willRemain = remaining.length > 0
      const out = { ...prev }
      if (remaining.length) out[skillId] = remaining
      else delete out[skillId]
      return out
    })
    setSkillProf((prev) => {
      // If there are no sources left for this skill, drop proficiency entry
      if (willRemain) return prev
      const out = { ...prev }
      delete out[skillId]
      return out
    })
  }

  // Notify parent when character changes
  useEffect(() => {
    props.onCharacterChange?.(state, derived)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, race, JSON.stringify(classes), JSON.stringify(abilities), JSON.stringify(loadout), JSON.stringify(background), derived])

  // Restore from localStorage on first mount
  useEffect(() => {
    if (restoredRef.current) return
    try {
      const raw = localStorage.getItem(BUILDER_STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved && typeof saved === 'object') {
          if (typeof saved.mode === 'string') setMode(saved.mode === 'guided' ? 'guided' : 'power')
          if (typeof saved.name === 'string') setName(saved.name)
          if (typeof saved.raceId === 'string') {
            const r = RACES.find((x) => x.id === saved.raceId)
            if (r) setRace(r)
          }
          if (typeof saved.backgroundId === 'string') {
            const bg = BACKGROUNDS.find((b) => b.id === saved.backgroundId)
            setBackground(bg)
          }
          if (saved.classes && Array.isArray(saved.classes)) {
            const next: Array<{ klass: Klass; level: number; subclass?: Subclass }> = []
            ;(saved.classes as any[]).forEach((c) => {
              const k = CLASSES.find((x) => x.id === c.klassId)
              if (!k) return
              const level = Math.max(1, Math.min(20, Number(c.level) || 1))
              let sc: Subclass | undefined
              if (c.subclassId && k.subclasses) sc = k.subclasses.find((s) => s.id === c.subclassId)
              next.push({ klass: k, level, subclass: sc })
            })
            if (next.length) setClasses(next)
          }
          if (saved.abilities && typeof saved.abilities === 'object') setAbilities(saved.abilities)
          if (saved.loadoutIds && Array.isArray(saved.loadoutIds)) {
            const items: Equipment[] = []
            ;(saved.loadoutIds as string[]).forEach((id) => {
              const it = (EQUIPMENT as any[]).find((eq) => (eq as any).id === id)
              if (it) items.push(it as any)
            })
            setLoadout(items)
          }
          if (saved.skillProf && typeof saved.skillProf === 'object') setSkillProf(saved.skillProf)
          if (saved.skillSources && typeof saved.skillSources === 'object') setSkillSources(saved.skillSources)
          if (typeof saved.skillTab === 'string') setSkillTab(saved.skillTab === 'sources' ? 'sources' : 'list')
          if (typeof saved.skillLayout === 'string') setSkillLayout(saved.skillLayout)
          if (typeof saved.skillSort === 'string') setSkillSort(saved.skillSort)
          if (saved.classSkillPicks && typeof saved.classSkillPicks === 'object') setClassSkillPicks(saved.classSkillPicks)
          if (Array.isArray(saved.bgReplPicks)) setBgReplPicks(saved.bgReplPicks)
          if (Array.isArray(saved.raceReplPicks)) setRaceReplPicks(saved.raceReplPicks)
          if (saved.classFeatureChoices && typeof saved.classFeatureChoices === 'object') setClassFeatureChoices(saved.classFeatureChoices)
          if (saved.knownSpells && typeof saved.knownSpells === 'object') setKnownSpells(saved.knownSpells)
          if (saved.preparedSpells && typeof saved.preparedSpells === 'object') setPreparedSpells(saved.preparedSpells)
          if (saved.asiAlloc && typeof saved.asiAlloc === 'object') setAsiAlloc(saved.asiAlloc)
          if (Array.isArray(saved.selectedFeats)) setSelectedFeats(saved.selectedFeats)
          if (saved.featChoices && typeof saved.featChoices === 'object') setFeatChoices(saved.featChoices)
          if (saved.originAlloc && typeof saved.originAlloc === 'object') setOriginAlloc(saved.originAlloc)
          // Rules restore (now global) - only TCE data applied; multiclass toggle handled in drawer
          if (saved.rules && typeof saved.rules === 'object') {
            const emptyAlloc: Record<AbilityKey, number> = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
            if (typeof saved.rules.tceCustomAsi === 'boolean') setTceCustomAsi(saved.rules.tceCustomAsi)
            if (saved.rules.tceMode === '1+1+1' || saved.rules.tceMode === '2+1') setTceMode(saved.rules.tceMode)
            if (saved.rules.tceAlloc && typeof saved.rules.tceAlloc === 'object') setTceAlloc({ ...emptyAlloc, ...saved.rules.tceAlloc })
          }
          if (typeof saved.showCompleted === 'boolean') setShowCompleted(saved.showCompleted)
          if (Array.isArray(saved.catalogTags)) setCatalogTags(saved.catalogTags)
          if (typeof saved.catalogQuery === 'string') setCatalogQuery(saved.catalogQuery)
          if (typeof saved.catalogFiltersOpen === 'boolean') setCatalogFiltersOpen(saved.catalogFiltersOpen)
          if (saved.spellFilters && typeof saved.spellFilters === 'object') setSpellFilters(saved.spellFilters)
          restoredRef.current = true
        }
      }
    } catch {}
  }, [])
  
  // Persist to localStorage (separate effect)
  useEffect(() => {
    try {
      const payload = {
        mode,
        name,
        raceId: race?.id,
        backgroundId: background?.id,
        classes: classes.map(c => ({ klassId: c.klass.id, level: c.level, subclassId: c.subclass?.id })),
        abilities,
        loadoutIds: loadout.map(i => i.id),
        // Skills
        skillProf,
        skillSources,
        skillTab,
        skillLayout,
        skillSort,
        classSkillPicks,
        bgReplPicks,
        raceReplPicks,
        classFeatureChoices,
        // Spells
        knownSpells,
        preparedSpells,
        // ASI/Feats
        asiAlloc,
        selectedFeats,
        originAlloc,
        featChoices,
        // Rules (subset)
        rules: { tceCustomAsi, multiclassReqs, tceMode, tceAlloc },
        // Minor UI prefs
        showCompleted,
        catalogQuery,
        catalogTags,
        catalogFiltersOpen,
        spellFilters,
        _ts: Date.now(),
      }
      localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(payload))
    } catch {}
  }, [
    mode,
    name,
    race,
    background,
    JSON.stringify(classes),
    JSON.stringify(abilities),
    JSON.stringify(loadout),
    JSON.stringify(skillProf),
    JSON.stringify(skillSources),
    skillTab,
    skillLayout,
    skillSort,
    JSON.stringify(classSkillPicks),
    JSON.stringify(bgReplPicks),
    JSON.stringify(raceReplPicks),
    JSON.stringify(classFeatureChoices),
    JSON.stringify(knownSpells),
    JSON.stringify(preparedSpells),
    JSON.stringify(asiAlloc),
    JSON.stringify(selectedFeats),
    JSON.stringify(originAlloc),
    JSON.stringify(featChoices),
    tceMode,
    JSON.stringify(tceAlloc),
    showCompleted,
    catalogQuery,
    JSON.stringify(catalogTags),
    catalogFiltersOpen,
    JSON.stringify(spellFilters),
  ])

  // -------- Export / Import helpers --------
  function buildExportPayload() {
    return {
      $schema: 'ttrpg-builder.v1',
      version: 1,
      name,
      mode,
      raceId: race?.id,
      backgroundId: background?.id || null,
      classes: classes.map((c) => ({ klassId: c.klass.id, level: c.level, subclassId: c.subclass?.id || null })),
      abilities,
      loadoutIds: loadout.map((i: any) => i.id),
      // Skills & choices
      skillProf,
      skillSources,
      classSkillPicks,
      bgReplPicks,
      raceReplPicks,
      classFeatureChoices,
      // Spells
      knownSpells,
      preparedSpells,
      // ASI/Feats
      asiAlloc,
  selectedFeats,
  originAlloc,
      featChoices,
  // Rules
  rules: { tceCustomAsi, multiclassReqs, tceMode, tceAlloc },
      // Minor UI prefs that are useful if sharing
      skillTab,
      skillLayout,
      skillSort,
      _exportedAt: new Date().toISOString(),
    }
  }

  function exportToFile() {
    try {
      const payload = buildExportPayload()
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safe = (name || 'character').replace(/[^a-z0-9\-_. ]/gi, '_')
      a.href = url
      a.download = `${safe}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      try { console.error(e) } catch {}
      window.alert('Failed to export JSON.')
    }
  }

  function importFromObject(obj: any) {
    if (!obj || typeof obj !== 'object') throw new Error('Invalid JSON object')
    // Support both our export format and a minimal schema
    const get = (k: string, def?: any) => (obj as any)[k] !== undefined ? (obj as any)[k] : def
    // Snapshot for undo
    snapshot()
    try {
      // Mode & name
      if (typeof get('mode') === 'string') setMode(get('mode') === 'guided' ? 'guided' : 'power')
      if (typeof get('name') === 'string') setName(get('name'))

      // Race / Background (accept id or name fields)
      const raceId: string | undefined = get('raceId') || undefined
      const raceName: string | undefined = get('raceName') || get('race') || undefined
      if (raceId || raceName) {
        const r = raceId ? RACES.find((x) => x.id === raceId) : RACES.find((x) => x.name.toLowerCase() === String(raceName).toLowerCase())
        if (r) setRace(r)
      }
      const bgId: string | null | undefined = get('backgroundId', null)
      const bgName: string | undefined = get('backgroundName') || get('background') || undefined
      if (bgId !== undefined || bgName) {
        const bg = bgId ? BACKGROUNDS.find((b) => b.id === bgId) : (bgName ? BACKGROUNDS.find((b) => b.name.toLowerCase() === String(bgName).toLowerCase()) : undefined)
        setBackground(bg)
      }

      // Classes: accept our exported shape or alternate with names
      const impClasses: any[] = Array.isArray(get('classes')) ? get('classes') : []
      if (impClasses.length) {
        const next: Array<{ klass: Klass; level: number; subclass?: Subclass }> = []
        ;(impClasses as any[]).forEach((c) => {
          const klassId: string | undefined = c.klassId || c.classId || undefined
          const klassName: string | undefined = c.klassName || c.className || c.klass || undefined
          const k = klassId ? CLASSES.find((x) => x.id === klassId) : (klassName ? CLASSES.find((x) => x.name.toLowerCase() === String(klassName).toLowerCase()) : undefined)
          if (!k) return
          const level = Math.max(1, Math.min(20, Number(c.level) || 1))
          let sc: Subclass | undefined
          const subclassId: string | undefined = c.subclassId
          const subclassName: string | undefined = c.subclassName || c.subclass
          if (k.subclasses && (subclassId || subclassName)) {
            sc = subclassId ? k.subclasses.find((s) => s.id === subclassId) : k.subclasses.find((s) => s.name.toLowerCase() === String(subclassName).toLowerCase())
          }
          next.push({ klass: k, level, subclass: sc })
        })
        if (next.length) setClasses(next)
      }

      // Abilities
      const impAbilities = get('abilities')
      if (impAbilities && typeof impAbilities === 'object') setAbilities(impAbilities)

      // Loadout: accept ids or names
      const loadoutIds: string[] | undefined = get('loadoutIds')
      const loadoutNames: string[] | undefined = get('loadoutNames') || get('loadout')
      if (Array.isArray(loadoutIds) || Array.isArray(loadoutNames)) {
        const items: Equipment[] = []
        const source = Array.isArray(loadoutIds) ? loadoutIds : (Array.isArray(loadoutNames) ? loadoutNames : [])
        source.forEach((val: any) => {
          const it = (EQUIPMENT as any[]).find((eq) => (eq as any).id === val) || (EQUIPMENT as any[]).find((eq) => String((eq as any).name).toLowerCase() === String(val).toLowerCase())
          if (it) items.push(it as any)
        })
        if (items.length) setLoadout(items)
      }

      // Skills & sources
      const impSkillProf = get('skillProf')
      if (impSkillProf && typeof impSkillProf === 'object') setSkillProf(impSkillProf)
      const impSkillSources = get('skillSources')
      if (impSkillSources && typeof impSkillSources === 'object') setSkillSources(impSkillSources)
      const impClassSkillPicks = get('classSkillPicks')
      if (impClassSkillPicks && typeof impClassSkillPicks === 'object') setClassSkillPicks(impClassSkillPicks)
      const impBgRepl = get('bgReplPicks')
      if (Array.isArray(impBgRepl)) setBgReplPicks(impBgRepl)
      const impRaceRepl = get('raceReplPicks')
      if (Array.isArray(impRaceRepl)) setRaceReplPicks(impRaceRepl)

      // Class feature decisions
      const impCfc = get('classFeatureChoices')
      if (impCfc && typeof impCfc === 'object') setClassFeatureChoices(impCfc)

      // Spells (accept knownSpells/preparedSpells or spells.known/prepared)
      const impKnown = get('knownSpells') || (obj.spells && obj.spells.known)
      if (impKnown && typeof impKnown === 'object') setKnownSpells(impKnown)
      const impPrepared = get('preparedSpells') || (obj.spells && obj.spells.prepared)
      if (impPrepared && typeof impPrepared === 'object') setPreparedSpells(impPrepared)

      // ASI/Feats
      const impAsi = get('asiAlloc') || get('asi')
      if (impAsi && typeof impAsi === 'object') setAsiAlloc(impAsi)
      const impFeats: any = get('selectedFeats') || get('feats')
      if (Array.isArray(impFeats)) {
        const mapped = (impFeats as any[]).map((f) => {
          // accept id or name
          const m = FEATS.find((x) => x.id === f || x.name.toLowerCase() === String(f).toLowerCase())
          return m ? m.id : String(f)
        })
        setSelectedFeats(mapped)
      }
      const impFeatChoices = get('featChoices')
      if (impFeatChoices && typeof impFeatChoices === 'object') setFeatChoices(impFeatChoices)

      // UI prefs (optional)
      if (typeof get('skillTab') === 'string') setSkillTab(get('skillTab') === 'sources' ? 'sources' : 'list')
      if (typeof get('skillLayout') === 'string') setSkillLayout(get('skillLayout'))
      if (typeof get('skillSort') === 'string') setSkillSort(get('skillSort'))
      // Rules (optional)
      const impRules = get('rules')
      if (impRules && typeof impRules === 'object') {
        const emptyAlloc: Record<AbilityKey, number> = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
        if (typeof impRules.tceCustomAsi === 'boolean') setTceCustomAsi(impRules.tceCustomAsi)
        if (impRules.tceMode === '1+1+1' || impRules.tceMode === '2+1') setTceMode(impRules.tceMode)
        if (impRules.tceAlloc && typeof impRules.tceAlloc === 'object') setTceAlloc({ ...emptyAlloc, ...impRules.tceAlloc })
      }
    } catch (e) {
      throw e
    }
  }

  function onImportFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const txt = String(reader.result || '')
        const obj = JSON.parse(txt)
        importFromObject(obj)
        window.alert('Character imported.')
      } catch (err: any) {
        try { console.error(err) } catch {}
        window.alert('Failed to import JSON. Please ensure the file matches the builder schema.')
      } finally {
        try { if (importInputRef.current) importInputRef.current.value = '' } catch {}
      }
    }
    reader.onerror = () => {
      window.alert('Failed to read file.')
      try { if (importInputRef.current) importInputRef.current.value = '' } catch {}
    }
    reader.readAsText(file)
  }

  // Helper: build a mapping from plan to next state pieces
  function mapPlanToState(plan: any) {
    // Map race/background by name
    const nextRace = RACES.find((r) => r.name === plan.race) || race
    const nextBg = BACKGROUNDS.find((b) => b.name === plan.background) || background

    // Level entries from plan (may include future flag)
    const levelEntries: Array<{ level: number; className?: string; feats?: string[]; featureChoices?: any[]; future?: boolean; subclass?: string }> = Array.isArray(plan.levels) ? plan.levels : []

    // Build chronological per-level sequence including future markers (for display only)
    const chronological: Array<{ klass: Klass; subclass?: Subclass; future?: boolean }> = levelEntries
      .filter(lv => lv.className)
      .map(lv => {
        const k = CLASSES.find(c => c.name === lv.className!)
        if (!k) return null
        const sc = lv.subclass ? k.subclasses?.find(s => s.name === lv.subclass) : undefined
        return { klass: k, subclass: sc, future: !!lv.future }
      })
      .filter(Boolean) as Array<{ klass: Klass; subclass?: Subclass; future?: boolean }>

    // Aggregate realized (non-future) levels into class counts
    const classCounts: Record<string, number> = {}
  // Only treat entries explicitly flagged as present (future === false) as realized levels.
  levelEntries.filter(lv => lv.future === false).forEach((lv) => {
      const nm = String(lv.className || '').trim()
      if (!nm) return
      classCounts[nm] = (classCounts[nm] || 0) + 1
    })
    const nextClasses: Array<{ klass: Klass; level: number; subclass?: Subclass }> = []
    Object.entries(classCounts).forEach(([nm, lvl]) => {
      const k = CLASSES.find((c) => c.name === nm)
      if (k) nextClasses.push({ klass: k, level: lvl })
    })
  // Allow no classes if plan provided no realized levels

    // Collect feats only from realized levels
    const nextFeats: string[] = []
    levelEntries.filter(lv => !lv.future).forEach((lv) => {
      const arr: string[] = Array.isArray(lv.feats) ? lv.feats : []
      arr.forEach((f) => {
        if (f && typeof f === 'string') {
          const match = FEATS.find((x) => x.id === f || x.name.toLowerCase() === f.toLowerCase())
          nextFeats.push(match ? match.id : f)
        }
      })
    })

    // Map bundle feature choices into classFeatureChoices and skill picks
    const nextCfc: Record<string, Record<string, string | string[]>> = {}
    const nextClassSkillPicks: Record<string, string[]> = {}
    const sorted = levelEntries.slice().sort((a, b) => (Number(a.level) || 0) - (Number(b.level) || 0))
    sorted.forEach((lv: any) => {
      const fcs = Array.isArray(lv.featureChoices) ? lv.featureChoices : []
      if (!fcs.length) return
      const klass = CLASSES.find((c) => c.name === lv.className)
      const klassId = klass?.id
      fcs.forEach((ch: any) => {
        if (!ch || !klassId) return
        if (ch.kind === 'fighting-style') {
          const cls = classes.find(c => c.klass.id === klassId) || { klass: { id: klassId } as any }
          const specs = filteredClassFeatureDecisions(cls)
          const dec = specs.find((d) => d.id === 'fighting-style')
          const optName = String(ch.style || '').trim().toLowerCase()
          if (dec && optName) {
            const opt = dec.options.find((o) => o.id === optName || o.name.toLowerCase() === optName)
            if (opt) {
              const prev = nextCfc[klassId]?.[dec.id]
              if ((dec.picks || 1) > 1) {
                const arr = Array.isArray(prev) ? (prev as string[]) : prev ? [prev as string] : []
                const out = Array.from(new Set([...arr, opt.id]))
                nextCfc[klassId] = { ...(nextCfc[klassId] || {}), [dec.id]: out }
              } else {
                nextCfc[klassId] = { ...(nextCfc[klassId] || {}), [dec.id]: opt.id }
              }
            }
          }
        } else if (ch.kind === 'subclass') {
          const cls2 = classes.find(c => c.klass.id === klassId) || { klass: { id: klassId } as any }
          const specs = filteredClassFeatureDecisions(cls2)
          const subDecision = specs.find((d) => ['sacred-oath','divine-domain','bard-college','monastic-tradition','druid-circle','roguish-archetype','ranger-archetype','sorcerous-origin','otherworldly-patron'].includes(d.id))
          const inp = String(ch.subclass || '').trim().toLowerCase()
          if (subDecision && inp) {
            const opt = subDecision.options.find((o) => o.id === inp || o.name.toLowerCase() === inp || o.name.toLowerCase().includes(inp))
            if (opt) {
              nextCfc[klassId] = { ...(nextCfc[klassId] || {}), [subDecision.id]: opt.id }
            }
          }
        } else if (ch.kind === 'skill-proficiency') {
          const names: string[] = Array.isArray(ch.skills) ? ch.skills : []
          const arr = nextClassSkillPicks[klassId] || []
          names.forEach((nm) => {
            const skill = SKILLS.find((s) => s.name.toLowerCase() === String(nm).toLowerCase() || s.id === String(nm).toLowerCase())
            if (skill && !arr.includes(skill.id)) arr.push(skill.id)
          })
          nextClassSkillPicks[klassId] = arr
        }
      })
  })

  const result = { nextRace, nextBg, nextClasses, nextFeats, nextCfc, nextClassSkillPicks, chronological }
  if (debugPlanSync) console.log('[PlanSync] mapPlanToState result', { nextClasses: result.nextClasses.map(c=>({id:c.klass.id,l:c.level})), chronological: result.chronological.map(c=>({id:c.klass.id,f:c.future})) })
  return result
  }

  function summarizeClassCounts(list: Array<{ klass: Klass; level: number }>) {
    const counts: Record<string, number> = {}
    list.forEach((c) => { counts[c.klass.name] = (counts[c.klass.name] || 0) + (c.level || 0) })
    const parts = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])).map(([nm, lv]) => `${nm} x${lv}`)
    return parts.join(', ') || '(none)'
  }

  function buildDiff(mapping: any) {
    const diffs: Array<{ key: string; label: string; before?: string; after?: string }> = []
    if (mapping.nextRace?.id !== race?.id) diffs.push({ key: 'race', label: 'Race', before: race?.name || '(none)', after: mapping.nextRace?.name || '(none)' })
    if ((mapping.nextBg?.id || null) !== (background?.id || null)) diffs.push({ key: 'background', label: 'Background', before: background?.name || '(none)', after: mapping.nextBg?.name || '(none)' })
    const currClassesSummary = summarizeClassCounts(classes)
    const nextClassesSummary = summarizeClassCounts(mapping.nextClasses)
    if (currClassesSummary !== nextClassesSummary) diffs.push({ key: 'classes', label: 'Classes', before: currClassesSummary, after: nextClassesSummary })
    // Feats
    const currFeats = (selectedFeats || []).slice().sort()
    const nextFeats = (mapping.nextFeats || []).slice().sort()
    if (JSON.stringify(currFeats) !== JSON.stringify(nextFeats)) {
      const name = (id: string) => FEATS.find((f) => f.id === id)?.name || id
      diffs.push({ key: 'feats', label: 'Feats', before: currFeats.map(name).join(', ') || '(none)', after: nextFeats.map(name).join(', ') || '(none)' })
    }
    // Feature decisions
    const currCfc = JSON.stringify(classFeatureChoices || {})
    const nextCfc = JSON.stringify(mapping.nextCfc || {})
    if (currCfc !== nextCfc) diffs.push({ key: 'featureChoices', label: 'Class feature decisions', before: '(current)', after: '(from planner)' })
    // Class skill picks
    const currPicks = JSON.stringify(classSkillPicks || {})
    const nextPicks = JSON.stringify(mapping.nextClassSkillPicks || {})
    if (currPicks !== nextPicks) diffs.push({ key: 'classSkills', label: 'Class skill picks', before: '(current)', after: '(from planner)' })
    return diffs
  }

  function applyMapping(mapping: any) {
    if (debugPlanSync) console.log('[PlanSync] applyMapping start', { before: classes.map(c=>({id:c.klass.id,l:c.level})), next: (mapping.nextClasses||[]).map((c:any)=>({id:c.klass.id,l:c.level})) })
    snapshot()
    setRace(mapping.nextRace)
    setBackground(mapping.nextBg)
    setClasses(mapping.nextClasses)
    if (debugPlanSync) console.log('[PlanSync] applyMapping scheduled setClasses')
    setSelectedFeats(mapping.nextFeats)
    if (mapping.nextCfc && Object.keys(mapping.nextCfc).length) setClassFeatureChoices(mapping.nextCfc)
    if (mapping.nextClassSkillPicks && Object.keys(mapping.nextClassSkillPicks).length) {
      setClassSkillPicks(mapping.nextClassSkillPicks)
      Object.entries(mapping.nextClassSkillPicks).forEach(([klassId, skills]: any) => {
        ;(skills as string[]).forEach((sid) => { try { addSkillSource(sid, `class:${klassId}`) } catch {} })
      })
    }
  }

  // Apply or prompt for a plan imported from the Progression Planner
  useEffect(() => {
    const plan = props.importPlan as any
    if (!plan) return
    const ts = typeof plan._ts === 'number' ? plan._ts : Date.now()
    if (lastImportTsHandled && ts === lastImportTsHandled) return
    try {
      const mapping = mapPlanToState(plan)
      if (plan._origin === 'planner-passive') {
        const diff = buildDiff(mapping)
        setLastImportTsHandled(ts)
        if (diff.length === 0) {
          // No changes; nothing to do.
          setPendingPassivePlan(null)
          return
        }
        setPendingPassivePlan({ plan, diff, mapping, ts })
        setSuppressPlanReconcile(false) // new incoming plan -> enable reconciliation again until user applies
        setImportedPlanSequence(mapping.chronological || [])
        if (debugPlanSync) console.log('[PlanSync] passive plan received', { diff, chronological: mapping.chronological.map((c:any)=>({id:c.klass.id,f:c.future})) })
        return
      }
      // Explicit apply (from Planner Apply button): apply immediately
      setLastImportTsHandled(ts)
      applyMapping(mapping)
      setImportedPlanSequence(mapping.chronological || [])
      setSuppressPlanReconcile(true) // freeze post-apply to prevent overwrite
      if (debugPlanSync) console.log('[PlanSync] explicit apply plan', { chronological: mapping.chronological.map((c:any)=>({id:c.klass.id,f:c.future})) })
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(props.importPlan), lastImportTsHandled])

  function snapshot() {
    setHistory((h) => [...h, JSON.stringify(state)])
    setFuture([])
  }
  function undo() {
    if (!history.length) return
    const prev = history[history.length - 1]
    setFuture((f) => [JSON.stringify(state), ...f])
    setHistory((h) => h.slice(0, -1))
    const s: AppState = JSON.parse(prev)
    setName(s.name); setRace(s.race); setClasses(s.classes as any); setAbilities(s.abilities); setLoadout(s.loadout)
  }
  function redo() {
    if (!future.length) return
    const next = future[0]
    setHistory((h) => [...h, JSON.stringify(state)])
    setFuture((f) => f.slice(1))
    const s: AppState = JSON.parse(next)
    setName(s.name); setRace(s.race); setClasses(s.classes as any); setAbilities(s.abilities); setLoadout(s.loadout)
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Top controls similar to demo header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
        {/* Removed icon and header text per request */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' }}>
          {/* Removed Guided/Power toggle per request */}
          <Button size="sm" variant="outline" onClick={undo}><Undo2 size={16} style={{ marginRight: 6 }} />Undo</Button>
          <Button size="sm" variant="outline" onClick={redo}><Redo2 size={16} style={{ marginRight: 6 }} />Redo</Button>
      <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const ok = window.confirm('Reset character to defaults? This clears saved Builder data.')
              if (!ok) return
              try { localStorage.removeItem(BUILDER_STORAGE_KEY) } catch {}
              // Also clear any saved Progression Planner data to prevent auto re-import after reset
              try {
                const del: string[] = []
                for (let i = 0; i < localStorage.length; i++) {
                  const k = localStorage.key(i) || ''
                  if (k.startsWith('progressionPlanner.v1:') || k.startsWith('progressionPlanner.activeRoot.v1:')) del.push(k)
                }
                del.forEach(k => localStorage.removeItem(k))
              } catch {}
              // Reset core state to defaults
              setMode('power')
              setName('New Hero')
              setRace(RACES[0])
              setClasses([])
              // Reset chronological level history and any imported plan so progression table reflects fresh state
              setClassLevelOrder([])
              setImportedPlanSequence([])
              setPendingPassivePlan(null)
              setLastImportTsHandled(null)
              setShowFullProgression(false)
              setAbilities({ str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 8 })
              setLoadout([EQUIPMENT[0], EQUIPMENT[1]])
              setBackground(BACKGROUNDS[0])
              setSkillProf({})
              setSkillSources({})
              setSkillTab('list')
              setSkillLayout('grid')
              setSkillSort('ability')
              setClassSkillPicks({})
              setBgReplPicks([])
              setRaceReplPicks([])
              setClassFeatureChoices({})
              setKnownSpells({})
              setPreparedSpells({})
              setAsiAlloc({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 })
              setSelectedFeats([])
              setFeatChoices({})
              setShowCompleted(true)
              setCatalogQuery('')
              setCatalogTags([])
              setCatalogFiltersOpen(false)
              setHistory([])
              setFuture([])
        // Reset rules and TCE controls
  // Rules reset moved to global rules context
            }}
          >Reset Character</Button>
          <Button size="sm" onClick={snapshot}><Settings2 size={16} style={{ marginRight: 6 }} />Save Draft</Button>
          <Button size="sm" variant="outline" onClick={exportToFile}>Export JSON</Button>
          <input ref={importInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={onImportFileSelected} />
          <Button size="sm" variant="outline" onClick={() => importInputRef.current?.click()}>Import JSON</Button>
          {/* Inline rules menu removed - global menu used instead */}
        </div>
      </div>

  {/* Main layout: left builder, right summary */}
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, width: '100%' }}>
        {/* Left */}
    <div style={{ display: 'grid', gap: 12, minWidth: 0, flex: '1 1 auto' }}>
          {/* Basics */}
          <Card>
            <CardHeader><CardTitle><Info size={16} style={{ marginRight: 6 }} />Basics</CardTitle></CardHeader>
            <CardContent>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '2fr 1fr 1fr', alignItems: 'start', alignContent: 'start' }}>
                {/* Character Name (col 1) */}
                <Labeled label="Character Name">
                  <input value={name} onChange={(e) => setName(e.target.value)} style={inp} />
                </Labeled>

                {/* Race (col 2) */}
                <Labeled label="Race">
                  <RaceSelector value={race} onChange={setRace} />
                </Labeled>
                {customOrigin ? (
                  <div style={{ gridColumn: '1 / -1', marginTop: -4 }}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Custom Origin Allocation (+2 and +1)</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', color: '#64748b' }}>+2</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(['str','dex','con','int','wis','cha'] as AbilityKey[]).map(k => (
                            <Button key={k} size="sm" variant={originAlloc.plus2 === k ? 'default' : 'outline'} onClick={() => setOriginAlloc(o => ({ ...o, plus2: k, plus1: (o.plus1 === k ? undefined : o.plus1) }))}>{k.toUpperCase()}</Button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', color: '#64748b' }}>+1</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(['str','dex','con','int','wis','cha'] as AbilityKey[]).map(k => (
                            <Button key={k} size="sm" variant={originAlloc.plus1 === k ? 'default' : 'outline'} disabled={k === originAlloc.plus2} onClick={() => setOriginAlloc(o => ({ ...o, plus1: k }))}>{k.toUpperCase()}</Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Background (col 3) */}
                <Labeled label="Background">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {BACKGROUNDS.map((bg) => (
                      <Button key={bg.id} size="sm" variant={background?.id === bg.id ? 'default' : 'outline'} onClick={() => setBackground(bg)}>
                        {bg.name}
                      </Button>
                    ))}
                  </div>
                </Labeled>

                {/* Classes & Level manager (full width) */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <ClassManager
                    classes={classes}
                    onChange={(v: Array<{ klass: Klass; level: number; subclass?: Subclass }>, levelAppend?: string[]) => {
                      setClasses(v)
                      if (levelAppend && levelAppend.length) setClassLevelOrder(o => [...o, ...levelAppend])
                    }}
                    abilities={abilities}
                    race={race}
                    asi={asiAlloc}
                  />
                </div>
                {/* AbilityEditor moved to its own dedicated card below Basics */}

                {/* TCE controls moved back to global Rules Drawer */}
              </div>
            </CardContent>
          </Card>

          {/* Ability Scores (separated from Basics) */}
          <Card>
            <CardHeader><CardTitle><Scale size={16} style={{ marginRight: 6 }} />Ability Scores</CardTitle></CardHeader>
            <CardContent>
              <AbilityEditor abilities={abilities} onChange={setAbilities} race={race} asi={asiAlloc} tceActive={tceCustomAsi} tceMode={tceMode} tceAlloc={tceAlloc} saves={derived.saves} saveProfs={derived.saveProfs} primaryClassId={classes[0]?.klass.id} primaryClassName={classes[0]?.klass.name} />
            </CardContent>
          </Card>

          {/* Manual Hit Points Section */}
          {manualHitPoints && (
            <Card>
              <CardHeader><CardTitle><HeartIcon size={16} style={{ marginRight: 6 }} />Hit Points</CardTitle></CardHeader>
              <CardContent>
                <HPManager
                  classes={classes}
                  abils={abilities}
                  method={hpMethod}
                  onMethodChange={setHpMethod}
                  rolls={hpRolls}
                  setRolls={setHpRolls}
                  manualTotal={hpManualTotal}
                  setManualTotal={setHpManualTotal}
                />
              </CardContent>
            </Card>
          )}

          {/* Combined Progression (Multiclass) */}
          {classes.length > 0 && (
            <>
              <Card>
                <Button
                  size="sm"
                  variant="ghost"
                  style={{ position: 'absolute', top: 8, right: 8 }}
                  onClick={() => setShowFullProgression(true)}
                  title="View Fullscreen"
                  aria-label="View progression table fullscreen"
                >⛶</Button>
                <CardHeader>
                  <CardTitle>Combined Progression</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Branch selector (pull roots from ProgressionPlanner storage) */}
                  <BranchProgressionSelector characterName={name} currentClasses={classes} onSelectSequence={(seq, order) => { setClasses(seq); setClassLevelOrder(order) }} />
                  {renderProgressionTable(
                    importedPlanSequence.length
                      ? importedPlanSequence.map(e => ({ klass: e.klass, level: 1, subclass: e.subclass, future: e.future }))
                      : reconstructSequence(classes, classLevelOrder)
                  )}
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Levels are ordered by the sequence of classes shown above. Reordering support could be added later.</div>
                </CardContent>
              </Card>
              {showFullProgression && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ background: 'var(--card-bg)', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.25)', padding: 32, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto', position: 'relative' }}>
                    <Button size="sm" variant="outline" style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }} onClick={() => setShowFullProgression(false)}>Close</Button>
                    <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>Custom Progression Table</div>
                    {renderProgressionTable(
                      importedPlanSequence.length
                        ? importedPlanSequence.map(e => ({ klass: e.klass, level: 1, subclass: e.subclass, future: e.future }))
                        : reconstructSequence(classes, classLevelOrder),
                      true
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Combined Progression now rendered near top via renderProgressionTable() */}

          {/* Class Feature Choices (appears only when needed) */}
          {pendingSubclassChoices.length ? (
            <Card>
              <CardHeader><CardTitle><Sparkles size={16} style={{ marginRight: 6 }} />Class Feature Choices</CardTitle></CardHeader>
              <CardContent>
                <div style={{ fontSize: 12, color: '#64748b' }}>You have class choices to make.</div>
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  {pendingSubclassChoices.map((c) => (
                    <div key={c.klass.id} style={{ padding: 8, borderRadius: 10, border: '1px solid var(--muted-border)', background: 'var(--card-bg)', display: 'grid', gap: 8 }}>
                      <div style={{ fontWeight: 600 }}>{c.klass.name}: Choose a Subclass</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(c.klass.subclasses || []).filter((s) => c.level >= s.unlockLevel).map((s) => (
                          <Button key={s.id} size="sm" variant={c.subclass?.id === s.id ? 'default' : 'outline'} onClick={() => setSubclassChoice(c.klass.id, s)}>{s.name}</Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* ASI & Feats (hidden if feats disabled; ASI portion still shows but feat list suppressed) */}
          {(() => {
            // Count available ASI slots from classes at levels 4,8,12,16,19 (demo rule).
            const asiLevels = new Set([4, 8, 12, 16, 19])
            const asiSlots = classes.reduce((sum, c) => sum + Array.from(asiLevels).filter(lv => c.level >= lv).length, 0)
            // Each slot provides 2 points for ASIs or 1 feat (which consumes 2 points)
            // Variant Human grants a bonus feat only when feats are enabled (variant gated off otherwise)
            const bonusFeatPoints = (race?.id === 'human-variant' && featsEnabled) ? 2 : 0
            const totalPoints = asiSlots * 2 + bonusFeatPoints
            const spentPoints = (['str','dex','con','int','wis','cha'] as AbilityKey[]).reduce((s, k) => s + (asiAlloc[k] || 0), 0) + (selectedFeats.length * 2)
            const remaining = Math.max(0, totalPoints - spentPoints)
            const fa = finalAbility(abilities, race, asiAlloc, { tceActive: tceCustomAsi, tceMode, tceAlloc, customOrigin, originAlloc })
            const canIncrease = (k: AbilityKey) => remaining > 0 && fa[k] + 1 <= 20
            const canDecrease = (k: AbilityKey) => (asiAlloc[k] || 0) > 0
            const toggleFeat = (id: string) => {
              setSelectedFeats((prev) => {
                const has = prev.includes(id)
                if (has) return prev.filter(f => f !== id)
                if (remaining < 2) return prev // not enough points
                return [...prev, id]
              })
            }
            // Show card if any ASI slot OR variant human bonus feat present
            if (asiSlots === 0 && bonusFeatPoints === 0) return null
            return (
              <Card>
                <CardHeader><CardTitle><Sparkles size={16} style={{ marginRight: 6 }} />ASI & Feats</CardTitle></CardHeader>
                <CardContent>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Pill>ASI slots {asiSlots}</Pill>
                      <Pill>Points {spentPoints} / {totalPoints}</Pill>
                      <Pill>Remaining {remaining}</Pill>
                      {bonusFeatPoints ? <Pill style={{ background: '#6366f1', color: 'white' }}>Variant Human Feat</Pill> : null}
                    </div>
                    {bonusFeatPoints ? (
                      <div style={{ fontSize: 12, color: '#64748b' }}>Variant Human grants one bonus feat at 1st level.</div>
                    ) : null}
                    {/* ASI allocation (suppressed for Variant Human at level 1 bonus feat only) */}
                    {asiSlots > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                        {(['str','dex','con','int','wis','cha'] as AbilityKey[]).map((k) => (
                          <div key={k} style={{ padding: 8, borderRadius: 10, border: '1px solid var(--muted-border)', background: 'var(--card-bg)', display: 'grid', gap: 6 }}>
                            <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b' }}>{k}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Button size="icon" variant="outline" onClick={() => setAsiAlloc((prev) => ({ ...prev, [k]: Math.max(0, (prev[k] || 0) - 1) }))} disabled={!canDecrease(k)}>−</Button>
                              <div style={{ fontWeight: 600, minWidth: 44, textAlign: 'center' }}>{fa[k]}{asiAlloc[k] ? ` (+${asiAlloc[k]})` : ''}</div>
                              <Button size="icon" variant="outline" onClick={() => {
                                if (!canIncrease(k)) return
                                setAsiAlloc((prev) => ({ ...prev, [k]: (prev[k] || 0) + 1 }))
                              }} disabled={!canIncrease(k)}>+</Button>
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>mod {mod(fa[k]) >= 0 ? '+' : ''}{mod(fa[k])}</div>
                          </div>
                        ))}
                      </div>
                    ) : (bonusFeatPoints ? (
                      <div style={{ fontSize: 12, color: '#64748b' }}>Variant Human: you gain a bonus feat at 1st level instead of increasing ability scores. Ability Score Increases will appear at later levels.</div>
                    ) : null)}
                    {featsEnabled ? (
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 12, color: '#64748b' }}>Feats (each costs 2 points)</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {FEATS.map((f) => {
                            const sel = selectedFeats.includes(f.id)
                            const full = remaining < 2
                            return (
                              <Button key={f.id} size="sm" variant={sel ? 'default' : 'outline'} disabled={!sel && full} onClick={() => toggleFeat(f.id)} title={f.text} style={{ opacity: !sel && full ? 0.6 : 1 }}>{f.name}</Button>
                            )
                          })}
                        </div>
                        {selectedFeats.includes('prodigy') ? (
                          <div style={{ marginTop: 6, padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff' }}>
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Prodigy: choose a skill to gain proficiency (or expertise if already proficient)</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {SKILLS.map((s) => {
                                const chosen = featChoices.prodigySkill === s.id
                                return (
                                  <Button key={s.id} size="sm" variant={chosen ? 'default' : 'outline'} onClick={() => setFeatChoices((prev) => ({ ...prev, prodigySkill: s.id }))}>{s.name}</Button>
                                )
                              })}
                            </div>
                            {featChoices.prodigySkill ? (
                              <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>Selected: {SKILLS.find(x => x.id === featChoices.prodigySkill)?.name}</div>
                            ) : null}
                          </div>
                        ) : null}
                        {selectedFeats.includes('resilient') ? (
                          <div style={{ marginTop: 6, padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff' }}>
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Resilient: choose an ability (grants +1 and saving throw proficiency)</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {(['str','dex','con','int','wis','cha'] as AbilityKey[]).map((ab) => {
                                const chosen = featChoices.resilientAbility === ab
                                const alreadyProf = classes.some(c => (c.klass.saves || []).includes(ab))
                                const style: React.CSSProperties | undefined = alreadyProf ? { borderColor: '#f97316', boxShadow: '0 0 0 1px #f97316 inset' } : undefined
                                return (
                                  <Button
                                    key={ab}
                                    size="sm"
                                    variant={chosen ? 'default' : 'outline'}
                                    onClick={() => setFeatChoices(prev => ({ ...prev, resilientAbility: ab }))}
                                    style={style}
                                    title={alreadyProf ? 'Already proficient in this save (discouraged choice)' : undefined}
                                  >{ab.toUpperCase()}</Button>
                                )
                              })}
                            </div>
                            {featChoices.resilientAbility ? (
                              <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>Selected: {String(featChoices.resilientAbility).toUpperCase()}</div>
                            ) : null}
                          </div>
                        ) : null}
                        {selectedFeats.includes('skilled') ? (
                          <div style={{ marginTop: 6, padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff' }}>
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Skilled: choose up to three skills to gain proficiency</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {SKILLS.map(s => {
                                const chosenArr: string[] = featChoices.skilledSkills || []
                                const chosen = chosenArr.includes(s.id)
                                const limitReached = chosenArr.length >= 3 && !chosen
                                return (
                                  <Button
                                    key={s.id}
                                    size="sm"
                                    variant={chosen ? 'default' : 'outline'}
                                    disabled={limitReached}
                                    onClick={() => setFeatChoices(prev => {
                                      const curr: string[] = prev.skilledSkills || []
                                      if (curr.includes(s.id)) return { ...prev, skilledSkills: curr.filter(x => x !== s.id) }
                                      if (curr.length >= 3) return prev
                                      return { ...prev, skilledSkills: [...curr, s.id] }
                                    })}
                                  >{s.name}</Button>
                                )
                              })}
                            </div>
                            <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>Selected { (featChoices.skilledSkills || []).length } / 3</div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {((featsEnabled || race?.id === 'human-variant') && selectedFeats.length > 0) ? (
                      <div style={{ fontSize: 12, color: '#64748b' }}>Selected feats: {selectedFeats.map(fid => FEATS.find(f => f.id === fid)?.name || fid).join(', ')}</div>
                    ) : null}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="sm" variant="ghost" onClick={() => { setAsiAlloc({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }); if (featsEnabled) setSelectedFeats([]) }}>Reset ASI/Feats</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })()}

          {/* Spells */}
          {(() => {
            // Identify classes that have Spellcasting at current level
            const casterEntries = classes.filter((c) => (c.level || 0) >= 1 && ['bard','cleric','wizard','druid','warlock','paladin','sorcerer','ranger'].includes(c.klass.id))
            if (!casterEntries.length) return null
            // Helper to get casting ability per class
            const castingMod = (klassId: string) => {
              const fa = finalAbility(abilities, race, asiAlloc, { tceActive: tceCustomAsi, tceMode, tceAlloc, customOrigin, originAlloc })
              const ab = klassId === 'bard' ? fa.cha
                : klassId === 'cleric' ? fa.wis
                : klassId === 'druid' ? fa.wis
                : klassId === 'warlock' ? fa.cha
                : klassId === 'paladin' ? fa.cha
                : klassId === 'sorcerer' ? fa.cha
                : klassId === 'ranger' ? fa.wis
                : fa.int
              return { mod: mod(ab), score: ab }
            }
            const pb = proficiencyBonus(Math.max(1, derived.totalLevel))
            // Demo limits and unlock thresholds (simplified):
            // Known casters get known L1/L2/L3 counts at or after unlock levels.
            // Prepared casters have prepared limits per level = max(1, casting mod + class level) at or after unlock.
            // Unlock levels (very simplified): full casters unlock L2@3, L3@5; half-casters unlock later.
            const unlock = {
              bard: { l2: 3, l3: 5 },
              cleric: { l2: 3, l3: 5 },
              druid: { l2: 3, l3: 5 },
              wizard: { l2: 3, l3: 5 },
              sorcerer: { l2: 3, l3: 5 },
              warlock: { l2: 3, l3: 5 }, // pact magic differs, simplified
              paladin: { l2: 5, l3: 9 }, // simplified half-caster
              ranger: { l2: 5, l3: 9 },
            } as const

            const limits = {
              bard: { cantrips: 2, level1: 2, level2: 2, level3: 2, prepared1: 0, prepared2: 0, prepared3: 0 },
              cleric: { cantrips: 3, level1: 0, level2: 0, level3: 0, prepared1: Math.max(1, castingMod('cleric').mod + (classes.find(c=>c.klass.id==='cleric')?.level || 1)), prepared2: 0, prepared3: 0 },
              wizard: { cantrips: 3, level1: 3, level2: 2, level3: 2, prepared1: 0, prepared2: 0, prepared3: 0 },
              druid: { cantrips: 2, level1: 0, level2: 0, level3: 0, prepared1: Math.max(1, castingMod('druid').mod + (classes.find(c=>c.klass.id==='druid')?.level || 1)), prepared2: 0, prepared3: 0 },
              warlock: { cantrips: 2, level1: 2, level2: 2, level3: 0, prepared1: 0, prepared2: 0, prepared3: 0 },
              paladin: { cantrips: 0, level1: 0, level2: 0, level3: 0, prepared1: Math.max(1, castingMod('paladin').mod + (classes.find(c=>c.klass.id==='paladin')?.level || 1)), prepared2: 0, prepared3: 0 },
              sorcerer: { cantrips: 4, level1: 2, level2: 2, level3: 2, prepared1: 0, prepared2: 0, prepared3: 0 },
              ranger: { cantrips: 0, level1: 0, level2: 0, level3: 0, prepared1: Math.max(1, castingMod('ranger').mod + (classes.find(c=>c.klass.id==='ranger')?.level || 1)), prepared2: 0, prepared3: 0 },
            } as const

            const toggle = (klassId: string, spellId: string, prepared = false) => {
              if (prepared) {
                setPreparedSpells((prev) => {
                  const curr = prev[klassId] || []
                  const has = curr.includes(spellId)
                  return { ...prev, [klassId]: has ? curr.filter((s) => s !== spellId) : [...curr, spellId] }
                })
              } else {
                setKnownSpells((prev) => {
                  const curr = prev[klassId] || []
                  const has = curr.includes(spellId)
                  return { ...prev, [klassId]: has ? curr.filter((s) => s !== spellId) : [...curr, spellId] }
                })
              }
            }

            return (
              <Card>
                <CardHeader>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CardTitle><Sparkles size={16} style={{ marginRight: 6 }} />Spells</CardTitle>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {(() => {
                        const dirty =
                          !spellFilters.levels[0] ||
                          !spellFilters.levels[1] ||
                          !spellFilters.levels[2] ||
                          !spellFilters.levels[3] ||
                          spellFilters.selectedOnly ||
                          (spellFilters.schools?.length || 0) > 0 ||
                          (spellFilters.damage?.length || 0) > 0 ||
                          (spellFilters.saves?.length || 0) > 0
                        return (
                          <Button
                            size="sm"
                            variant={spellsFiltersOpen || dirty ? 'default' : 'outline'}
                            onClick={() => setSpellsFiltersOpen((v) => !v)}
                            aria-haspopup="menu"
                            aria-expanded={spellsFiltersOpen}
                            title="Filters"
                          >Filters</Button>
                        )
                      })()}
                      {/* Filters dropdown moved to inline section below header */}
                      <input
                        value={spellsQuery}
                        onChange={(e)=>setSpellsQuery(e.target.value)}
                        placeholder="Search spells..."
                        style={{ ...inp, width: 240, padding: '6px 10px' }}
                        aria-label="Search spells"
                      />
                    </div>
                  </div>
                </CardHeader>
                {spellsFiltersOpen ? (
                  <div style={{ borderTop: '1px solid var(--muted-border)', background: 'var(--card-bg)', padding: 10, display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Levels</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Button size="sm" variant={spellFilters.levels[0] ? 'default' : 'outline'} onClick={() => setSpellFilters((p) => ({ ...p, levels: { ...p.levels, 0: !p.levels[0] } }))}>Cantrips</Button>
                        <Button size="sm" variant={spellFilters.levels[1] ? 'default' : 'outline'} onClick={() => setSpellFilters((p) => ({ ...p, levels: { ...p.levels, 1: !p.levels[1] } }))}>Level 1</Button>
                        <Button size="sm" variant={spellFilters.levels[2] ? 'default' : 'outline'} onClick={() => setSpellFilters((p) => ({ ...p, levels: { ...p.levels, 2: !p.levels[2] } }))}>Level 2</Button>
                        <Button size="sm" variant={spellFilters.levels[3] ? 'default' : 'outline'} onClick={() => setSpellFilters((p) => ({ ...p, levels: { ...p.levels, 3: !p.levels[3] } }))}>Level 3</Button>
                        <Button size="sm" variant={spellFilters.selectedOnly ? 'default' : 'outline'} onClick={() => setSpellFilters((p) => ({ ...p, selectedOnly: !p.selectedOnly }))}>Selected Only</Button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Schools</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {(['abjuration','conjuration','divination','enchantment','evocation','illusion','necromancy','transmutation'] as MagicSchool[]).map((sc) => {
                          const sel = spellFilters.schools.includes(sc)
                          return (
                            <Button key={sc} size="sm" variant={sel ? 'default' : 'outline'} onClick={() => setSpellFilters((p) => ({ ...p, schools: sel ? p.schools.filter(s=>s!==sc) : [...p.schools, sc] }))}>{sc}</Button>
                          )
                        })}
                        {spellFilters.schools.length ? (
                          <Button size="sm" variant="ghost" onClick={() => setSpellFilters((p)=>({ ...p, schools: [] }))}>Clear</Button>
                        ) : null}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Damage</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {(['acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder'] as DamageType[]).map((dt) => {
                          const sel = spellFilters.damage.includes(dt)
                          return (
                            <Button key={dt} size="sm" variant={sel ? 'default' : 'outline'} onClick={() => setSpellFilters((p) => ({ ...p, damage: sel ? p.damage.filter(d=>d!==dt) : [...p.damage, dt] }))}>{dt}</Button>
                          )
                        })}
                        {spellFilters.damage.length ? (
                          <Button size="sm" variant="ghost" onClick={() => setSpellFilters((p)=>({ ...p, damage: [] }))}>Clear</Button>
                        ) : null}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Saves</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {(['str','dex','con','int','wis','cha'] as AbilityKey[]).map((ab) => {
                          const sel = (spellFilters.saves as (AbilityKey|'none')[]).includes(ab)
                          return (
                            <Button key={ab} size="sm" variant={sel ? 'default' : 'outline'} onClick={() => setSpellFilters((p) => ({ ...p, saves: sel ? (p.saves as (AbilityKey|'none')[]).filter(s=>s!==ab) : ([...p.saves, ab] as (AbilityKey|'none')[]) }))}>{ab.toUpperCase()}</Button>
                          )
                        })}
                        {/* Include 'none' for attack roll or non-save spells */}
                        {(() => {
                          const sel = (spellFilters.saves as (AbilityKey|'none')[]).includes('none')
                          return (
                            <Button size="sm" variant={sel ? 'default' : 'outline'} onClick={() => setSpellFilters((p) => ({ ...p, saves: sel ? (p.saves as (AbilityKey|'none')[]).filter(s=>s!=='none') : ([...p.saves, 'none'] as (AbilityKey|'none')[]) }))}>None</Button>
                          )
                        })()}
                        {(spellFilters.saves?.length || 0) ? (
                          <Button size="sm" variant="ghost" onClick={() => setSpellFilters((p)=>({ ...p, saves: [] }))}>Clear</Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
                <CardContent>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {casterEntries.map((c) => {
                      const kid = c.klass.id
                      const { mod: cam, score: cascore } = castingMod(kid)
                      const dc = 8 + pb + cam
                      const atk = pb + cam
                      const q = spellsQuery.trim().toLowerCase()
                      const byQuery = (s: Spell) => !q || s.name.toLowerCase().includes(q) || s.text.toLowerCase().includes(q)
                      const byFacets = (s: Spell) => {
                        const meta = (SPELL_META as any)[s.id] || {}
                        // Schools
                        if ((spellFilters.schools?.length || 0) > 0) {
                          if (!meta.school || !(spellFilters.schools as any).includes(meta.school)) return false
                        }
                        // Damage types
                        if ((spellFilters.damage?.length || 0) > 0) {
                          const dmg: string[] = meta.damageTypes || []
                          if (!dmg.some((d) => (spellFilters.damage as any).includes(d))) return false
                        }
                        // Saves
                        if ((spellFilters.saves?.length || 0) > 0) {
                          const wantsNone = (spellFilters.saves as any).includes('none')
                          const save = meta.save || 'none'
                          if (wantsNone) {
                            if (save !== 'none') {
                              const others = (spellFilters.saves as any).filter((x: any) => x !== 'none')
                              if (others.length === 0) return false
                              if (!others.includes(save)) return false
                            }
                          } else {
                            if (!(spellFilters.saves as any).includes(save)) return false
                          }
                        }
                        return true
                      }
                      const cantrips = SPELLS.filter((s) => s.level === 0 && s.classes.includes(kid) && byQuery(s) && byFacets(s))
                      const level1 = SPELLS.filter((s) => s.level === 1 && s.classes.includes(kid) && byQuery(s) && byFacets(s))
                      const level2 = SPELLS.filter((s) => s.level === 2 && s.classes.includes(kid) && byQuery(s) && byFacets(s))
                      const level3 = SPELLS.filter((s) => s.level === 3 && s.classes.includes(kid) && byQuery(s) && byFacets(s))
                      const known = knownSpells[kid] || []
                      const prepared = preparedSpells[kid] || []
                      const lim = (limits as any)[kid] || { cantrips: 0, level1: 0, level2: 0, level3: 0, prepared1: 0, prepared2: 0, prepared3: 0 }
                      const knownCanCount = known.filter((id) => cantrips.some((s) => s.id === id)).length
                      const knownL1Count = known.filter((id) => level1.some((s) => s.id === id)).length
                      const knownL2Count = known.filter((id) => level2.some((s) => s.id === id)).length
                      const knownL3Count = known.filter((id) => level3.some((s) => s.id === id)).length
                      const prepL1Count = prepared.filter((id) => level1.some((s) => s.id === id)).length
                      const prepL2Count = prepared.filter((id) => level2.some((s) => s.id === id)).length
                      const prepL3Count = prepared.filter((id) => level3.some((s) => s.id === id)).length
                      const kidLevel = classes.find((x)=>x.klass.id===kid)?.level || 1
                      return (
                        <div key={kid} style={{ padding: 8, borderRadius: 12, border: '1px solid var(--muted-border)', background: 'var(--card-bg)', display: 'grid', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 600 }}>{c.klass.name}</div>
                            <Pill>Spell DC {dc}</Pill>
                            <Pill>Spell Atk {atk >= 0 ? `+${atk}` : atk}</Pill>
                            <div style={{ fontSize: 12, color: '#64748b' }}>Casting stat {
                              kid === 'bard' ? 'CHA' :
                              kid === 'cleric' ? 'WIS' :
                              kid === 'druid' ? 'WIS' :
                              kid === 'warlock' ? 'CHA' :
                              kid === 'paladin' ? 'CHA' :
                              kid === 'sorcerer' ? 'CHA' :
                              kid === 'ranger' ? 'WIS' :
                              'INT'
                            } ({cascore} | {cam >= 0 ? `+${cam}` : cam})</div>
                          </div>

                          {/* Cantrips */}
          {!!lim.cantrips && spellFilters.levels[0] && (
                            <div style={{ display: 'grid', gap: 6 }}>
                              <div style={{ fontSize: 12, color: '#64748b' }}>Cantrips: pick {lim.cantrips - knownCanCount} more</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cantrips.filter(sp => !spellFilters.selectedOnly || known.includes(sp.id)).map((sp) => {
                                  const sel = known.includes(sp.id)
                                  const full = knownCanCount >= lim.cantrips
                                  return (
                                    <Button key={sp.id} size="sm" variant={sel ? 'default' : 'outline'} disabled={!sel && full} onClick={() => toggle(kid, sp.id)} title={sp.text} style={{ opacity: !sel && full ? 0.6 : 1 }}>{sp.name}</Button>
                                  )
                                })}
                              </div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>Selected {knownCanCount} / {lim.cantrips}</div>
                            </div>
                          )}

                          {/* Level 1 known/prepared (known for bard/wizard/warlock) */}
          {['bard','wizard','warlock','sorcerer'].includes(kid) && !!lim.level1 && spellFilters.levels[1] && (
                            <div style={{ display: 'grid', gap: 6 }}>
                              <div style={{ fontSize: 12, color: '#64748b' }}>Level 1 Spells: pick {lim.level1 - knownL1Count} more</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {level1.filter(sp => !spellFilters.selectedOnly || known.includes(sp.id)).map((sp) => {
                                  const sel = known.includes(sp.id)
                                  const full = knownL1Count >= lim.level1
                                  return (
                                    <Button key={sp.id} size="sm" variant={sel ? 'default' : 'outline'} disabled={!sel && full} onClick={() => toggle(kid, sp.id)} title={sp.text} style={{ opacity: !sel && full ? 0.6 : 1 }}>{sp.name}</Button>
                                  )
                                })}
                              </div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>Selected {knownL1Count} / {lim.level1}</div>
                            </div>
                          )}

                          {/* Level 2 known for known-casters when unlocked */}
          {['bard','wizard','warlock','sorcerer'].includes(kid) && !!lim.level2 && spellFilters.levels[2] && kidLevel >= (unlock as any)[kid].l2 && (
                            <div style={{ display: 'grid', gap: 6 }}>
                              <div style={{ fontSize: 12, color: '#64748b' }}>Level 2 Spells: pick {lim.level2 - knownL2Count} more</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {level2.filter(sp => !spellFilters.selectedOnly || known.includes(sp.id)).map((sp) => {
                                  const sel = known.includes(sp.id)
                                  const full = knownL2Count >= lim.level2
                                  return (
                                    <Button key={sp.id} size="sm" variant={sel ? 'default' : 'outline'} disabled={!sel && full} onClick={() => toggle(kid, sp.id)} title={sp.text} style={{ opacity: !sel && full ? 0.6 : 1 }}>{sp.name}</Button>
                                  )
                                })}
                              </div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>Selected {knownL2Count} / {lim.level2}</div>
                            </div>
                          )}

                          {/* Level 3 known for known-casters when unlocked */}
          {['bard','wizard','sorcerer'].includes(kid) && !!lim.level3 && spellFilters.levels[3] && kidLevel >= (unlock as any)[kid].l3 && (
                            <div style={{ display: 'grid', gap: 6 }}>
                              <div style={{ fontSize: 12, color: '#64748b' }}>Level 3 Spells: pick {lim.level3 - knownL3Count} more</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {level3.filter(sp => !spellFilters.selectedOnly || known.includes(sp.id)).map((sp) => {
                                  const sel = known.includes(sp.id)
                                  const full = knownL3Count >= lim.level3
                                  return (
                                    <Button key={sp.id} size="sm" variant={sel ? 'default' : 'outline'} disabled={!sel && full} onClick={() => toggle(kid, sp.id)} title={sp.text} style={{ opacity: !sel && full ? 0.6 : 1 }}>{sp.name}</Button>
                                  )
                                })}
                              </div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>Selected {knownL3Count} / {lim.level3}</div>
                            </div>
                          )}

                          {/* Prepared casters: cleric, druid, paladin */}
          {['cleric','druid','paladin','ranger'].includes(kid) && lim.prepared1 > 0 && spellFilters.levels[1] && (
                            <div style={{ display: 'grid', gap: 6 }}>
                              <div style={{ fontSize: 12, color: '#64748b' }}>Prepared Level 1: pick {Math.max(0, lim.prepared1 - prepL1Count)} more (limit {lim.prepared1})</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {level1.filter(sp => !spellFilters.selectedOnly || prepared.includes(sp.id)).map((sp) => {
                                  const sel = prepared.includes(sp.id)
                                  const full = prepL1Count >= lim.prepared1
                                  return (
                                    <Button key={sp.id} size="sm" variant={sel ? 'default' : 'outline'} disabled={!sel && full} onClick={() => toggle(kid, sp.id, true)} title={sp.text} style={{ opacity: !sel && full ? 0.6 : 1 }}>{sp.name}</Button>
                                  )
                                })}
                              </div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>Prepared {prepL1Count} / {lim.prepared1}</div>
                            </div>
                          )}

                          {/* Prepared Level 2 */}
          {['cleric','druid','paladin','ranger'].includes(kid) && spellFilters.levels[2] && kidLevel >= (unlock as any)[kid].l2 && (
                            <div style={{ display: 'grid', gap: 6 }}>
                              <div style={{ fontSize: 12, color: '#64748b' }}>Prepared Level 2</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {level2.filter(sp => !spellFilters.selectedOnly || prepared.includes(sp.id)).map((sp) => {
                                  const sel = prepared.includes(sp.id)
                                  // Simplified limit: same formula as level 1 for demo
                                  const limit = lim.prepared2 || lim.prepared1
                                  const full = prepL2Count >= limit
                                  return (
                                    <Button key={sp.id} size="sm" variant={sel ? 'default' : 'outline'} disabled={!sel && full} onClick={() => toggle(kid, sp.id, true)} title={sp.text} style={{ opacity: !sel && full ? 0.6 : 1 }}>{sp.name}</Button>
                                  )
                                })}
                              </div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>Prepared {prepL2Count} / {lim.prepared2 || lim.prepared1}</div>
                            </div>
                          )}

                          {/* Prepared Level 3 */}
          {['cleric','druid','paladin','ranger'].includes(kid) && spellFilters.levels[3] && kidLevel >= (unlock as any)[kid].l3 && (
                            <div style={{ display: 'grid', gap: 6 }}>
                              <div style={{ fontSize: 12, color: '#64748b' }}>Prepared Level 3</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {level3.filter(sp => !spellFilters.selectedOnly || prepared.includes(sp.id)).map((sp) => {
                                  const sel = prepared.includes(sp.id)
                                  const limit = lim.prepared3 || lim.prepared1
                                  const full = prepL3Count >= limit
                                  return (
                                    <Button key={sp.id} size="sm" variant={sel ? 'default' : 'outline'} disabled={!sel && full} onClick={() => toggle(kid, sp.id, true)} title={sp.text} style={{ opacity: !sel && full ? 0.6 : 1 }}>{sp.name}</Button>
                                  )
                                })}
                              </div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>Prepared {prepL3Count} / {lim.prepared3 || lim.prepared1}</div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })()}

          {/* Skills */}
          <Card>
            <CardHeader>
              <CardTitle><Info size={16} style={{ marginRight: 6 }} />Skills</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <Button size="sm" variant={skillTab === 'list' ? 'default' : 'outline'} onClick={() => setSkillTab('list')}>List</Button>
                <Button size="sm" variant={skillTab === 'sources' ? 'default' : 'outline'} onClick={() => setSkillTab('sources')}>Sources</Button>
              </div>

              {skillTab === 'list' ? (
                <>
                  {/* Sort controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Sort By</div>
                    <select value={skillSort} onChange={(e) => setSkillSort(e.target.value as any)} style={{ ...inp, width: 240, padding: '6px 10px' }}>
                      <option value="ability">Ability Score</option>
                      <option value="alpha">Alphabetical</option>
                      <option value="bonus">Highest Bonus</option>
                      <option value="proftype">Proficiency Type</option>
                    </select>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Button size="sm" variant={skillLayout === 'single' ? 'default' : 'outline'} onClick={() => setSkillLayout('single')} aria-label="Single column" title="Single column">
                        <List size={16} />
                      </Button>
                      <Button size="sm" variant={skillLayout === 'double' ? 'default' : 'outline'} onClick={() => setSkillLayout('double')} aria-label="Two columns" title="Two columns">
                        <Columns size={16} />
                      </Button>
                      <Button size="sm" variant={skillLayout === 'grid' ? 'default' : 'outline'} onClick={() => setSkillLayout('grid')} aria-label="Grid" title="Grid">
                        <LayoutGrid size={16} />
                      </Button>
                    </div>
                  </div>

                  {(() => {
                    const fa = finalAbility(abilities, race, asiAlloc, { tceActive: tceCustomAsi, tceMode, tceAlloc, customOrigin, originAlloc })
                    const pb = proficiencyBonus(Math.max(1, derived.totalLevel))
                    // Ability sort order preference (CHA, CON, DEX, INT, STR, WIS)
                    const abilityOrder: AbilityKey[] = ['cha', 'con', 'dex', 'int', 'str', 'wis']
                    const profOrder: ProfType[] = ['expert', 'prof', 'half', 'none']
                    const items = SKILLS.map((s) => {
                      const base = mod(fa[s.ability])
                      let t: ProfType = skillProf[s.id] ?? 'none'
                      // Feat: Prodigy handling (proficiency if none, expertise if already proficient)
                      if (selectedFeats.includes('prodigy') && featChoices.prodigySkill === s.id) {
                        if (t === 'none') t = 'prof'
                        else if (t === 'prof') t = 'expert'
                      }
                      // Feat: Skilled grants straight proficiency (does not stack to expertise here)
                      if (selectedFeats.includes('skilled') && (featChoices.skilledSkills || []).includes(s.id)) {
                        if (t === 'none') t = 'prof'
                      }
                      const add = t === 'half' ? Math.floor(pb / 2) : t === 'prof' ? pb : t === 'expert' ? pb * 2 : 0
                      const total = base + add
                      return { ...s, base, add, total, t }
                    })
                    items.sort((a, b) => {
                      if (skillSort === 'alpha') return a.name.localeCompare(b.name)
                      if (skillSort === 'bonus') return b.total - a.total || a.name.localeCompare(b.name)
                      if (skillSort === 'proftype') return profOrder.indexOf(a.t) - profOrder.indexOf(b.t) || a.name.localeCompare(b.name)
                      // ability
                      return abilityOrder.indexOf(a.ability) - abilityOrder.indexOf(b.ability) || a.name.localeCompare(b.name)
                    })
                    // Compute a consistent card width so all skill names are fully visible on one line
                    const measure = (font: string, text: string) => {
                      try {
                        const canvas = document.createElement('canvas')
                        const ctx = canvas.getContext('2d')
                        if (!ctx) return text.length * 8
                        ctx.font = font
                        const m = ctx.measureText(text)
                        return m.width
                      } catch {
                        return text.length * 8
                      }
                    }
                    const fontStack = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
                    const nameFont = `600 14px ${fontStack}`
                    const pillFont = `12px ${fontStack}`
                    const btnFont = `12px ${fontStack}`
                    const maxNameWidth = Math.max(...SKILLS.map((s) => measure(nameFont, s.name)))
                    const maxPillTextWidth = Math.max(...items.map((i) => measure(pillFont, i.total >= 0 ? `+${i.total}` : `${i.total}`)))
                    const pillWidth = Math.ceil(maxPillTextWidth + 16 + 2) // padding 8+8 + borders
                    const btnLabel = 'Expertise' // longest button label
                    const btnTextWidth = measure(btnFont, btnLabel)
                    const btnWidth = Math.ceil(btnTextWidth + 20 + 2) // padding 10+10 + borders
                    const leftWidth = Math.ceil(maxNameWidth)
                    const cardWidth = Math.ceil(leftWidth + 8 /* gap L-R */ + pillWidth + 8 /* gap pill-btn */ + btnWidth + 16 /* padding */)
                    const containerStyle: React.CSSProperties = {
                      display: 'grid',
                      gap: 8,
                      gridTemplateColumns:
                        skillLayout === 'single'
                          ? `repeat(1, minmax(${cardWidth}px, 1fr))`
                          : skillLayout === 'double'
                          ? `repeat(2, minmax(${cardWidth}px, 1fr))`
                          : `repeat(auto-fill, ${cardWidth}px)`,
                    }
                    const cardBaseStyle: React.CSSProperties = {
                      padding: 8,
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      background: 'var(--card-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      ...(skillLayout === 'grid' ? { width: cardWidth } : {}),
                    }
                    // For two-column layout, render items in column-major order:
                    // left column gets the first half top-to-bottom, right column the second half,
                    // then interleave per row so CSS grid (row-major) places them correctly.
                    let displayItems = items
                    if (skillLayout === 'double') {
                      const rows = Math.ceil(items.length / 2)
                      const left = items.slice(0, rows)
                      const right = items.slice(rows)
                      const interleaved: typeof items = []
                      for (let i = 0; i < rows; i++) {
                        if (left[i]) interleaved.push(left[i])
                        if (right[i]) interleaved.push(right[i])
                      }
                      displayItems = interleaved
                    }
                    // Local expansion state for skills (keyed by id). We keep this ephemeral; not persisted.
                    const [expandedSkills, setExpandedSkills] = React.useState<Record<string, boolean>>({})
                    const toggleSkill = (id: string) => setExpandedSkills((m) => ({ ...m, [id]: !m[id] }))
                    return (
                      <div style={{ ...containerStyle }}>
                        {displayItems.map((s) => {
                          const skillMeta = SKILLS.find((k) => k.id === s.id) as any // Skill type (has description & subSkills)
                          const isExpanded = !!expandedSkills[s.id]
                          return (
                            <div key={s.id} style={{ ...cardBaseStyle, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                  <div style={{ display: 'grid', gap: 2 }}>
                                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <span>{s.name}</span>
                                      {(skillMeta?.description || skillMeta?.subSkills?.length) && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => toggleSkill(s.id)}
                                          style={{ paddingInline: 6 }}
                                          title={isExpanded ? 'Hide details' : 'Show details'}
                                        >
                                          {isExpanded ? 'ⓘ' : 'ⓘ'}
                                        </Button>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{s.ability}</div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                                  <Pill>{s.total >= 0 ? `+${s.total}` : s.total}</Pill>
                                  <Button
                                    size="sm"
                                    variant={s.t === 'none' ? 'outline' : 'default'}
                                    onClick={() => {
                                      const hasManual = (skillSources[s.id] || []).includes('manual')
                                      if (hasManual) {
                                        removeSkillSource(s.id, 'manual')
                                      } else {
                                        addSkillSource(s.id, 'manual')
                                      }
                                    }}
                                  >{s.t === 'none' ? 'None' : s.t === 'half' ? 'Half' : s.t === 'prof' ? 'Prof' : 'Expertise'}</Button>
                                </div>
                              </div>
                              {isExpanded && (
                                <div style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                                  {skillMeta?.description && (
                                    <div style={{ lineHeight: 1.3, color: 'var(--muted-fg)' }}>{skillMeta.description}</div>
                                  )}
                                  {skillMeta?.subSkills?.length ? (
                                    <div style={{ display: 'grid', gap: 4 }}>
                                      {skillMeta.subSkills.map((ss: any) => (
                                        <div
                                          key={ss.id}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            justifyContent: 'space-between',
                                            gap: 8,
                                            background: 'var(--subtle-bg)',
                                            padding: '4px 6px',
                                            borderRadius: 6,
                                          }}
                                        >
                                          <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 500 }}>{ss.name}</div>
                                            {ss.description && (
                                              <div style={{ opacity: 0.75, lineHeight: 1.25 }}>{ss.description}</div>
                                            )}
                                          </div>
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                            <Pill>{s.total >= 0 ? `+${s.total}` : s.total}</Pill>
                                            {typeof ss.bonusAdjust === 'number' && ss.bonusAdjust !== 0 && (
                                              <div style={{ fontSize: 10, color: ss.bonusAdjust > 0 ? 'green' : 'crimson' }}>
                                                {ss.bonusAdjust > 0 ? '+' : ''}
                                                {ss.bonusAdjust}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </>
              ) : null}

              {skillTab === 'sources' ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Combined node graph showing all skills and their proficiency sources.</div>
                  <CombinedSourcesGraph
                    skills={SKILLS.map(s => ({ id: s.id, name: s.name }))}
                    skillSources={skillSources}
                    race={race}
                    raceReplPicks={raceReplPicks}
                    classes={classes}
                    background={background}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Equipment */}
      <Card>
            <CardHeader><CardTitle><Sword size={16} style={{ marginRight: 6 }} />Equipment & Loadout</CardTitle></CardHeader>
            <CardContent>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
                {/* Catalog column */}
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Catalog</div>
                  {/* Search + Filters + Sort toggles */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      placeholder="Search catalog..."
                      value={catalogQuery}
                      onChange={(e) => setCatalogQuery(e.target.value)}
                      style={{ ...inp, flex: 1 }}
                    />
                    <Button
                      size="sm"
                      variant={catalogFiltersOpen || catalogTags.length ? 'default' : 'outline'}
                      onClick={() => setCatalogFiltersOpen((v) => !v)}
                    >Filters{catalogTags.length ? ` (${catalogTags.length})` : ''}</Button>
                    <Button
                      size="sm"
                      variant={catalogSortOpen ? 'default' : 'outline'}
                      onClick={() => setCatalogSortOpen(o => !o)}
                    >Sort</Button>
                  </div>
                  {/* Sort controls (collapsible) */}
                  {catalogSortOpen && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <select value={catalogSort} onChange={(e) => setCatalogSort(e.target.value as any)} style={{ ...inp, flex: 1, minWidth: 140 }}>
                        <option value="alpha">Alphabetical</option>
                        <option value="weight">Weight</option>
                        <option value="cost">Cost (gp)</option>
                        <option value="damageDie">Damage (avg)</option>
                        <option value="ac">AC</option>
                        <option value="hands">Hands</option>
                      </select>
                      <Button size="sm" variant="outline" onClick={() => setCatalogSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
                        {catalogSortDir === 'asc' ? 'Asc' : 'Desc'}
                      </Button>
                    </div>
                  )}
                  {/* Tag filters (collapsible) */}
                  {catalogFiltersOpen ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {allTags.map((tag) => (
                        <Button
                          key={tag}
                          size="sm"
                          variant={catalogTags.includes(tag) ? 'default' : 'outline'}
                          onClick={() => toggleTag(tag)}
                        >{tag}</Button>
                      ))}
                      {catalogTags.length ? (
                        <Button size="sm" variant="ghost" onClick={() => setCatalogTags([])}>Clear filters</Button>
                      ) : null}
                    </div>
                  ) : null}
                  {/* Scrollable grid of items */}
                  <div style={{ maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                      {filteredEquipment.length ? filteredEquipment.map((eq) => (
                        <ItemCard key={(eq as any).id} item={eq} onAdd={() => setLoadout((l) => dedupe([...l, eq]))} />
                      )) : (
                        <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#94a3b8' }}>No items match your search.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Loadout column */}
                <div style={{ display: 'grid', gap: 8, background: 'var(--card-bg)', padding: 8, borderRadius: 10, border: '1px solid var(--muted-border)' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Loadout</div>
                  <div style={{ maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {loadout.length === 0 && (
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>Nothing equipped.</div>
                      )}
                      {loadout.map((eq) => (
                        <LoadoutRow key={(eq as any).id} item={eq} onRemove={() => setLoadout((l) => l.filter((x) => (x as any).id !== (eq as any).id))} />
                      ))}
                    </div>
                  </div>
                </div>
                      
              </div>
            </CardContent>
          </Card>

          {/* Compare panel and Toy Combat Readiness removed */}
        </div>

    {/* Right: Live Summary */}
  <aside className="no-scrollbar" style={{ display: 'grid', gap: 12, position: 'sticky', top: 76, flex: '0 0 420px', width: 420, minWidth: 420, boxSizing: 'border-box', maxHeight: 'calc(100vh - 100px)', overflowY: 'auto', paddingRight: 4 }}>
          <Card>
            <CardHeader>
              <div style={{ width: '100%', textAlign: 'center', display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '.5px' }}>{name && name.trim() ? name : 'Unnamed Character'}</div>
                <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1 }}>
                  {race.name}{background ? ` • ${background.name}` : ''}
                </div>
                {/* Live Summary label removed per request */}
              </div>
            </CardHeader>
            <CardContent>
              {/* Top Priority Summary */}
              <div style={{ display: 'grid', gap: 12 }}>
                {/* Level + Class breakdown */}
                <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 600, lineHeight: 1.2 }}>
                  {derived.totalLevel > 0 ? `Level ${derived.totalLevel}` : 'No Class Selected'}
                  <div style={{ marginTop: 4, fontSize: 14, fontWeight: 500, color: 'var(--foreground-muted,#334155)', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
                    {classes.length ? classes.map(c => (
                      <span key={c.klass.id} style={{ background: 'var(--pill-bg,#f1f5f9)', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                        {c.klass.name} {c.level}{c.subclass ? ` (${c.subclass.name})` : ''}
                      </span>
                    )) : <span style={{ fontSize: 12, color: '#94a3b8' }}>Add a class to begin</span>}
                  </div>
                </div>

                {/* Key combat stats */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 20 }}>
                  <StatBadge label="HP" value={manualHitPoints && computedManualHp != null ? computedManualHp : derived.hp} />
                  <StatBadge label="AC" value={derived.ac} />
                  <StatBadge label="Init" value={derived.initiative >= 0 ? `+${derived.initiative}` : derived.initiative} />
                  <StatBadge label="Speed" value={`${derived.speed} ft`} />
                  {derived.barbarianLevel ? (
                    <div style={{ display: 'grid', placeItems: 'center', padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, minWidth: 72 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.5px', color: '#b91c1c' }}>RAGE</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c' }}>{derived.rageUses === 'unlimited' ? '∞' : derived.rageUses}</div>
                      <div style={{ fontSize: 10, color: '#b91c1c' }}>+{derived.rageDamageBonus} dmg</div>
                    </div>
                  ) : null}
                </div>

                {/* (Race & Background moved under name in header) */}
              </div>

              {/* Abilities (compact mirror of editor) */}
              <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 92px)', gap: 8, justifyContent: 'center' }}>
                  {(['str','dex','con','int','wis','cha'] as AbilityKey[]).map(k => {
                    const val = finalAbility(abilities, race, asiAlloc, { tceActive: tceCustomAsi, tceMode, tceAlloc, customOrigin, originAlloc })[k]
                    const m = mod(val)
                    const save = derived.saves[k]
                    return (
                      <div key={k} style={{ width: 92, padding: 12, borderRadius: 10, border: '1px solid var(--muted-border)', background: 'var(--card-bg)', display: 'grid', gap: 6, alignContent: 'start', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase' }}>{k}</div>
                        <div style={{ fontSize: 22, fontWeight: 400, lineHeight: 1 }}>{val}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, gap: 8 }}>
                          <div style={{ display: 'grid', gap: 2, flex: 1, textAlign: 'center' }}>
                            <span style={{ fontSize: 9, letterSpacing: '.5px', textTransform: 'uppercase', color: '#64748b' }}>Mod</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{m >= 0 ? `+${m}` : m}</span>
                          </div>
                          <div style={{ display: 'grid', gap: 2, flex: 1, textAlign: 'center' }}>
                            <span style={{ fontSize: 9, letterSpacing: '.5px', textTransform: 'uppercase', color: '#64748b' }}>Save</span>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{save >= 0 ? `+${save}` : save}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Subactions */}
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Subactions Gained</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {derived.subactions.length ? derived.subactions.map((s) => <span key={s} style={badgeSecondary}>{s}</span>) : <div style={{ color: '#94a3b8' }}>None yet.</div>}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={16} style={{ marginRight: 6 }} />Class Features
                </div>
                <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                  {(() => {
                    // Gather class features up to the current level (if featuresByLevel provided)
                    // plus subclass features when unlocked. Fall back to level1 only when no map is provided.
                    const cards: Array<{ key: string; name: string; text: string; source: string }> = []
                    classes.filter((c) => (c.level || 0) >= 1).forEach((c) => {
                      const lvl = c.level || 1
                      const map = c.klass.featuresByLevel
                      // Build chosen decisions lookup for this class
                      const decisions = CLASS_FEATURE_DECISIONS[c.klass.id] || []
                      const chosenById: Record<string, { name: string; text: string } | { multi: Array<{ name: string; text: string }> }> = {}
                      const chosenByName: Record<string, { name: string; text: string } | { multi: Array<{ name: string; text: string }> }> = {}
                      decisions.forEach((d) => {
                        if (lvl >= d.level) {
                          const raw = classFeatureChoices[c.klass.id]?.[d.id]
                          const ids = Array.isArray(raw) ? raw : (raw ? [raw] : [])
                          const opts = ids.map(id => d.options.find(o => o.id === id)).filter(Boolean) as Array<{ id: string; name: string; text: string }>
                          if (opts.length === 1) {
                            const one = opts[0]
                            chosenById[d.id] = { name: one.name, text: one.text }
                            chosenByName[d.name] = { name: one.name, text: one.text }
                          } else if (opts.length > 1) {
                            const multi = opts.map(o => ({ name: o.name, text: o.text }))
                            chosenById[d.id] = { multi }
                            chosenByName[d.name] = { multi }
                          }
                        }
                      })
                      const consumedDecisionIds = new Set<string>()
                      if (map) {
                        const levels = Object.keys(map).map((n) => parseInt(n, 10)).filter((n) => n <= lvl).sort((a, b) => a - b)
                        levels.forEach((ln) => {
                          map[ln].forEach((f) => {
                            // If a decision with the same feature name is chosen, merge it into this card
                            const chosen = chosenByName[f.name]
                            if (chosen) {
                              const dec = decisions.find((d) => d.name === f.name)
                              if (dec) consumedDecisionIds.add(dec.id)
                            }
                            const displayName = (() => {
                              if (!chosen) return f.name
                              if ('multi' in chosen) return `${f.name}: ${chosen.multi.map(m => m.name).join(', ')}`
                              return `${f.name}: ${chosen.name}`
                            })()
                            const displayText = (() => {
                              // Special-case ASI features: reflect ASI allocation or feat chosen
                              const isASI = f.name.toLowerCase().includes('ability score improvement')
                              if (isASI) {
                                // Build a per-level view: if any feats are selected, summarize feats; otherwise show stat increases
                                const incs = (['str','dex','con','int','wis','cha'] as AbilityKey[]).filter(k => (asiAlloc[k] || 0) > 0)
                                const incStr = incs.length ? `ASI: ${incs.map(k => `${k.toUpperCase()} +${asiAlloc[k] || 0}`).join(', ')}` : ''
                                const featStr = selectedFeats.length ? `Feats: ${selectedFeats.map(fid => FEATS.find(ff => ff.id === fid)?.name || fid).join(', ')}` : ''
                                const parts = [incStr, featStr].filter(Boolean)
                                return parts.length ? parts.join(' • ') : f.text
                              }
                              if (!chosen) return f.text
                              if ('multi' in chosen) return chosen.multi.map(m => m.text).join(' • ')
                              return chosen.text
                            })()
                            cards.push({ key: `${c.klass.id}-lvl${ln}-${f.name}`, name: displayName, text: displayText, source: `${c.klass.name} • L${ln}` })
                          })
                        })
                      } else {
                        (c.klass.level1 || []).forEach((f) => {
                          const chosen = chosenByName[f.name]
                          if (chosen) {
                            const dec = decisions.find((d) => d.name === f.name)
                            if (dec) consumedDecisionIds.add(dec.id)
                          }
                          const displayName = (() => {
                            const chosen = chosenByName[f.name]
                            if (!chosen) return f.name
                            if ('multi' in chosen) return `${f.name}: ${chosen.multi.map(m => m.name).join(', ')}`
                            return `${f.name}: ${chosen.name}`
                          })()
                          const displayText = (() => {
                            // Special-case ASI features: reflect ASI allocation or feat chosen
                            const isASI = f.name.toLowerCase().includes('ability score improvement')
                            if (isASI) {
                              const incs = (['str','dex','con','int','wis','cha'] as AbilityKey[]).filter(k => (asiAlloc[k] || 0) > 0)
                              const incStr = incs.length ? `ASI: ${incs.map(k => `${k.toUpperCase()} +${asiAlloc[k] || 0}`).join(', ')}` : ''
                              const featStr = selectedFeats.length ? `Feats: ${selectedFeats.map(fid => FEATS.find(ff => ff.id === fid)?.name || fid).join(', ')}` : ''
                              const parts = [incStr, featStr].filter(Boolean)
                              return parts.length ? parts.join(' • ') : f.text
                            }
                            const chosen = chosenByName[f.name]
                            if (!chosen) return f.text
                            if ('multi' in chosen) return chosen.multi.map(m => m.text).join(' • ')
                            return chosen.text
                          })()
                          cards.push({ key: `${c.klass.id}-lvl1-${f.name}`, name: displayName, text: displayText, source: c.klass.name })
                        })
                      }
                      // Add any remaining selected decisions that didn't match a base feature card
                      decisions.forEach((d) => {
                        if (lvl >= d.level && !consumedDecisionIds.has(d.id)) {
                          const chosen = chosenById[d.id]
                          if (chosen) {
                            if ('multi' in chosen) {
                              cards.push({ key: `${c.klass.id}-dec-${d.id}`, name: `${d.name}: ${chosen.multi.map(m => m.name).join(', ')}`, text: chosen.multi.map(m => m.text).join(' • '), source: c.klass.name })
                            } else {
                              cards.push({ key: `${c.klass.id}-dec-${d.id}`, name: `${d.name}: ${chosen.name}`, text: chosen.text, source: c.klass.name })
                            }
                          }
                        }
                      })

                      if (c.subclass && lvl >= (c.subclass.unlockLevel || Infinity)) {
                        const grants = c.subclass.grants?.subactions?.length ? `Grants: ${c.subclass.grants!.subactions!.join(', ')}` : 'Subclass features unlocked.'
                        cards.push({ key: `${c.klass.id}-sub-${c.subclass.id}`, name: c.subclass.name, text: grants, source: c.klass.name })
                      }
                    })
                    return cards.length ? cards.map((card) => (
                      <div key={card.key} style={{ padding: 8, borderRadius: 12, border: '1px solid var(--muted-border)', background: 'var(--card-bg)' }}>
                        <div style={{ fontWeight: 600 }}>{card.name} <span style={{ color: '#64748b', fontWeight: 400 }}>({card.source})</span></div>
                        <div style={{ color: '#64748b' }}>{card.text}</div>
                      </div>
                    )) : (
                      <div style={{ color: '#94a3b8' }}>No class features.</div>
                    )
                  })()}
                </div>
              </div>

              {/* Racial Features moved to bottom, text size matches Level 1 Features */}
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Racial Features</div>
                <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                  {(race.traits || []).length ? (
                    (race.traits || []).map((t) => (
                      <div key={t.id} style={{ padding: 8, borderRadius: 12, border: '1px solid var(--muted-border)', background: 'var(--card-bg)' }}>
                        <div style={{ fontWeight: 600 }}>{t.name}</div>
                        <div style={{ color: '#64748b' }}>{t.text}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#94a3b8' }}>No racial features.</div>
                  )}
                  {/* Innate racial spells */}
                  {race.spells?.length ? (
                    <div style={{ padding: 8, borderRadius: 12, border: '1px solid var(--muted-border)', background: 'var(--card-bg)' }}>
                      <div style={{ fontWeight: 600 }}>Innate Spells</div>
                      <div style={{ color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {race.spells.map(sid => {
                          const sp = SPELLS.find(s => s.id === sid)
                          return <span key={sid} style={{ background: 'var(--muted-bg)', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>{sp?.name || sid}</span>
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
      <div style={{ fontSize: 12, color: '#64748b', padding: '8px 0' }}>Demo only. Replace permit/reward stubs with your engine calls to power full validation, previews, and MCST‑driven simulations.</div>
      {/* Passive Planner sync prompt (global overlay) */}
      {pendingPassivePlan ? (
        <div style={{ position: 'fixed', left: 12, right: 12, bottom: 12, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 50 }}>
          <div style={{ pointerEvents: 'auto', maxWidth: 720, width: '100%', background: 'var(--card-bg)', border: '1px solid var(--muted-border)', borderRadius: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.18)', padding: 12, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600 }}>Planner changes available</div>
              <Button size="sm" variant="outline" onClick={() => { setPendingPassivePlan(null) }}>Dismiss</Button>
            </div>
            <div style={{ fontSize: 13, color: '#475569' }}>We found differences between Builder and the active plan. Apply these updates?</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#334155' }}>
              {pendingPassivePlan.diff.slice(0, 8).map((d: { key: string; label: string; before?: string; after?: string }) => (
                <li key={d.key}>
                  <strong>{d.label}:</strong> {d.before || ''} {d.after ? '→ ' + d.after : ''}
                </li>
              ))}
              {pendingPassivePlan.diff.length > 8 ? (<li>…and {pendingPassivePlan.diff.length - 8} more</li>) : null}
            </ul>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button size="sm" variant="outline" onClick={() => { setPendingPassivePlan(null) }}>Not now</Button>
              <Button size="sm" onClick={() => { if (pendingPassivePlan) { if (debugPlanSync) console.log('[PlanSync] Apply button click', pendingPassivePlan.mapping.nextClasses.map((c:any)=>({id:c.klass.id,l:c.level}))); applyMapping(pendingPassivePlan.mapping); setImportedPlanSequence(pendingPassivePlan.mapping.chronological || []); setSuppressPlanReconcile(true); setPendingPassivePlan(null) } }}>Apply changes</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ---------------- Subcomponents ----------------

function Selector<T extends { id: string }>(props: { options: T[]; value: T; onChange: (v: T) => void; getLabel: (t: T) => string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {props.options.map((opt) => (
        <Button key={opt.id} size="sm" variant={props.value?.id === opt.id ? 'default' : 'outline'} onClick={() => props.onChange(opt)}>
          {props.getLabel(opt)}
        </Button>
      ))}
    </div>
  )
}

function AbilityEditor(props: { abilities: Record<AbilityKey, number>; onChange: (v: Record<AbilityKey, number>) => void; race: Race; asi?: Record<AbilityKey, number>; tceActive?: boolean; tceMode?: '2+1' | '1+1+1'; tceAlloc?: Record<AbilityKey, number>; saves?: Record<AbilityKey, number>; saveProfs?: AbilityKey[]; primaryClassId?: string; primaryClassName?: string }) {
  // Access rule for manual adjustments
  const { manualAbilityAdjust } = useRules()
  const final = finalAbility(props.abilities, props.race, props.asi, { tceActive: props.tceActive, tceMode: props.tceMode, tceAlloc: props.tceAlloc })
  const order: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  // Inject keyframes for flashing hint once
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!document.getElementById('ability-drop-pulse-style')) {
      const el = document.createElement('style')
      el.id = 'ability-drop-pulse-style'
      el.textContent = `@keyframes abilityDropPulse { 0%{opacity:.25} 50%{opacity:1} 100%{opacity:.25} }`
      document.head.appendChild(el)
    }
  }, [])

  // Roll pool + DnD state
  type RollToken = { id: string; value: number }
  const [rollTokens, setRollTokens] = useState<RollToken[]>([])
  const [assignedFromPool, setAssignedFromPool] = useState<Partial<Record<AbilityKey, number>>>({})
  const makeId = () => Math.random().toString(36).slice(2, 9)
  // Point Buy state
  const [pointBuy, setPointBuy] = useState(false)
  const canManualAdjust = manualAbilityAdjust || pointBuy
  // NEW: toggle for generator options
  const [genOpen, setGenOpen] = useState(false)
  // Global toggle: when true, show breakdown for all abilities
  const [breakdownAllOpen, setBreakdownAllOpen] = useState(false)
  const POINT_BUY_BUDGET = 27
  function pointCost(score: number) {
    switch (score) {
      case 8: return 0
      case 9: return 1
      case 10: return 2
      case 11: return 3
      case 12: return 4
      case 13: return 5
      case 14: return 7
      case 15: return 9
      default: return Number.POSITIVE_INFINITY
    }
  }
  function totalPointsSpent(vals: Record<AbilityKey, number>) {
    return (['str','dex','con','int','wis','cha'] as AbilityKey[]).reduce((s, k) => {
      const v = Math.max(8, Math.min(15, vals[k] || 8))
      return s + pointCost(v)
    }, 0)
  }
  const pointsSpent = totalPointsSpent(props.abilities)
  const pointsRemaining = Math.max(0, POINT_BUY_BUDGET - pointsSpent)

  // Generators
  function rollDice(count: number, sides: number) { return Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides)) }
  function gen4d6dlOnce() { const r = rollDice(4, 6).sort((a, b) => b - a); return r[0] + r[1] + r[2] }
  function gen3d6Once() { return rollDice(3, 6).reduce((a, b) => a + b, 0) }
  function toTokens(vals: number[]): RollToken[] { return vals.map((v) => ({ id: makeId(), value: v })) }

  function roll4d6dlPool() {
    const vals = Array.from({ length: 6 }, () => gen4d6dlOnce())
    setRollTokens(toTokens(vals))
    setAssignedFromPool({})
    setPointBuy(false)
  // Reset current ability scores so previous partial assignments don't persist
  props.onChange({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
  }
  function roll3d6Pool() {
    const vals = Array.from({ length: 6 }, () => gen3d6Once())
    setRollTokens(toTokens(vals))
    setAssignedFromPool({})
    setPointBuy(false)
  props.onChange({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
  }
  function roll1d20Pool() {
    const vals = Array.from({ length: 6 }, () => 1 + Math.floor(Math.random() * 20))
    setRollTokens(toTokens(vals))
    setAssignedFromPool({})
    setPointBuy(false)
  props.onChange({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
  }
  function applyScores(scores: number[]) {
    const sorted = [...scores].sort((a, b) => b - a)
    const next: Record<AbilityKey, number> = { ...props.abilities }
    order.forEach((k, i) => { next[k] = clamp(sorted[i] ?? 10, 3, 20) })
    props.onChange(next)
  }

  function autoAssignFromPool() {
    if (!rollTokens.length) return
    applyScores(rollTokens.map(t => t.value))
    setRollTokens([])
    setAssignedFromPool({})
  }
  function quickAssignByClass() {
    if (!rollTokens.length) return
    const CLASS_PRIORITIES: Record<string, AbilityKey[]> = {
      barbarian: ['str','con','dex','wis','cha','int'],
      fighter: ['str','con','dex','wis','cha','int'],
      rogue: ['dex','con','wis','int','cha','str'],
      wizard: ['int','con','dex','wis','cha','str'],
      cleric: ['wis','con','str','dex','cha','int'],
      druid: ['wis','con','dex','int','cha','str'],
      paladin: ['cha','str','con','wis','dex','int'],
      ranger: ['dex','wis','con','str','int','cha'],
      sorcerer: ['cha','con','dex','wis','int','str'],
      warlock: ['cha','con','dex','wis','int','str'],
      monk: ['dex','wis','con','str','int','cha'],
      bard: ['cha','dex','con','wis','int','str'],
    }
    const pri = (props.primaryClassId && CLASS_PRIORITIES[props.primaryClassId]) || order
    const sortedValues = [...rollTokens.map(t => t.value)].sort((a,b)=>b-a)
    const next: Record<AbilityKey, number> = { ...props.abilities }
    pri.forEach((ab,i)=> { if (sortedValues[i] != null) next[ab] = clamp(sortedValues[i],3,20) })
    props.onChange(next)
    setRollTokens([])
    setAssignedFromPool({})
  }
  function clearRolls() { setRollTokens([]); setAssignedFromPool({}) }

  // DnD handlers
  function onTokenDragStart(e: React.DragEvent<HTMLDivElement>, tokenId: string) {
    e.dataTransfer.setData('text/plain', tokenId)
    e.dataTransfer.effectAllowed = 'move'
  }
  function onAbilityDragOver(e: React.DragEvent<HTMLDivElement>) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  function onAbilityDrop(k: AbilityKey, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const tokenId = e.dataTransfer.getData('text/plain')
    if (!tokenId) return
    const tokenIdx = rollTokens.findIndex(t => t.id === tokenId)
    if (tokenIdx === -1) return
    const token = rollTokens[tokenIdx]
    const remaining = rollTokens.filter((_, i) => i !== tokenIdx)

    // If this ability already had a pool-assigned value, return it to pool
    const prev = assignedFromPool[k]
    const newPool = [...remaining]
    if (typeof prev === 'number') newPool.push({ id: makeId(), value: prev })

    // Update assignment map and abilities
    setAssignedFromPool({ ...assignedFromPool, [k]: token.value })
    setRollTokens(newPool)
    props.onChange({ ...props.abilities, [k]: clamp(token.value, 3, 20) })
  }

  function adjustAbility(k: AbilityKey, delta: number) {
  if (!pointBuy && !manualAbilityAdjust) return // guard when manual adjustments disabled
    if (!pointBuy) {
      props.onChange({ ...props.abilities, [k]: clamp((props.abilities[k] || 10) + delta, 3, 20) })
      return
    }
    const current = clamp(props.abilities[k] || 8, 8, 15)
    const next = clamp(current + delta, 8, 15)
    if (next === current) return
    const diff = pointCost(next) - pointCost(current)
    if (diff <= 0 || pointsRemaining - diff >= 0) {
      props.onChange({ ...props.abilities, [k]: next })
    }
  }

  function getAbilityBreakdown(k: AbilityKey) {
    const lines: Array<{ label: string; value: number; detail?: string }> = []
    // Base (raw) value
    const base = pointBuy ? Math.max(8, Math.min(15, props.abilities[k] || 8)) : (props.abilities[k] || 10)
    lines.push({ label: 'Base', value: base })
    // Race / TCE allocation
    if (props.tceActive) {
      const alloc = props.tceAlloc?.[k] || 0
      if (alloc) lines.push({ label: 'TCE Allocation', value: alloc })
    } else {
      const inc = (props.race?.asis as any)?.[k] || 0
      if (inc) lines.push({ label: props.race?.name ? `Race (${props.race.name})` : 'Race', value: inc })
    }
    // ASI improvements (cumulative)
    const asiInc = props.asi?.[k] || 0
    if (asiInc) lines.push({ label: 'ASI Improvements', value: asiInc })
    // Feat: Resilient (+1 chosen ability)
    try {
      const bs = (window as any).builderState
      if (bs?.selectedFeats?.includes('resilient') && bs?.featChoices?.resilientAbility === k) {
        lines.push({ label: 'Feat (Resilient)', value: 1 })
      }
    } catch {}
    const total = lines.reduce((s, l) => s + l.value, 0)
    return { lines, total }
  }

  return (
    <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 12, color: '#64748b' }}>Abilities</div>

      {/* Generators */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <Button size="sm" variant="outline" onClick={() => setGenOpen((v) => !v)}>{genOpen ? 'Close' : 'Generate'}</Button>
        {genOpen && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Button size="sm" variant="outline" onClick={roll4d6dlPool}>🎲 4d6 (drop lowest)</Button>
            <Button size="sm" variant="outline" onClick={roll3d6Pool}>🎲 3d6</Button>
            <Button size="sm" variant="outline" onClick={roll1d20Pool}>🎲 1d20</Button>
            <Button size="sm" variant="outline" onClick={() => { applyScores([15, 14, 13, 12, 10, 8]); clearRolls(); setPointBuy(false) }}>Standard Array</Button>
            {!pointBuy ? (
              <Button size="sm" variant="outline" onClick={() => { setPointBuy(true); clearRolls(); props.onChange({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }) }}>Point Buy (27)</Button>
            ) : (
              <>
                <span style={{ fontSize: 12, color: '#64748b' }}>Remaining: <strong>{pointsRemaining}</strong></span>
                <Button size="sm" variant="ghost" onClick={() => setPointBuy(false)}>Exit Point Buy</Button>
              </>
            )}
            {rollTokens.length ? (
              <Button size="sm" variant="ghost" onClick={clearRolls}>Clear Rolls</Button>
            ) : null}
          </div>
        )}
        <Button size="sm" variant="ghost" style={{ marginLeft: 'auto' }} onClick={() => { props.onChange({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }); clearRolls(); setPointBuy(false) }}>Reset</Button>
      </div>

  {/* Roll pool as draggable tokens (only for dice methods) */}
      {rollTokens.length ? (
        <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {rollTokens.map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => onTokenDragStart(e, t.id)}
                title={`Drag ${t.value} onto a stat`}
                style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #ef4444', background: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}
              >
                {t.value}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button size="sm" variant="outline" onClick={autoAssignFromPool}>Auto-assign high→low</Button>
            {props.primaryClassId && (
              <Button size="sm" variant="outline" onClick={quickAssignByClass}>Quick Assign {props.primaryClassName ? `(${props.primaryClassName})` : ''}</Button>
            )}
          </div>
        </div>
      ) : null}

  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
        {order.map((k) => (
          <div
            key={k}
            onDragOver={onAbilityDragOver}
            onDrop={(e) => onAbilityDrop(k, e)}
    style={{ padding: 8, borderRadius: 12, border: '1px solid var(--muted-border)', background: 'var(--card-bg)', display: 'grid', gap: 6, textAlign: 'center', justifyItems: 'center', alignItems: 'center' }}
          >
            <div style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--fg)', fontWeight: 700, letterSpacing: '.5px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>{k.toUpperCase()}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setBreakdownAllOpen(o => !o) }}
                style={{
                  border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center',
                  color: breakdownAllOpen ? '#0ea5e9' : '#64748b'
                }}
                aria-label={breakdownAllOpen ? 'Hide ability breakdowns' : 'Show ability breakdowns'}
                title={breakdownAllOpen ? 'Hide ability breakdowns' : 'Show ability breakdowns'}
              >
                <Info size={14} />
              </button>
            </div>
            {breakdownAllOpen && (() => { const bd = getAbilityBreakdown(k); return (
              <div style={{ fontSize: 10, lineHeight: 1.3, background: 'var(--pill-bg, #f1f5f9)', border: '1px solid var(--muted-border)', padding: 6, borderRadius: 6, width: '100%', textAlign: 'left' }}>
                {bd.lines.length <= 1 ? <div style={{ color: '#64748b' }}>No modifiers</div> : bd.lines.map((l, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{l.label}</span>
                    <span style={{ fontWeight: 500 }}>{l.value >= 0 ? '+' : ''}{l.value}</span>
                  </div>
                ))}
                {bd.lines.length > 1 && (
                  <div style={{ marginTop: 4, borderTop: '1px solid #e2e8f0', paddingTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <strong>Total</strong>
                    <strong>{bd.total}</strong>
                  </div>
                )}
              </div>
            ) })()}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Button size="icon" variant="outline" disabled={!canManualAdjust} onClick={() => adjustAbility(k, -1)}>−</Button>
              {(() => { const base = pointBuy ? Math.max(8, Math.min(15, props.abilities[k] || 8)) : (props.abilities[k] || 10); const eff = final[k]; return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, lineHeight: 1 }}>
                  <div style={{ fontWeight: 600 }}>{eff}</div>
                  {eff !== base && <div style={{ fontSize: 10, color: '#64748b' }}>({base})</div>}
                </div>
              ) })()}
              <Button size="icon" variant="outline" disabled={!canManualAdjust} onClick={() => adjustAbility(k, +1)}>+</Button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, width: '100%' }}>
              <div style={{ background: 'var(--pill-bg, #f1f5f9)', padding: '4px 6px', borderRadius: 6, fontSize: 11, display: 'grid', gap: 2 }}>
                <span style={{ fontSize: 9, letterSpacing: '.5px', textTransform: 'uppercase', color: '#64748b' }}>Mod</span>
                <span style={{ fontSize: 12, fontWeight: 400 }}>{mod(final[k]) >= 0 ? '+' : ''}{mod(final[k])}</span>
              </div>
              {(() => { const sv = props.saves?.[k]; const prof = props.saveProfs?.includes(k); const val = typeof sv === 'number' ? (sv >= 0 ? '+' : '') + sv : (mod(final[k]) >= 0 ? '+' : '') + mod(final[k]); return (
                <div style={{ background: prof ? '#e0f2fe' : 'var(--pill-bg, #f1f5f9)', padding: '4px 6px', borderRadius: 6, fontSize: 11, display: 'grid', gap: 2, border: prof ? '1px solid #38bdf8' : '1px solid transparent' }}>
                  <span style={{ fontSize: 9, letterSpacing: '.5px', textTransform: 'uppercase', color: prof ? '#0369a1' : '#64748b' }}>Save</span>
                  <span style={{ fontSize: 12, fontWeight: 400, color: prof ? '#0ea5e9' : 'inherit' }}>{val}</span>
                </div>
              ) })()}
            </div>
            {typeof assignedFromPool[k] === 'number' ? (
              <div style={{ fontSize: 11, color: '#64748b' }}>Assigned: {assignedFromPool[k]}</div>
            ) : (
              rollTokens.length ? <div style={{ fontSize: 11, color: '#94a3b8', animation: 'abilityDropPulse 2.2s ease-in-out infinite' }}>Drop a roll here</div> : null
            )}
          </div>
        ))}
      </div>
      {/* Passive Planner sync prompt */}
  {/* Overlay moved to Builder root */}
    </div>
  )
}

function finalAbility(abilities: Record<AbilityKey, number>, race: Race, asi?: Record<AbilityKey, number>, opts?: RuleOpts): Record<AbilityKey, number> {
  const out: Record<AbilityKey, number> = { ...{ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, ...abilities }
  if (opts?.tceActive) {
    // Apply flexible TCE allocation instead of race ASIs. Assume alloc already respects mode/budget.
    const alloc = opts.tceAlloc || { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
    ;(['str','dex','con','int','wis','cha'] as AbilityKey[]).forEach((k) => {
      const inc = Math.max(0, Math.floor(alloc[k] || 0))
      out[k] = (out[k] || 10) + inc
    })
  } else if (opts?.customOrigin) {
    // Ignore native racial ASIs and apply custom +2 / +1 allocation
    if (opts.originAlloc?.plus2) out[opts.originAlloc.plus2] = (out[opts.originAlloc.plus2] || 10) + 2
    if (opts.originAlloc?.plus1 && opts.originAlloc.plus1 !== opts.originAlloc.plus2) out[opts.originAlloc.plus1] = (out[opts.originAlloc.plus1] || 10) + 1
  } else {
    Object.entries(race?.asis || {}).forEach(([k, inc]) => { const kk = k as AbilityKey; out[kk] = (out[kk] || 10) + (inc || 0) })
  }
  if (asi) {
    (['str','dex','con','int','wis','cha'] as AbilityKey[]).forEach((k) => {
      const inc = Math.max(0, Math.floor(asi[k] || 0))
      out[k] = (out[k] || 10) + inc
    })
  }
  // Feat: Resilient (+1 to chosen ability) applied after ASIs
  try {
    const bs = (window as any).builderState
    if (bs?.selectedFeats?.includes('resilient')) {
      const ra = bs.featChoices?.resilientAbility as AbilityKey | undefined
      if (ra) out[ra] = (out[ra] || 10) + 1
    }
  } catch {}
  return out
}

function ItemCard({ item, onAdd }: { item: Equipment; onAdd: () => void }) {
  const tags = (item as any).tags as string[] | undefined
  return (
  <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--muted-border)', background: 'var(--card-bg)', display: 'grid', gap: 6, minHeight: 96 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {item.type === 'weapon' && <Sword size={16} />}
        {item.type === 'shield' && <Shield size={16} />}
        {item.type === 'armor' && <ArmorIcon size={16} />}
        <span style={{ fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
        <Button size="icon" onClick={onAdd} aria-label={`Add ${item.name}`}><Plus size={16} /></Button>
      </div>
      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.3 }}>
        {item.type === 'weapon' && (item as any).dmg}
        {item.type === 'armor' && (
          <>AC {(item as any).ac}{typeof (item as any).dexMax !== 'undefined' ? `, Dex cap ${((item as any).dexMax === (Infinity as any)) ? '—' : (item as any).dexMax}` : ''}</>
        )}
        {item.type === 'shield' && `+${(item as any).ac || 2} AC`}
        {(item as any).cost ? ` • ${(item as any).cost} gp` : ''}
        {(item as any).weight ? ` • ${(item as any).weight} lb` : ''}
      </div>
      {tags?.length ? (
        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.2 }}>
          {tags.join(' • ')}
        </div>
      ) : null}
    </div>
  )
}

function LoadoutRow({ item, onRemove }: { item: Equipment; onRemove: () => void }) {
  return (
  <div style={{ padding: 6, borderRadius: 10, border: '1px solid var(--muted-border)', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {item.type === 'weapon' && <Sword size={16} />}
        {item.type === 'shield' && <Shield size={16} />}
  {item.type === 'armor' && <ArmorIcon size={16} />}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {item.type === 'weapon' ? (item as any).dmg : item.type === 'armor' ? `AC ${(item as any).ac}` : item.type}
          </div>
          {item.type === 'armor' && (item as any).tags?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(item as any).tags.map((t: string) => <span key={t} style={{ padding: '1px 6px', borderRadius: 999, border: '1px solid #e2e8f0', fontSize: 10 }}>{t}</span>)}
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
  {(SUBACTIONS_BY_ITEM[(item as any).id] || []).map((s) => <span key={s} style={{ padding: '1px 6px', borderRadius: 999, background: 'var(--pill-bg)', border: '1px solid var(--muted-border)', fontSize: 11 }}>{s}</span>)}
        <Button size="sm" variant="ghost" onClick={onRemove} style={{ padding: '4px 6px' }}>Remove</Button>
      </div>
    </div>
  )
}

// ScoreBlock removed

// ComparePanel removed

function ClassManager(props: { classes: Array<{ klass: Klass; level: number; subclass?: Subclass }>; onChange: (v: Array<{ klass: Klass; level: number; subclass?: Subclass }>, levelAppend?: string[]) => void; abilities?: Record<AbilityKey, number>; race?: Race; asi?: Record<AbilityKey, number> }) {
  const [addOpen, setAddOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const addRef = useRef<HTMLDivElement | null>(null)
  const totalLevel = props.classes.reduce((s: number, c: { klass: Klass; level: number; subclass?: Subclass }) => s + c.level, 0)
  const maxTotal = 20
  const available: Klass[] = CLASSES
    .filter((k) => !props.classes.some((c) => c.klass.id === k.id))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
  const canAdd = totalLevel < maxTotal && available.length > 0

  // Rules context for multiclass enforcement & flexible ASIs
  const { multiclassReqs, tceCustomAsi, tceAlloc, tceMode } = useRules()

  // Compute final abilities (needed only if enforcing requirements)
  const finalAbils = useMemo(() => {
    if (!multiclassReqs) return undefined
    if (!props.abilities || !props.race) return undefined
    return finalAbility(props.abilities, props.race, props.asi, { tceActive: tceCustomAsi, tceAlloc, tceMode })
  }, [multiclassReqs, props.abilities, props.race, props.asi, tceCustomAsi, tceMode, JSON.stringify(tceAlloc)])

  // Shared prereq map (keep in sync with validateChoice)
  const prereqMap: Record<string, Array<{ ab: AbilityKey; min: number }> | ((fa: Record<AbilityKey, number>) => boolean)> = useMemo(() => ({
    barbarian: [{ ab: 'str', min: 13 }],
    bard: [{ ab: 'cha', min: 13 }],
    cleric: [{ ab: 'wis', min: 13 }],
    druid: [{ ab: 'wis', min: 13 }],
    fighter: (fa) => (fa.str >= 13 || fa.dex >= 13),
    monk: [{ ab: 'dex', min: 13 }, { ab: 'wis', min: 13 }],
    paladin: [{ ab: 'str', min: 13 }, { ab: 'cha', min: 13 }],
    ranger: [{ ab: 'dex', min: 13 }, { ab: 'wis', min: 13 }],
    rogue: [{ ab: 'dex', min: 13 }],
    sorcerer: [{ ab: 'cha', min: 13 }],
    warlock: [{ ab: 'cha', min: 13 }],
    wizard: [{ ab: 'int', min: 13 }],
  }), [])

  function meetsPrereq(k: Klass): boolean {
    // Only restrict if enforcement ON and we're adding a second+ class (i.e. already have at least one class picked)
    if (!multiclassReqs) return true
    if (props.classes.length === 0) return true
    if (!finalAbils) return true // missing data; fail open
    const r = prereqMap[k.id]
    if (!r) return true
    if (typeof r === 'function') return r(finalAbils)
    return (r as Array<{ ab: AbilityKey; min: number }>).every(req => (finalAbils[req.ab] || 0) >= req.min)
  }

  useEffect(() => {
    if (!addOpen) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setAddOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAddOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [addOpen])

  function setLevelAt(idx: number, next: number) {
    const other = totalLevel - props.classes[idx].level
    const clamped = clamp(next, 1, Math.max(1, Math.min(maxTotal - other, 20)))
    const out = props.classes.map((c, i) => (i === idx ? { ...c, level: clamped, subclass: c.subclass && clamped < (c.subclass?.unlockLevel || Infinity) ? undefined : c.subclass } : c))
    // If increasing level, append class id for each added level difference
    const diff = clamped - props.classes[idx].level
    props.onChange(out, diff > 0 ? Array(diff).fill(props.classes[idx].klass.id) : undefined)
  }
  function removeAt(idx: number) {
    const out = props.classes.filter((_, i) => i !== idx)
    props.onChange(out)
  }
  function addClass(k: Klass) {
    if (props.classes.some((c) => c.klass.id === k.id)) return
    const other = totalLevel
    if (other >= maxTotal) return
    props.onChange([...props.classes, { klass: k, level: 1 }], [k.id])
    setAddOpen(false)
  }
  function setSubclass(idx: number, sc?: Subclass) {
    const out = props.classes.map((c, i) => (i === idx ? { ...c, subclass: sc } : c))
    props.onChange(out)
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center' }}>
          Classes (Total Level: <strong>{totalLevel}</strong>)
        </div>
        <div style={{ position: 'relative' }} ref={addRef}>
          <Button size="sm" variant="outline" onClick={() => setAddOpen((v) => !v)} disabled={!canAdd}>
            Add Class
          </Button>
          {addOpen ? (
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, background: 'var(--card-bg)', border: '1px solid var(--muted-border)', borderRadius: 8, boxShadow: '0 8px 16px rgba(15,23,42,0.25)', zIndex: 20, minWidth: 220 }}>
              <div style={{ maxHeight: 240, overflowY: 'auto', display: 'grid' }}>
                {available.map((k: Klass) => {
                  const ok = meetsPrereq(k)
                  const disabled = !ok
                  const prereq = prereqMap[k.id]
                  let hint: string | undefined
                  if (disabled && prereq) {
                    if (typeof prereq === 'function') hint = 'Requires STR 13 or DEX 13'
                    else hint = (prereq as Array<{ ab: AbilityKey; min: number }>).map(p => `${p.ab.toUpperCase()} ${p.min}+`).join(' & ')
                  }
                  return (
                    <Button
                      key={k.id}
                      size="sm"
                      variant="ghost"
                      style={{ width: '100%', justifyContent: 'flex-start', opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
                      disabled={disabled}
                      title={disabled && hint ? `Requires: ${hint}` : undefined}
                      onClick={() => { if (!disabled) addClass(k) }}
                    >
                      {k.name}
                      {disabled && hint ? <span style={{ fontSize: 10, marginLeft: 6, color: '#64748b' }}>({hint})</span> : null}
                    </Button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {props.classes.map((c: { klass: Klass; level: number; subclass?: Subclass }, idx: number) => (
          <div key={c.klass.id} style={{ padding: 8, borderRadius: 12, border: '1px solid var(--muted-border)', background: 'var(--card-bg)', display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setExpanded(e => ({ ...e, [c.klass.id]: !e[c.klass.id] }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                  aria-label={expanded[c.klass.id] ? `Collapse ${c.klass.name} features` : `Expand ${c.klass.name} features`}
                >
                  {expanded[c.klass.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span>{c.klass.name}</span>
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Button size="icon" variant="outline" onClick={() => setLevelAt(idx, c.level - 1)}>−</Button>
                  <Pill>{c.level}</Pill>
                  <Button size="icon" variant="outline" onClick={() => setLevelAt(idx, c.level + 1)}>+</Button>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => removeAt(idx)}>Remove</Button>
            </div>
            {c.klass.subclasses?.length ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Subclass</div>
                {c.level < (c.klass.subclasses[0]?.unlockLevel || Infinity) ? (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Unlocks at level {Math.min(...c.klass.subclasses.map((s: Subclass) => s.unlockLevel))}</span>
                ) : (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {c.klass.subclasses.map((s: Subclass) => (
                      <Button
                        key={s.id}
                        size="sm"
                        variant={c.subclass?.id === s.id ? 'default' : 'outline'}
                        onClick={() => setSubclass(idx, s)}
                      >{s.name}</Button>
                    ))}
                    {c.subclass ? (
                      <Button size="sm" variant="ghost" onClick={() => setSubclass(idx, undefined)}>Clear</Button>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
            {expanded[c.klass.id] && (() => {
              const feats: Array<{ name: string; text: string }> = []
              for (let lvl = 1; lvl <= c.level; lvl++) {
                const arr = c.klass.featuresByLevel?.[lvl]
                if (arr) arr.forEach(f => feats.push({ ...f, level: lvl } as any))
              }
              return (
                <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
                  {feats.length ? feats.map((f, i) => (
                    <div key={i} style={{ padding: 6, borderRadius: 8, border: '1px solid var(--muted-border)', background: 'var(--pill-bg, #f1f5f9)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span>{f.name}</span>
                        {'level' in f && (f as any).level ? <span style={{ fontSize: 10, color: '#64748b' }}>L{(f as any).level}</span> : null}
                      </div>
                      <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.3 }}>{f.text}</div>
                    </div>
                  )) : <div style={{ fontSize: 11, color: '#64748b' }}>No features for current level.</div>}
                </div>
              )
            })()}
          </div>
        ))}

        {/* Placeholder for empty state */}
        {props.classes.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: 8, borderRadius: 12, border: '1px solid var(--muted-border)', background: 'var(--card-bg)', textAlign: 'center', color: 'var(--muted-fg)' }}>
            No classes added yet. Use "Add Class" to start building your character.
          </div>
        )}
      </div>
    </div>
  )
}

// Hit Point Manager
function HPManager({ classes, abils, method, onMethodChange, rolls, setRolls, manualTotal, setManualTotal }: {
  classes: Array<{ klass: Klass; level: number; subclass?: Subclass }>
  abils: Record<AbilityKey, number>
  method: 'fixed' | 'rollEach' | 'maxFirstFixed' | 'maxEach' | 'manual'
  onMethodChange: (m: 'fixed' | 'rollEach' | 'maxFirstFixed' | 'maxEach' | 'manual') => void
  rolls: Record<string, number[]>
  setRolls: React.Dispatch<React.SetStateAction<Record<string, number[]>>>
  manualTotal: number | ''
  setManualTotal: React.Dispatch<React.SetStateAction<number | ''>>
}) {
  const conScore = abils.con || 10
  const CON_MOD = mod(conScore)

  function hitDieFor(classId: string): number {
    const k = CLASSES.find(c => c.id === classId)
    return k?.hitDie || 8
  }
  function averageDie(d: number) { return Math.ceil((d / 2) + 0.5) } // 5e fixed avg rule

  function rollDie(d: number) { return 1 + Math.floor(Math.random() * d) }

  function rollLevels(classId: string, count: number) {
    setRolls(r => ({ ...r, [classId]: Array.from({ length: count }, (_, i) => r[classId]?.[i] || rollDie(hitDieFor(classId))) }))
  }

  // compute total HP
  let total = 0
  if (method === 'manual') {
    total = typeof manualTotal === 'number' ? manualTotal : 0
  } else {
    classes.forEach(c => {
      const hd = hitDieFor(c.klass.id)
      if (method === 'maxEach') {
        total += (hd + CON_MOD) * c.level
      } else if (method === 'maxFirstFixed') {
        const extraLevels = Math.max(0, c.level - 1)
        const avg = averageDie(hd)
        total += hd + CON_MOD // first level max
        total += extraLevels * (avg + CON_MOD)
      } else if (method === 'fixed') {
        const avg = averageDie(hd)
        total += c.level * (avg + CON_MOD)
      } else if (method === 'rollEach') {
        const arr = rolls[c.klass.id] || []
        // ensure we have enough rolls
        if (arr.length < c.level) rollLevels(c.klass.id, c.level)
        total += arr.slice(0, c.level).reduce((s, v) => s + v + CON_MOD, 0)
      }
    })
  }
  if (total < 1) total = 1

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(([ 
          ['maxFirstFixed', 'Max 1st + Avg Later'],
          ['fixed', 'Average Each Level'],
          ['rollEach', 'Roll Each Level'],
          ['maxEach', 'Max Every Level'],
          ['manual', 'Manual Total'],
        ] as Array<[string, string]>)).map(([k, label]) => (
          <Button key={k} size="sm" variant={method === k ? 'default' : 'outline'} onClick={() => onMethodChange(k as any)}>{label}</Button>
        ))}
      </div>
      {method === 'manual' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" value={manualTotal} onChange={e => setManualTotal(e.target.value === '' ? '' : parseInt(e.target.value))} placeholder="Enter total HP" style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--muted-border)', width: 140 }} />
        </div>
      )}
      {method === 'rollEach' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {classes.map(c => {
            const hd = hitDieFor(c.klass.id)
            const arr = rolls[c.klass.id] || []
            return (
              <div key={c.klass.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{c.klass.name} d{hd}</div>
                <Button size="sm" variant="outline" onClick={() => rollLevels(c.klass.id, c.level)}>Roll Missing</Button>
                {Array.from({ length: c.level }, (_, i) => (
                  <span key={i} style={{ padding: '2px 6px', borderRadius: 6, background: 'var(--pill-bg, #f1f5f9)', border: '1px solid var(--muted-border)', fontSize: 11 }}>
                    {arr[i] != null ? arr[i] : '?'}+{CON_MOD}
                  </span>
                ))}
              </div>
            )
          })}
        </div>
      )}
      <div style={{ fontSize: 12, color: '#64748b' }}>CON Mod applied per level. Minimum 1 HP enforced.</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Total Hit Points: {total}</div>
    </div>
  )
}

function RaceSelector(props: { value: Race; onChange: (v: Race) => void }) {
  const [showHumanSubs, setShowHumanSubs] = useState(false)
  const [showElfSubs, setShowElfSubs] = useState(false)
  const [showDwarfSubs, setShowDwarfSubs] = useState(false)
  const [showHalflingSubs, setShowHalflingSubs] = useState(false)
  const [showDragonSubs, setShowDragonSubs] = useState(false)
  const [showTieflingSubs, setShowTieflingSubs] = useState(false)
  const [showGenasiSubs, setShowGenasiSubs] = useState(false)
  const [showGnomeSubs, setShowGnomeSubs] = useState(false)
  // Subrace buttons use a distinct color scheme to differentiate from parent buttons
  const subBtnStyle = (selected: boolean): React.CSSProperties =>
    selected
      ? { background: '#4f46e5', color: 'white', borderColor: '#4f46e5' } // indigo selected
      : { borderColor: '#4f46e5', color: '#4f46e5' } // indigo outline
  const humanBase = RACES.find(r => r.id === 'human')!
  const humanVar = RACES.find(r => r.id === 'human-variant')!
  const elfWood = RACES.find(r => r.id === 'elf-wood')!
  const elfHigh = RACES.find(r => r.id === 'elf-high')!
  const elfDrow = RACES.find(r => r.id === 'elf-drow')!
  const dwarfHill = RACES.find(r => r.id === 'dwarf-hill')!
  const dwarfMountain = RACES.find(r => r.id === 'dwarf-mountain')!
  const halflingLightfoot = RACES.find(r => r.id === 'halfling-lightfoot')!
  const halflingStout = RACES.find(r => r.id === 'halfling-stout')!
  const dragonbornBase = RACES.find(r => r.id === 'dragonborn')!
  const dragonVariants = RACES.filter(r => r.id.startsWith('dragonborn-'))
  const dragonVariantIds = new Set(dragonVariants.map(r => r.id))
  const tieflingBase = RACES.find(r => r.id === 'tiefling')!
  const tieflingVariants = RACES.filter(r => r.id.startsWith('tiefling-') && r.id !== 'tiefling')
  const tieflingVariantIds = new Set(tieflingVariants.map(r => r.id))
  const genasiVariants = RACES.filter(r => r.id.startsWith('genasi-'))
  const genasiVariantIds = new Set(genasiVariants.map(r => r.id))
  const gnomeForest = RACES.find(r => r.id === 'gnome-forest')
  const gnomeRock = RACES.find(r => r.id === 'gnome-rock')
  const gnomeDeep = RACES.find(r => r.id === 'gnome-deep')
  const excludeIds = new Set<string>([
    'human','human-variant','elf-wood','elf-high','elf-drow','dwarf-hill','dwarf-mountain','halfling-lightfoot','halfling-stout','dragonborn','tiefling','gnome',
  'gnome-forest','gnome-rock','gnome-deep',
    ...Array.from(dragonVariantIds),
    ...Array.from(tieflingVariantIds),
    ...Array.from(genasiVariantIds)
  ])
  const others = RACES.filter(r => !excludeIds.has(r.id))
  const isHumanSelected = props.value.id === 'human' || props.value.id === 'human-variant'
  const isElfSelected = props.value.id === 'elf-wood' || props.value.id === 'elf-high' || props.value.id === 'elf-drow'
  const isDwarfSelected = props.value.id === 'dwarf-hill' || props.value.id === 'dwarf-mountain'
  const isHalflingSelected = props.value.id === 'halfling-lightfoot' || props.value.id === 'halfling-stout'
  const isDragonSelected = props.value.id === 'dragonborn' || props.value.id.startsWith('dragonborn-')
  const isTieflingSelected = props.value.id === 'tiefling' || props.value.id.startsWith('tiefling-')
  const isGenasiSelected = props.value.id.startsWith('genasi-')
  const isGnomeSelected = props.value.id.startsWith('gnome-')

  // Need featsEnabled to gate Variant Human (requires feats optional rule)
  const { featsEnabled } = useRules()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {/* Human group button */}
      <Button size="sm" variant={isHumanSelected ? 'default' : 'outline'} onClick={() => setShowHumanSubs((v) => !v)}>Human</Button>
      {showHumanSubs && (
        <>
          <Button size="sm" variant={props.value.id === 'human' ? 'default' : 'outline'} onClick={() => props.onChange(humanBase)} style={subBtnStyle(props.value.id === 'human')}>Base</Button>
          {featsEnabled ? (
            <Button size="sm" variant={props.value.id === 'human-variant' ? 'default' : 'outline'} onClick={() => props.onChange(humanVar)} style={subBtnStyle(props.value.id === 'human-variant')}>Variant</Button>
          ) : null}
        </>
      )}

      {/* Elf group button */}
      <Button size="sm" variant={isElfSelected ? 'default' : 'outline'} onClick={() => setShowElfSubs((v) => !v)}>Elf</Button>
      {showElfSubs && (
        <>
          <Button size="sm" variant={props.value.id === 'elf-wood' ? 'default' : 'outline'} onClick={() => props.onChange(elfWood)} style={subBtnStyle(props.value.id === 'elf-wood')}>Wood</Button>
          <Button size="sm" variant={props.value.id === 'elf-high' ? 'default' : 'outline'} onClick={() => props.onChange(elfHigh)} style={subBtnStyle(props.value.id === 'elf-high')}>High</Button>
          <Button size="sm" variant={props.value.id === 'elf-drow' ? 'default' : 'outline'} onClick={() => props.onChange(elfDrow)} style={subBtnStyle(props.value.id === 'elf-drow')}>Drow</Button>
        </>
      )}

      {/* Dwarf group button */}
      <Button size="sm" variant={isDwarfSelected ? 'default' : 'outline'} onClick={() => setShowDwarfSubs((v) => !v)}>Dwarf</Button>
      {showDwarfSubs && (
        <>
          <Button size="sm" variant={props.value.id === 'dwarf-hill' ? 'default' : 'outline'} onClick={() => props.onChange(dwarfHill)} style={subBtnStyle(props.value.id === 'dwarf-hill')}>Hill</Button>
          <Button size="sm" variant={props.value.id === 'dwarf-mountain' ? 'default' : 'outline'} onClick={() => props.onChange(dwarfMountain)} style={subBtnStyle(props.value.id === 'dwarf-mountain')}>Mountain</Button>
        </>
      )}

      {/* Halfling group button */}
      <Button size="sm" variant={isHalflingSelected ? 'default' : 'outline'} onClick={() => setShowHalflingSubs((v) => !v)}>Halfling</Button>
      {showHalflingSubs && (
        <>
          <Button size="sm" variant={props.value.id === 'halfling-lightfoot' ? 'default' : 'outline'} onClick={() => props.onChange(halflingLightfoot)} style={subBtnStyle(props.value.id === 'halfling-lightfoot')}>Lightfoot</Button>
          <Button size="sm" variant={props.value.id === 'halfling-stout' ? 'default' : 'outline'} onClick={() => props.onChange(halflingStout)} style={subBtnStyle(props.value.id === 'halfling-stout')}>Stout</Button>
        </>
      )}

      {/* Dragonborn group button */}
      <Button size="sm" variant={isDragonSelected ? 'default' : 'outline'} onClick={() => setShowDragonSubs((v) => !v)}>Dragonborn</Button>
      {showDragonSubs && (
        <>
          <Button size="sm" variant={props.value.id === 'dragonborn' ? 'default' : 'outline'} onClick={() => props.onChange(dragonbornBase)} style={subBtnStyle(props.value.id === 'dragonborn')}>Base</Button>
          {dragonVariants.map((r) => {
            const label = r.name.replace(/^Dragonborn\s*\(/, '').replace(/\)$/, '')
            return (
              <Button key={r.id} size="sm" variant={props.value.id === r.id ? 'default' : 'outline'} onClick={() => props.onChange(r)} style={subBtnStyle(props.value.id === r.id)}>{label}</Button>
            )
          })}
        </>
      )}

      {/* Tiefling group button */}
      <Button size="sm" variant={isTieflingSelected ? 'default' : 'outline'} onClick={() => setShowTieflingSubs(v => !v)}>Tiefling</Button>
      {showTieflingSubs && (
        <>
          <Button size="sm" variant={props.value.id === 'tiefling' ? 'default' : 'outline'} onClick={() => props.onChange(tieflingBase)} style={subBtnStyle(props.value.id === 'tiefling')}>Base</Button>
          {tieflingVariants.map(r => {
            const label = r.name.replace(/^Tiefling\s*\(/, '').replace(/\)$/, '')
            return (
              <Button key={r.id} size="sm" variant={props.value.id === r.id ? 'default' : 'outline'} onClick={() => props.onChange(r)} style={subBtnStyle(props.value.id === r.id)}>{label}</Button>
            )
          })}
        </>
      )}

  {/* Genasi group button */}
      <Button size="sm" variant={isGenasiSelected ? 'default' : 'outline'} onClick={() => setShowGenasiSubs(v => !v)}>Genasi</Button>
      {showGenasiSubs && (
        <>
          {genasiVariants.map(r => {
            const label = r.name.replace(/^Genasi\s*\(/, '').replace(/\)$/, '')
            return (
              <Button key={r.id} size="sm" variant={props.value.id === r.id ? 'default' : 'outline'} onClick={() => props.onChange(r)} style={subBtnStyle(props.value.id === r.id)}>{label}</Button>
            )
          })}
        </>
      )}

      {/* Gnome group button */}
      <Button size="sm" variant={isGnomeSelected ? 'default' : 'outline'} onClick={() => setShowGnomeSubs(v => !v)}>Gnome</Button>
      {showGnomeSubs && (
        <>
          {gnomeForest && <Button size="sm" variant={props.value.id === 'gnome-forest' ? 'default' : 'outline'} onClick={() => props.onChange(gnomeForest)} style={subBtnStyle(props.value.id === 'gnome-forest')}>Forest</Button>}
          {gnomeRock && <Button size="sm" variant={props.value.id === 'gnome-rock' ? 'default' : 'outline'} onClick={() => props.onChange(gnomeRock)} style={subBtnStyle(props.value.id === 'gnome-rock')}>Rock</Button>}
          {gnomeDeep && <Button size="sm" variant={props.value.id === 'gnome-deep' ? 'default' : 'outline'} onClick={() => props.onChange(gnomeDeep)} style={subBtnStyle(props.value.id === 'gnome-deep')}>Deep</Button>}
        </>
      )}

      {/* Other races remain direct buttons */}
      {others.map(r => (
        <Button key={r.id} size="sm" variant={props.value.id === r.id ? 'default' : 'outline'} onClick={() => props.onChange(r)}>{r.name}</Button>
      ))}
    </div>
  )
}
function SkillSourceGraph({ name, sources }: { name: string; sources: string[] }) {
  // Normalize and label sources
  const labelFor = (src: string) => {
    if (src === 'bg') return 'Background'
    if (src === 'race') return 'Race'
    if (src === 'race-pick') return 'Race (replacement)'
    if (src === 'manual') return 'Manual'
  if (src === 'feat:skilled') return 'Skilled (feat)'
    if (src.startsWith('class:')) {
      const id = src.split(':')[1]
      const cname = CLASSES.find(c => c.id === id)?.name || id
      return `Class: ${cname}`
    }
    return src
  }
  const uniq = Array.from(new Set(sources))
  const width = 480
  const srcCount = Math.max(1, uniq.length)
  const height = 80 + (srcCount > 3 ? Math.ceil((srcCount - 3) / 3) * 26 : 0)
  const centerX = width / 2
  const skillY = 20
  // Layout sources in a row beneath
  const rowY = 56
  const perRow = 3
  const colW = width / Math.min(perRow, srcCount)
  const nodes = uniq.map((src, i) => {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    const cx = srcCount <= perRow ? (colW * (col + 0.5)) : ((width / perRow) * (col + 0.5))
    const cy = rowY + row * 26
    return { id: src, label: labelFor(src), x: cx, y: cy }
  })
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        style={{ display: 'block' }}
      >
        {/* Skill node */}
        <g>
          <rect x={centerX - 60} y={skillY - 14} width={120} height={28} rx={8} ry={8} fill="#0ea5e9" stroke="#0284c7" />
          <text x={centerX} y={skillY + 4} textAnchor="middle" fontSize="12" fill="#fff">{name}</text>
        </g>
        {/* Edges and source nodes */}
        {nodes.map((n) => (
          <g key={n.id}>
            <line x1={centerX} y1={skillY + 14} x2={n.x} y2={n.y - 12} stroke="#94a3b8" strokeWidth={1.5} />
            <rect x={n.x - 70} y={n.y - 12} width={140} height={24} rx={6} ry={6} fill="#f1f5f9" stroke="#e2e8f0" />
            <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="11" fill="#0f172a">{n.label}</text>
          </g>
        ))}
        {nodes.length === 0 && (
          <text x={centerX} y={rowY} textAnchor="middle" fontSize="12" fill="#94a3b8">No current sources</text>
        )}
      </svg>
    </div>
  )
}

function CombinedSourcesGraph({ skills, skillSources, race, raceReplPicks, classes, background }: { skills: Array<{ id: string; name: string }>; skillSources: Record<string, string[]>; race?: Race; raceReplPicks?: string[]; classes?: Array<{ klass: Klass; level: number; subclass?: Subclass }>; background?: Background }) {
  // Determine availability from classes and race
  const classAvailSkillIds = new Set<string>((classes || []).flatMap((c) => CLASS_SKILL_CHOICES[c.klass.id]?.options || []))
  const skillHasSources = (id: string) => (skillSources[id] || []).length > 0
  // Race replacement availability only when current race grants a skill that conflicts with another non-race source
  const raceGrantedSkillIds = race ? (race.traits || []).flatMap((t) => RACE_TRAIT_SKILLS[t.id] || []) : []
  const raceConflicts = raceGrantedSkillIds.filter((sid) => (skillSources[sid] || []).some((s) => s !== 'race' && s !== 'race-pick' && s !== 'manual'))
  const isEligibleForRaceReplacement = (id: string) => {
    if (!race || raceConflicts.length === 0) return false
    const srcs = skillSources[id] || []
    const hasOther = srcs.some((s) => s !== 'race' && s !== 'race-pick' && s !== 'manual')
    return !hasOther
  }
  // Build included skill set: with sources OR available via class OR available via race replacement
  const includedSkillIds = new Set<string>()
  skills.forEach((s) => {
    if (skillHasSources(s.id) || classAvailSkillIds.has(s.id) || isEligibleForRaceReplacement(s.id)) includedSkillIds.add(s.id)
  })
  if (includedSkillIds.size === 0) {
    return (
      <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
        No skill sources yet. Add a class, pick a race/background, select a feat that grants a skill, or manually toggle a skill in the List tab to see the source graph populate.
      </div>
    )
  }
  // Choice sources are those the user explicitly toggles on a per-skill basis (manual, race replacement, feats).
  // Class sources act like fixed once granted (we already render availability with dotted edges),
  // so we intentionally DO NOT classify class:<id> here to avoid duplicating nodes on both sides.
  const isChoice = (src: string) => src === 'manual' || src === 'race-pick' || src.startsWith('feat:')
  // Gather unique source keys from skills that have sources, split by type
  const allKeys = Array.from(new Set(skills.filter((s) => skillHasSources(s.id)).flatMap((s) => (skillSources[s.id] || []))))
  const fixedKeys = allKeys.filter((k) => !isChoice(k))
  const choiceKeys = allKeys.filter((k) => isChoice(k))
  const labelFor = (src: string) => {
    if (src === 'bg') return `Background${background?.name ? `: ${background.name}` : ''}`
    if (src === 'race') return `Race${race?.name ? `: ${race.name}` : ''}`
    if (src === 'race-pick') return 'Race (replacement)'
    if (src === 'manual') return 'Manual'
    if (src.startsWith('feat:')) {
      const featId = src.split(':')[1]
      // Friendly labels for known feat skill sources
      if (featId === 'skilled') return 'Feat: Skilled'
      if (featId === 'prodigy') return 'Feat: Prodigy'
      return `Feat: ${featId.replace(/(^[a-z])/, c => c.toUpperCase())}`
    }
    if (src.startsWith('class:')) {
      const id = src.split(':')[1]
      const cname = CLASSES.find(c => c.id === id)?.name || id
      return `Class: ${cname}`
    }
    return src
  }

  // Layout constants (three columns: fixed sources | skills | choice sources)
  const padding = 16
  const colGap = 256 // another tiny step for breathing room
  const rowGap = 32
  const srcW = 160   // compact source/choice nodes
  const skillW = 160 // compact skill nodes
  const leftX = padding + srcW / 2
  const midX = leftX + colGap
  const rightX = midX + colGap

  // Node centers
  // Ensure Race appears on the left if race replacement availability exists
  const fixedKeysAug = [...fixedKeys]
  if (race && raceConflicts.length > 0 && !fixedKeysAug.includes('race')) fixedKeysAug.push('race')
  const leftFixedNodes = fixedKeysAug.map((key, i) => ({ id: key, label: labelFor(key), x: leftX, y: padding + i * rowGap }))
  const classAvailKeys = (classes || [])
    .filter((c) => CLASS_SKILL_CHOICES[c.klass.id])
    .map((c) => `class:${c.klass.id}`)
  // Avoid duplicating class nodes: if a class has already granted a skill (so class:<id> is in fixedKeysAug)
  // we don't render a second availability node for it.
  const leftClassNodes = classAvailKeys
    .filter((key) => !fixedKeysAug.includes(key))
    .map((key, i) => ({ id: key, label: labelFor(key), x: leftX, y: padding + (leftFixedNodes.length + i) * rowGap }))
  const leftNodes = [...leftFixedNodes, ...leftClassNodes]
  // Barycentric ordering: compute neighbor indices on the left for each included skill
  const leftIndex: Record<string, number> = {}
  leftNodes.forEach((n, i) => { leftIndex[n.id] = i })
  const midSkills = skills.filter((s) => includedSkillIds.has(s.id))
  const neighborIdsForSkill = (sid: string): string[] => {
    const ids: string[] = []
    // Actual fixed sources for this skill
    ;(skillSources[sid] || []).forEach((src) => { if (!isChoice(src)) ids.push(src) })
    // Class availability
    ;(classes || []).forEach((c) => {
      const spec = CLASS_SKILL_CHOICES[c.klass.id]
      if (spec && spec.options.includes(sid)) ids.push(`class:${c.klass.id}`)
    })
    // Race availability via replacement
    if (isEligibleForRaceReplacement(sid)) ids.push('race')
    return Array.from(new Set(ids))
  }
  const midWithKey = midSkills.map((s, i) => {
    const neigh = neighborIdsForSkill(s.id).map((nid) => leftIndex[nid]).filter((v) => typeof v === 'number') as number[]
    const avg = neigh.length ? (neigh.reduce((a, b) => a + b, 0) / neigh.length) : i
    return { s, key: avg }
  })
  midWithKey.sort((a, b) => a.key - b.key || a.s.name.localeCompare(b.s.name))
  const midNodes = midWithKey.map((o, i) => ({ id: o.s.id, label: o.s.name, x: midX, y: padding + i * rowGap }))
  // Order right (choice) nodes by the average index of connected skills (actual edges only)
  const midIndex: Record<string, number> = {}
  midNodes.forEach((n, i) => { midIndex[n.id] = i })
  const rightWithKey = choiceKeys.map((key, i) => {
    const connected = midNodes.filter((mn) => (skillSources[mn.id] || []).includes(key)).map((mn) => midIndex[mn.id])
    const avg = connected.length ? (connected.reduce((a, b) => a + b, 0) / connected.length) : i
    return { key, avg }
  })
  rightWithKey.sort((a, b) => a.avg - b.avg || labelFor(a.key).localeCompare(labelFor(b.key)))
  const rightNodes = rightWithKey.map((o, i) => ({ id: o.key, label: labelFor(o.key), x: rightX, y: padding + i * rowGap }))

  // Edges: left->mid for fixed sources, mid->right for choice sources
  const edgesLeft: Array<{ sx: number; sy: number; tx: number; ty: number; key: string }> = []
  const edgesRight: Array<{ sx: number; sy: number; tx: number; ty: number; key: string }> = []
  midNodes.forEach((mn) => {
    const srcs = skillSources[mn.id] || []
    srcs.forEach((k) => {
      if (fixedKeys.includes(k)) {
        const ln = leftNodes.find(n => n.id === k)
        if (ln) edgesLeft.push({ sx: ln.x + srcW / 2, sy: ln.y, tx: mn.x - skillW / 2, ty: mn.y, key: `${k}->${mn.id}` })
      } else if (choiceKeys.includes(k)) {
        const rn = rightNodes.find(n => n.id === k)
        if (rn) edgesRight.push({ sx: mn.x + skillW / 2, sy: mn.y, tx: rn.x - srcW / 2, ty: rn.y, key: `${mn.id}->${k}` })
      }
    })
  })

  // Size the canvas
  const width = rightX + srcW / 2 + padding
  const height = Math.max(
    (leftNodes.length ? leftNodes[leftNodes.length - 1].y : 0),
    (midNodes.length ? midNodes[midNodes.length - 1].y : 0),
    (rightNodes.length ? rightNodes[rightNodes.length - 1].y : 0)
  ) + padding

  // Optional: dotted edges from Race (left) to skills that are available as race replacements
  const dottedEdgesLeft: Array<{ sx: number; sy: number; tx: number; ty: number; key: string }> = []
  if (race) {
    const raceSkillIds = (race.traits || []).flatMap((t) => RACE_TRAIT_SKILLS[t.id] || [])
    const raceConflicts = raceSkillIds.filter((sid) => (skillSources[sid] || []).some((s) => s !== 'race' && s !== 'race-pick' && s !== 'manual'))
    const raceNode = leftNodes.find((n) => n.id === 'race')
    if (raceNode && raceConflicts.length > 0) {
      midNodes.forEach((mn) => {
        const srcs = skillSources[mn.id] || []
        const hasOtherSource = srcs.some((s) => s !== 'race' && s !== 'race-pick' && s !== 'manual')
        if (!hasOtherSource) {
          dottedEdgesLeft.push({ sx: raceNode.x + srcW / 2, sy: raceNode.y, tx: mn.x - skillW / 2, ty: mn.y, key: `race~avail->${mn.id}` })
        }
      })
    }
  }
  // Dotted edges from Class nodes (left) to their selectable skills to indicate availability
  if (classes && classes.length) {
    classes.forEach((c) => {
      const clsKey = `class:${c.klass.id}`
      const clsNode = leftNodes.find((n) => n.id === clsKey)
      const spec = CLASS_SKILL_CHOICES[c.klass.id]
      if (!clsNode || !spec) return
      spec.options.forEach((sid) => {
        const mid = midNodes.find((mn) => mn.id === sid)
        if (!mid) return
        // draw dotted availability edge even if currently not selected by class
        dottedEdgesLeft.push({ sx: clsNode.x + srcW / 2, sy: clsNode.y, tx: mid.x - skillW / 2, ty: mid.y, key: `${clsKey}~avail->${sid}` })
      })
    })
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        style={{ display: 'block', background: '#ffffff' }}
      >
        {/* Edges left->mid */}
        {edgesLeft.map((e) => (
          <path key={e.key} d={`M ${e.sx} ${e.sy} C ${e.sx + 24} ${e.sy}, ${e.tx - 24} ${e.ty}, ${e.tx} ${e.ty}`} stroke="#94a3b8" strokeWidth={1.5} fill="none" />
        ))}
        {/* Dotted availability edges from Race to eligible skills (left->mid) */}
        {dottedEdgesLeft.map((e) => (
          <path key={e.key} d={`M ${e.sx} ${e.sy} C ${e.sx + 24} ${e.sy}, ${e.tx - 24} ${e.ty}, ${e.tx} ${e.ty}`} stroke="#cbd5e1" strokeWidth={1.5} fill="none" strokeDasharray="4,4" />
        ))}
        {/* Edges mid->right */}
        {edgesRight.map((e) => (
          <path key={e.key} d={`M ${e.sx} ${e.sy} C ${e.sx + 24} ${e.sy}, ${e.tx - 24} ${e.ty}, ${e.tx} ${e.ty}`} stroke="#94a3b8" strokeWidth={1.5} fill="none" />
        ))}
        {/* Left fixed source nodes */}
        {leftNodes.map((n) => (
          <g key={n.id}>
            <rect x={n.x - srcW / 2} y={n.y - 12} width={srcW} height={24} rx={6} ry={6} fill="#f1f5f9" stroke="#e2e8f0" />
            <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="11" fill="#0f172a">{n.label}</text>
          </g>
        ))}
        {/* Middle skill nodes */}
        {midNodes.map((n) => {
          const cnt = (skillSources[n.id] || []).length
          const isActive = cnt > 0
          const badgeR = 9
          const badgeCx = n.x - skillW / 2 - badgeR - 6
          const badgeCy = n.y
          const nodeFill = isActive ? '#0ea5e9' : '#f1f5f9'
          const nodeStroke = isActive ? '#0284c7' : '#e2e8f0'
          const labelFill = isActive ? '#ffffff' : '#0f172a'
          return (
            <g key={n.id}>
              {/* Count badge */}
              <circle cx={badgeCx} cy={badgeCy} r={badgeR} fill="#e2e8f0" stroke="#cbd5e1" />
              <text x={badgeCx} y={badgeCy + 3} textAnchor="middle" fontSize="10" fill="#0f172a" fontWeight="600">{cnt}</text>
              {/* Skill node */}
              <rect x={n.x - skillW / 2} y={n.y - 12} width={skillW} height={24} rx={6} ry={6} fill={nodeFill} stroke={nodeStroke} />
              <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="11" fill={labelFill}>{n.label}</text>
            </g>
          )
        })}
        {/* Right choice-based source nodes */}
        {rightNodes.map((n) => (
          <g key={n.id}>
            <rect x={n.x - srcW / 2} y={n.y - 12} width={srcW} height={24} rx={6} ry={6} fill="#f1f5f9" stroke="#e2e8f0" />
            <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="11" fill="#0f172a">{n.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export default Builder
