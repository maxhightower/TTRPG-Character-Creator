import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { ChevronRight, Dice6, Info, Settings2, Sparkles, Undo2, Redo2, Shuffle, Scale, Sword, Shield, Sparkles as Magic, Zap } from "lucide-react";

/**
 * BattleProphet Character Creator — UX Demo
 * ---------------------------------------------------------
 * Highlights implemented in this demo:
 *  - Guided vs Power‑User flows
 *  - Live, reactive summary panel (stats, AC, subactions, validations)
 *  - Inline rule summaries & dependency hints
 *  - Side‑by‑side compare for Class / Race / Equipment
 *  - Inventory & loadout sandbox with effects on stats
 *  - "Combat Readiness" toy simulation score
 *
 * Notes:
 *  - This is a front‑end demo: the rule engine is stubbed with simple logic
 *    that mirrors the ideas in your back end (permit/reward rules, subactions).
 *  - Replace stubs with your real permit/reward checks to go live.
 */

// ---------- Demo Data -------------------------------------------------------

const RACES = [
  {
    id: "human",
    name: "Human (Base)",
    asis: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    speed: 30,
    traits: [
      { id: "versatile", name: "Versatile", text: "+1 to all ability scores." },
    ],
  },
  {
    id: "elf",
    name: "Elf (Wood)",
    asis: { dex: 2, wis: 1 },
    speed: 35,
    traits: [
      { id: "darkvision", name: "Darkvision", text: "See in dim light 60 ft." },
      { id: "keen", name: "Keen Senses", text: "Proficiency in Perception." },
    ],
  },
];

const CLASSES = [
  {
    id: "barbarian",
    name: "Barbarian",
    hitDie: 12,
    armor: ["light", "medium", "shields"],
    weapons: ["simple", "martial"],
    grants: {
      subactions: ["Rage", "Reckless Attack"],
    },
    level1: [
      { name: "Rage", text: "+2 damage, advantage on STR checks; uses/long rest." },
      { name: "Unarmored Defense", text: "AC = 10 + DEX + CON when no armor; shield allowed." },
    ],
    acFormula: (a) => (a.armor === "none" ? 10 + a.dexMod + a.conMod : undefined),
  },
  {
    id: "fighter",
    name: "Fighter",
    hitDie: 10,
    armor: ["all", "shields"],
    weapons: ["simple", "martial"],
    grants: {
      subactions: ["Second Wind"],
    },
    level1: [
      { name: "Second Wind", text: "1d10 + level self‑heal, 1/short rest." },
      { name: "Fighting Style", text: "+2 to hit with archery or +1 AC with defense, etc." },
    ],
  },
  {
    id: "wizard",
    name: "Wizard",
    hitDie: 6,
    armor: [],
    weapons: ["daggers", "quarterstaff"],
    grants: { subactions: ["Cast Spell"] },
    level1: [
      { name: "Spellcasting", text: "INT spellcasting. Cantrips & 1st‑level slots." },
      { name: "Arcane Recovery", text: "Recover expended slots on short rest." },
    ],
  },
];

const EQUIPMENT = [
  { id: "greataxe", name: "Greataxe", type: "weapon", group: "martial", hands: 2, dmg: "1d12 slashing", tags: ["heavy", "two‑handed"], grants: ["Melee Attack (Greataxe)"] },
  { id: "shield", name: "Shield", type: "shield", ac: +2, hands: 1, tags: ["shield"], grants: ["Raise Shield"] },
  { id: "leather", name: "Leather Armor", type: "armor", ac: 11, dexMax: Infinity },
  { id: "chain", name: "Chain Mail", type: "armor", ac: 16, dexMax: 0, reqStr: 13 },
  { id: "longbow", name: "Longbow", type: "weapon", group: "martial", hands: 2, dmg: "1d8 piercing", tags: ["heavy", "two‑handed", "ranged"], grants: ["Ranged Attack (Longbow)"] },
];

const SUBACTIONS_BY_ITEM = {
  greataxe: ["Melee Attack (Greataxe)"],
  longbow: ["Ranged Attack (Longbow)"],
  shield: ["Raise Shield"],
};

// ---------- Utilities -------------------------------------------------------

function mod(score) {
  return Math.floor((score - 10) / 2);
}

