import type { Background } from './types'

export const BACKGROUNDS: Background[] = [
  { id: 'soldier', name: 'Soldier', skills: ['athletics', 'intimidation'], tools: ['gaming set', 'vehicles (land)'], feature: { name: 'Military Rank', text: 'You have a military rank and can exert influence.' } },
  { id: 'acolyte', name: 'Acolyte', skills: ['insight', 'religion'], languages: 2, feature: { name: 'Shelter of the Faithful', text: 'You command respect from those who share your faith.' } },
  { id: 'criminal', name: 'Criminal', skills: ['deception', 'stealth'], tools: ['thieves’ tools', 'gaming set'], feature: { name: 'Criminal Contact', text: 'You have a reliable and trustworthy contact.' } },
  { id: 'sage', name: 'Sage', skills: ['arcana', 'history'], languages: 2, feature: { name: 'Researcher', text: 'You can find information with ease in libraries and archives.' } },
  { id: 'folk-hero', name: 'Folk Hero', skills: ['animal', 'survival'], tools: ['artisan’s tools', 'vehicles (land)'], feature: { name: 'Rustic Hospitality', text: 'You fit in among common folk and can find shelter among them.' } },
  { id: 'urchin', name: 'Urchin', skills: ['sleight', 'stealth'], tools: ['disguise kit', 'thieves’ tools'], feature: { name: 'City Secrets', text: 'You know the secret patterns and flow to cities and can find passages through the urban sprawl.' } },
  // Added backgrounds
  { id: 'noble', name: 'Noble', skills: ['history', 'persuasion'], tools: ['gaming set'], languages: 1, feature: { name: 'Position of Privilege', text: 'People are inclined to think the best of you. You are welcome in high society.' } },
  { id: 'outlander', name: 'Outlander', skills: ['athletics', 'survival'], tools: ['musical instrument'], feature: { name: 'Wanderer', text: 'You have an excellent memory for maps and geography; you can find food and fresh water for yourself and up to five others each day.' } },
  { id: 'sailor', name: 'Sailor', skills: ['athletics', 'perception'], tools: ["navigator's tools", 'vehicles (water)'], feature: { name: "Ship's Passage", text: 'You can secure free passage on a sailing ship for yourself and your companions.' } },
]
