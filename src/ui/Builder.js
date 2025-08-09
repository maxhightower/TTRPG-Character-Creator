import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState, useEffect, useRef } from 'react';
import { Plus, Dice6, Info, Redo2, Scale, Settings2, Shield, Shuffle, Sparkles, Sword, Undo2, Zap } from 'lucide-react';
const RACES = [
    { id: 'human', name: 'Human (Base)', asis: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, speed: 30, traits: [{ id: 'versatile', name: 'Versatile', text: '+1 to all ability scores.' }] },
    { id: 'elf', name: 'Elf (Wood)', asis: { dex: 2, wis: 1 }, speed: 35, traits: [{ id: 'darkvision', name: 'Darkvision', text: 'See in dim light 60 ft.' }, { id: 'keen', name: 'Keen Senses', text: 'Proficiency in Perception.' }] },
];
const CLASSES = [
    {
        id: 'barbarian',
        name: 'Barbarian',
        hitDie: 12,
        armor: ['light', 'medium', 'shields'],
        weapons: ['simple', 'martial'],
        grants: { subactions: ['Rage', 'Reckless Attack'] },
        level1: [
            { name: 'Rage', text: '+2 damage, advantage on STR checks; uses/long rest.' },
            { name: 'Unarmored Defense', text: 'AC = 10 + DEX + CON when no armor; shield allowed.' },
        ],
        acFormula: (a) => (a.armor === 'none' ? 10 + a.dexMod + a.conMod : undefined),
        saves: ['str', 'con'],
        subclasses: [
            { id: 'berserker', name: 'Path of the Berserker', unlockLevel: 3, grants: { subactions: ['Frenzy'] } },
        ],
    },
    {
        id: 'fighter',
        name: 'Fighter',
        hitDie: 10,
        armor: ['all', 'shields'],
        weapons: ['simple', 'martial'],
        grants: { subactions: ['Second Wind'] },
        level1: [
            { name: 'Second Wind', text: '1d10 + level self‑heal, 1/short rest.' },
            { name: 'Fighting Style', text: '+2 to hit with archery or +1 AC with defense, etc.' },
        ],
        saves: ['str', 'con'],
        subclasses: [
            { id: 'champion', name: 'Champion', unlockLevel: 3, grants: { subactions: ['Improved Critical'] } },
        ],
    },
    {
        id: 'wizard',
        name: 'Wizard',
        hitDie: 6,
        armor: [],
        weapons: ['daggers', 'quarterstaff'],
        grants: { subactions: ['Cast Spell'] },
        level1: [
            { name: 'Spellcasting', text: 'INT spellcasting. Cantrips & 1st‑level slots.' },
            { name: 'Arcane Recovery', text: 'Recover expended slots on short rest.' },
        ],
        saves: ['int', 'wis'],
        subclasses: [
            { id: 'evocation', name: 'School of Evocation', unlockLevel: 2, grants: { subactions: ['Sculpt Spells'] } },
        ],
    },
];
const EQUIPMENT = [
    { id: 'greataxe', name: 'Greataxe', type: 'weapon', group: 'martial', hands: 2, dmg: '1d12 slashing', tags: ['heavy', 'two‑handed'], grants: ['Melee Attack (Greataxe)'] },
    { id: 'shield', name: 'Shield', type: 'shield', ac: 2, hands: 1, tags: ['shield'], grants: ['Raise Shield'] },
    { id: 'leather', name: 'Leather Armor', type: 'armor', ac: 11, dexMax: Number.POSITIVE_INFINITY, tags: ['light'] },
    { id: 'breastplate', name: 'Breastplate', type: 'armor', ac: 14, dexMax: 2, tags: ['medium'] },
    { id: 'chain', name: 'Chain Mail', type: 'armor', ac: 16, dexMax: 0, reqStr: 13, tags: ['heavy'] },
    { id: 'longbow', name: 'Longbow', type: 'weapon', group: 'martial', hands: 2, dmg: '1d8 piercing', tags: ['heavy', 'two‑handed', 'ranged'], grants: ['Ranged Attack (Longbow)'] },
];
const SUBACTIONS_BY_ITEM = {
    greataxe: ['Melee Attack (Greataxe)'],
    longbow: ['Ranged Attack (Longbow)'],
    shield: ['Raise Shield'],
};
// ---------------- Utilities ----------------
function mod(score) { return Math.floor((score - 10) / 2); }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function dedupe(arr) { return Array.from(new Set(arr)); }
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
// Helper to safely read 'hands' across Equipment union
function getHands(i) {
    return typeof i.hands === 'number' ? i.hands : 0;
}
function validateChoice(state) {
    const issues = [];
    const hasShield = state.loadout.some((i) => i.type === 'shield');
    const armor = state.loadout.find((i) => i.type === 'armor');
    const handsInUse = state.loadout.reduce((acc, i) => acc + getHands(i), 0);
    const twoHandedWeapon = state.loadout.find((i) => i.tags?.includes('two‑handed'));
    if (twoHandedWeapon && hasShield) {
        issues.push({ level: 'error', msg: 'Two‑handed weapon cannot be used with a shield equipped.' });
    }
    if (armor?.id === 'chain' && (state.abilities.str || 10) < 13) {
        issues.push({ level: 'warn', msg: 'Chain Mail requires STR 13 for optimal use (speed penalties otherwise).' });
    }
    if (state.classes.some((c) => c.klass.id === 'wizard') && armor) {
        issues.push({ level: 'warn', msg: 'Wizards are not proficient with armor by default (toy rule).' });
    }
    if (state.classes.some((c) => c.klass.id === 'barbarian') && !armor) {
        issues.push({ level: 'hint', msg: 'Unarmored Defense active: AC = 10 + DEX + CON. Shield allowed.' });
    }
    if (handsInUse > 2) {
        issues.push({ level: 'error', msg: 'You cannot hold more than two hands worth of equipment.' });
    }
    return issues;
}
// ---------------- Derived & Simulation ----------------
function computeDerived(state) {
    const dexMod = mod(state.abilities.dex);
    const conMod = mod(state.abilities.con);
    const strMod = mod(state.abilities.str);
    const armor = state.loadout.find((i) => i.type === 'armor');
    const shield = state.loadout.find((i) => i.type === 'shield');
    const totalLevel = Math.max(1, state.classes.reduce((s, c) => s + (c.level || 0), 0) || 1);
    let ac = 10 + dexMod;
    if (armor) {
        const dexCap = typeof armor.dexMax === 'number' ? armor.dexMax : Infinity;
        ac = armor.ac + clamp(dexMod, -Infinity, dexCap);
    }
    if (!armor && state.classes.some((c) => c.klass.id === 'barbarian')) {
        ac = 10 + dexMod + conMod;
    }
    if (shield)
        ac += shield.ac ?? 2;
    // HP: base at first level from the first selected class, then average per-level per class
    const firstHitDie = state.classes[0]?.klass.hitDie ?? 8;
    let hp = firstHitDie + conMod;
    state.classes.forEach((c, idx) => {
        const perLevel = Math.max(1, Math.floor(c.klass.hitDie / 2) + 1 + conMod);
        const extraLevels = Math.max(0, (c.level || 0) - (idx === 0 ? 1 : 0));
        hp += extraLevels * perLevel;
    });
    const speed = state.race?.speed ?? 30;
    const classSubs = state.classes.flatMap((c) => c.klass.grants?.subactions ?? []);
    const subclassSubs = state.classes.flatMap((c) => c.subclass?.grants?.subactions ?? []);
    const itemSubs = state.loadout.flatMap((i) => SUBACTIONS_BY_ITEM[i.id] ?? []);
    const subactions = dedupe([...classSubs, ...subclassSubs, ...itemSubs]);
    // Saving throws (union of class save proficiencies)
    const final = finalAbility(state.abilities, state.race);
    const prof = proficiencyBonus(totalLevel);
    const saveProfs = dedupe(state.classes.flatMap((c) => c.klass.saves ?? []));
    const saves = {
        str: mod(final.str) + (saveProfs.includes('str') ? prof : 0),
        dex: mod(final.dex) + (saveProfs.includes('dex') ? prof : 0),
        con: mod(final.con) + (saveProfs.includes('con') ? prof : 0),
        int: mod(final.int) + (saveProfs.includes('int') ? prof : 0),
        wis: mod(final.wis) + (saveProfs.includes('wis') ? prof : 0),
        cha: mod(final.cha) + (saveProfs.includes('cha') ? prof : 0),
    };
    return { ac, hp, speed, subactions, dexMod, conMod, strMod, saves, totalLevel };
}
function simulateReadiness(state) {
    const { subactions, strMod, dexMod, conMod } = computeDerived(state);
    const offense = (subactions.includes('Melee Attack (Greataxe)') ? 0.6 : 0) + (subactions.includes('Ranged Attack (Longbow)') ? 0.5 : 0) + Math.max(strMod, dexMod) * 0.15;
    const defense = computeDerived(state).ac * 0.03 + conMod * 0.4;
    const economy = (subactions.includes('Rage') ? 0.5 : 0) + (subactions.includes('Second Wind') ? 0.4 : 0) + (subactions.includes('Cast Spell') ? 0.4 : 0);
    const readiness = clamp(Math.round((offense + defense + economy) * 100) / 100, 0, 10);
    return { offense, defense, economy, readiness };
}
// ---------------- Local UI helpers ----------------
function Labeled(props) {
    return (_jsxs("div", { style: { display: 'grid', gap: 4 }, children: [_jsx("div", { style: { fontSize: 12, color: '#64748b' }, children: props.label }), props.children] }));
}
function Pill(props) {
    return _jsx("span", { style: { padding: '2px 8px', borderRadius: 999, background: '#f1f5f9', color: '#0f172a', fontSize: 12 }, children: props.children });
}
function Button(props) {
    const { variant = 'default', size = 'md', style, ...rest } = props;
    const base = {
        borderRadius: 8,
        border: '1px solid #cbd5e1',
        background: variant === 'default' ? '#0ea5e9' : 'white',
        color: variant === 'default' ? 'white' : '#0f172a',
        cursor: 'pointer',
    };
    if (variant === 'outline') {
        base.background = 'white';
    }
    if (variant === 'ghost') {
        base.background = 'transparent';
        base.border = '1px solid transparent';
    }
    if (size === 'sm') {
        base.padding = '6px 10px';
        base.fontSize = 12;
    }
    else if (size === 'icon') {
        base.padding = 6;
    }
    else {
        base.padding = '8px 12px';
    }
    return _jsx("button", { ...rest, style: { ...base, ...style } });
}
function Progress({ value }) {
    return (_jsx("div", { style: { width: '100%', height: 10, borderRadius: 999, background: '#e2e8f0' }, children: _jsx("div", { style: { width: `${clamp(value, 0, 100)}%`, height: '100%', borderRadius: 999, background: '#0ea5e9' } }) }));
}
// ---------------- Simple Card primitives ----------------
function Card(props) {
    return _jsx("section", { style: card, children: props.children });
}
function CardHeader(props) {
    return _jsx("div", { style: { padding: 12, borderBottom: '1px solid #e2e8f0' }, children: props.children });
}
function CardTitle(props) {
    return _jsx("div", { style: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }, children: props.children });
}
function CardContent(props) {
    return _jsx("div", { style: { padding: 12, display: 'grid', gap: 12 }, children: props.children });
}
// ---------------- Styles ----------------
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' };
const badgeSecondary = { padding: '2px 8px', borderRadius: 999, background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: 12 };
const badgeOutline = { padding: '2px 8px', borderRadius: 999, border: '1px solid #e2e8f0', fontSize: 12 };
const card = { border: '1px solid #e2e8f0', borderRadius: 12, background: 'white' };
// ---------------- Main Component ----------------
export function Builder() {
    const [mode, setMode] = useState('power');
    const [name, setName] = useState('New Hero');
    const [race, setRace] = useState(RACES[0]);
    const [classes, setClasses] = useState([
        { klass: CLASSES[0], level: 1 },
    ]);
    const [abilities, setAbilities] = useState({ str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 8 });
    const [loadout, setLoadout] = useState([EQUIPMENT[0], EQUIPMENT[1]]); // greataxe + shield
    const [history, setHistory] = useState([]);
    const [future, setFuture] = useState([]);
    const state = { name, race, classes, abilities, loadout };
    const derived = useMemo(() => computeDerived(state), [state]);
    const issues = useMemo(() => validateChoice(state), [state]);
    const sim = useMemo(() => simulateReadiness(state), [state]);
    function snapshot() {
        setHistory((h) => [...h, JSON.stringify(state)]);
        setFuture([]);
    }
    function undo() {
        if (!history.length)
            return;
        const prev = history[history.length - 1];
        setFuture((f) => [JSON.stringify(state), ...f]);
        setHistory((h) => h.slice(0, -1));
        const s = JSON.parse(prev);
        setName(s.name);
        setRace(s.race);
        setClasses(s.classes);
        setAbilities(s.abilities);
        setLoadout(s.loadout);
    }
    function redo() {
        if (!future.length)
            return;
        const next = future[0];
        setHistory((h) => [...h, JSON.stringify(state)]);
        setFuture((f) => f.slice(1));
        const s = JSON.parse(next);
        setName(s.name);
        setRace(s.race);
        setClasses(s.classes);
        setAbilities(s.abilities);
        setLoadout(s.loadout);
    }
    return (_jsxs("div", { style: { display: 'grid', gap: 12 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }, children: [_jsx(Sparkles, { size: 18 }), _jsx("div", { style: { fontWeight: 600 }, children: "Character Builder" }), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' }, children: [_jsx("span", { children: "Guided" }), _jsxs("label", { style: { display: 'inline-flex', alignItems: 'center', gap: 6 }, children: [_jsx("input", { type: "checkbox", checked: mode === 'power', onChange: (e) => setMode(e.target.checked ? 'power' : 'guided') }), _jsx("span", { children: "Power" })] }), _jsxs(Button, { size: "sm", variant: "outline", onClick: undo, children: [_jsx(Undo2, { size: 16, style: { marginRight: 6 } }), "Undo"] }), _jsxs(Button, { size: "sm", variant: "outline", onClick: redo, children: [_jsx(Redo2, { size: 16, style: { marginRight: 6 } }), "Redo"] }), _jsxs(Button, { size: "sm", onClick: snapshot, children: [_jsx(Settings2, { size: 16, style: { marginRight: 6 } }), "Save Draft"] })] })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 380px', gap: 12 }, children: [_jsxs("div", { style: { display: 'grid', gap: 12 }, children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { children: [_jsx(Info, { size: 16, style: { marginRight: 6 } }), "Basics"] }) }), _jsx(CardContent, { children: _jsxs("div", { style: { display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }, children: [_jsx(Labeled, { label: "Character Name", children: _jsx("input", { value: name, onChange: (e) => setName(e.target.value), style: inp }) }), _jsx(Labeled, { label: "Race", children: _jsx(Selector, { options: RACES, value: race, onChange: setRace, getLabel: (r) => r.name }) }), _jsx("div", { style: { gridColumn: '1 / -1' }, children: _jsx(ClassManager, { classes: classes, onChange: setClasses }) }), _jsx(AbilityEditor, { abilities: abilities, onChange: setAbilities, race: race })] }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { children: [_jsx(Sword, { size: 16, style: { marginRight: 6 } }), "Equipment & Loadout"] }) }), _jsx(CardContent, { children: _jsxs("div", { style: { display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }, children: [_jsxs("div", { style: { display: 'grid', gap: 8 }, children: [_jsx("div", { style: { fontSize: 12, color: '#64748b' }, children: "Catalog" }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }, children: EQUIPMENT.map((eq) => (_jsx(ItemCard, { item: eq, onAdd: () => setLoadout((l) => dedupe([...l, eq])) }, eq.id))) })] }), _jsxs("div", { style: { display: 'grid', gap: 8, background: '#f8fafc', padding: 8, borderRadius: 10, border: '1px solid #e2e8f0' }, children: [_jsx("div", { style: { fontSize: 12, color: '#64748b' }, children: "Loadout" }), _jsxs("div", { style: { display: 'grid', gap: 6 }, children: [loadout.length === 0 && (_jsx("div", { style: { fontSize: 12, color: '#94a3b8' }, children: "Nothing equipped." })), loadout.map((eq) => (_jsx(LoadoutRow, { item: eq, onRemove: () => setLoadout((l) => l.filter((x) => x.id !== eq.id)) }, eq.id)))] })] })] }) })] }), _jsx(ComparePanel, { race: race, classes: classes, loadout: loadout }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { children: [_jsx(Zap, { size: 16, style: { marginRight: 6 } }), "Toy Combat Readiness"] }) }), _jsxs(CardContent, { children: [_jsx("div", { style: { fontSize: 12, color: '#64748b' }, children: "This demo computes a quick heuristic score. In production this would call your MCST to simulate turns and return rich analytics." }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }, children: [_jsx(ScoreBlock, { label: "Offense", value: sim.offense }), _jsx(ScoreBlock, { label: "Defense", value: sim.defense }), _jsx(ScoreBlock, { label: "Economy", value: sim.economy })] }), _jsxs("div", { style: { paddingTop: 8 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }, children: [_jsx("span", { children: "Readiness" }), _jsxs("span", { style: { fontWeight: 600 }, children: [sim.readiness.toFixed(2), " / 10"] })] }), _jsx(Progress, { value: (sim.readiness / 10) * 100 })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 8 }, children: [_jsxs(Button, { variant: "outline", onClick: () => {
                                                            const randomEq = EQUIPMENT[Math.floor(Math.random() * EQUIPMENT.length)];
                                                            setLoadout((l) => dedupe([...l.filter((x) => x.type !== randomEq.type), randomEq]));
                                                        }, children: [_jsx(Shuffle, { size: 16, style: { marginRight: 6 } }), "Try Random Loadout"] }), _jsxs(Button, { onClick: snapshot, children: [_jsx(Dice6, { size: 16, style: { marginRight: 6 } }), "Snapshot Build"] })] })] })] })] }), _jsx("aside", { style: { display: 'grid', gap: 12 }, children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { children: [_jsx(Scale, { size: 16, style: { marginRight: 6 } }), "Live Summary"] }) }), _jsxs(CardContent, { children: [_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }, children: [_jsx(Labeled, { label: "Race", children: _jsx("div", { children: race.name }) }), _jsx(Labeled, { label: "Level", children: _jsx(Pill, { children: derived.totalLevel }) }), _jsx(Labeled, { label: "Classes", children: _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6 }, children: classes.map((c) => (_jsxs(Pill, { children: [c.klass.name, " ", c.level, c.subclass ? ` (${c.subclass.name})` : ''] }, c.klass.id))) }) }), _jsx(Labeled, { label: "Speed", children: _jsxs(Pill, { children: [derived.speed, " ft."] }) }), _jsx(Labeled, { label: "HP @lvl", children: _jsx(Pill, { children: derived.hp }) }), _jsx(Labeled, { label: "AC", children: _jsx(Pill, { children: derived.ac }) })] }), _jsxs("div", { style: { display: 'grid', gap: 8 }, children: [_jsx("div", { style: { fontSize: 12, color: '#64748b' }, children: "Saving Throws" }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }, children: ['str', 'dex', 'con', 'int', 'wis', 'cha'].map((k) => (_jsxs("div", { style: { padding: 8, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'grid', gap: 4 }, children: [_jsx("div", { style: { fontSize: 10, textTransform: 'uppercase', color: '#64748b' }, children: k }), _jsx("div", { children: _jsx(Pill, { children: derived.saves[k] >= 0 ? `+${derived.saves[k]}` : derived.saves[k] }) })] }, k))) })] }), _jsxs("div", { style: { display: 'grid', gap: 8, marginTop: 12 }, children: [_jsx("div", { style: { fontSize: 12, color: '#64748b' }, children: "Ability Scores (incl. racial)" }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }, children: ['str', 'dex', 'con', 'int', 'wis', 'cha'].map((k) => (_jsxs("div", { style: { padding: 8, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc' }, children: [_jsx("div", { style: { fontSize: 10, textTransform: 'uppercase', color: '#64748b' }, children: k }), _jsx("div", { style: { fontWeight: 600 }, children: finalAbility(abilities, race)[k] }), _jsxs("div", { style: { fontSize: 12, color: '#64748b' }, children: ["mod ", mod(finalAbility(abilities, race)[k]) >= 0 ? '+' : '', mod(finalAbility(abilities, race)[k])] })] }, k))) })] }), _jsxs("div", { style: { display: 'grid', gap: 8, marginTop: 12 }, children: [_jsx("div", { style: { fontSize: 12, color: '#64748b' }, children: "Subactions Gained" }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6 }, children: derived.subactions.length ? derived.subactions.map((s) => _jsx("span", { style: badgeSecondary, children: s }, s)) : _jsx("div", { style: { color: '#94a3b8' }, children: "None yet." }) }), _jsxs("div", { style: { fontSize: 12, color: '#64748b', marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx(Sparkles, { size: 16, style: { marginRight: 6 } }), "Level 1 Features"] }), _jsx("div", { style: { display: 'grid', gap: 8, fontSize: 14 }, children: classes.filter((c) => (c.level || 0) >= 1).flatMap((c) => (c.klass.level1 || []).map((f) => ({ f, cname: c.klass.name }))).map(({ f, cname }) => (_jsxs("div", { style: { padding: 8, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc' }, children: [_jsxs("div", { style: { fontWeight: 600 }, children: [f.name, " ", _jsxs("span", { style: { color: '#64748b', fontWeight: 400 }, children: ["(", cname, ")"] })] }), _jsx("div", { style: { color: '#64748b' }, children: f.text })] }, cname + f.name))) })] })] })] }) })] }), _jsx("div", { style: { fontSize: 12, color: '#64748b', padding: '8px 0' }, children: "Demo only. Replace permit/reward stubs with your engine calls to power full validation, previews, and MCST\u2011driven simulations." })] }));
}
// ---------------- Subcomponents ----------------
function Selector(props) {
    return (_jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 8 }, children: props.options.map((opt) => (_jsx(Button, { size: "sm", variant: props.value?.id === opt.id ? 'default' : 'outline', onClick: () => props.onChange(opt), children: props.getLabel(opt) }, opt.id))) }));
}
function AbilityEditor(props) {
    const final = finalAbility(props.abilities, props.race);
    const order = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const [rollTokens, setRollTokens] = useState([]);
    const [assignedFromPool, setAssignedFromPool] = useState({});
    const makeId = () => Math.random().toString(36).slice(2, 9);
    // Generators
    function rollDice(count, sides) { return Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides)); }
    function gen4d6dlOnce() { const r = rollDice(4, 6).sort((a, b) => b - a); return r[0] + r[1] + r[2]; }
    function gen3d6Once() { return rollDice(3, 6).reduce((a, b) => a + b, 0); }
    function toTokens(vals) { return vals.map((v) => ({ id: makeId(), value: v })); }
    function roll4d6dlPool() {
        const vals = Array.from({ length: 6 }, () => gen4d6dlOnce());
        setRollTokens(toTokens(vals));
        setAssignedFromPool({});
    }
    function roll3d6Pool() {
        const vals = Array.from({ length: 6 }, () => gen3d6Once());
        setRollTokens(toTokens(vals));
        setAssignedFromPool({});
    }
    function applyScores(scores) {
        const sorted = [...scores].sort((a, b) => b - a);
        const next = { ...props.abilities };
        order.forEach((k, i) => { next[k] = clamp(sorted[i] ?? 10, 3, 20); });
        props.onChange(next);
    }
    function autoAssignFromPool() {
        if (!rollTokens.length)
            return;
        applyScores(rollTokens.map(t => t.value));
        setRollTokens([]);
        setAssignedFromPool({});
    }
    function clearRolls() { setRollTokens([]); setAssignedFromPool({}); }
    // DnD handlers
    function onTokenDragStart(e, tokenId) {
        e.dataTransfer.setData('text/plain', tokenId);
        e.dataTransfer.effectAllowed = 'move';
    }
    function onAbilityDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
    function onAbilityDrop(k, e) {
        e.preventDefault();
        const tokenId = e.dataTransfer.getData('text/plain');
        if (!tokenId)
            return;
        const tokenIdx = rollTokens.findIndex(t => t.id === tokenId);
        if (tokenIdx === -1)
            return;
        const token = rollTokens[tokenIdx];
        const remaining = rollTokens.filter((_, i) => i !== tokenIdx);
        // If this ability already had a pool-assigned value, return it to pool
        const prev = assignedFromPool[k];
        const newPool = [...remaining];
        if (typeof prev === 'number')
            newPool.push({ id: makeId(), value: prev });
        // Update assignment map and abilities
        setAssignedFromPool({ ...assignedFromPool, [k]: token.value });
        setRollTokens(newPool);
        props.onChange({ ...props.abilities, [k]: clamp(token.value, 3, 20) });
    }
    return (_jsxs("div", { style: { gridColumn: '1 / -1', display: 'grid', gap: 8 }, children: [_jsx("div", { style: { fontSize: 12, color: '#64748b' }, children: "Abilities" }), _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 12, color: '#64748b', marginRight: 4 }, children: "Generate" }), _jsxs(Button, { size: "sm", variant: "outline", onClick: roll4d6dlPool, children: [_jsx(Dice6, { size: 14, style: { marginRight: 6 } }), "Roll 4d6 drop lowest"] }), _jsx(Button, { size: "sm", variant: "outline", onClick: roll3d6Pool, children: "Roll 3d6" }), _jsx(Button, { size: "sm", variant: "outline", onClick: () => { applyScores([15, 14, 13, 12, 10, 8]); clearRolls(); }, children: "Standard Array" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => { props.onChange({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }); clearRolls(); }, children: "Reset" }), rollTokens.length ? (_jsxs(_Fragment, { children: [_jsx(Button, { size: "sm", variant: "outline", onClick: autoAssignFromPool, children: "Auto-assign high\u2192low" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: clearRolls, children: "Clear Rolls" })] })) : null] }), rollTokens.length ? (_jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 8 }, children: rollTokens.map((t) => (_jsx("div", { draggable: true, onDragStart: (e) => onTokenDragStart(e, t.id), title: `Drag ${t.value} onto a stat`, style: { width: 36, height: 36, borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }, children: t.value }, t.id))) })) : null, _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }, children: order.map((k) => (_jsxs("div", { onDragOver: onAbilityDragOver, onDrop: (e) => onAbilityDrop(k, e), style: { padding: 8, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'grid', gap: 6 }, children: [_jsx("div", { style: { fontSize: 10, textTransform: 'uppercase', color: '#64748b' }, children: k }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx(Button, { size: "icon", variant: "outline", onClick: () => props.onChange({ ...props.abilities, [k]: clamp((props.abilities[k] || 10) - 1, 3, 20) }), children: "\u2212" }), _jsx("div", { style: { fontWeight: 600, width: 24, textAlign: 'center' }, children: props.abilities[k] || 10 }), _jsx(Button, { size: "icon", variant: "outline", onClick: () => props.onChange({ ...props.abilities, [k]: clamp((props.abilities[k] || 10) + 1, 3, 20) }), children: "+" })] }), _jsxs("div", { style: { fontSize: 12, color: '#64748b' }, children: ["mod ", mod(final[k]) >= 0 ? '+' : '', mod(final[k])] }), typeof assignedFromPool[k] === 'number' ? (_jsxs("div", { style: { fontSize: 11, color: '#64748b' }, children: ["Assigned: ", assignedFromPool[k]] })) : (rollTokens.length ? _jsx("div", { style: { fontSize: 11, color: '#94a3b8' }, children: "Drop a roll here" }) : null)] }, k))) })] }));
}
function finalAbility(abilities, race) {
    const out = { ...{ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, ...abilities };
    Object.entries(race?.asis || {}).forEach(([k, inc]) => { const kk = k; out[kk] = (out[kk] || 10) + (inc || 0); });
    return out;
}
function ItemCard({ item, onAdd }) {
    const tags = item.tags;
    return (_jsxs("div", { style: { padding: 8, borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', display: 'grid', gap: 6 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [item.type === 'weapon' && _jsx(Sword, { size: 16 }), item.type === 'shield' && _jsx(Shield, { size: 16 }), _jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 6, flex: 1, minWidth: 0 }, children: [_jsx("span", { style: { fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: item.name }), _jsxs("span", { style: { fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }, children: [item.type === 'weapon' && item.dmg, item.type === 'armor' && (_jsxs(_Fragment, { children: ["AC ", item.ac, typeof item.dexMax !== 'undefined' ? `, Dex cap ${(item.dexMax === Infinity) ? '—' : item.dexMax}` : ''] })), item.type === 'shield' && `+${item.ac || 2} AC`] })] }), _jsx(Button, { size: "icon", variant: "outline", onClick: onAdd, "aria-label": "Add", children: _jsx(Plus, { size: 16 }) })] }), tags?.length ? (_jsx("div", { style: { fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: tags.join(' • ') })) : null] }));
}
function LoadoutRow({ item, onRemove }) {
    return (_jsxs("div", { style: { padding: 6, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }, children: [item.type === 'weapon' && _jsx(Sword, { size: 16 }), item.type === 'shield' && _jsx(Shield, { size: 16 }), _jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }, children: [_jsx("div", { style: { fontWeight: 600, fontSize: 13 }, children: item.name }), _jsx("div", { style: { fontSize: 12, color: '#64748b' }, children: item.type === 'weapon' ? item.dmg : item.type === 'armor' ? `AC ${item.ac}` : item.type }), item.type === 'armor' && item.tags?.length ? (_jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 4 }, children: item.tags.map((t) => _jsx("span", { style: { padding: '1px 6px', borderRadius: 999, border: '1px solid #e2e8f0', fontSize: 10 }, children: t }, t)) })) : null] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }, children: [(SUBACTIONS_BY_ITEM[item.id] || []).map((s) => _jsx("span", { style: { padding: '1px 6px', borderRadius: 999, background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: 11 }, children: s }, s)), _jsx(Button, { size: "sm", variant: "ghost", onClick: onRemove, style: { padding: '4px 6px' }, children: "Remove" })] })] }));
}
function ScoreBlock({ label, value }) {
    const pct = clamp((value / 5) * 100, 0, 100);
    return (_jsxs("div", { style: { padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'grid', gap: 8 }, children: [_jsx("div", { style: { fontSize: 12, color: '#64748b' }, children: label }), _jsx("div", { style: { fontSize: 18, fontWeight: 600 }, children: value.toFixed(2) }), _jsx(Progress, { value: pct })] }));
}
function ComparePanel({ race, classes, loadout }) {
    const [open, setOpen] = useState(false);
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { children: [_jsx(Info, { size: 16, style: { marginRight: 6 } }), "Compare"] }) }), _jsxs(CardContent, { children: [_jsxs(Button, { variant: "outline", onClick: () => setOpen((v) => !v), children: [open ? 'Close' : 'Open', " Side\u2011by\u2011Side Compare"] }), open ? (_jsxs("div", { style: { marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }, children: [_jsxs("div", { style: { padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'grid', gap: 8 }, children: [_jsx("div", { style: { fontWeight: 600 }, children: "Race" }), _jsx("div", { style: { fontSize: 14 }, children: race.name }), _jsxs("div", { style: { fontSize: 12, color: '#64748b' }, children: ["Speed ", race.speed, " ft"] }), _jsx("div", { style: { display: 'grid', gap: 4 }, children: (race.traits || []).map((t) => _jsxs("div", { style: { fontSize: 12 }, children: ["\u2022 ", _jsxs("span", { style: { fontWeight: 600 }, children: [t.name, ":"] }), " ", t.text] }, t.id)) })] }), _jsxs("div", { style: { padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'grid', gap: 8 }, children: [_jsx("div", { style: { fontWeight: 600 }, children: "Classes" }), _jsx("div", { style: { display: 'grid', gap: 4, fontSize: 12, color: '#64748b' }, children: classes.map((c) => (_jsxs("div", { children: ["\u2022 ", c.klass.name, " ", c.level, c.subclass ? ` (${c.subclass.name})` : ''] }, c.klass.id))) })] }), _jsxs("div", { style: { padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'grid', gap: 8 }, children: [_jsx("div", { style: { fontWeight: 600 }, children: "Loadout" }), _jsx("div", { style: { display: 'grid', gap: 4, fontSize: 14 }, children: loadout.map((i) => _jsxs("div", { children: ["\u2022 ", i.name] }, i.id)) })] })] })) : null] })] }));
}
function ClassManager(props) {
    const [addOpen, setAddOpen] = useState(false);
    const addRef = useRef(null);
    const totalLevel = props.classes.reduce((s, c) => s + c.level, 0);
    const maxTotal = 20;
    const available = CLASSES.filter((k) => !props.classes.some((c) => c.klass.id === k.id));
    const canAdd = totalLevel < maxTotal && available.length > 0;
    useEffect(() => {
        if (!addOpen)
            return;
        const onDown = (e) => {
            if (addRef.current && !addRef.current.contains(e.target)) {
                setAddOpen(false);
            }
        };
        const onKey = (e) => {
            if (e.key === 'Escape')
                setAddOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('touchstart', onDown);
        window.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('touchstart', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [addOpen]);
    function setLevelAt(idx, next) {
        const other = totalLevel - props.classes[idx].level;
        const clamped = clamp(next, 1, Math.max(1, Math.min(maxTotal - other, 20)));
        const out = props.classes.map((c, i) => (i === idx ? { ...c, level: clamped, subclass: c.subclass && clamped < (c.subclass?.unlockLevel || Infinity) ? undefined : c.subclass } : c));
        props.onChange(out);
    }
    function removeAt(idx) {
        const out = props.classes.filter((_, i) => i !== idx);
        props.onChange(out.length ? out : [{ klass: CLASSES[0], level: 1 }]);
    }
    function addClass(k) {
        if (props.classes.some((c) => c.klass.id === k.id))
            return;
        const other = totalLevel;
        if (other >= maxTotal)
            return;
        props.onChange([...props.classes, { klass: k, level: 1 }]);
        setAddOpen(false);
    }
    function setSubclass(idx, sc) {
        const out = props.classes.map((c, i) => (i === idx ? { ...c, subclass: sc } : c));
        props.onChange(out);
    }
    return (_jsxs("div", { style: { display: 'grid', gap: 8 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { style: { fontSize: 12, color: '#64748b' }, children: ["Classes (Total Level: ", _jsx("strong", { children: totalLevel }), ")"] }), _jsxs("div", { ref: addRef, style: { position: 'relative' }, children: [_jsx(Button, { size: "sm", variant: "outline", onClick: () => setAddOpen((v) => !v), disabled: !canAdd, children: "Add Class" }), addOpen ? (_jsx("div", { style: { position: 'absolute', right: 0, top: '100%', marginTop: 6, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 16px rgba(15,23,42,0.12)', zIndex: 20, minWidth: 220 }, children: _jsx("div", { style: { maxHeight: 240, overflowY: 'auto', display: 'grid' }, children: available.map((k) => (_jsx(Button, { size: "sm", variant: "ghost", style: { width: '100%', justifyContent: 'flex-start' }, onClick: () => addClass(k), children: k.name }, k.id))) }) })) : null] })] }), _jsx("div", { style: { display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }, children: props.classes.map((c, idx) => (_jsxs("div", { style: { padding: 8, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'grid', gap: 6 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontWeight: 600 }, children: c.klass.name }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx(Button, { size: "icon", variant: "outline", onClick: () => setLevelAt(idx, c.level - 1), children: "\u2212" }), _jsx(Pill, { children: c.level }), _jsx(Button, { size: "icon", variant: "outline", onClick: () => setLevelAt(idx, c.level + 1), children: "+" })] })] }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => removeAt(idx), children: "Remove" })] }), c.klass.subclasses?.length ? (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, children: [_jsx("div", { style: { fontSize: 12, color: '#64748b' }, children: "Subclass" }), c.level < (c.klass.subclasses[0]?.unlockLevel || Infinity) ? (_jsxs("span", { style: { fontSize: 12, color: '#94a3b8' }, children: ["Unlocks at level ", Math.min(...c.klass.subclasses.map((s) => s.unlockLevel))] })) : (_jsxs("div", { style: { display: 'flex', gap: 6, flexWrap: 'wrap' }, children: [c.klass.subclasses.map((s) => (_jsx(Button, { size: "sm", variant: c.subclass?.id === s.id ? 'default' : 'outline', onClick: () => setSubclass(idx, s), children: s.name }, s.id))), c.subclass ? (_jsx(Button, { size: "sm", variant: "ghost", onClick: () => setSubclass(idx, undefined), children: "Clear" })) : null] }))] })) : null] }, c.klass.id))) })] }));
}
export default Builder;
