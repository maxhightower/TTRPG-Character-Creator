// Extracted static proficiency mapping data from Builder.tsx
// Extend with real data as needed.

// Map race trait id -> array of skill ids it grants
export const RACE_TRAIT_SKILLS: Record<string, string[]> = {
  // example placeholders (fill out with actual trait -> skill ids)
  // keen-senses: ['perception'],
  // menacing: ['intimidation']
}

// Map class id -> number of picks and available skill ids (placeholder values)
export const CLASS_SKILL_CHOICES: Record<string, { picks: number; options: string[] }> = {
  // fighter: { picks: 2, options: ['athletics','perception','survival'] },
  // rogue: { picks: 4, options: ['acrobatics','athletics','deception','investigation','perception','sleight-of-hand','stealth'] }
}