function parseDie(expr) {
  // Tiny parser for NdM (+optional) used in the toy simulator
  const m = /([0-9]+)d([0-9]+)(\s*[+−-]\s*[0-9]+)?/i.exec(expr?.trim?.() || "");
  if (!m) return () => 0;
  const n = Number(m[1]);
  const d = Number(m[2]);
  const flat = m[3] ? Number(m[3].replace("−", "-").replace(" ", "")) : 0;
  return () => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * d)).reduce((a, b) => a + b, 0) + flat;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// ---------- Permit / Validation Stubs --------------------------------------

function validateChoice(state) {
  // This mirrors the idea of back‑end permit rules.
  const issues = [];

  // Armor & Shield compatibility
  const hasShield = state.loadout.some((i) => i.type === "shield");
  const armor = state.loadout.find((i) => i.type === "armor");
  const handsInUse = state.loadout.reduce((acc, i) => acc + (i.hands || 0), 0);
  const twoHandedWeapon = state.loadout.find((i) => i.tags?.includes("two‑handed"));

  if (twoHandedWeapon && hasShield) {
    issues.push({ level: "error", msg: "Two‑handed weapon cannot be used with a shield equipped." });
  }

  // Heavy armor STR requirement
  if (armor?.id === "chain" && (state.abilities.str || 10) < 13) {
    issues.push({ level: "warn", msg: "Chain Mail requires STR 13 for optimal use (speed penalties otherwise)." });
  }

  // Wizard armor proficiency (toy rule)
  if (state.class?.id === "wizard" && armor) {
    issues.push({ level: "warn", msg: "Wizards are not proficient with armor by default (toy rule)." });
  }

  // Barbarian: Unarmored Defense reminder
  if (state.class?.id === "barbarian" && !armor) {
    issues.push({ level: "hint", msg: "Unarmored Defense active: AC = 10 + DEX + CON. Shield allowed." });
  }

  // Hands sanity
  if (handsInUse > 2) {
    issues.push({ level: "error", msg: "You cannot hold more than two hands worth of equipment." });
  }

  return issues;
}

// ---------- Demo Engine-ish Calculations -----------------------------------

function computeDerived(state) {
  const dexMod = mod(state.abilities.dex);
  const conMod = mod(state.abilities.con);
  const strMod = mod(state.abilities.str);

  // Base AC
  const armor = state.loadout.find((i) => i.type === "armor");
  const shield = state.loadout.find((i) => i.type === "shield");

  let ac = 10 + dexMod; // default
  if (armor) {
    const dexCap = armor.dexMax ?? Infinity;
    ac = armor.ac + clamp(dexMod, -Infinity, dexCap);
  }
  if (!armor && state.class?.id === "barbarian") {
    ac = 10 + dexMod + conMod; // Unarmored Defense (toy)
  }
  if (shield) ac += shield.ac ?? 2;

  // HP at level 1
  const hitDie = state.class?.hitDie ?? 8;
  const hp = hitDie + conMod;

  // Speed
  const speed = (state.race?.speed ?? 30);

  // Subactions
  const classSubs = state.class?.grants?.subactions ?? [];
  const itemSubs = state.loadout.flatMap((i) => SUBACTIONS_BY_ITEM[i.id] ?? []);
  const subactions = dedupe([...classSubs, ...itemSubs]);

  return { ac, hp, speed, subactions, dexMod, conMod, strMod };
}

function dedupe(arr) {
  return Array.from(new Set(arr));
}

// Tiny toy simulator that pretends to run MCST and outputs a readiness score
function simulateReadiness(state) {
  const { subactions, strMod, dexMod, conMod } = computeDerived(state);
  const offense = (subactions.includes("Melee Attack (Greataxe)") ? 0.6 : 0) + (subactions.includes("Ranged Attack (Longbow)") ? 0.5 : 0) + Math.max(strMod, dexMod) * 0.15;
  const defense = computeDerived(state).ac * 0.03 + conMod * 0.4;
  const economy = (subactions.includes("Rage") ? 0.5 : 0) + (subactions.includes("Second Wind") ? 0.4 : 0) + (subactions.includes("Cast Spell") ? 0.4 : 0);
  const readiness = clamp(Math.round((offense + defense + economy) * 100) / 100, 0, 10);
  return { offense, defense, economy, readiness };
}

