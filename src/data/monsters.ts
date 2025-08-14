// Simple demo monster dataset for Target Settings in DPR Optimizer
// Extend as needed; keep lightweight.
export type Monster = {
  id: string
  name: string
  cr: string
  ac: number
  abilities: { str: number; dex: number; con: number; int: number; wis: number; cha: number }
  resistances?: string[]
  vulnerabilities?: string[]
}

export const MONSTERS: Monster[] = [
  {
    id: 'goblin',
    name: 'Goblin',
    cr: '1/4',
    ac: 15,
    abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    resistances: [],
    vulnerabilities: []
  },
  {
    id: 'orc',
    name: 'Orc',
    cr: '1/2',
    ac: 13,
    abilities: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
  },
  {
    id: 'ogre',
    name: 'Ogre',
    cr: '2',
    ac: 11,
    abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
  },
  {
    id: 'adult-red-dragon',
    name: 'Adult Red Dragon',
    cr: '17',
    ac: 19,
    abilities: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
    resistances: ['slashing'], // using physical for demo (real dragon has fire immunity)
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    cr: '1/4',
    ac: 13,
    abilities: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
    vulnerabilities: ['bludgeoning'],
    resistances: ['piercing', 'slashing']
  }
]
