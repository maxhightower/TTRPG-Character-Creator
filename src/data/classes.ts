import type { AbilityKey } from './types'

export type Subclass = {
  id: string
  name: string
  unlockLevel: number
  grants?: { subactions?: string[] }
}

export type Klass = {
  id: string
  name: string
  hitDie: number
  armor: string[]
  weapons: string[]
  grants?: { subactions?: string[] }
  level1?: Array<{ name: string; text: string }>
  featuresByLevel?: Record<number, Array<{ name: string; text: string }>>
  acFormula?: (a: { armor: string | 'none'; dexMod: number; conMod: number }) => number | undefined
  saves?: AbilityKey[]
  subclasses?: Subclass[]
}

export const CLASSES: Klass[] = [
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
      6: [
        { name: 'Path Feature', text: 'Your Primal Path grants an additional feature.' },
      ],
      7: [
        { name: 'Feral Instinct', text: 'Advantage on initiative rolls; you act normally while surprised if you enter rage first.' },
      ],
      8: [
        { name: 'Ability Score Improvement', text: '+2 to one ability or +1 to two abilities (demo text).' },
      ],
      9: [
        { name: 'Brutal Critical (1 die)', text: 'Add one extra weapon damage die on a critical hit.' },
        { name: 'Rage Damage +3', text: 'Rage damage bonus increases to +3.' },
      ],
      10: [
        { name: 'Path Feature', text: 'Your Primal Path grants an additional feature.' },
      ],
      11: [
        { name: 'Relentless Rage', text: 'While raging, drop to 1 HP instead of 0 on a failed death save (DC increases on repeats).' },
      ],
      12: [
        { name: 'Ability Score Improvement', text: '+2 to one ability or +1 to two abilities (demo text).' },
      ],
      13: [
        { name: 'Brutal Critical (2 dice)', text: 'Add two extra weapon damage dice on a critical hit.' },
      ],
      14: [
        { name: 'Path Feature', text: 'Your Primal Path grants an additional feature.' },
      ],
      15: [
        { name: 'Persistent Rage', text: 'Your rage ends only if you fall unconscious or choose to end it.' },
      ],
      16: [
        { name: 'Ability Score Improvement', text: '+2 to one ability or +1 to two abilities (demo text).' },
        { name: 'Rage Damage +4', text: 'Rage damage bonus increases to +4.' },
      ],
      17: [
        { name: 'Brutal Critical (3 dice)', text: 'Add three extra weapon damage dice on a critical hit.' },
      ],
      18: [
        { name: 'Indomitable Might', text: 'STR check result can be your STR score if lower.' },
      ],
      19: [
        { name: 'Ability Score Improvement', text: '+2 to one ability or +1 to two abilities (demo text).' },
      ],
      20: [
        { name: 'Primal Champion', text: 'STR and CON scores increase by 4 (max now 24); unlimited rages.' },
      ],
    },
    acFormula: (a) => (a.armor === 'none' ? 10 + a.dexMod + a.conMod : undefined),
    saves: ['str', 'con'],
    subclasses: [
      { id: 'berserker', name: 'Path of the Berserker', unlockLevel: 3, grants: { subactions: ['Frenzy'] } },
      { id: 'totem-warrior', name: 'Path of the Totem Warrior', unlockLevel: 3, grants: { subactions: ['Spirit Totem'] } },
      { id: 'ancestral-guardian', name: 'Path of the Ancestral Guardian', unlockLevel: 3, grants: { subactions: ['Spirit Shield'] } },
      { id: 'storm-herald', name: 'Path of the Storm Herald', unlockLevel: 3, grants: { subactions: ['Storm Aura'] } },
      { id: 'zealot', name: 'Path of the Zealot', unlockLevel: 3, grants: { subactions: ['Divine Fury'] } },
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
  { id: 'gloom-stalker', name: 'Gloom Stalker', unlockLevel: 3 },
  { id: 'horizon-walker', name: 'Horizon Walker', unlockLevel: 3 },
  { id: 'monster-slayer', name: 'Monster Slayer', unlockLevel: 3 },
  { id: 'swarmkeeper', name: 'Swarmkeeper', unlockLevel: 3 },
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
  { id: 'swashbuckler', name: 'Swashbuckler', unlockLevel: 3 },
  { id: 'soulknife', name: 'Soulknife', unlockLevel: 3 },
  { id: 'phantom', name: 'Phantom', unlockLevel: 3 },
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
  { id: 'four-elements', name: 'Way of the Four Elements', unlockLevel: 3, grants: { subactions: ['Elemental Discipline'] } },
  { id: 'kensei', name: 'Way of the Kensei', unlockLevel: 3, grants: { subactions: ['Kensei Shot'] } },
  { id: 'mercy', name: 'Way of Mercy', unlockLevel: 3, grants: { subactions: ['Hands of Healing', 'Hands of Harm'] } },
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
  { id: 'oath-ancients', name: 'Oath of the Ancients', unlockLevel: 3, grants: { subactions: ['Channel Divinity (Ancients)'] } },
  { id: 'oath-conquest', name: 'Oath of Conquest', unlockLevel: 3, grants: { subactions: ['Channel Divinity (Conquest)'] } },
  { id: 'oath-redemption', name: 'Oath of Redemption', unlockLevel: 3, grants: { subactions: ['Channel Divinity (Redemption)'] } },
  { id: 'oath-glory', name: 'Oath of Glory', unlockLevel: 3, grants: { subactions: ['Channel Divinity (Glory)'] } },
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
  { id: 'battle-master', name: 'Battle Master', unlockLevel: 3, grants: { subactions: ['Superiority Dice', 'Combat Maneuver'] } },
  { id: 'eldritch-knight', name: 'Eldritch Knight', unlockLevel: 3, grants: { subactions: ['Cast Spell', 'Weapon Bond'] } },
  { id: 'rune-knight', name: 'Rune Knight', unlockLevel: 3, grants: { subactions: ["Giant's Might", 'Invoke Rune'] } },
  { id: 'samurai', name: 'Samurai', unlockLevel: 3, grants: { subactions: ['Fighting Spirit'] } },
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
  { id: 'college-of-glamour', name: 'College of Glamour', unlockLevel: 3, grants: { subactions: ['Mantle of Inspiration', 'Enthralling Performance'] } },
  { id: 'college-of-swords', name: 'College of Swords', unlockLevel: 3, grants: { subactions: ['Blade Flourish'] } },
  { id: 'college-of-whispers', name: 'College of Whispers', unlockLevel: 3, grants: { subactions: ['Psychic Blades', 'Mantle of Whispers'] } },
  { id: 'college-of-eloquence', name: 'College of Eloquence', unlockLevel: 3, grants: { subactions: ['Unsettling Words', 'Silver Tongue'] } },
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
  { id: 'tempest-domain', name: 'Tempest Domain', unlockLevel: 1, grants: { subactions: ['Channel Divinity: Destructive Wrath'] } },
  { id: 'twilight-domain', name: 'Twilight Domain', unlockLevel: 1, grants: { subactions: ['Channel Divinity: Twilight Sanctuary'] } },
  { id: 'peace-domain', name: 'Peace Domain', unlockLevel: 1, grants: { subactions: ['Channel Divinity: Balm of Peace'] } },
  { id: 'forge-domain', name: 'Forge Domain', unlockLevel: 1, grants: { subactions: ['Channel Divinity: Artisan’s Blessing'] } },
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
  { id: 'circle-dreams', name: 'Circle of Dreams', unlockLevel: 2, grants: { subactions: ['Balm of the Summer Court'] } },
  { id: 'circle-shepherd', name: 'Circle of the Shepherd', unlockLevel: 2, grants: { subactions: ['Spirit Totem'] } },
  { id: 'circle-spores', name: 'Circle of Spores', unlockLevel: 2, grants: { subactions: ['Halo of Spores'] } },
  { id: 'circle-wildfire', name: 'Circle of Wildfire', unlockLevel: 2, grants: { subactions: ['Summon Wildfire Spirit'] } },
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
  { id: 'abjuration', name: 'School of Abjuration', unlockLevel: 2, grants: { subactions: ['Arcane Ward'] } },
  { id: 'conjuration', name: 'School of Conjuration', unlockLevel: 2, grants: { subactions: ['Minor Conjuration'] } },
  { id: 'divination', name: 'School of Divination', unlockLevel: 2, grants: { subactions: ['Portent'] } },
  { id: 'illusion', name: 'School of Illusion', unlockLevel: 2, grants: { subactions: ['Improved Illusion'] } },
  { id: 'necromancy', name: 'School of Necromancy', unlockLevel: 2, grants: { subactions: ['Grim Harvest'] } },
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
  { id: 'celestial', name: 'The Celestial', unlockLevel: 1 },
  { id: 'hexblade', name: 'The Hexblade', unlockLevel: 1 },
  { id: 'genie', name: 'The Genie', unlockLevel: 1 },
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
  { id: 'divine-soul', name: 'Divine Soul', unlockLevel: 1 },
  { id: 'shadow-magic', name: 'Shadow Magic', unlockLevel: 1 },
  { id: 'storm-sorcery', name: 'Storm Sorcery', unlockLevel: 1 },
    ],
  },
]