// ---------- UI Bits ---------------------------------------------------------

const Labeled = ({ label, children }) => (
  <div className="grid gap-1">
    <div className="text-xs text-muted-foreground">{label}</div>
    {children}
  </div>
);

const Pill = ({ children }) => (
  <span className="px-2 py-1 text-xs rounded-full bg-muted text-foreground/90">{children}</span>
);

// ---------- Main App --------------------------------------------------------

export default function App() {
  const [mode, setMode] = useState("power"); // "guided" | "power"
  const [name, setName] = useState("New Hero");
  const [race, setRace] = useState(RACES[0]);
  const [klass, setKlass] = useState(CLASSES[0]);
  const [abilities, setAbilities] = useState({ str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 8 });
  const [loadout, setLoadout] = useState([EQUIPMENT[0], EQUIPMENT[1]]); // greataxe + shield (to show a validation)
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  const state = { name, race, class: klass, abilities, loadout };
  const derived = useMemo(() => computeDerived(state), [state]);
  const issues = useMemo(() => validateChoice(state), [state]);
  const sim = useMemo(() => simulateReadiness(state), [state]);

  function snapshot() {
    setHistory((h) => [...h, JSON.stringify(state)]);
    setFuture([]);
  }
  function undo() {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setFuture((f) => [JSON.stringify(state), ...f]);
    setHistory((h) => h.slice(0, -1));
    const s = JSON.parse(prev);
    setName(s.name); setRace(s.race); setKlass(s.class); setAbilities(s.abilities); setLoadout(s.loadout);
  }
  function redo() {
    if (!future.length) return;
    const next = future[0];
    setHistory((h) => [...h, JSON.stringify(state)]);
    setFuture((f) => f.slice(1));
    const s = JSON.parse(next);
    setName(s.name); setRace(s.race); setKlass(s.class); setAbilities(s.abilities); setLoadout(s.loadout);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Sparkles className="w-5 h-5" />
          <h1 className="text-lg font-semibold">BattleProphet · Character Creator (Demo)</h1>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Guided</span>
              <Switch checked={mode === "power"} onCheckedChange={(v) => setMode(v ? "power" : "guided")} />
              <span className="text-muted-foreground">Power</span>
            </div>
            <Button size="sm" variant="outline" onClick={undo}><Undo2 className="w-4 h-4 mr-1"/>Undo</Button>
            <Button size="sm" variant="outline" onClick={redo}><Redo2 className="w-4 h-4 mr-1"/>Redo</Button>
            <Button size="sm" onClick={snapshot}><Settings2 className="w-4 h-4 mr-1"/>Save Draft</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 grid gap-4 md:grid-cols-[1fr_380px]">
        {/* Left: Builder */}
        <div className="grid gap-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Info className="w-4 h-4"/>Basics</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <Labeled label="Character Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Labeled>

              <Labeled label="Race">
                <Selector options={RACES} value={race} onChange={setRace} getLabel={(r)=>r.name} />
              </Labeled>

              <Labeled label="Class">
                <Selector options={CLASSES} value={klass} onChange={setKlass} getLabel={(c)=>c.name} />
              </Labeled>

              <AbilityEditor abilities={abilities} onChange={setAbilities} race={race} />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sword className="w-4 h-4"/>Equipment & Loadout</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-3">
                <div className="text-sm text-muted-foreground">Catalog</div>
                <div className="grid grid-cols-2 gap-2">
                  {EQUIPMENT.map((eq) => (
                    <ItemCard key={eq.id} item={eq} onAdd={() => setLoadout((l)=> dedupe([...l, eq]))} />
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                <div className="text-sm text-muted-foreground">Loadout</div>
                <div className="grid gap-2">
                  {loadout.length === 0 && (
                    <div className="text-sm text-muted-foreground">Nothing equipped.</div>
                  )}
                  {loadout.map((eq) => (
                    <LoadoutRow key={eq.id} item={eq} onRemove={() => setLoadout((l)=> l.filter((x)=> x.id !== eq.id))} />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <CompareDrawer race={race} klass={klass} loadout={loadout} />

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Zap className="w-4 h-4"/>Toy Combat Readiness</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="text-sm text-muted-foreground">This demo computes a quick heuristic score. In production this would call your MCST to simulate turns and return rich analytics.</div>
              <div className="grid md:grid-cols-3 gap-4">
                <ScoreBlock label="Offense" value={sim.offense} />
                <ScoreBlock label="Defense" value={sim.defense} />
                <ScoreBlock label="Economy" value={sim.economy} />
              </div>
              <div className="pt-2">
                <div className="flex items-center justify-between text-sm mb-1"><span>Readiness</span><span className="font-medium">{sim.readiness.toFixed(2)} / 10</span></div>
                <Progress value={(sim.readiness / 10) * 100} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  // randomize a bit for fun
                  const randomEq = EQUIPMENT[Math.floor(Math.random()*EQUIPMENT.length)];
                  setLoadout((l)=> dedupe([...l.filter(x=> x.type!==randomEq.type), randomEq]));
                }}><Shuffle className="w-4 h-4 mr-2"/>Try Random Loadout</Button>
                <Button onClick={snapshot}><Dice6 className="w-4 h-4 mr-2"/>Snapshot Build</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Live Summary / Validation */}
        <aside className="grid gap-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Scale className="w-4 h-4"/>Live Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Labeled label="Race"><div>{race.name}</div></Labeled>
                <Labeled label="Class"><div>{klass.name}</div></Labeled>
                <Labeled label="Speed"><Pill>{computeDerived(state).speed} ft.</Pill></Labeled>
                <Labeled label="HP @1"><Pill>{computeDerived(state).hp}</Pill></Labeled>
                <Labeled label="AC"><Pill>{computeDerived(state).ac}</Pill></Labeled>
              </div>

              <div className="grid gap-2">
                <div className="text-xs text-muted-foreground">Ability Scores (incl. racial)</div>
                <div className="grid grid-cols-6 gap-2">
                  {(["str","dex","con","int","wis","cha"]).map((k)=> (
                    <div key={k} className="p-2 rounded border bg-muted/40">
                      <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
                      <div className="font-semibold">{finalAbility(abilities, race)[k]}</div>
                      <div className="text-xs text-muted-foreground">mod {mod(finalAbility(abilities, race)[k])>=0?"+":""}{mod(finalAbility(abilities, race)[k])}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <div className="text-xs text-muted-foreground">Subactions Gained</div>
                <div className="flex flex-wrap gap-2">
                  {derived.subactions.length ? derived.subactions.map((s)=> <Badge key={s} variant="secondary">{s}</Badge>) : <div className="text-muted-foreground">None yet.</div>}
                </div>
              </div>

              <div className="grid gap-2">
                <div className="text-xs text-muted-foreground">Validation & Hints</div>
                {!issues.length && <div className="text-green-600 text-xs">All good! No conflicts detected.</div>}
                {issues.map((i, idx)=> (
                  <div key={idx} className={`text-xs ${i.level === "error" ? "text-red-600" : i.level === "warn" ? "text-amber-600" : "text-blue-600"}`}>• {i.msg}</div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Magic className="w-4 h-4"/>Level 1 Features</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {(klass.level1||[]).map((f)=> (
                <div key={f.name} className="p-2 rounded border bg-muted/40">
                  <div className="font-medium">{f.name}</div>
                  <div className="text-muted-foreground">{f.text}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </main>

      <footer className="max-w-7xl mx-auto py-8 px-4 text-xs text-muted-foreground">
        Demo only. Replace permit/reward stubs with your engine calls to power full validation, previews, and MCST‑driven simulations.
      </footer>
    </div>
  );
}

// ---------- Components ------------------------------------------------------

function Selector({ options, value, onChange, getLabel }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt)=> (
        <Button key={opt.id} size="sm" variant={value?.id===opt.id?"default":"outline"} onClick={()=> onChange(opt)}>
          {getLabel(opt)}
        </Button>
      ))}
    </div>
  );
}

function AbilityEditor({ abilities, onChange, race }) {
  const final = finalAbility(abilities, race);
  return (
    <div className="col-span-2 grid gap-2">
      <div className="text-sm text-muted-foreground">Abilities</div>
      <div className="grid grid-cols-6 gap-2">
        {Object.entries(abilities).map(([k, v]) => (
          <div key={k} className="p-2 rounded border bg-muted/40 grid gap-1">
            <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" onClick={()=> onChange({ ...abilities, [k]: clamp(v-1, 3, 20) })}>−</Button>
              <div className="font-semibold w-6 text-center">{v}</div>
              <Button size="icon" variant="outline" onClick={()=> onChange({ ...abilities, [k]: clamp(v+1, 3, 20) })}>+</Button>
            </div>
            <div className="text-xs text-muted-foreground">mod {mod(final[k])>=0?"+":""}{mod(final[k])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function finalAbility(abilities, race) {
  const out = { ...abilities };
  Object.entries(race?.asis || {}).forEach(([k, inc]) => { out[k] = (out[k] || 10) + inc; });
  return out;
}

function ItemCard({ item, onAdd }) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} className="p-3 rounded-xl border bg-card grid gap-2">
      <div className="font-medium flex items-center gap-2">
        {item.type === "weapon" && <Sword className="w-4 h-4"/>}
        {item.type === "shield" && <Shield className="w-4 h-4"/>}
        <span>{item.name}</span>
      </div>
      <div className="text-xs text-muted-foreground min-h-[32px]">
        {item.type === "weapon" && <span>{item.dmg}</span>}
        {item.type === "armor" && <span>AC {item.ac}{typeof item.dexMax!=="undefined"?`, Dex cap ${item.dexMax===Infinity?"—":item.dexMax}`: ""}</span>}
        {item.type === "shield" && <span>+{item.ac||2} AC</span>}
      </div>
      <div className="flex flex-wrap gap-1">
        {(item.tags||[]).map((t)=> <Badge key={t} variant="outline">{t}</Badge>)}
      </div>
      <Button size="sm" className="mt-1" onClick={onAdd}><ChevronRight className="w-4 h-4 mr-1"/>Add</Button>
    </motion.div>
  );
}

function LoadoutRow({ item, onRemove }) {
  return (
    <div className="p-2 rounded border bg-muted/40 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {item.type === "weapon" && <Sword className="w-4 h-4"/>}
        {item.type === "shield" && <Shield className="w-4 h-4"/>}
        <div>
          <div className="font-medium text-sm">{item.name}</div>
          <div className="text-xs text-muted-foreground">{item.type === "weapon" ? item.dmg : item.type === "armor" ? `AC ${item.ac}` : item.type}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {(SUBACTIONS_BY_ITEM[item.id]||[]).map((s)=> <Badge key={s} variant="secondary">{s}</Badge>)}
        <Button size="sm" variant="ghost" onClick={onRemove}>Remove</Button>
      </div>
    </div>
  );
}

function ScoreBlock({ label, value }) {
  const pct = clamp((value/5)*100, 0, 100);
  return (
    <div className="p-3 rounded-xl border bg-muted/40 grid gap-2">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value.toFixed(2)}</div>
      <Progress value={pct} />
    </div>
  );
}

function CompareDrawer({ race, klass, loadout }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Info className="w-4 h-4"/>Compare</CardTitle>
      </CardHeader>
      <CardContent>
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline">Open Side‑by‑Side Compare</Button>
          </DrawerTrigger>
          <DrawerContent className="p-4">
            <DrawerHeader>
              <DrawerTitle>Side‑by‑Side</DrawerTitle>
            </DrawerHeader>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border bg-muted/40 grid gap-2">
                <div className="font-medium">Race</div>
                <div className="text-sm">{race.name}</div>
                <div className="text-xs text-muted-foreground">Speed {race.speed} ft</div>
                <div className="grid gap-1">
                  {(race.traits||[]).map((t)=> <div key={t.id} className="text-xs">• <span className="font-medium">{t.name}:</span> {t.text}</div>)}
                </div>
              </div>
              <div className="p-3 rounded-xl border bg-muted/40 grid gap-2">
                <div className="font-medium">Class</div>
                <div className="text-sm">{klass.name}</div>
                <div className="grid gap-1 text-xs text-muted-foreground">
                  {(klass.level1||[]).map((f)=> <div key={f.name}>• {f.name}</div>)}
                </div>
              </div>
              <div className="p-3 rounded-xl border bg-muted/40 grid gap-2">
                <div className="font-medium">Loadout</div>
                <div className="grid gap-1 text-sm">
                  {loadout.map((i)=> <div key={i.id}>• {i.name}</div>)}
                </div>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </CardContent>
    </Card>
  );
}
