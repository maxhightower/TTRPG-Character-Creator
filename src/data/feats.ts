import type { Feat } from './types'

export const FEATS: Feat[] = [
  { id: 'great-weapon-master', name: 'Great Weapon Master', tags: ['martial'], text: '+10 damage on a heavy attack after -5 to hit; bonus attack on crit/kill.' },
  { id: 'sharpshooter', name: 'Sharpshooter', tags: ['ranged'], text: '+10 damage at range after -5 to hit; ignore cover; no disadvantage at long range.' },
  { id: 'sentinel', name: 'Sentinel', tags: ['defense', 'control'], text: 'Reduce enemy speed to 0 on opportunity hit; creatures provoke even if Disengage; reactions on attacks within 5 ft.' },
  { id: 'polearm-master', name: 'Polearm Master', tags: ['martial'], text: 'Bonus action butt-end attack; opportunity attacks when they enter reach.' },
  { id: 'resilient-con', name: 'Resilient (Constitution)', tags: ['defense'], text: '+1 CON; gain proficiency in CON saves.' },
  { id: 'alert', name: 'Alert', tags: ['utility'], text: '+5 initiative; can’t be surprised while conscious; other creatures don’t gain advantage from being unseen.' },
  { id: 'tough', name: 'Tough', tags: ['defense'], text: 'Increase your hit point maximum by 2 per level.' },
  { id: 'prodigy', name: 'Prodigy', tags: ['skill'], text: 'Gain proficiency in one skill; if already proficient, gain expertise (demo).' },
]
