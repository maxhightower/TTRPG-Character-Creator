import React, { useMemo, useState, useEffect, useRef } from 'react'
import { Plus, Info, Redo2, Scale, Settings2, Shield, Sparkles, Sword, Undo2, List, Columns, LayoutGrid } from 'lucide-react'
// Externalized shared types and data
import type { AbilityKey, Background, Spell, MagicSchool, DamageType, Equipment, Feat } from '../data/types'
import { SKILLS } from '../data/skills'
import { BACKGROUNDS } from '../data/backgrounds'
import { SPELLS, SPELL_META, ALL_SPELL_SCHOOLS, ALL_DAMAGE_TYPES, ALL_SAVE_ABILITIES } from '../data/spells'
import { EQUIPMENT, SUBACTIONS_BY_ITEM } from '../data/equipment'
import { FEATS } from '../data/feats'

// ---------------- Demo Data (typed) ----------------

// AbilityKey now imported from ../data/types

type Race = {
  id: string
  name: string
  asis: Partial<Record<AbilityKey, number>>
  speed: number
  traits: Array<{ id: string; name: string; text: string }>
}

type Subclass = {
  id: string
  name: string
  unlockLevel: number
  grants?: { subactions?: string[] }
}

type Klass = {
  id: string
  name: string
  hitDie: number
  armor: string[]
  weapons: string[]
  grants?: { subactions?: string[] }
  level1?: Array<{ name: string; text: string }>
  // Optional richer feature map by level; if provided, render all features up to the class level
  featuresByLevel?: Record<number, Array<{ name: string; text: string }>>
  acFormula?: (a: { armor: string | 'none'; dexMod: number; conMod: number }) => number | undefined
  saves?: AbilityKey[]
  subclasses?: Subclass[]
}

// Feats and Equipment now imported from ../data

