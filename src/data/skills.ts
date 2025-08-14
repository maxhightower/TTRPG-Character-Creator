import type { AbilityKey } from './types'

// Sub-skill metadata allows us to surface common specialized uses of a skill
// (e.g., Grappling via Athletics) while re‑using the parent skill's modifier.
// Optionally a sub-skill can specify a bonusAdjust (flat) applied on top of
// the parent skill total if certain future features warrant it.
export interface SubSkill {
  id: string
  name: string
  description?: string
  bonusAdjust?: number // relative flat modifier (can be negative)
}

export interface Skill {
  id: string
  name: string
  ability: AbilityKey
  description?: string
  subSkills?: SubSkill[]
}

export const SKILLS: Skill[] = [
  {
    id: 'acrobatics',
    name: 'Acrobatics',
    ability: 'dex',
    description:
      'Covers agility-based maneuvers: balancing, flips, mitigating falls, and wriggling free of restraints or grapples.',
    subSkills: [
      { id: 'escape-grapple-acr', name: 'Escape Grapple', description: 'Use Acrobatics to contest a creature holding you.' },
      { id: 'maintain-balance', name: 'Maintain Balance', description: 'Avoid falling on narrow or unstable surfaces.' },
    ],
  },
  { id: 'animal', name: 'Animal Handling', ability: 'wis', description: 'Calm, control, or intuit the intentions of beasts and similar creatures.' },
  { id: 'arcana', name: 'Arcana', ability: 'int', description: 'Recall lore about magical traditions, spells, planar phenomena, and constructs.' },
  {
    id: 'athletics',
    name: 'Athletics',
    ability: 'str',
    description:
      'Represents raw physical feats: climbing, swimming, jumping, shoving, and grappling opponents.',
    subSkills: [
      { id: 'grapple', name: 'Grapple', description: 'Initiate or maintain a grapple; opposed by target’s Athletics or Acrobatics.' },
      { id: 'escape-grapple-ath', name: 'Escape Grapple', description: 'Use Athletics to break free; alternative to Acrobatics.' },
      { id: 'shove', name: 'Shove / Push', description: 'Attempt to shove a creature prone or push it away.' },
      { id: 'climb', name: 'Climb', description: 'Ascend or traverse vertical surfaces and hazards.' },
      { id: 'swim', name: 'Swim', description: 'Navigate water or similar fluids under taxing conditions.' },
      { id: 'long-jump', name: 'Long / High Jump', description: 'Determine distance or height cleared in a jump.' },
    ],
  },
  { id: 'deception', name: 'Deception', ability: 'cha', description: 'Conceal the truth, disguise intentions, bluff, or create believable falsehoods.' },
  { id: 'history', name: 'History', ability: 'int', description: 'Recall facts about past events, cultures, conflicts, and key figures.' },
  { id: 'insight', name: 'Insight', ability: 'wis', description: 'Discern hidden motives, emotional states, and deception in others.' },
  { id: 'intimidation', name: 'Intimidation', ability: 'cha', description: 'Influence through threats, hostile body language, or overt displays of power.' },
  { id: 'investigation', name: 'Investigation', ability: 'int', description: 'Infer clues, deduce mechanisms, and piece together information from evidence.' },
  { id: 'medicine', name: 'Medicine', ability: 'wis', description: 'Stabilize the dying, diagnose ailments, or glean health-related clues.' },
  { id: 'nature', name: 'Nature', ability: 'int', description: 'Identify flora, fauna, weather patterns, and natural cycles.' },
  { id: 'perception', name: 'Perception', ability: 'wis', description: 'Spot, hear, or otherwise detect hidden threats or subtle details.' },
  { id: 'performance', name: 'Performance', ability: 'cha', description: 'Captivate audiences with artistry, poise, or practiced routines.' },
  { id: 'persuasion', name: 'Persuasion', ability: 'cha', description: 'Influence attitudes or negotiate using tact, courtesy, and logic.' },
  { id: 'religion', name: 'Religion', ability: 'int', description: 'Recall lore about deities, rites, planar orders, and divine hierarchies.' },
  { id: 'sleight', name: 'Sleight of Hand', ability: 'dex', description: 'Legerdemain: palm objects, pick pockets, and perform subtle manual tricks.' },
  { id: 'stealth', name: 'Stealth', ability: 'dex', description: 'Avoid detection: move silently, remain unseen, and blend with shadows.' },
  { id: 'survival', name: 'Survival', ability: 'wis', description: 'Track creatures, forage, predict weather, and navigate the wilderness.' },
]
