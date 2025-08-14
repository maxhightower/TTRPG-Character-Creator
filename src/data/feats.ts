import type { Feat } from './types'

export const FEATS: Feat[] = [
  { id: 'great-weapon-master', name: 'Great Weapon Master', tags: ['martial'], text: '+10 damage on a heavy attack after -5 to hit; bonus attack on crit/kill.' },
  { id: 'sharpshooter', name: 'Sharpshooter', tags: ['ranged'], text: '+10 damage at range after -5 to hit; ignore cover; no disadvantage at long range.' },
  { id: 'sentinel', name: 'Sentinel', tags: ['defense', 'control'], text: 'Reduce enemy speed to 0 on opportunity hit; creatures provoke even if Disengage; reactions on attacks within 5 ft.' },
  { id: 'polearm-master', name: 'Polearm Master', tags: ['martial'], text: 'Bonus action butt-end attack; opportunity attacks when they enter reach.' },
  // Resilient: now generic. User picks an ability; effect applied dynamically (+1 ability, proficiency in that save)
  { id: 'resilient', name: 'Resilient', tags: ['defense'], text: '+1 to a chosen ability; gain proficiency in that ability’s saving throws.' },
  { id: 'alert', name: 'Alert', tags: ['utility'], text: '+5 initiative; can’t be surprised while conscious; other creatures don’t gain advantage from being unseen.' },
  { id: 'tough', name: 'Tough', tags: ['defense'], text: 'Increase your hit point maximum by 2 per level.' },
  { id: 'prodigy', name: 'Prodigy', tags: ['skill'], text: 'Gain proficiency in one skill; if already proficient, gain expertise (demo).' },
  { id: 'dual-wielder', name: 'Dual Wielder', tags: ['martial'], text: '+1 AC while dual wielding; draw/stow two weapons; off-hand can use non-light one-handed weapons.' },
  { id: 'mobile', name: 'Mobile', tags: ['mobility'], text: '+10 speed; no difficult terrain penalty when dashing; no opportunity attacks from creatures you melee attack.' },
  { id: 'lucky', name: 'Lucky', tags: ['utility'], text: '3 luck points to reroll your own d20s (attack/ability/save) or impose disadvantage on an attack against you (demo summary).' },
  { id: 'war-caster', name: 'War Caster', tags: ['magic','defense'], text: 'Advantage on concentration saves; perform somatic components while hands are full; spell opportunity attack (demo summary).' },
  { id: 'crossbow-expert', name: 'Crossbow Expert', tags: ['ranged'], text: 'Ignore loading; no disadvantage in 5 ft; bonus attack with hand crossbow after attacking (demo summary).' },
  { id: 'mage-slayer', name: 'Mage Slayer', tags: ['control','anti-mage'], text: 'Reactive attack vs adjacent spellcaster; impose disadvantage on their concentration (demo summary).' },
  { id: 'shield-master', name: 'Shield Master', tags: ['defense'], text: 'Add shield to Dex save vs effects; bonus action shove after Attack action (demo summary).' },
  { id: 'skilled', name: 'Skilled', tags: ['skill'], text: 'Gain proficiency in any three skills or tools (abstracted: pick three in full implementation).' },
  { id: 'actor', name: 'Actor', tags: ['social'], text: '+1 CHA (not auto-applied); advantage on Deception/Performance to impersonate; mimic voices (demo summary).' },
  { id: 'observant', name: 'Observant', tags: ['utility'], text: '+1 INT or WIS (not auto-applied); +5 passive Perception/Investigation; read lips (demo summary).' },
]
