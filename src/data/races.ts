import type { AbilityKey } from './types'

export type Race = {
  id: string
  name: string
  asis: Partial<Record<AbilityKey, number>>
  speed: number
  traits: Array<{ id: string; name: string; text: string }>
  spells?: string[]
}

export const RACES: Race[] = [
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
  ], spells: ['minor-illusion'] },
  { id: 'elf-drow', name: 'Elf (Drow)', asis: { dex: 2, cha: 1 }, speed: 30, traits: [
    { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' },
    { id: 'keen', name: 'Keen Senses', text: 'Proficiency in Perception.' },
    { id: 'fey-ancestry', name: 'Fey Ancestry', text: 'Advantage on saves against being charmed; magic can’t put you to sleep.' },
    { id: 'drow-magic', name: 'Drow Magic', text: 'Innate magic themed around light and darkness (demo placeholder).' },
  ], spells: ['light','faerie-fire','darkness'] },
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
  { id: 'tiefling', name: 'Tiefling', asis: { cha: 2, int: 1 }, speed: 30, traits: [ { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' }, { id: 'hellish-resistance', name: 'Hellish Resistance', text: 'Resistance to fire damage.' } ], spells: ['thaumaturgy','hellish-rebuke','darkness'] },
  // Tiefling subraces (generic placeholders)
  { id: 'tiefling-asmodeus', name: 'Tiefling (Asmodeus)', asis: { cha: 2, int: 1 }, speed: 30, traits: [
    { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' },
    { id: 'hellish-resistance', name: 'Hellish Resistance', text: 'Resistance to fire damage.' },
    { id: 'infernal-legacy-asmodeus', name: 'Infernal Legacy (Asmodeus)', text: 'Innate infernal magic themed to Asmodeus (placeholder).' },
  ], spells: ['thaumaturgy','hellish-rebuke','darkness'] },
  { id: 'tiefling-baalzebul', name: 'Tiefling (Baalzebul)', asis: { cha: 2, int: 1 }, speed: 30, traits: [
    { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' },
    { id: 'hellish-resistance', name: 'Hellish Resistance', text: 'Resistance to fire damage.' },
    { id: 'infernal-legacy-baalzebul', name: 'Infernal Legacy (Baalzebul)', text: 'Innate magic reflecting corruption and decay (placeholder).' },
  ], spells: ['thaumaturgy','hellish-rebuke','darkness'] },
  { id: 'tiefling-dispater', name: 'Tiefling (Dispater)', asis: { cha: 2, dex: 1 }, speed: 30, traits: [
    { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' },
    { id: 'hellish-resistance', name: 'Hellish Resistance', text: 'Resistance to fire damage.' },
    { id: 'infernal-legacy-dispater', name: 'Infernal Legacy (Dispater)', text: 'Innate magic of stealth and metal craft (placeholder).' },
  ], spells: ['thaumaturgy','hellish-rebuke','darkness'] },
  { id: 'tiefling-fierna', name: 'Tiefling (Fierna)', asis: { cha: 2, wis: 1 }, speed: 30, traits: [
    { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' },
    { id: 'hellish-resistance', name: 'Hellish Resistance', text: 'Resistance to fire damage.' },
    { id: 'infernal-legacy-fierna', name: 'Infernal Legacy (Fierna)', text: 'Innate magic of persuasion and flame (placeholder).' },
  ], spells: ['thaumaturgy','hellish-rebuke','darkness'] },
  { id: 'tiefling-glasya', name: 'Tiefling (Glasya)', asis: { cha: 2, dex: 1 }, speed: 30, traits: [
    { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' },
    { id: 'hellish-resistance', name: 'Hellish Resistance', text: 'Resistance to fire damage.' },
    { id: 'infernal-legacy-glasya', name: 'Infernal Legacy (Glasya)', text: 'Innate magic of guile and subterfuge (placeholder).' },
  ], spells: ['thaumaturgy','hellish-rebuke','darkness'] },
  { id: 'tiefling-levistus', name: 'Tiefling (Levistus)', asis: { cha: 2, con: 1 }, speed: 30, traits: [
    { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' },
    { id: 'hellish-resistance', name: 'Hellish Resistance', text: 'Resistance to fire damage.' },
    { id: 'infernal-legacy-levistus', name: 'Infernal Legacy (Levistus)', text: 'Innate magic of cold preservation (placeholder).' },
  ], spells: ['thaumaturgy','hellish-rebuke','darkness'] },
  { id: 'tiefling-mammon', name: 'Tiefling (Mammon)', asis: { cha: 2, int: 1 }, speed: 30, traits: [
    { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' },
    { id: 'hellish-resistance', name: 'Hellish Resistance', text: 'Resistance to fire damage.' },
    { id: 'infernal-legacy-mammon', name: 'Infernal Legacy (Mammon)', text: 'Innate magic of avarice and transmutation (placeholder).' },
  ], spells: ['thaumaturgy','hellish-rebuke','darkness'] },
  { id: 'tiefling-mephistopheles', name: 'Tiefling (Mephistopheles)', asis: { cha: 2, int: 1 }, speed: 30, traits: [
    { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' },
    { id: 'hellish-resistance', name: 'Hellish Resistance', text: 'Resistance to fire damage.' },
    { id: 'infernal-legacy-mephistopheles', name: 'Infernal Legacy (Mephistopheles)', text: 'Innate magic of arcane flame (placeholder).' },
  ], spells: ['thaumaturgy','hellish-rebuke','darkness'] },
  { id: 'tiefling-zariel', name: 'Tiefling (Zariel)', asis: { cha: 2, str: 1 }, speed: 30, traits: [
    { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' },
    { id: 'hellish-resistance', name: 'Hellish Resistance', text: 'Resistance to fire damage.' },
    { id: 'infernal-legacy-zariel', name: 'Infernal Legacy (Zariel)', text: 'Innate magic of martial zeal and flame (placeholder).' },
  ], spells: ['thaumaturgy','hellish-rebuke','darkness'] },
  // Gnome subraces
  { id: 'gnome-forest', name: 'Gnome (Forest)', asis: { int: 2, dex: 1 }, speed: 25, traits: [
    { id: 'darkvision', name: 'Darkvision', text: 'Dim light 60 ft.' },
    { id: 'gnome-cunning', name: 'Gnome Cunning', text: 'Adv. on Int/Wis/Cha saves vs. magic (demo).' },
    { id: 'speak-small-beasts', name: 'Speak with Small Beasts', text: 'Communicate simple ideas with Small beasts (demo).' },
  ], spells: ['minor-illusion'] },
  { id: 'gnome-rock', name: 'Gnome (Rock)', asis: { int: 2, con: 1 }, speed: 25, traits: [
    { id: 'darkvision', name: 'Darkvision', text: 'Dim light 60 ft.' },
    { id: 'gnome-cunning', name: 'Gnome Cunning', text: 'Adv. on Int/Wis/Cha saves vs. magic (demo).' },
    { id: 'artificers-lore', name: "Artificer's Lore", text: 'Add INT mod (demo placeholder) to some History checks.' },
    { id: 'tinker', name: 'Tinker', text: 'Can create small clockwork devices (demo placeholder).' },
  ] },
  { id: 'gnome-deep', name: 'Gnome (Deep)', asis: { int: 2, dex: 1 }, speed: 25, traits: [
    { id: 'superior-darkvision', name: 'Superior Darkvision', text: 'Darkvision extends to 120 ft. (demo).' },
    { id: 'gnome-cunning', name: 'Gnome Cunning', text: 'Adv. on Int/Wis/Cha saves vs. magic (demo).' },
    { id: 'stone-camouflage', name: 'Stone Camouflage', text: 'Advantage on Stealth checks to hide in rocky terrain (demo).' },
  ] },
  // Genasi
  { id: 'genasi-air', name: 'Genasi (Air)', asis: { con: 2, dex: 1 }, speed: 30, traits: [
    { id: 'unending-breath-air', name: 'Unending Breath', text: 'Can hold breath indefinitely (demo).' },
    { id: 'mingle-with-wind', name: 'Mingle with the Wind', text: 'Affinity with air currents (demo).' },
  ], spells: ['shocking-grasp','misty-step'] },
  { id: 'genasi-earth', name: 'Genasi (Earth)', asis: { con: 2, str: 1 }, speed: 30, traits: [
    { id: 'earth-walk', name: 'Earth Walk', text: 'Ignore difficult terrain made of earth or stone (demo).' },
    { id: 'stone-endurance-genasi', name: 'Stone Resilience', text: 'Stony skin offers minor protection (demo).' },
  ], spells: ['resistance','pass-without-trace'] },
  { id: 'genasi-fire', name: 'Genasi (Fire)', asis: { con: 2, int: 1 }, speed: 30, traits: [
    { id: 'fire-resistance', name: 'Fire Affinity', text: 'Resistance to fire damage (demo).' },
    { id: 'inner-flame', name: 'Inner Flame', text: 'Emits faint warmth and light (demo).' },
  ], spells: ['produce-flame','burning-hands'] },
  { id: 'genasi-water', name: 'Genasi (Water)', asis: { con: 2, wis: 1 }, speed: 30, traits: [
    { id: 'acid-resistance', name: 'Acid Affinity', text: 'Resistance to acid damage (demo).' },
    { id: 'swim-speed', name: 'Amphibious', text: 'Can breathe air and water; swim speed equal to walk (demo).' },
  ], spells: ['acid-splash','fog-cloud'] },
  // Goliath
  { id: 'goliath', name: 'Goliath', asis: { str: 2, con: 1 }, speed: 30, traits: [
    { id: 'powerful-build', name: 'Powerful Build', text: 'Counts as one size larger for carry / lift (demo).' },
    { id: 'stone-endurance', name: 'Stone Endurance', text: 'Can shrug off a bit of damage (demo placeholder).' },
  ] },
  // Aarakocra
  { id: 'aarakocra', name: 'Aarakocra', asis: { dex: 2, wis: 1 }, speed: 25, traits: [
    { id: 'flight', name: 'Flight', text: 'Has a flying speed of 50 ft. while not wearing medium/heavy armor (demo).' },
    { id: 'talons', name: 'Talons', text: 'Natural weapons (demo placeholder).' },
  ] },
  { id: 'dragonborn', name: 'Dragonborn', asis: { str: 2, cha: 1 }, speed: 30, traits: [ { id: 'draconic-ancestry', name: 'Draconic Ancestry', text: 'Breath weapon and damage resistance depend on ancestry.' }, { id: 'breath-weapon', name: 'Breath Weapon', text: 'Exhale destructive energy (demo flavor).' }, { id: 'damage-resistance', name: 'Damage Resistance', text: 'Resistance based on ancestry.' } ] },
  // Dragonborn variants
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
  { id: 'half-orc', name: 'Half-Orc', asis: { str: 2, con: 1 }, speed: 30, traits: [ { id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' }, { id: 'menacing', name: 'Menacing', text: 'Proficiency in Intimidation.' }, { id: 'relentless-endurance', name: 'Relentless Endurance', text: 'When reduced to 0 HP but not killed, drop to 1 HP instead (1/long rest).' }, { id: 'savage-attacks', name: 'Savage Attacks', text: 'Extra weapon die on a crit (demo flavor).' } ] },
]