const RACES: Race[] = [
  { id: 'human', name: 'Human (Base)', asis: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, speed: 30, traits: [ { id: 'versatile', name: 'Versatile', text: '+1 to all ability scores.' } ] },
  { id: 'human-variant', name: 'Human (Variant)', asis: { str: 1, dex: 1 }, speed: 30, traits: [ { id: 'adaptable', name: 'Adaptable', text: '+1 to two ability scores (demo variant).' } ] },
  // Elves
  { id: 'elf-wood', name: 'Elf (Wood)', asis: { dex: 2, wis: 1 }, speed: 35, traits: [
    { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' },
    { id: 'keen', name: 'Keen Senses', text: 'Proficiency in Perception.' },
    { id: 'fey-ancestry', name: 'Fey Ancestry', text: 'Advantage on saves against being charmed; magic can’t put you to sleep.' },
  ] },
  { id: 'elf-high', name: 'Elf (High)', asis: { dex: 2, int: 1 }, speed: 30, traits: [
    { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' },
    { id: 'keen', name: 'Keen Senses', text: 'Proficiency in Perception.' },
    { id: 'fey-ancestry', name: 'Fey Ancestry', text: 'Advantage on saves against being charmed; magic can’t put you to sleep.' },
  ] },
  // Dwarves
  { id: 'dwarf-hill', name: 'Dwarf (Hill)', asis: { con: 2, wis: 1 }, speed: 25, traits: [
    { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' },
    { id: 'dwarven-resilience', name: 'Dwarven Resilience', text: 'Advantage on saving throws against poison, and resistance to poison damage (demo flavor).' },
  ] },
  { id: 'dwarf-mountain', name: 'Dwarf (Mountain)', asis: { con: 2, str: 2 }, speed: 25, traits: [
    { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' },
    { id: 'dwarven-resilience', name: 'Dwarven Resilience', text: 'Advantage on saving throws against poison, and resistance to poison damage (demo flavor).' },
  ] },
  { id: 'halfling-lightfoot', name: 'Halfling (Lightfoot)', asis: { dex: 2, cha: 1 }, speed: 25, traits: [ { id: 'lucky', name: 'Lucky', text: 'Reroll 1s on attack, ability, or save rolls (demo flavor).' }, { id: 'brave', name: 'Brave', text: 'Advantage on saves vs. fear.' } ] },
  { id: 'halfling-stout', name: 'Halfling (Stout)', asis: { dex: 2, con: 1 }, speed: 25, traits: [ { id: 'lucky', name: 'Lucky', text: 'Reroll 1s on attack, ability, or save rolls (demo flavor).' }, { id: 'brave', name: 'Brave', text: 'Advantage on saves vs. fear.' }, { id: 'stout-resilience', name: 'Stout Resilience', text: 'Advantage on saves vs. poison (demo flavor).' } ] },
  { id: 'tiefling', name: 'Tiefling', asis: { cha: 2, int: 1 }, speed: 30, traits: [ { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' }, { id: 'hellish-resistance', name: 'Hellish Resistance', text: 'Resistance to fire damage.' } ] },
  { id: 'dragonborn', name: 'Dragonborn', asis: { str: 2, cha: 1 }, speed: 30, traits: [ { id: 'draconic-ancestry', name: 'Draconic Ancestry', text: 'Breath weapon and damage resistance depend on ancestry.' }, { id: 'breath-weapon', name: 'Breath Weapon', text: 'Exhale destructive energy (demo flavor).' }, { id: 'damage-resistance', name: 'Damage Resistance', text: 'Resistance based on ancestry.' } ] },
  // Dragonborn variants (sub-race style entries)
  { id: 'dragonborn-black', name: 'Dragonborn (Black)', asis: { str: 2, cha: 1 }, speed: 30, traits: [
    { id: 'draconic-ancestry-black', name: 'Draconic Ancestry — Black', text: 'Acid breath; resistance to acid (demo).' },
    { id: 'breath-weapon', name: 'Breath Weapon', text: 'Exhale destructive energy (demo flavor).' },
    { id: 'damage-resistance', name: 'Damage Resistance', text: 'Resistance to acid (demo).' },
  ] },
  { id: 'dragonborn-blue', name: 'Dragonborn (Blue)', asis: { str: 2, cha: 1 }, speed: 30, traits: [
    { id: 'draconic-ancestry-blue', name: 'Draconic Ancestry — Blue', text: 'Lightning breath; resistance to lightning (demo).' },
    { id: 'breath-weapon', name: 'Breath Weapon', text: 'Exhale destructive energy (demo flavor).' },
    { id: 'damage-resistance', name: 'Damage Resistance', text: 'Resistance to lightning (demo).' },
  ] },
  { id: 'dragonborn-brass', name: 'Dragonborn (Brass)', asis: { str: 2, cha: 1 }, speed: 30, traits: [
    { id: 'draconic-ancestry-brass', name: 'Draconic Ancestry — Brass', text: 'Fire breath; resistance to fire (demo).' },
    { id: 'breath-weapon', name: 'Breath Weapon', text: 'Exhale destructive energy (demo flavor).' },
    { id: 'damage-resistance', name: 'Damage Resistance', text: 'Resistance to fire (demo).' },
  ] },
  { id: 'dragonborn-bronze', name: 'Dragonborn (Bronze)', asis: { str: 2, cha: 1 }, speed: 30, traits: [
    { id: 'draconic-ancestry-bronze', name: 'Draconic Ancestry — Bronze', text: 'Lightning breath; resistance to lightning (demo).' },
    { id: 'breath-weapon', name: 'Breath Weapon', text: 'Exhale destructive energy (demo flavor).' },
    { id: 'damage-resistance', name: 'Damage Resistance', text: 'Resistance to lightning (demo).' },
  ] },
  { id: 'dragonborn-copper', name: 'Dragonborn (Copper)', asis: { str: 2, cha: 1 }, speed: 30, traits: [
    { id: 'draconic-ancestry-copper', name: 'Draconic Ancestry — Copper', text: 'Acid breath; resistance to acid (demo).' },
    { id: 'breath-weapon', name: 'Breath Weapon', text: 'Exhale destructive energy (demo flavor).' },
    { id: 'damage-resistance', name: 'Damage Resistance', text: 'Resistance to acid (demo).' },
  ] },
  { id: 'dragonborn-gold', name: 'Dragonborn (Gold)', asis: { str: 2, cha: 1 }, speed: 30, traits: [
    { id: 'draconic-ancestry-gold', name: 'Draconic Ancestry — Gold', text: 'Fire breath; resistance to fire (demo).' },
    { id: 'breath-weapon', name: 'Breath Weapon', text: 'Exhale destructive energy (demo flavor).' },
    { id: 'damage-resistance', name: 'Damage Resistance', text: 'Resistance to fire (demo).' },
  ] },
  { id: 'dragonborn-green', name: 'Dragonborn (Green)', asis: { str: 2, cha: 1 }, speed: 30, traits: [
    { id: 'draconic-ancestry-green', name: 'Draconic Ancestry — Green', text: 'Poison breath; resistance to poison (demo).' },
    { id: 'breath-weapon', name: 'Breath Weapon', text: 'Exhale destructive energy (demo flavor).' },
    { id: 'damage-resistance', name: 'Damage Resistance', text: 'Resistance to poison (demo).' },
  ] },
  { id: 'dragonborn-red', name: 'Dragonborn (Red)', asis: { str: 2, cha: 1 }, speed: 30, traits: [
    { id: 'draconic-ancestry-red', name: 'Draconic Ancestry — Red', text: 'Fire breath; resistance to fire (demo).' },
    { id: 'breath-weapon', name: 'Breath Weapon', text: 'Exhale destructive energy (demo flavor).' },
    { id: 'damage-resistance', name: 'Damage Resistance', text: 'Resistance to fire (demo).' },
  ] },
  { id: 'dragonborn-silver', name: 'Dragonborn (Silver)', asis: { str: 2, cha: 1 }, speed: 30, traits: [
    { id: 'draconic-ancestry-silver', name: 'Draconic Ancestry — Silver', text: 'Cold breath; resistance to cold (demo).' },
    { id: 'breath-weapon', name: 'Breath Weapon', text: 'Exhale destructive energy (demo flavor).' },
    { id: 'damage-resistance', name: 'Damage Resistance', text: 'Resistance to cold (demo).' },
  ] },
  { id: 'dragonborn-white', name: 'Dragonborn (White)', asis: { str: 2, cha: 1 }, speed: 30, traits: [
    { id: 'draconic-ancestry-white', name: 'Draconic Ancestry — White', text: 'Cold breath; resistance to cold (demo).' },
    { id: 'breath-weapon', name: 'Breath Weapon', text: 'Exhale destructive energy (demo flavor).' },
    { id: 'damage-resistance', name: 'Damage Resistance', text: 'Resistance to cold (demo).' },
  ] },
  { id: 'gnome', name: 'Gnome', asis: { int: 2 }, speed: 25, traits: [ { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' }, { id: 'gnome-cunning', name: 'Gnome Cunning', text: 'Advantage on INT, WIS, and CHA saves against magic.' } ] },
  { id: 'half-orc', name: 'Half-Orc', asis: { str: 2, con: 1 }, speed: 30, traits: [ { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' }, { id: 'menacing', name: 'Menacing', text: 'Proficiency in Intimidation.' }, { id: 'relentless-endurance', name: 'Relentless Endurance', text: 'When reduced to 0 HP but not killed, drop to 1 HP instead (1/long rest).' }, { id: 'savage-attacks', name: 'Savage Attacks', text: 'Extra weapon die on a crit (demo flavor).' } ] },
]

const CLASSES: Klass[] = [
  {
    id: 'barbarian',
    name: 'Barbarian',
    hitDie: 12,
    armor: ['light', 'medium', 'shields'],
    weapons: ['simple', 'martial'],
    grants: { subactions: ['Rage', 'Reckless Attack'] },
    featuresByLevel: {
      1: [
        { name: 'Rage', text: '+2 damage, advantage on STR checks; uses/long rest.' },
        { name: 'Unarmored Defense', text: 'AC = 10 + DEX + CON when no armor; shield allowed.' },
      ],
      2: [
        { name: 'Reckless Attack', text: 'Gain advantage on melee STR attacks this turn; attacks against you have advantage until your next turn.' },
        { name: 'Danger Sense', text: 'Advantage on DEX saves vs. effects you can see.' },
      ],
      3: [
        { name: 'Primal Path', text: 'Choose a subclass and gain its level 3 features.' },
      ],
      4: [
        { name: 'Ability Score Improvement', text: '+2 to one ability or +1 to two abilities (demo text).' },
      ],
      5: [
        { name: 'Extra Attack', text: 'Attack twice, instead of once, whenever you take the Attack action.' },
        { name: 'Fast Movement', text: 'Your speed increases by 10 ft. while not wearing heavy armor.' },
      ],
    },
    acFormula: (a) => (a.armor === 'none' ? 10 + a.dexMod + a.conMod : undefined),
    saves: ['str', 'con'],
    subclasses: [
      { id: 'berserker', name: 'Path of the Berserker', unlockLevel: 3, grants: { subactions: ['Frenzy'] } },
    ],
  },
  {
    id: 'ranger',
    name: 'Ranger',
    hitDie: 10,
    armor: ['light', 'medium', 'shields'],
    weapons: ['simple', 'martial'],
    grants: { subactions: ['Cast Spell'] },
    featuresByLevel: {
      1: [
        { name: 'Favored Enemy', text: 'You have significant experience studying, tracking, and hunting a certain type of enemy.' },
        { name: 'Natural Explorer', text: 'You are particularly familiar with one type of natural environment and adept at traveling and surviving in such regions.' },
      ],
      2: [
        { name: 'Fighting Style', text: 'Choose a combat style to hone your martial prowess.' },
        { name: 'Spellcasting', text: 'WIS‑based spellcasting (half‑caster). Gains 1st‑level spells at level 2.' },
      ],
      3: [
        { name: 'Ranger Archetype', text: 'Choose an archetype and gain its features.' },
      ],
      4: [
        { name: 'Ability Score Improvement', text: '+2 to one ability or +1 to two abilities (demo text).' },
      ],
      5: [
        { name: 'Extra Attack', text: 'Attack twice, instead of once, whenever you take the Attack action.' },
      ],
    },
    saves: ['str', 'dex'],
    subclasses: [
      { id: 'hunter', name: 'Hunter', unlockLevel: 3 },
      { id: 'beast-master', name: 'Beast Master', unlockLevel: 3 },
    ],
  },
  {
    id: 'rogue',
    name: 'Rogue',
    hitDie: 8,
    armor: ['light'],
    weapons: ['simple', 'hand-crossbow', 'longsword', 'rapier', 'shortsword'],
    featuresByLevel: {
      1: [
        { name: 'Sneak Attack', text: 'Deal extra damage once per turn when you have advantage or an ally is adjacent.' },
        { name: 'Thieves’ Cant', text: 'Secret mix of dialect, jargon, and code that allows you to hide messages.' },
        { name: 'Expertise', text: 'Choose two skills; double proficiency bonus for them.' },
      ],
      2: [
        { name: 'Cunning Action', text: 'Dash, Disengage, or Hide as a bonus action.' },
      ],
      3: [
        { name: 'Roguish Archetype', text: 'Choose an archetype and gain its features.' },
      ],
      4: [
        { name: 'Ability Score Improvement', text: '+2 to one ability or +1 to two abilities (demo text).' },
      ],
      5: [
        { name: 'Uncanny Dodge', text: 'Use your reaction to halve the damage from an attacker you can see.' },
      ],
    },
    saves: ['dex', 'int'],
    subclasses: [
      { id: 'thief', name: 'Thief', unlockLevel: 3 },
      { id: 'assassin', name: 'Assassin', unlockLevel: 3 },
      { id: 'arcane-trickster', name: 'Arcane Trickster', unlockLevel: 3 },
    ],
  },
  {
    id: 'monk',
    name: 'Monk',
    hitDie: 8,
    armor: [],
    weapons: ['simple', 'shortswords'],
    grants: { subactions: ['Flurry of Blows', 'Patient Defense', 'Step of the Wind'] },
    featuresByLevel: {
      1: [
        { name: 'Unarmored Defense', text: 'AC = 10 + DEX + WIS while not wearing armor or a shield.' },
        { name: 'Martial Arts', text: 'Use DEX for unarmed/monk weapon attacks; bonus unarmed strike.' },
      ],
      2: [
        { name: 'Ki', text: 'Fuel abilities like Flurry of Blows, Patient Defense, Step of the Wind.' },
        { name: 'Unarmored Movement', text: '+10 ft. movement speed while unarmored.' },
      ],
      3: [
        { name: 'Monastic Tradition', text: 'Choose a subclass (tradition) and gain its level 3 features.' },
        { name: 'Deflect Missiles', text: 'Reduce ranged weapon damage; catch/throw sometimes.' },
      ],
      4: [
        { name: 'Ability Score Improvement', text: '+2 to one ability or +1 to two abilities (demo text).' },
        { name: 'Slow Fall', text: 'Reduce falling damage by 5 × monk level.' },
      ],
      5: [
        { name: 'Extra Attack', text: 'Attack twice when you take the Attack action.' },
        { name: 'Stunning Strike', text: 'On a hit, spend ki to stun a creature that fails a CON save.' },
      ],
    },
    saves: ['str', 'dex'],
    subclasses: [
      { id: 'open-hand', name: 'Way of the Open Hand', unlockLevel: 3, grants: { subactions: [] } },
      { id: 'shadow', name: 'Way of Shadow', unlockLevel: 3, grants: { subactions: [] } },
    ],
  },
  {
    id: 'paladin',
    name: 'Paladin',
    hitDie: 10,
    armor: ['all', 'shields'],
    weapons: ['simple', 'martial'],
    grants: { subactions: ['Divine Smite'] },
    featuresByLevel: {
      1: [
        { name: 'Divine Sense', text: 'Detect celestials, fiends, and undead (limited uses).' },
        { name: 'Lay on Hands', text: 'Pool of healing equal to 5 × paladin level.' },
      ],
      2: [
        { name: 'Fighting Style', text: 'Choose a combat style for a passive benefit.' },
        { name: 'Spellcasting', text: 'CHA‑based half‑caster; gains 1st‑level spell slots.' },
        { name: 'Divine Smite', text: 'Expend a spell slot to deal radiant damage on a hit.' },
      ],
      3: [
        { name: 'Sacred Oath', text: 'Swear an oath (subclass) and gain Channel Divinity options.' },
      ],
      4: [
        { name: 'Ability Score Improvement', text: '+2 to one ability or +1 to two abilities (demo text).' },
      ],
      5: [
        { name: 'Extra Attack', text: 'Attack twice, instead of once, whenever you take the Attack action.' },
      ],
    },
    saves: ['wis', 'cha'],
    subclasses: [
      { id: 'oath-devotion', name: 'Oath of Devotion', unlockLevel: 3, grants: { subactions: ['Channel Divinity (Devotion)'] } },
      { id: 'oath-vengeance', name: 'Oath of Vengeance', unlockLevel: 3, grants: { subactions: ['Channel Divinity (Vengeance)'] } },
    ],
  },
  {
    id: 'fighter',
    name: 'Fighter',
    hitDie: 10,
    armor: ['all', 'shields'],
    weapons: ['simple', 'martial'],
    grants: { subactions: ['Second Wind'] },
    featuresByLevel: {
      1: [
        { name: 'Second Wind', text: '1d10 + level self‑heal, 1/short rest.' },
        { name: 'Fighting Style', text: 'Choose a combat style for a passive benefit.' },
      ],
      2: [
        { name: 'Action Surge', text: 'Take one additional action on your turn, 1/short rest.' },
      ],
      3: [
        { name: 'Martial Archetype', text: 'Choose a subclass and gain its level 3 features.' },
      ],
      4: [
        { name: 'Ability Score Improvement', text: '+2 to one ability or +1 to two abilities (demo text).' },
      ],
      5: [
        { name: 'Extra Attack', text: 'Attack twice, instead of once, whenever you take the Attack action.' },
      ],
    },
    saves: ['str', 'con'],
    subclasses: [
      { id: 'champion', name: 'Champion', unlockLevel: 3, grants: { subactions: ['Improved Critical'] } },
    ],
  },
  {
    id: 'bard',
    name: 'Bard',
    hitDie: 8,
    armor: ['light'],
    weapons: ['simple', 'hand crossbows', 'longswords', 'rapiers', 'shortswords'],
    grants: { subactions: ['Cast Spell', 'Bardic Inspiration'] },
    featuresByLevel: {
      1: [
        { name: 'Spellcasting', text: 'CHA‑based spellcasting. Cantrips & 1st‑level slots.' },
        { name: 'Bardic Inspiration (d6)', text: 'As a bonus action, give a creature a d6 inspiration die (CHA uses/long rest).' },
      ],
      2: [
        { name: 'Jack of All Trades', text: 'Add half your proficiency bonus to ability checks you are not proficient in.' },
        { name: 'Song of Rest (d6)', text: 'During a short rest, allies who hear your performance regain extra 1d6 HP.' },
      ],
      3: [
        { name: 'Bard College', text: 'Choose a subclass and gain its level 3 features.' },
        { name: 'Expertise', text: 'Choose two skills you are proficient in; your proficiency bonus is doubled for them.' },
      ],
      4: [
        { name: 'Ability Score Improvement', text: '+2 to one ability or +1 to two abilities (demo text).' },
      ],
      5: [
        { name: 'Font of Inspiration', text: 'Regain all uses of Bardic Inspiration on a short rest.' },
      ],
    },
    saves: ['dex', 'cha'],
    subclasses: [
      { id: 'college-of-lore', name: 'College of Lore', unlockLevel: 3, grants: { subactions: [] } },
      { id: 'college-of-valor', name: 'College of Valor', unlockLevel: 3, grants: { subactions: [] } },
    ],
  },
  {
    id: 'cleric',
    name: 'Cleric',
    hitDie: 8,
    armor: ['light', 'medium', 'shields'],
    weapons: ['simple'],
    grants: { subactions: ['Cast Spell'] },
    featuresByLevel: {
      1: [
        { name: 'Spellcasting', text: 'WIS‑based spellcasting. Cantrips & 1st‑level slots.' },
        { name: 'Divine Domain', text: 'Choose a domain (subclass) and gain its level 1 features.' },
      ],
      2: [
        { name: 'Channel Divinity (1/rest)', text: 'Turn Undead; your domain adds an additional Channel Divinity option.' },
      ],
      4: [
        { name: 'Ability Score Improvement', text: '+2 to one ability or +1 to two abilities (demo text).' },
      ],
      5: [
        { name: 'Destroy Undead (CR 1/2)', text: 'When a turned undead of CR 1/2 or lower fails its save, it is destroyed.' },
        { name: 'Spellcasting Progression', text: 'Access to higher‑level spell slots and prepared spells.' },
      ],
    },
    saves: ['wis', 'cha'],
    subclasses: [
      { id: 'life-domain', name: 'Life Domain', unlockLevel: 1, grants: { subactions: ['Channel Divinity: Preserve Life'] } },
      { id: 'light-domain', name: 'Light Domain', unlockLevel: 1, grants: { subactions: ['Channel Divinity: Radiance of the Dawn'] } },
    ],
  },
  {
    id: 'druid',
    name: 'Druid',
    hitDie: 8,
    armor: ['light', 'medium', 'shields'],
    weapons: ['clubs', 'daggers', 'darts', 'javelins', 'maces', 'quarterstaff', 'scimitars', 'sickles', 'slings', 'spears'],
    grants: { subactions: ['Cast Spell'] },
    featuresByLevel: {
      1: [
        { name: 'Druidic', text: 'Secret druidic language known to druids.' },
        { name: 'Spellcasting', text: 'WIS‑based prepared spellcasting. Cantrips & 1st‑level slots.' },
      ],
      2: [
        { name: 'Wild Shape', text: 'Magically assume the shape of a beast you have seen (limited CR/time).' },
        { name: 'Druid Circle', text: 'Choose a circle (subclass) and gain its level 2 features.' },
      ],
      4: [
        { name: 'Ability Score Improvement', text: '+2 to one ability or +1 to two abilities (demo text).' },
      ],
      5: [
        { name: 'Wild Shape Improvement', text: 'Improved wild shape options and spellcasting progression.' },
      ],
    },
    saves: ['int', 'wis'],
    subclasses: [
      { id: 'circle-land', name: 'Circle of the Land', unlockLevel: 2, grants: { subactions: [] } },
      { id: 'circle-moon', name: 'Circle of the Moon', unlockLevel: 2, grants: { subactions: ['Combat Wild Shape'] } },
    ],
  },
  {
    id: 'wizard',
    name: 'Wizard',
    hitDie: 6,
    armor: [],
    weapons: ['daggers', 'quarterstaff'],
    grants: { subactions: ['Cast Spell'] },
    featuresByLevel: {
      1: [
        { name: 'Spellcasting', text: 'INT spellcasting. Cantrips & 1st‑level slots.' },
        { name: 'Arcane Recovery', text: 'Recover expended slots on short rest.' },
      ],
      2: [
        { name: 'Arcane Tradition', text: 'Choose a subclass (school) and gain its level 2/3 features.' },
      ],
      4: [
        { name: 'Ability Score Improvement', text: '+2 to one ability or +1 to two abilities (demo text).' },
      ],
      5: [
        { name: 'Spellcasting Progression', text: 'Access to higher‑level spell slots and prepared spells.' },
      ],
    },
    saves: ['int', 'wis'],
    subclasses: [
      { id: 'evocation', name: 'School of Evocation', unlockLevel: 2, grants: { subactions: ['Sculpt Spells'] } },
    ],
  },
  {
    id: 'warlock',
    name: 'Warlock',
    hitDie: 8,
    armor: ['light'],
    weapons: ['simple'],
    grants: { subactions: ['Cast Spell'] },
    featuresByLevel: {
      1: [
        { name: 'Otherworldly Patron', text: 'Form a pact with a powerful entity and gain patron features.' },
        { name: 'Pact Magic', text: 'CHA‑based spellcasting using pact slots; Eldritch Blast cantrip available.' },
      ],
      2: [
        { name: 'Eldritch Invocations', text: 'Learn special invocations to augment abilities.' },
      ],
      3: [
        { name: 'Pact Boon', text: 'Choose Chain, Blade, or Tome (not modeled in this demo).' },
      ],
      4: [
        { name: 'Ability Score Improvement', text: '+2 to one ability or +1 to two abilities (demo text).' },
      ],
    },
    saves: ['wis', 'cha'],
    subclasses: [
      { id: 'fiend', name: 'The Fiend', unlockLevel: 1 },
      { id: 'archfey', name: 'The Archfey', unlockLevel: 1 },
      { id: 'great-old-one', name: 'The Great Old One', unlockLevel: 1 },
    ],
  },
  {
    id: 'sorcerer',
    name: 'Sorcerer',
    hitDie: 6,
    armor: [],
    weapons: ['daggers', 'quarterstaff', 'light-crossbow'],
    grants: { subactions: ['Cast Spell'] },
    featuresByLevel: {
      1: [
        { name: 'Sorcerous Origin', text: 'Choose a bloodline that grants innate magic.' },
        { name: 'Spellcasting', text: 'CHA‑based flexible spellcasting. Cantrips & 1st‑level slots.' },
      ],
      2: [
        { name: 'Font of Magic', text: 'Sorcery Points fuel metamagic and spell slot conversions.' },
      ],
      3: [
        { name: 'Metamagic', text: 'Alter spells using metamagic options.' },
      ],
      4: [
        { name: 'Ability Score Improvement', text: '+2 to one ability or +1 to two abilities (demo text).' },
      ],
    },
    saves: ['con', 'cha'],
    subclasses: [
      { id: 'draconic-bloodline', name: 'Draconic Bloodline', unlockLevel: 1 },
      { id: 'wild-magic', name: 'Wild Magic', unlockLevel: 1 },
    ],
  },
]

// Equipment and subactions moved to ../data/equipment

// Skills moved to ../data/skills

// Grants mapping (demo): map certain race traits and classes to skill choices.
const RACE_TRAIT_SKILLS: Record<string, string[]> = {
  // Elf Keen Senses -> Perception
  keen: ['perception'],
  // Half-Orc Menacing -> Intimidation
  menacing: ['intimidation'],
}

// Simple class skill choice lists (demo approximation)
const CLASS_SKILL_CHOICES: Record<string, { count: number; options: string[] }> = {
  barbarian: { count: 2, options: ['animal', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] },
  bard: { count: 3, options: ['acrobatics','animal','arcana','athletics','deception','history','insight','intimidation','investigation','medicine','nature','perception','performance','persuasion','religion','sleight','stealth','survival'] },
  cleric: { count: 2, options: ['history', 'insight', 'medicine', 'persuasion', 'religion'] },
  druid: { count: 2, options: ['arcana', 'animal', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
  fighter: { count: 2, options: ['acrobatics', 'animal', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'] },
  monk: { count: 2, options: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
  paladin: { count: 2, options: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
  ranger: { count: 3, options: ['animal','athletics','insight','investigation','nature','perception','stealth','survival'] },
  rogue: { count: 4, options: ['acrobatics','athletics','deception','insight','intimidation','investigation','perception','performance','persuasion','sleight','stealth'] },
  sorcerer: { count: 2, options: ['arcana','deception','insight','intimidation','persuasion','religion'] },
  warlock: { count: 2, options: ['arcana','deception','history','intimidation','investigation','nature','religion'] },
  wizard: { count: 2, options: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'] },
}

// Class feature decisions (demo): e.g., Fighter Fighting Style at level 1
type ClassFeatureDecisionSpec = {
  id: string
  name: string
  level: number
  picks?: number
  options: Array<{ id: string; name: string; text: string }>
}
const CLASS_FEATURE_DECISIONS: Record<string, ClassFeatureDecisionSpec[]> = {
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
      ],
    },
  ],
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

type RuleOpts = { tceActive?: boolean; tceMode?: '2+1' | '1+1+1'; tceAlloc?: Record<AbilityKey, number>; multiclassReqs?: boolean }

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

  const totalLevel = Math.max(1, state.classes.reduce((s, c) => s + (c.level || 0), 0) || 1)

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
  const firstHitDie = state.classes[0]?.klass.hitDie ?? 8
  let hp = firstHitDie + conMod
  state.classes.forEach((c, idx) => {
    const perLevel = Math.max(1, Math.floor(c.klass.hitDie / 2) + 1 + conMod)
    const extraLevels = Math.max(0, (c.level || 0) - (idx === 0 ? 1 : 0))
    hp += extraLevels * perLevel
  })
  // Feat: Tough adds +2 HP per total level
  if ((state.feats || []).includes('tough')) {
    hp += 2 * totalLevel
  }

  const speed = state.race?.speed ?? 30

  const classSubs = state.classes.flatMap((c) => c.klass.grants?.subactions ?? [])
  const subclassSubs = state.classes.flatMap((c) => c.subclass?.grants?.subactions ?? [])
  const itemSubs = state.loadout.flatMap((i) => SUBACTIONS_BY_ITEM[(i as any).id] ?? [])
  const subactions = dedupe([...classSubs, ...subclassSubs, ...itemSubs])

  // Saving throws (union of class save proficiencies)
  const final = finalAbility(state.abilities, state.race, state.asi, opts)
  const prof = proficiencyBonus(totalLevel)
  const saveProfs = dedupe(state.classes.flatMap((c) => c.klass.saves ?? []))
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
  return { ac, hp, speed, subactions, dexMod, conMod, strMod, saves, totalLevel, initiative }
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

function Pill(props: { children: React.ReactNode }) {
  return <span style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--pill-bg, #f1f5f9)', color: 'var(--fg)', fontSize: 12, whiteSpace: 'nowrap' }}>{props.children}</span>
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
function CardTitle(props: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 15 }}>{props.children}</div>
}
function CardContent(props: { children: React.ReactNode }) {
  return <div style={{ padding: 16, display: 'grid', gap: 12 }}>{props.children}</div>
}

// ---------------- Styles ----------------

const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--muted-border)', color: 'var(--fg)', background: 'var(--card-bg)' }
const badgeSecondary: React.CSSProperties = { padding: '2px 8px', borderRadius: 999, background: 'var(--pill-bg, #f1f5f9)', border: '1px solid var(--muted-border)', fontSize: 12, color: 'var(--fg)' }
const badgeOutline: React.CSSProperties = { padding: '2px 8px', borderRadius: 999, border: '1px solid var(--muted-border)', fontSize: 12, color: 'var(--fg)' }
const card: React.CSSProperties = { border: '1px solid var(--muted-border)', borderRadius: 12, background: 'var(--card-bg)', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }

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

// ---------------- Main Component ----------------

export function Builder(props: { onCharacterChange?: (state: AppState, derived?: any) => void; importPlan?: any }) {
  const [mode, setMode] = useState<'guided' | 'power'>('power')
  const [name, setName] = useState('New Hero')
  const [race, setRace] = useState<Race>(RACES[0])
  const [classes, setClasses] = useState<Array<{ klass: Klass; level: number; subclass?: Subclass }>>([
    { klass: CLASSES[0], level: 1 },
  ])
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
  const allTags = useMemo(() => dedupe(EQUIPMENT.flatMap((i) => (((i as any).tags || []) as string[]))), [])
  const filteredEquipment = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase()
    return EQUIPMENT.filter((eq) => {
      const tags = (((eq as any).tags || []) as string[])
      const nameMatch = q ? eq.name.toLowerCase().includes(q) : true
      const tagsMatch = catalogTags.length ? catalogTags.every((tg) => tags.includes(tg)) : true
      return nameMatch && tagsMatch
    })
  }, [catalogQuery, catalogTags])
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
  // Rules & options
  const [rulesOpen, setRulesOpen] = useState(false)
  const rulesRef = useRef<HTMLDivElement | null>(null)
  const [rules, setRules] = useState<{ tceCustomAsi: boolean; multiclassReqs: boolean }>({ tceCustomAsi: false, multiclassReqs: false })
  const [tceMode, setTceMode] = useState<'2+1' | '1+1+1'>('2+1')
  const emptyAlloc: Record<AbilityKey, number> = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
  const [tceAlloc, setTceAlloc] = useState<Record<AbilityKey, number>>({ ...emptyAlloc, str: 2, dex: 1 })
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
  const derived = useMemo(() => computeDerived(state, { tceActive: rules.tceCustomAsi, tceMode, tceAlloc }), [state, rules.tceCustomAsi, tceMode, JSON.stringify(tceAlloc)])
  const issues = useMemo(() => validateChoice(state, { tceActive: rules.tceCustomAsi, tceMode, tceAlloc, multiclassReqs: rules.multiclassReqs }), [state, rules.tceCustomAsi, rules.multiclassReqs, tceMode, JSON.stringify(tceAlloc)])
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
  const specs = CLASS_FEATURE_DECISIONS[c.klass.id] || []
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

  // Auto-apply background/race skill grants immediately, and remove stale grants when switching
  useEffect(() => {
    const bgSkills = background?.skills ?? []
    const raceSkills = (race?.traits || []).flatMap((t) => RACE_TRAIT_SKILLS[t.id] || [])
    const desiredBg = new Set(bgSkills)
    const desiredRace = new Set(raceSkills)

    // Additions needed (based on current sources)
    const needsBg = bgSkills.filter((s) => !(skillSources[s] || []).includes('bg'))
    const needsRace = raceSkills.filter((s) => !(skillSources[s] || []).includes('race'))

    // Reconcile sources: remove stale 'bg' / 'race' entries not in desired sets; then add missing
    let newSources: Record<string, string[]> = {}
    setSkillSources((prev) => {
      const out: Record<string, string[]> = {}
      // First, copy and filter existing sources
      Object.entries(prev).forEach(([skill, sources]) => {
        const filtered = sources.filter((src) => {
          if (src === 'bg') return desiredBg.has(skill)
          if (src === 'race') return desiredRace.has(skill)
          return true // keep all other sources (class picks, race-pick, etc.)
        })
        if (filtered.length) out[skill] = filtered
      })
      // Then, add missing bg/race sources per desired sets
      bgSkills.forEach((s) => { out[s] = Array.from(new Set([...(out[s] || []), 'bg'])) })
      raceSkills.forEach((s) => { out[s] = Array.from(new Set([...(out[s] || []), 'race'])) })
      newSources = out
      return out
    })

    // Sync proficiency map to sources: add prof for any sourced skills; remove for unsourced
    setSkillProf((prev) => {
      const out: Record<string, ProfType> = {}
      Object.keys(newSources).forEach((skill) => {
        out[skill] = prev[skill] && prev[skill] !== 'none' ? prev[skill] : 'prof'
      })
      return out
    })
  }, [background, race, skillSources])

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
          // Rules restore
          if (saved.rules && typeof saved.rules === 'object') {
            setRules({
              tceCustomAsi: !!saved.rules.tceCustomAsi,
              multiclassReqs: !!saved.rules.multiclassReqs,
            })
            if (saved.rules.tceMode === '1+1+1' || saved.rules.tceMode === '2+1') setTceMode(saved.rules.tceMode)
            if (saved.rules.tceAlloc && typeof saved.rules.tceAlloc === 'object') setTceAlloc({ ...emptyAlloc, ...saved.rules.tceAlloc })
          }
          if (typeof saved.showCompleted === 'boolean') setShowCompleted(saved.showCompleted)
          if (Array.isArray(saved.catalogTags)) setCatalogTags(saved.catalogTags)
          if (typeof saved.catalogQuery === 'string') setCatalogQuery(saved.catalogQuery)
          if (typeof saved.catalogFiltersOpen === 'boolean') setCatalogFiltersOpen(saved.catalogFiltersOpen)
          if (saved.spellFilters && typeof saved.spellFilters === 'object') {
            setSpellFilters((prev) => ({
              levels: saved.spellFilters.levels ?? prev.levels,
              selectedOnly: saved.spellFilters.selectedOnly ?? prev.selectedOnly,
              schools: Array.isArray(saved.spellFilters.schools) ? saved.spellFilters.schools : prev.schools,
              damage: Array.isArray(saved.spellFilters.damage) ? saved.spellFilters.damage : prev.damage,
              saves: Array.isArray(saved.spellFilters.saves) ? saved.spellFilters.saves : prev.saves,
            }))
          }
        }
      }
    } catch {}
    restoredRef.current = true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Autosave whenever core state changes
  useEffect(() => {
    // Only save after initial restore to avoid overwriting before load
    if (!restoredRef.current) return
    try {
      const payload = {
        mode,
        name,
        raceId: race?.id,
        backgroundId: background?.id || null,
        classes: classes.map((c) => ({ klassId: c.klass.id, level: c.level, subclassId: c.subclass?.id || null })),
        abilities,
        loadoutIds: loadout.map((i: any) => i.id),
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
        featChoices,
  // Rules
  rules: { tceCustomAsi: rules.tceCustomAsi, multiclassReqs: rules.multiclassReqs, tceMode, tceAlloc },
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
    JSON.stringify(featChoices),
  JSON.stringify(rules),
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
      featChoices,
  // Rules
  rules: { tceCustomAsi: rules.tceCustomAsi, multiclassReqs: rules.multiclassReqs, tceMode, tceAlloc },
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
        setRules({ tceCustomAsi: !!impRules.tceCustomAsi, multiclassReqs: !!impRules.multiclassReqs })
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

    // Aggregate levels -> classes map
    const levelEntries: Array<{ level: number; className?: string; feats?: string[]; featureChoices?: any[] }> = Array.isArray(plan.levels) ? plan.levels : []
    const classCounts: Record<string, number> = {}
    levelEntries.forEach((lv) => {
      const nm = String(lv.className || '').trim()
      if (!nm) return
      classCounts[nm] = (classCounts[nm] || 0) + 1
    })
    // Build classes array using known CLASSES by name
    const nextClasses: Array<{ klass: Klass; level: number; subclass?: Subclass }> = []
    Object.entries(classCounts).forEach(([nm, lvl]) => {
      const k = CLASSES.find((c) => c.name === nm)
      if (k) nextClasses.push({ klass: k, level: lvl })
    })
    if (!nextClasses.length) nextClasses.push({ klass: CLASSES[0], level: 1 })

    // Collect feats: map incoming names to known FEATS ids when possible
    const nextFeats: string[] = []
    levelEntries.forEach((lv) => {
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
          const specs = CLASS_FEATURE_DECISIONS[klassId] || []
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
          const specs = CLASS_FEATURE_DECISIONS[klassId] || []
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

    return { nextRace, nextBg, nextClasses, nextFeats, nextCfc, nextClassSkillPicks }
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
    snapshot()
    setRace(mapping.nextRace)
    setBackground(mapping.nextBg)
    setClasses(mapping.nextClasses)
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
        return
      }
      // Explicit apply (from Planner Apply button): apply immediately
      setLastImportTsHandled(ts)
      applyMapping(mapping)
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
        <Sparkles size={18} />
        <div style={{ fontWeight: 600 }}>Character Builder</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' }}>
          <span>Guided</span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={mode === 'power'} onChange={(e) => setMode(e.target.checked ? 'power' : 'guided')} />
            <span>Power</span>
          </label>
          <Button size="sm" variant="outline" onClick={undo}><Undo2 size={16} style={{ marginRight: 6 }} />Undo</Button>
          <Button size="sm" variant="outline" onClick={redo}><Redo2 size={16} style={{ marginRight: 6 }} />Redo</Button>
      <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const ok = window.confirm('Reset character to defaults? This clears saved Builder data.')
              if (!ok) return
              try { localStorage.removeItem(BUILDER_STORAGE_KEY) } catch {}
              // Reset core state to defaults
              setMode('power')
              setName('New Hero')
              setRace(RACES[0])
              setClasses([{ klass: CLASSES[0], level: 1 }])
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
        setRules({ tceCustomAsi: false, multiclassReqs: false })
        setTceMode('2+1')
        setTceAlloc({ str: 2, dex: 1, con: 0, int: 0, wis: 0, cha: 0 })
        setRulesOpen(false)
            }}
          >Reset Character</Button>
          <Button size="sm" onClick={snapshot}><Settings2 size={16} style={{ marginRight: 6 }} />Save Draft</Button>
          <Button size="sm" variant="outline" onClick={exportToFile}>Export JSON</Button>
          <input ref={importInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={onImportFileSelected} />
          <Button size="sm" variant="outline" onClick={() => importInputRef.current?.click()}>Import JSON</Button>
          {/* Rules menu */}
          <div style={{ position: 'relative' }} ref={rulesRef}>
            <Button size="sm" onClick={() => setRulesOpen((v) => !v)}><Settings2 size={16} style={{ marginRight: 6 }} />Rules</Button>
            {rulesOpen ? (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, background: 'var(--card-bg)', border: '1px solid var(--muted-border)', borderRadius: 8, boxShadow: '0 8px 16px rgba(15,23,42,0.25)', zIndex: 40, minWidth: 320, padding: 10 }}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>TCE Custom Racial Bonuses</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Replace racial ASIs with flexible allocation</div>
                    </div>
                    <Button size="sm" variant={rules.tceCustomAsi ? 'default' : 'outline'} onClick={() => setRules((r) => ({ ...r, tceCustomAsi: !r.tceCustomAsi }))}>{rules.tceCustomAsi ? 'On' : 'Off'}</Button>
                  </div>
                  {rules.tceCustomAsi ? (
                    <div style={{ padding: 8, border: '1px solid var(--muted-border)', borderRadius: 8, display: 'grid', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 12, color: '#64748b' }}>Mode</div>
                        <Button size="sm" variant={tceMode === '2+1' ? 'default' : 'outline'} onClick={() => { setTceMode('2+1'); setTceAlloc((prev)=>{ const next={...emptyAlloc, ...prev}; const total=Object.values(next).reduce((a,b)=>a+b,0); return total? next: { ...emptyAlloc, str: 2, dex: 1 } }) }}>+2 and +1</Button>
                        <Button size="sm" variant={tceMode === '1+1+1' ? 'default' : 'outline'} onClick={() => { setTceMode('1+1+1'); setTceAlloc((prev)=>{ const next={...emptyAlloc, ...prev}; const total=Object.values(next).reduce((a,b)=>a+b,0); return total? next: { ...emptyAlloc, str: 1, dex: 1, con: 1 } }) }}>+1/+1/+1</Button>
                        <Button size="sm" variant="ghost" onClick={() => setTceAlloc(tceMode === '2+1' ? { ...emptyAlloc, str: 2, dex: 1 } : { ...emptyAlloc, str: 1, dex: 1, con: 1 })}>Reset</Button>
                      </div>
                      {(() => {
                        const budget = 3
                        const limits: Record<AbilityKey, number> = { str: tceMode==='2+1'?2:1, dex: tceMode==='2+1'?2:1, con: tceMode==='2+1'?2:1, int: tceMode==='2+1'?2:1, wis: tceMode==='2+1'?2:1, cha: tceMode==='2+1'?2:1 }
                        const total = (['str','dex','con','int','wis','cha'] as AbilityKey[]).reduce((s,k)=> s + (tceAlloc[k]||0), 0)
                        const maxSlots = tceMode === '2+1' ? 2 : 3
                        const usedSlots = (['str','dex','con','int','wis','cha'] as AbilityKey[]).filter(k => (tceAlloc[k]||0) > 0).length
                        const canInc = (k: AbilityKey) => {
                          const curr = tceAlloc[k] || 0
                          if (curr >= limits[k]) return false
                          if (total >= budget) return false
                          if (tceMode === '2+1') {
                            // prevent third slot on new ability
                            if (usedSlots >= maxSlots && (tceAlloc[k]||0) === 0) return false
                            // allow one ability to reach 2; ensure at most one value 2
                            const alreadyTwo = (['str','dex','con','int','wis','cha'] as AbilityKey[]).some(x => (tceAlloc[x]||0) >= 2)
                            if (alreadyTwo && curr >= 1) return false
                          }
                          return true
                        }
                        const canDec = (k: AbilityKey) => (tceAlloc[k]||0) > 0
                        return (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                              {(['str','dex','con','int','wis','cha'] as AbilityKey[]).map((k) => (
                                <div key={k} style={{ display: 'grid', gap: 4, alignContent: 'start' }}>
                                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b', textAlign: 'center' }}>{k}</div>
                                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                                    <Button size="icon" variant="outline" onClick={() => setTceAlloc((p)=>({ ...p, [k]: Math.max(0, (p[k]||0)-1) }))} disabled={!canDec(k)}>−</Button>
                                    <div style={{ minWidth: 16, textAlign: 'center', fontWeight: 600 }}>{tceAlloc[k] || 0}</div>
                                    <Button size="icon" variant="outline" onClick={() => { if (!canInc(k)) return; setTceAlloc((p)=>({ ...p, [k]: Math.min(limits[k], (p[k]||0)+1) })) }}>+</Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>Allocated {total} / {budget}</div>
                          </>
                        )
                      })()}
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>Enforce Multiclassing Requirements</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Require ability score minimums for additional classes</div>
                    </div>
                    <Button size="sm" variant={rules.multiclassReqs ? 'default' : 'outline'} onClick={() => setRules((r) => ({ ...r, multiclassReqs: !r.multiclassReqs }))}>{rules.multiclassReqs ? 'On' : 'Off'}</Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
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
                    onChange={setClasses}
                  />
                </div>

                <AbilityEditor abilities={abilities} onChange={setAbilities} race={race} asi={asiAlloc} tceActive={rules.tceCustomAsi} tceMode={tceMode} tceAlloc={tceAlloc} />
              </div>
            </CardContent>
          </Card>

          {/* Pending Choices: background/race/class skills the player hasn't finalized */}
          {(() => {
            // Determine skills granted by any source
            const taken = new Set(Object.keys(skillSources))

            // Background skills (fixed in this demo). If conflict, offer replacements.
            const bgSkills = background?.skills ?? []
            const bgMissing = bgSkills.filter((s) => !taken.has(s))
            const bgConflicts = bgSkills.filter((s) => taken.has(s))

            // Race trait skills (e.g., Keen Senses -> Perception)
            const raceSkills = (race?.traits || []).flatMap((t) => RACE_TRAIT_SKILLS[t.id] || [])
            const raceMissing = raceSkills.filter((s) => !(skillSources[s] || []).length)
            const raceConflicts = raceSkills.filter((s) => (skillSources[s] || []).some((src) => src !== 'race' && src !== 'race-pick' && src !== 'manual'))

            // Class skill choices: for each class, count picks not yet made
            const classNeeds: Array<{ klassId: string; klassName: string; need: number; count: number; options: string[] }> = []
            classes.forEach((c) => {
              const spec = CLASS_SKILL_CHOICES[c.klass.id]
              if (!spec) return
              const current = classSkillPicks[c.klass.id] || []
              const selected = current.filter(Boolean)
              const remaining = Math.max(0, spec.count - selected.length)
              // Always show the class block; if remaining === 0 we mark it as completed
              const opts = spec.options
              classNeeds.push({ klassId: c.klass.id, klassName: c.klass.name, need: remaining, count: spec.count, options: opts })
            })

            // Class feature decisions (e.g., Fighter Fighting Style)
            // Support multi-pick decisions by allowing selected to be string | string[]
            type PendingDecision = { klassId: string; klassName: string; decision: ClassFeatureDecisionSpec; selected?: string | string[] }
            const decisionNeeds: PendingDecision[] = []
            classes.forEach((c) => {
              const specs = CLASS_FEATURE_DECISIONS[c.klass.id] || []
              specs.forEach((d) => {
                if ((c.level || 0) >= d.level) {
                  const selected = classFeatureChoices[c.klass.id]?.[d.id]
                  decisionNeeds.push({ klassId: c.klass.id, klassName: c.klass.name, decision: d, selected })
                }
              })
            })

            // Replacement pool for conflicts: show all skills; mark already-proficient as orange/disabled
            const allSkillIds = SKILLS.map((s) => s.id)
            const availableForReplacement = allSkillIds
            // Background conflicts do not grant alternatives; only race replacements remain
            const remainingReplacements = Math.max(0, raceConflicts.length - raceReplPicks.length)

            const hasAnyPending = classNeeds.reduce((a, b) => a + b.need, 0) + remainingReplacements + decisionNeeds.filter(d => {
              if (!d.selected) return true
              if (Array.isArray(d.selected)) return d.selected.length < (d.decision.picks || 1)
              return false
            }).length > 0


            return (
              <Card>
                <CardHeader>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CardTitle><Sparkles size={16} style={{ marginRight: 6 }} />Pending Choices</CardTitle>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Button size="sm" variant={showCompleted ? 'default' : 'outline'} onClick={() => setShowCompleted((v) => !v)}>
                        {showCompleted ? 'Show Completed: On' : 'Show Completed: Off'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {!hasAnyPending && (
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        No pending choices. You can still review selections here.
                      </div>
                    )}
                    {/* Background has no user choices; only show when viewing completed */}
                    {showCompleted && (
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ fontWeight: 600 }}>Background: {background?.name}</div>
            {bgMissing.length > 0 && (
                          <div style={{ fontSize: 12, color: '#64748b' }}>Grants: {bgMissing.map((s) => SKILLS.find(x => x.id === s)?.name || s).join(', ')} (will be applied)</div>
                        )}
            {bgConflicts.length > 0 && (
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            Conflicts detected: {bgConflicts.map((s) => SKILLS.find(x => x.id === s)?.name || s).join(', ')}. This background doesn't grant alternatives.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Race missing grants: render only if the race provides any skills */}
                    {(raceSkills.length > 0) && (showCompleted || raceMissing.length > 0 || raceConflicts.length > 0) && (
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ fontWeight: 600 }}>Race: {race?.name}</div>
                        {raceMissing.length > 0 && (
                          <div style={{ fontSize: 12, color: '#64748b' }}>Grants: {raceMissing.map((s) => SKILLS.find(x => x.id === s)?.name || s).join(', ')} (will be applied)</div>
                        )}
      {raceConflicts.length > 0 && (
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            Conflicts detected: {raceConflicts.map((s) => SKILLS.find(x => x.id === s)?.name || s).join(', ')}. Pick {raceConflicts.length} replacement{raceConflicts.length > 1 ? 's' : ''}:
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                              {availableForReplacement.map((sid) => {
                                const selected = raceReplPicks.includes(sid)
                                const selectedOther = bgReplPicks.includes(sid)
                                const atMax = raceReplPicks.length >= raceConflicts.length
        // Mark as already only if the skill is granted from a source other than this race replacement (ignore manual)
        const sources = skillSources[sid] || []
        const hasOtherSource = sources.some((s) => s !== 'race' && s !== 'race-pick' && s !== 'manual')
                                const already = hasOtherSource && !selected
                                const disabled = already || selectedOther || (atMax && !selected)
                                const baseProps: any = {}
                                if (already) {
                                  baseProps.style = { background: '#f97316', color: 'white', borderColor: '#f97316' }
                                }
                                return (
                                  <Button
                                    key={sid}
                                    size="sm"
                                    variant={selected ? 'default' : 'outline'}
                                    disabled={disabled}
                                    onClick={() => {
                                      if (already || selectedOther) return
                                      setRaceReplPicks((prev) => selected
                                        ? prev.filter((x) => x !== sid)
                                        : (prev.length < raceConflicts.length ? [...prev, sid] : prev))
                                      if (selected) removeSkillSource(sid, 'race-pick')
                                      else addSkillSource(sid, 'race-pick')
                                    }}
                                    {...baseProps}
                                  >{SKILLS.find(x => x.id === sid)?.name || sid}</Button>
                                )
                              })}
                            </div>
                            <div style={{ marginTop: 6 }}>Selected {raceReplPicks.length} / {raceConflicts.length}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Class skill picks */}
                    {classNeeds.filter(c => showCompleted || c.need > 0).length > 0 && (
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ fontWeight: 600 }}>Class Skills</div>
                        {classNeeds.filter(c => showCompleted || c.need > 0).map(({ klassId, klassName, need, count, options }) => (
                          <div key={klassId} style={{ display: 'grid', gap: 6 }}>
                            <div style={{ fontSize: 12, color: '#64748b' }}>
                              {klassName}: {need > 0 ? `pick ${need}` : (showCompleted ? 'complete' : null)}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {options.map((sid) => {
                                const current = classSkillPicks[klassId] || []
                                const selected = current.includes(sid)
                                // Treat this class's own grants as selectable (blue), but block if any other source grants it (ignore manual)
                                const sources = skillSources[sid] || []
                                const hasOtherSource = sources.some((s) => s !== `class:${klassId}` && s !== 'manual')
                                const already = hasOtherSource && !selected
        const atMax = current.length >= count
                                const disabled = already || (atMax && !selected)
                                const baseProps: any = {}
                                if (already) {
                                  baseProps.style = { background: '#f97316', color: 'white', borderColor: '#f97316' }
                                }
                                return (
                                  <Button
                                    key={sid}
                                    size="sm"
                                    variant={selected ? 'default' : 'outline'}
                                    disabled={disabled}
                                    onClick={() => {
                                      if (already) return
                    setClassSkillPicks((prev) => {
                                        const arr = [...(prev[klassId] || [])]
                                        const nextArr = selected
                                          ? arr.filter((x) => x !== sid)
                      : (arr.length < count ? [...arr, sid] : arr)
                                        return { ...prev, [klassId]: nextArr }
                                      })
              if (selected) removeSkillSource(sid, `class:${klassId}`)
              else addSkillSource(sid, `class:${klassId}`)
                                    }}
                                    {...baseProps}
                                  >{SKILLS.find(x => x.id === sid)?.name || sid}</Button>
                                )
                              })}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>Selected {(classSkillPicks[klassId] || []).length} / {count}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Class feature decisions (e.g., Fighting Style) */}
                    {(() => {
                      // Rebuild within render scope to keep types simple
                      type PendingDecision = { klassId: string; klassName: string; decision: ClassFeatureDecisionSpec; selected?: string | string[] }
                      const decisionNeeds: PendingDecision[] = []
                      classes.forEach((c) => {
                        const specs = CLASS_FEATURE_DECISIONS[c.klass.id] || []
                        specs.forEach((d) => {
                          if ((c.level || 0) >= d.level) {
                            const selected = classFeatureChoices[c.klass.id]?.[d.id]
                            decisionNeeds.push({ klassId: c.klass.id, klassName: c.klass.name, decision: d, selected })
                          }
                        })
                      })
                      if (!decisionNeeds.length) return null
                      const visible = decisionNeeds.filter(({ decision, selected }) => {
                        const need = decision.picks || 1
                        const have = Array.isArray(selected) ? selected.length : (selected ? 1 : 0)
                        return showCompleted || have < need
                      })
                      if (!visible.length) return null
                      return (
                        <div style={{ display: 'grid', gap: 8 }}>
                          <div style={{ fontWeight: 600 }}>Class Feature Decisions</div>
                          {visible.map(({ klassId, klassName, decision, selected }) => (
                            <div key={`${klassId}:${decision.id}`} style={{ display: 'grid', gap: 6 }}>
                              <div style={{ fontSize: 12, color: '#64748b' }}>
                                {klassName}: {decision.name} {(() => {
                                  const need = decision.picks || 1
                                  const have = Array.isArray(selected) ? selected.length : (selected ? 1 : 0)
                                  return have >= need ? (showCompleted ? '(complete)' : '') : `(pick ${need - have} more)`
                                })()}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {decision.options.map((opt) => {
                                  const need = decision.picks || 1
                                  const selArr = Array.isArray(selected) ? selected : (selected ? [selected] : [])
                                  const isSelected = selArr.includes(opt.id)
                                  const atMax = selArr.length >= need
                                  return (
                                    <Button
                                      key={opt.id}
                                      size="sm"
                                      variant={isSelected ? 'default' : 'outline'}
                                      disabled={!isSelected && atMax}
                                      onClick={() => {
                                        setClassFeatureChoices((prev) => {
                                          const byClass = { ...(prev[klassId] || {}) }
                                          const cur = byClass[decision.id]
                                          const curArr = Array.isArray(cur) ? cur : (cur ? [cur] : [])
                                          let next: string[]
                                          if (isSelected) {
                                            next = curArr.filter((x) => x !== opt.id)
                                          } else {
                                            next = atMax ? curArr : [...curArr, opt.id]
                                          }
                                          byClass[decision.id] = need === 1 ? (next[0] || '') : next
                                          return { ...prev, [klassId]: byClass }
                                        })
                                      }}
                                      title={opt.text}
                                      style={{ opacity: !isSelected && atMax ? 0.6 : 1 }}
                                    >{opt.name}</Button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="sm" variant="ghost" onClick={() => {
                        // Clear local pick state only
                        setBgReplPicks([]); setRaceReplPicks([]); setClassSkillPicks({}); setClassFeatureChoices({})
                      }}>Reset Selections</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })()}

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

          {/* ASI & Feats */}
          {(() => {
            // Count available ASI slots from classes at levels 4,8,12,16,19 (demo rule).
            const asiLevels = new Set([4, 8, 12, 16, 19])
            const asiSlots = classes.reduce((sum, c) => sum + Array.from(asiLevels).filter(lv => c.level >= lv).length, 0)
            // Each slot provides 2 points for ASIs or 1 feat (which consumes 2 points)
            const totalPoints = asiSlots * 2
            const spentPoints = (['str','dex','con','int','wis','cha'] as AbilityKey[]).reduce((s, k) => s + (asiAlloc[k] || 0), 0) + (selectedFeats.length * 2)
            const remaining = Math.max(0, totalPoints - spentPoints)
            const fa = finalAbility(abilities, race, asiAlloc, { tceActive: rules.tceCustomAsi, tceMode, tceAlloc })
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
            // Only show card if there is at least one ASI slot from any class
            if (asiSlots === 0) return null
            return (
              <Card>
                <CardHeader><CardTitle><Sparkles size={16} style={{ marginRight: 6 }} />ASI & Feats</CardTitle></CardHeader>
                <CardContent>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Pill>ASI slots {asiSlots}</Pill>
                      <Pill>Points {spentPoints} / {totalPoints}</Pill>
                      <Pill>Remaining {remaining}</Pill>
                    </div>
                    {/* ASI allocation */}
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
                    {/* Feats */}
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
                      {/* Prodigy configuration */}
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
                    </div>
                    {(selectedFeats.length > 0) ? (
                      <div style={{ fontSize: 12, color: '#64748b' }}>Selected feats: {selectedFeats.map(fid => FEATS.find(f => f.id === fid)?.name || fid).join(', ')}</div>
                    ) : null}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="sm" variant="ghost" onClick={() => { setAsiAlloc({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }); setSelectedFeats([]) }}>Reset ASI/Feats</Button>
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
              const fa = finalAbility(abilities, race, asiAlloc, { tceActive: rules.tceCustomAsi, tceMode, tceAlloc })
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
            const pb = proficiencyBonus(derived.totalLevel)
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
                    const fa = finalAbility(abilities, race, asiAlloc, { tceActive: rules.tceCustomAsi, tceMode, tceAlloc })
                    const pb = proficiencyBonus(derived.totalLevel)
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
                    return (
                      <div style={containerStyle}>
                        {displayItems.map((s) => (
                          <div key={s.id} style={cardBaseStyle}>
                            <div style={{ display: 'grid', gap: 2 }}>
                              <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{s.name}</div>
                              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{s.ability}</div>
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
                        ))}
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
                  {/* Search + Filters toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                  </div>
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
  <aside style={{ display: 'grid', gap: 12, position: 'sticky', top: 76, flex: '0 0 420px', width: 420, minWidth: 420, boxSizing: 'border-box' }}>
          <Card>
            <CardHeader><CardTitle><Scale size={16} style={{ marginRight: 6 }} />Live Summary</CardTitle></CardHeader>
            <CardContent>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Labeled label="Race"><div>{race.name}</div></Labeled>
                <Labeled label="Level"><Pill>{derived.totalLevel}</Pill></Labeled>
                <Labeled label="Classes">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {classes.map((c) => (
                      <Pill key={c.klass.id}>
                        {c.klass.name} {c.level}{c.subclass ? ` (${c.subclass.name})` : ''}
                      </Pill>
                    ))}
                  </div>
                </Labeled>
                <Labeled label="Speed"><Pill>{derived.speed} ft.</Pill></Labeled>
                <Labeled label="HP @lvl"><Pill>{derived.hp}</Pill></Labeled>
                <Labeled label="AC"><Pill>{derived.ac}</Pill></Labeled>
                <Labeled label="Initiative"><Pill>{derived.initiative >= 0 ? `+${derived.initiative}` : derived.initiative}</Pill></Labeled>
                <Labeled label="Background"><div>{background?.name || '—'}</div></Labeled>
              </div>

              {/* Combined Abilities + Saves */}
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Abilities & Saves</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {(['str','dex','con','int','wis','cha'] as AbilityKey[]).map((k) => (
                    <div key={k} style={{ padding: 8, borderRadius: 12, border: '1px solid var(--muted-border)', background: 'var(--card-bg)', display: 'grid', gap: 6 }}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b' }}>{k}</div>
                      <div style={{ fontWeight: 600 }}>{finalAbility(abilities, race, asiAlloc, { tceActive: rules.tceCustomAsi, tceMode, tceAlloc })[k]}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>mod {mod(finalAbility(abilities, race, asiAlloc, { tceActive: rules.tceCustomAsi, tceMode, tceAlloc })[k]) >= 0 ? '+' : ''}{mod(finalAbility(abilities, race, asiAlloc, { tceActive: rules.tceCustomAsi, tceMode, tceAlloc })[k])}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>Save</span>
                        <Pill>{derived.saves[k] >= 0 ? `+${derived.saves[k]}` : derived.saves[k]}</Pill>
                      </div>
                    </div>
                  ))}
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
              <Button size="sm" onClick={() => { if (pendingPassivePlan) { applyMapping(pendingPassivePlan.mapping); setPendingPassivePlan(null) } }}>Apply changes</Button>
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

function AbilityEditor(props: { abilities: Record<AbilityKey, number>; onChange: (v: Record<AbilityKey, number>) => void; race: Race; asi?: Record<AbilityKey, number>; tceActive?: boolean; tceMode?: '2+1' | '1+1+1'; tceAlloc?: Record<AbilityKey, number> }) {
  const final = finalAbility(props.abilities, props.race, props.asi, { tceActive: props.tceActive, tceMode: props.tceMode, tceAlloc: props.tceAlloc })
  const order: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

  // Roll pool + DnD state
  type RollToken = { id: string; value: number }
  const [rollTokens, setRollTokens] = useState<RollToken[]>([])
  const [assignedFromPool, setAssignedFromPool] = useState<Partial<Record<AbilityKey, number>>>({})
  const makeId = () => Math.random().toString(36).slice(2, 9)
  // Point Buy state
  const [pointBuy, setPointBuy] = useState(false)
  // NEW: toggle for generator options
  const [genOpen, setGenOpen] = useState(false)
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
  }
  function roll3d6Pool() {
    const vals = Array.from({ length: 6 }, () => gen3d6Once())
    setRollTokens(toTokens(vals))
    setAssignedFromPool({})
    setPointBuy(false)
  }
  function roll1d20Pool() {
    const vals = Array.from({ length: 6 }, () => 1 + Math.floor(Math.random() * 20))
    setRollTokens(toTokens(vals))
    setAssignedFromPool({})
    setPointBuy(false)
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

  return (
    <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 12, color: '#64748b' }}>Abilities</div>

      {/* Generators */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <Button size="sm" variant="outline" onClick={() => setGenOpen((v) => !v)}>Generate</Button>
        <Button size="sm" variant="ghost" onClick={() => { props.onChange({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }); clearRolls(); setPointBuy(false) }}>Reset</Button>
        {genOpen ? (
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
              <>
                <Button size="sm" variant="outline" onClick={autoAssignFromPool}>Auto-assign high→low</Button>
                <Button size="sm" variant="ghost" onClick={clearRolls}>Clear Rolls</Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

  {/* Roll pool as draggable tokens (only for dice methods) */}
      {rollTokens.length ? (
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
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
        {order.map((k) => (
          <div
            key={k}
            onDragOver={onAbilityDragOver}
            onDrop={(e) => onAbilityDrop(k, e)}
            style={{ padding: 8, borderRadius: 12, border: '1px solid var(--muted-border)', background: 'var(--card-bg)', display: 'grid', gap: 6 }}
          >
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b' }}>{k}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button size="icon" variant="outline" onClick={() => adjustAbility(k, -1)}>−</Button>
              <div style={{ fontWeight: 600, width: 24, textAlign: 'center' }}>{pointBuy ? Math.max(8, Math.min(15, props.abilities[k] || 8)) : (props.abilities[k] || 10)}</div>
              <Button size="icon" variant="outline" onClick={() => adjustAbility(k, +1)}>+</Button>
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>mod {mod(final[k]) >= 0 ? '+' : ''}{mod(final[k])}</div>
            {typeof assignedFromPool[k] === 'number' ? (
              <div style={{ fontSize: 11, color: '#64748b' }}>Assigned: {assignedFromPool[k]}</div>
            ) : (
              rollTokens.length ? <div style={{ fontSize: 11, color: '#94a3b8' }}>Drop a roll here</div> : null
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
  } else {
    Object.entries(race?.asis || {}).forEach(([k, inc]) => { const kk = k as AbilityKey; out[kk] = (out[kk] || 10) + (inc || 0) })
  }
  if (asi) {
    (['str','dex','con','int','wis','cha'] as AbilityKey[]).forEach((k) => {
      const inc = Math.max(0, Math.floor(asi[k] || 0))
      out[k] = (out[k] || 10) + inc
    })
  }
  return out
}

function ItemCard({ item, onAdd }: { item: Equipment; onAdd: () => void }) {
  const tags = (item as any).tags as string[] | undefined
  return (
  <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--muted-border)', background: 'var(--card-bg)', display: 'grid', gap: 6, minHeight: 96 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {item.type === 'weapon' && <Sword size={16} />}
        {item.type === 'shield' && <Shield size={16} />}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
          <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
            {item.type === 'weapon' && (item as any).dmg}
            {item.type === 'armor' && (
              <>AC {(item as any).ac}{typeof (item as any).dexMax !== 'undefined' ? `, Dex cap ${((item as any).dexMax === (Infinity as any)) ? '—' : (item as any).dexMax}` : ''}</>
            )}
            {item.type === 'shield' && `+${(item as any).ac || 2} AC`}
          </span>
        </div>
        <Button size="icon" onClick={onAdd} aria-label="Add"><Plus size={16} /></Button>
      </div>
      {tags?.length ? (
        <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

function ClassManager(props: { classes: Array<{ klass: Klass; level: number; subclass?: Subclass }>; onChange: (v: Array<{ klass: Klass; level: number; subclass?: Subclass }>) => void }) {
  const [addOpen, setAddOpen] = useState(false)
  const addRef = useRef<HTMLDivElement | null>(null)
  const totalLevel = props.classes.reduce((s: number, c: { klass: Klass; level: number; subclass?: Subclass }) => s + c.level, 0)
  const maxTotal = 20
  const available: Klass[] = CLASSES
    .filter((k) => !props.classes.some((c) => c.klass.id === k.id))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
  const canAdd = totalLevel < maxTotal && available.length > 0

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
    props.onChange(out)
  }
  function removeAt(idx: number) {
    const out = props.classes.filter((_, i) => i !== idx)
    props.onChange(out.length ? out : [{ klass: CLASSES[0], level: 1 }])
  }
  function addClass(k: Klass) {
    if (props.classes.some((c) => c.klass.id === k.id)) return
    const other = totalLevel
    if (other >= maxTotal) return
    props.onChange([...props.classes, { klass: k, level: 1 }])
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
                {available.map((k: Klass) => (
                  <Button key={k.id} size="sm" variant="ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => addClass(k)}>
                    {k.name}
                  </Button>
                ))}
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
                <div style={{ fontWeight: 600 }}>{c.klass.name}</div>
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

function RaceSelector(props: { value: Race; onChange: (v: Race) => void }) {
  const [showHumanSubs, setShowHumanSubs] = useState(false)
  const [showElfSubs, setShowElfSubs] = useState(false)
  const [showDwarfSubs, setShowDwarfSubs] = useState(false)
  const [showHalflingSubs, setShowHalflingSubs] = useState(false)
  const [showDragonSubs, setShowDragonSubs] = useState(false)
  // Subrace buttons use a distinct color scheme to differentiate from parent buttons
  const subBtnStyle = (selected: boolean): React.CSSProperties =>
    selected
      ? { background: '#4f46e5', color: 'white', borderColor: '#4f46e5' } // indigo selected
      : { borderColor: '#4f46e5', color: '#4f46e5' } // indigo outline
  const humanBase = RACES.find(r => r.id === 'human')!
  const humanVar = RACES.find(r => r.id === 'human-variant')!
  const elfWood = RACES.find(r => r.id === 'elf-wood')!
  const elfHigh = RACES.find(r => r.id === 'elf-high')!
  const dwarfHill = RACES.find(r => r.id === 'dwarf-hill')!
  const dwarfMountain = RACES.find(r => r.id === 'dwarf-mountain')!
  const halflingLightfoot = RACES.find(r => r.id === 'halfling-lightfoot')!
  const halflingStout = RACES.find(r => r.id === 'halfling-stout')!
  const dragonbornBase = RACES.find(r => r.id === 'dragonborn')!
  const dragonVariants = RACES.filter(r => r.id.startsWith('dragonborn-'))
  const dragonVariantIds = new Set(dragonVariants.map(r => r.id))
  const excludeIds = new Set<string>(['human','human-variant','elf-wood','elf-high','dwarf-hill','dwarf-mountain','halfling-lightfoot','halfling-stout','dragonborn', ...Array.from(dragonVariantIds)])
  const others = RACES.filter(r => !excludeIds.has(r.id))
  const isHumanSelected = props.value.id === 'human' || props.value.id === 'human-variant'
  const isElfSelected = props.value.id === 'elf-wood' || props.value.id === 'elf-high'
  const isDwarfSelected = props.value.id === 'dwarf-hill' || props.value.id === 'dwarf-mountain'
  const isHalflingSelected = props.value.id === 'halfling-lightfoot' || props.value.id === 'halfling-stout'
  const isDragonSelected = props.value.id === 'dragonborn' || props.value.id.startsWith('dragonborn-')

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {/* Human group button */}
      <Button size="sm" variant={isHumanSelected ? 'default' : 'outline'} onClick={() => setShowHumanSubs((v) => !v)}>Human</Button>
      {showHumanSubs && (
        <>
          <Button size="sm" variant={props.value.id === 'human' ? 'default' : 'outline'} onClick={() => props.onChange(humanBase)} style={subBtnStyle(props.value.id === 'human')}>Base</Button>
          <Button size="sm" variant={props.value.id === 'human-variant' ? 'default' : 'outline'} onClick={() => props.onChange(humanVar)} style={subBtnStyle(props.value.id === 'human-variant')}>Variant</Button>
        </>
      )}

      {/* Elf group button */}
      <Button size="sm" variant={isElfSelected ? 'default' : 'outline'} onClick={() => setShowElfSubs((v) => !v)}>Elf</Button>
      {showElfSubs && (
        <>
          <Button size="sm" variant={props.value.id === 'elf-wood' ? 'default' : 'outline'} onClick={() => props.onChange(elfWood)} style={subBtnStyle(props.value.id === 'elf-wood')}>Wood</Button>
          <Button size="sm" variant={props.value.id === 'elf-high' ? 'default' : 'outline'} onClick={() => props.onChange(elfHigh)} style={subBtnStyle(props.value.id === 'elf-high')}>High</Button>
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

      {/* Other races remain direct buttons */}
      {others.map((r) => (
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
    return <div style={{ fontSize: 12, color: '#94a3b8' }}>No skills currently have sources or availability.</div>
  }
  const isChoice = (src: string) => src === 'manual' || src === 'race-pick' || src.startsWith('class:')
  // Gather unique source keys from skills that have sources, split by type
  const allKeys = Array.from(new Set(skills.filter((s) => skillHasSources(s.id)).flatMap((s) => (skillSources[s.id] || []))))
  const fixedKeys = allKeys.filter((k) => !isChoice(k))
  const choiceKeys = allKeys.filter((k) => isChoice(k))
  const labelFor = (src: string) => {
    if (src === 'bg') return `Background${background?.name ? `: ${background.name}` : ''}`
    if (src === 'race') return `Race${race?.name ? `: ${race.name}` : ''}`
    if (src === 'race-pick') return 'Race (replacement)'
    if (src === 'manual') return 'Manual'
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
  const leftClassNodes = classAvailKeys.map((key, i) => ({ id: key, label: labelFor(key), x: leftX, y: padding + (leftFixedNodes.length + i) * rowGap }))
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
