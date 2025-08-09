import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
const DICE_AVG = { d4: 2.5, d6: 3.5, d8: 4.5, d10: 5.5, d12: 6.5 };
function parseDice(dice) {
    const allowed = new Set(['4', '6', '8', '10', '12']);
    return dice
        .toLowerCase()
        .split('+')
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => {
        const parts = chunk.split('d');
        const n = parseInt(parts[0], 10) || 0;
        const size = parts[1] || '6';
        const die = allowed.has(size) ? `d${size}` : 'd6';
        return { n, die };
    });
}
function diceAverage(dice, opts) {
    const gwfBoost = { d4: 0.75, d6: 0.6667, d8: 0.625, d10: 0.6, d12: 0.5833 };
    const chunks = parseDice(dice);
    let avg = 0;
    chunks.forEach(({ n, die }) => {
        const base = DICE_AVG[die] ?? 0;
        const boost = opts?.greatWeaponFighting ? gwfBoost[die] ?? 0 : 0;
        avg += n * (base + boost);
    });
    return avg;
}
function proficiencyBonus(level) {
    if (level >= 17)
        return 6;
    if (level >= 13)
        return 5;
    if (level >= 9)
        return 4;
    if (level >= 5)
        return 3;
    return 2;
}
function fighterAttacksPerRound(level) {
    if (level >= 20)
        return 4;
    if (level >= 11)
        return 3;
    if (level >= 5)
        return 2;
    return 1;
}
function abilityMod(score) { return Math.floor((score - 10) / 2); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function advTransform(p, mode) { if (mode === 'adv')
    return 1 - (1 - p) ** 2; if (mode === 'dis')
    return p ** 2; return p; }
const FIGHTING_STYLES = [
    { id: 'defense', name: 'Defense (+1 AC)', tag: 'defense' },
    { id: 'dueling', name: 'Dueling (+2 dmg with 1H melee)', tag: 'melee-1h' },
    { id: 'great-weapon', name: 'Great Weapon Fighting (reroll 1-2)', tag: 'melee-2h' },
    { id: 'archery', name: 'Archery (+2 to hit)', tag: 'ranged' },
    { id: 'two-weapon', name: 'Two-Weapon Fighting (add mod to offhand)', tag: 'twf' },
];
const WEAPON_PRESETS = [
    { id: 'longsword', name: 'Longsword', dice: '1d8', versatile: '1d10', type: 'slashing', properties: ['versatile'], handed: '1h', finesse: false, ranged: false, tags: [] },
    { id: 'greatsword', name: 'Greatsword', dice: '2d6', type: 'slashing', properties: ['heavy', 'two-handed'], handed: '2h', finesse: false, ranged: false, tags: ['gwm'] },
    { id: 'rapier', name: 'Rapier', dice: '1d8', type: 'piercing', properties: ['finesse'], handed: '1h', finesse: true, ranged: false, tags: [] },
    { id: 'shortsword', name: 'Shortsword', dice: '1d6', type: 'piercing', properties: ['finesse', 'light'], handed: '1h', finesse: true, ranged: false, tags: [] },
    { id: 'longbow', name: 'Longbow', dice: '1d8', type: 'piercing', properties: ['heavy', 'two-handed', 'ammunition'], handed: '2h', finesse: false, ranged: true, tags: ['ss'] },
    { id: 'handaxe', name: 'Handaxe', dice: '1d6', type: 'slashing', properties: ['light', 'thrown'], handed: '1h', finesse: false, ranged: false, tags: [] },
    { id: 'glaive', name: 'Glaive', dice: '1d10', type: 'slashing', properties: ['heavy', 'reach', 'two-handed'], handed: '2h', finesse: false, ranged: false, tags: ['gwm', 'pam'] },
    { id: 'halberd', name: 'Halberd', dice: '1d10', type: 'slashing', properties: ['heavy', 'reach', 'two-handed'], handed: '2h', finesse: false, ranged: false, tags: ['gwm', 'pam'] },
    { id: 'spear', name: 'Spear', dice: '1d6', versatile: '1d8', type: 'piercing', properties: ['thrown', 'versatile'], handed: '1h', finesse: false, ranged: false, tags: ['pam'] },
    { id: 'hcrossbow', name: 'Heavy Crossbow', dice: '1d10', type: 'piercing', properties: ['heavy', 'ammunition', 'loading', 'two-handed'], handed: '2h', finesse: false, ranged: true, tags: ['ss', 'cbe'] },
];
export function Optimizer() {
    const [s, set] = useState({
        level: 5,
        str: 16,
        dex: 14,
        targetAC: 16,
        advMode: 'normal',
        useVersatile: false,
        resist: 'none',
        vuln: 'none',
        styleId: 'dueling',
        weaponId: 'longsword',
        feats: { gwm: false, ss: false, pam: false, cbe: false },
        features: { sneak: false, rage: false, smite: false, smiteDice: 2, smitesPerRound: 1 },
        buffs: { bless: false, d6onhit: false }
    });
    const prof = useMemo(() => proficiencyBonus(s.level), [s.level]);
    const attacksBase = useMemo(() => fighterAttacksPerRound(s.level), [s.level]);
    const weapon = useMemo(() => WEAPON_PRESETS.find(w => w.id === s.weaponId) ?? WEAPON_PRESETS[0], [s.weaponId]);
    const summary = useMemo(() => computeSummary(s, weapon, attacksBase, prof), [s, weapon, attacksBase, prof]);
    return (_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16 }, children: [_jsxs("div", { style: { display: 'grid', gap: 12 }, children: [_jsx(Panel, { title: "Global Settings", children: _jsxs("div", { style: { display: 'grid', gap: 10 }, children: [_jsx(Range, { label: `Level: ${s.level}`, min: 1, max: 20, value: s.level, onChange: (v) => set({ ...s, level: v }) }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }, children: [_jsx(Range, { label: `STR: ${s.str}`, min: 8, max: 20, value: s.str, onChange: (v) => set({ ...s, str: v }) }), _jsx(Range, { label: `DEX: ${s.dex}`, min: 8, max: 20, value: s.dex, onChange: (v) => set({ ...s, dex: v }) })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }, children: [_jsx(Field, { label: "Target AC", children: _jsx("input", { type: "number", value: s.targetAC, onChange: (e) => set({ ...s, targetAC: Number(e.target.value || 0) }), style: inp }) }), _jsx(Field, { label: "Roll Mode", children: _jsxs("select", { value: s.advMode, onChange: (e) => set({ ...s, advMode: e.target.value }), style: inp, children: [_jsx("option", { value: "normal", children: "Normal" }), _jsx("option", { value: "adv", children: "Advantage" }), _jsx("option", { value: "dis", children: "Disadvantage" })] }) })] }), _jsxs("label", { style: row, children: [_jsx("input", { type: "checkbox", checked: s.useVersatile, onChange: (e) => set({ ...s, useVersatile: e.target.checked }) }), " Use versatile die"] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }, children: [_jsx(Field, { label: "Resistance", children: _jsxs("select", { value: s.resist, onChange: (e) => set({ ...s, resist: e.target.value }), style: inp, children: [_jsx("option", { value: "none", children: "None" }), _jsx("option", { value: "slashing", children: "Slashing" }), _jsx("option", { value: "piercing", children: "Piercing" }), _jsx("option", { value: "bludgeoning", children: "Bludgeoning" })] }) }), _jsx(Field, { label: "Vulnerability", children: _jsxs("select", { value: s.vuln, onChange: (e) => set({ ...s, vuln: e.target.value }), style: inp, children: [_jsx("option", { value: "none", children: "None" }), _jsx("option", { value: "slashing", children: "Slashing" }), _jsx("option", { value: "piercing", children: "Piercing" }), _jsx("option", { value: "bludgeoning", children: "Bludgeoning" })] }) })] }), _jsxs("div", { style: { fontSize: 12, color: '#475569' }, children: ["Proficiency +", prof, " \u2022 Fighter attacks/round ", attacksBase] })] }) }), _jsxs(Panel, { title: "Weapon", children: [_jsx(Field, { label: "Preset", children: _jsx("select", { value: s.weaponId, onChange: (e) => set({ ...s, weaponId: e.target.value }), style: inp, children: WEAPON_PRESETS.map((w) => _jsx("option", { value: w.id, children: w.name }, w.id)) }) }), _jsxs("div", { style: { fontSize: 13, color: '#334155', marginTop: 6 }, children: [_jsxs("div", { children: [_jsx("strong", { children: "Dice:" }), " ", weapon.dice, weapon.versatile ? ` (${weapon.versatile} versatile)` : ''] }), _jsxs("div", { children: [_jsx("strong", { children: "Type:" }), " ", weapon.type] }), _jsxs("div", { children: [_jsx("strong", { children: "Props:" }), " ", weapon.properties.join(', ') || '-'] })] })] }), _jsx(Panel, { title: "Fighting Style", children: _jsx(Field, { label: "Style", children: _jsx("select", { value: s.styleId, onChange: (e) => set({ ...s, styleId: e.target.value }), style: inp, children: FIGHTING_STYLES.map((fs) => _jsx("option", { value: fs.id, children: fs.name }, fs.id)) }) }) }), _jsxs(Panel, { title: "Feats", children: [_jsx(Toggle, { label: "Great Weapon Master", checked: s.feats.gwm, onChange: (v) => set({ ...s, feats: { ...s.feats, gwm: v } }) }), _jsx(Toggle, { label: "Sharpshooter", checked: s.feats.ss, onChange: (v) => set({ ...s, feats: { ...s.feats, ss: v } }) }), _jsx(Toggle, { label: "Polearm Master", checked: s.feats.pam, onChange: (v) => set({ ...s, feats: { ...s.feats, pam: v } }) }), _jsx(Toggle, { label: "Crossbow Expert", checked: s.feats.cbe, onChange: (v) => set({ ...s, feats: { ...s.feats, cbe: v } }) })] }), _jsxs(Panel, { title: "Class Features", children: [_jsx(Toggle, { label: "Rogue Sneak Attack", checked: s.features.sneak, onChange: (v) => set({ ...s, features: { ...s.features, sneak: v } }) }), _jsx(Toggle, { label: "Barbarian Rage", checked: s.features.rage, onChange: (v) => set({ ...s, features: { ...s.features, rage: v } }) }), _jsx(Toggle, { label: "Paladin Divine Smite", checked: s.features.smite, onChange: (v) => set({ ...s, features: { ...s.features, smite: v } }) }), s.features.smite && (_jsxs("div", { style: { display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }, children: [_jsx(Range, { label: `Smite d8s: ${s.features.smiteDice}`, min: 0, max: 5, value: s.features.smiteDice, onChange: (v) => set({ ...s, features: { ...s.features, smiteDice: v } }) }), _jsx(Range, { label: `Smites/Round: ${s.features.smitesPerRound}`, min: 0, max: 2, value: s.features.smitesPerRound, onChange: (v) => set({ ...s, features: { ...s.features, smitesPerRound: v } }) })] }))] }), _jsxs(Panel, { title: "Buffs & Riders", children: [_jsx(Toggle, { label: "Bless (\u2248 +2.5 to hit)", checked: s.buffs.bless, onChange: (v) => set({ ...s, buffs: { ...s.buffs, bless: v } }) }), _jsx(Toggle, { label: "Hex / Hunter's Mark (+1d6 on hit)", checked: s.buffs.d6onhit, onChange: (v) => set({ ...s, buffs: { ...s.buffs, d6onhit: v } }) })] })] }), _jsxs("div", { style: { display: 'grid', gap: 12 }, children: [_jsx(Panel, { title: "DPR Output", children: _jsxs("div", { style: { display: 'grid', gap: 6, fontSize: 14 }, children: [_jsxs(Row, { label: "To-hit", children: ["+", Math.round(summary.toHit)] }), _jsx(Row, { label: "Mode", children: s.advMode }), _jsxs(Row, { label: `Hit chance vs AC ${s.targetAC}`, children: [Math.round(summary.pHit * 100), "%"] }), _jsxs(Row, { label: "Crit chance", children: [Math.round(summary.pCrit * 100), "%"] }), _jsx(Row, { label: "Attacks/round", children: summary.attacks }), _jsx("div", { style: { borderTop: '1px solid #e2e8f0', margin: '8px 0' } }), _jsxs("div", { style: { fontSize: 18 }, children: ["DPR: ", _jsx("strong", { children: summary.dpr.toFixed(2) })] }), summary.notes.length ? (_jsx("ul", { style: { marginTop: 8, color: '#475569' }, children: summary.notes.map((n, i) => _jsx("li", { style: { fontSize: 13 }, children: n }, i)) })) : null] }) }), _jsx(Panel, { title: "Notes", children: _jsxs("ul", { style: { color: '#475569', fontSize: 14, margin: 0, paddingLeft: 18 }, children: [_jsx("li", { children: "Advantage/disadvantage applied to both hit and crit chances via probability transforms." }), _jsx("li", { children: "GWM/SS: -5 to hit, +10 damage when weapon qualifies." }), _jsx("li", { children: "Polearm Master adds a bonus 1d4 attack if using a qualifying weapon." }), _jsx("li", { children: "Rogue Sneak Attack modeled once/turn with probability of at least one primary hit." }), _jsx("li", { children: "Divine Smite adds chosen d8s per smite on hit; crit doubles smite dice." }), _jsx("li", { children: "Rage adds +2/+3/+4 melee damage scaling by level." }), _jsx("li", { children: "Resist/Vulnerability multiplies final DPR by 0.5x/2x if it matches weapon's damage type." }), _jsx("li", { children: "Crits modeled as one extra set of weapon dice (and smite dice) on crit." })] }) })] })] }));
}
function computeSummary(s, weapon, attacksBase, prof) {
    const level = s.level;
    const strMod = abilityMod(s.str);
    const dexMod = abilityMod(s.dex);
    const isRanged = weapon.ranged === true;
    const usesDex = isRanged || weapon.finesse;
    let toHit = prof + (usesDex ? dexMod : strMod);
    const notes = [];
    if (s.styleId === 'archery' && isRanged) {
        toHit += 2;
        notes.push('Archery: +2 to hit applied.');
    }
    if (s.styleId === 'defense') {
        notes.push('Defense: +1 AC (not factored into DPR).');
    }
    if (s.buffs.bless) {
        toHit += 2.5;
        notes.push('Bless: +≈2.5 to hit EV.');
    }
    const qualifiesGWM = weapon.tags?.includes('gwm');
    const qualifiesSS = weapon.tags?.includes('ss');
    if (s.feats.gwm && qualifiesGWM && !isRanged) {
        toHit -= 5;
        notes.push('GWM: -5 to hit/+10 dmg.');
    }
    if (s.feats.ss && qualifiesSS && isRanged) {
        toHit -= 5;
        notes.push('Sharpshooter: -5 to hit/+10 dmg.');
    }
    const ac = s.targetAC;
    const basePHit = clamp((21 + toHit - ac) / 20, 0, 1);
    const basePCrit = 0.05;
    const pHit = advTransform(basePHit, s.advMode);
    const pCrit = advTransform(basePCrit, s.advMode);
    const dice = s.useVersatile && weapon.versatile ? weapon.versatile : weapon.dice;
    const gwf = s.styleId === 'great-weapon' && weapon.handed === '2h' && !isRanged;
    const baseDieAvg = diceAverage(dice, { greatWeaponFighting: gwf });
    if (gwf) {
        notes.push('Great Weapon Fighting: reroll 1s & 2s estimated.');
    }
    const dmgMod = usesDex ? dexMod : strMod;
    let flatDamageBonus = 0;
    let extraAttacks = 0;
    if (s.styleId === 'dueling' && weapon.handed === '1h' && !isRanged) {
        flatDamageBonus += 2;
        notes.push('Dueling: +2 damage with 1H melee.');
    }
    if (s.styleId === 'two-weapon' && weapon.properties.includes('light') && !isRanged) {
        extraAttacks += 1;
        notes.push('Two-Weapon Fighting: includes offhand attack (adds mod).');
    }
    if (s.feats.gwm && qualifiesGWM && !isRanged) {
        flatDamageBonus += 10;
    }
    if (s.feats.ss && qualifiesSS && isRanged) {
        flatDamageBonus += 10;
    }
    let pamBonusAvg = 0;
    if (s.feats.pam && weapon.tags?.includes('pam') && !isRanged) {
        const rageBonus = s.features.rage ? (level >= 16 ? 4 : level >= 9 ? 3 : 2) : 0;
        const riderOnHitAvgPam = s.buffs.d6onhit ? DICE_AVG.d6 : 0;
        const buttAvg = DICE_AVG.d4 + dmgMod + rageBonus + riderOnHitAvgPam;
        const critDieAvg = DICE_AVG.d4;
        const pNonCritHit = Math.max(pHit - pCrit, 0);
        pamBonusAvg = pNonCritHit * buttAvg + pCrit * (buttAvg + critDieAvg);
        notes.push('Polearm Master: bonus 1d4 attack added.');
    }
    if (s.feats.cbe && isRanged && weapon.id.includes('crossbow')) {
        extraAttacks += 1;
        notes.push('Crossbow Expert: bonus attack added.');
    }
    const riderOnHitAvg = s.buffs.d6onhit ? DICE_AVG.d6 : 0;
    if (s.buffs.d6onhit)
        notes.push("Hex/Hunter's Mark: +1d6 on hit.");
    const rageBonus = s.features.rage ? (level >= 16 ? 4 : level >= 9 ? 3 : 2) : 0;
    if (rageBonus && !isRanged) {
        flatDamageBonus += rageBonus;
        notes.push(`Rage: +${rageBonus} melee damage per hit.`);
    }
    let smiteDice = 0, smitesPerRound = 0;
    if (s.features.smite) {
        smiteDice = s.features.smiteDice ?? 2;
        smitesPerRound = s.features.smitesPerRound ?? 1;
    }
    const sneakDice = s.features.sneak ? Math.min(10, Math.ceil(level / 2)) : 0;
    const critDiceAvg = diceAverage(dice, { greatWeaponFighting: gwf });
    const avgWeapon = baseDieAvg + dmgMod + flatDamageBonus + riderOnHitAvg;
    const dmgPerAttack = (pHit - pCrit) * avgWeapon + pCrit * (avgWeapon + critDiceAvg);
    let attacksPerRound = attacksBase;
    if (extraAttacks)
        attacksPerRound += extraAttacks;
    const pNonCritHit = Math.max(pHit - pCrit, 0);
    const pAnyPrimaryHit = 1 - Math.pow(1 - pNonCritHit, Math.max(1, attacksBase));
    const sneakAvg = sneakDice ? pAnyPrimaryHit * diceAverage(`${sneakDice}d6`) : 0;
    const d8avg = DICE_AVG.d8;
    const smiteAvg = smiteDice && smitesPerRound ? smitesPerRound * ((pNonCritHit * (smiteDice * d8avg)) + (pCrit * (smiteDice * 2 * d8avg))) : 0;
    let dpr = dmgPerAttack * attacksPerRound + sneakAvg + smiteAvg + pamBonusAvg;
    let multiplier = 1;
    if (s.resist !== 'none' && s.resist === weapon.type)
        multiplier *= 0.5;
    if (s.vuln !== 'none' && s.vuln === weapon.type)
        multiplier *= 2;
    dpr *= multiplier;
    return { toHit, advMode: s.advMode, targetAC: ac, pHit, pCrit, attacks: attacksPerRound, dpr, notes };
}
function Panel(props) {
    return (_jsxs("section", { style: { border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, background: 'white' }, children: [_jsx("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, children: _jsx("h3", { style: { margin: 0, fontSize: 16 }, children: props.title }) }), _jsx("div", { style: { display: 'grid', gap: 8 }, children: props.children })] }));
}
function Field(props) {
    return (_jsxs("label", { style: { fontSize: 12, color: '#475569', display: 'grid', gap: 6 }, children: [_jsx("span", { children: props.label }), props.children] }));
}
function Range(props) {
    return (_jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, color: '#475569', marginBottom: 6 }, children: props.label }), _jsx("input", { type: "range", min: props.min, max: props.max, value: props.value, onChange: (e) => props.onChange(Number(e.target.value)), style: { width: '100%' } })] }));
}
function Toggle(props) {
    return (_jsxs("label", { style: row, children: [_jsx("input", { type: "checkbox", checked: props.checked, onChange: (e) => props.onChange(e.target.checked) }), " ", props.label] }));
}
function Row(props) {
    return (_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'baseline' }, children: [_jsxs("span", { style: { color: '#475569', width: 180 }, children: [props.label, ":"] }), _jsx("span", { children: props.children })] }));
}
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' };
const row = { display: 'flex', alignItems: 'center', gap: 8 };
