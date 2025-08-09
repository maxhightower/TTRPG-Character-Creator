import React, { useCallback, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  Handle,
  Position,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Sword, Crosshair, Sigma, Wand2, Sparkles, Star, Shield } from "lucide-react";

/**
 * D&D Character Creator – Node & Edge Optimizer (Expanded)
 *
 * New in this version:
 *  - Advantage/Disadvantage toggle
 *  - Enemy resistance/vulnerability and damage type handling
 *  - Additional weapons (glaive, halberd, spear, heavy crossbow)
 *  - Feats node: Great Weapon Master, Sharpshooter, Polearm Master, Crossbow Expert
 *  - Class Features node: Rogue Sneak Attack, Barbarian Rage, Paladin Divine Smite
 *  - Buffs node: Bless (+expected to-hit), Hex/Hunter's Mark (1d6 on hit)
 *  - Better hit/crit math with advantage/disadvantage transforms
 */

// ----------------------------- Helpers & Game Math ------------------------------

const DICE_AVG: Record<string, number> = { d4: 2.5, d6: 3.5, d8: 4.5, d10: 5.5, d12: 6.5 };

function parseDice(dice: string): Array<{ n: number; die: string }> {
  // Parse strings like "2d6+1d8" without regex
  const allowed = new Set(["4", "6", "8", "10", "12"]);
  return dice
    .toLowerCase()
    .split("+")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const parts = chunk.split("d");
      const n = parseInt(parts[0], 10) || 0;
      const size = parts[1] || "6";
      const die = allowed.has(size) ? `d${size}` : "d6";
      return { n, die };
    });
}

function diceAverage(dice: string, opts?: { greatWeaponFighting?: boolean }) {
  const gwfBoost: Record<string, number> = { d4: 0.75, d6: 0.6667, d8: 0.625, d10: 0.6, d12: 0.5833 };
  const chunks = parseDice(dice);
  let avg = 0;
  chunks.forEach(({ n, die }) => {
    const base = DICE_AVG[die] ?? 0;
    const boost = opts?.greatWeaponFighting ? (gwfBoost[die] ?? 0) : 0;
    avg += n * (base + boost);
  });
  return avg;
}

function proficiencyBonus(level: number) {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}

function fighterAttacksPerRound(level: number) {
  if (level >= 20) return 4;
  if (level >= 11) return 3;
  if (level >= 5) return 2;
  return 1;
}

function abilityMod(score: number) { return Math.floor((score - 10) / 2); }
function clamp(x: number, a: number, b: number) { return Math.max(a, Math.min(b, x)); }
function advTransform(p: number, mode: "normal" | "adv" | "dis"): number { if (mode === "adv") return 1 - (1 - p) ** 2; if (mode === "dis") return p ** 2; return p; }

// ----------------------------- Presets -----------------------------------------

const FIGHTING_STYLES = [
  { id: "defense", name: "Defense (+1 AC)", tag: "defense" },
  { id: "dueling", name: "Dueling (+2 dmg with 1H melee)", tag: "melee-1h" },
  { id: "great-weapon", name: "Great Weapon Fighting (reroll 1-2)", tag: "melee-2h" },
  { id: "archery", name: "Archery (+2 to hit)", tag: "ranged" },
  { id: "two-weapon", name: "Two-Weapon Fighting (add mod to offhand)", tag: "twf" },
];

const WEAPON_PRESETS = [
  { id: "longsword", name: "Longsword", dice: "1d8", versatile: "1d10", type: "slashing", properties: ["versatile"], handed: "1h", finesse: false, ranged: false, tags: [] },
  { id: "greatsword", name: "Greatsword", dice: "2d6", type: "slashing", properties: ["heavy", "two-handed"], handed: "2h", finesse: false, ranged: false, tags: ["gwm"] },
  { id: "rapier", name: "Rapier", dice: "1d8", type: "piercing", properties: ["finesse"], handed: "1h", finesse: true, ranged: false, tags: [] },
  { id: "shortsword", name: "Shortsword", dice: "1d6", type: "piercing", properties: ["finesse", "light"], handed: "1h", finesse: true, ranged: false, tags: [] },
  { id: "longbow", name: "Longbow", dice: "1d8", type: "piercing", properties: ["heavy", "two-handed", "ammunition"], handed: "2h", finesse: false, ranged: true, tags: ["ss"] },
  { id: "handaxe", name: "Handaxe", dice: "1d6", type: "slashing", properties: ["light", "thrown"], handed: "1h", finesse: false, ranged: false, tags: [] },
  { id: "glaive", name: "Glaive", dice: "1d10", type: "slashing", properties: ["heavy", "reach", "two-handed"], handed: "2h", finesse: false, ranged: false, tags: ["gwm", "pam"] },
  { id: "halberd", name: "Halberd", dice: "1d10", type: "slashing", properties: ["heavy", "reach", "two-handed"], handed: "2h", finesse: false, ranged: false, tags: ["gwm", "pam"] },
  { id: "spear", name: "Spear", dice: "1d6", versatile: "1d8", type: "piercing", properties: ["thrown", "versatile"], handed: "1h", finesse: false, ranged: false, tags: ["pam"] },
  { id: "hcrossbow", name: "Heavy Crossbow", dice: "1d10", type: "piercing", properties: ["heavy", "ammunition", "loading", "two-handed"], handed: "2h", finesse: false, ranged: true, tags: ["ss", "cbe"] },
];

// ----------------------------- Node Components ---------------------------------

function NodeContainer({ title, icon, children }: any) {
  const Icon = icon || Wand2;
  return (
    <Card className="min-w-[280px] bg-white shadow-md border rounded-2xl">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4" />
          <h4 className="font-semibold text-sm">{title}</h4>
        </div>
        <div>{children}</div>
      </CardContent>
    </Card>
  );
}

const FighterStyleNode = ({ data }: any) => (
  <div>
    <Handle type="target" position={Position.Left} />
    <NodeContainer title="Fighter: Fighting Style" icon={Sword}>
      <Label className="text-xs">Style</Label>
      <Select value={data.styleId} onValueChange={(v) => data.onChange({ styleId: v })}>
        <SelectTrigger><SelectValue placeholder="Pick a style" /></SelectTrigger>
        <SelectContent>
          {FIGHTING_STYLES.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {data.styleId && (
        <div className="mt-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="mr-1">{data.styleId}</Badge>
          <span>active</span>
        </div>
      )}
    </NodeContainer>
    <Handle type="source" position={Position.Right} />
  </div>
);

const WeaponNode = ({ data }: any) => {
  const weapon = WEAPON_PRESETS.find((w) => w.id === data.weaponId) ?? WEAPON_PRESETS[0];
  return (
    <div>
      <Handle type="target" position={Position.Left} />
      <NodeContainer title="Weapon" icon={Crosshair}>
        <Label className="text-xs">Preset</Label>
        <Select value={weapon.id} onValueChange={(v) => data.onChange({ weaponId: v })}>
          <SelectTrigger><SelectValue placeholder="Pick a weapon" /></SelectTrigger>
          <SelectContent>
            {WEAPON_PRESETS.map((w) => (
              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
          <div><strong>Dice:</strong> {weapon.dice}{weapon.versatile ? ` (${weapon.versatile} versatile)` : ""}</div>
          <div><strong>Type:</strong> {weapon.type}</div>
          <div className="col-span-2 flex flex-wrap gap-1 mt-1">
            {weapon.properties.map((p) => (<Badge key={p} variant="outline">{p}</Badge>))}
          </div>
        </div>
      </NodeContainer>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

const FeatNode = ({ data }: any) => (
  <div>
    <Handle type="target" position={Position.Left} />
    <NodeContainer title="Feats" icon={Star}>
      <div className="flex items-center justify-between text-sm mb-2"><span>Great Weapon Master</span><Switch checked={!!data.gwm} onCheckedChange={(v) => data.onChange({ gwm: v })} /></div>
      <div className="flex items-center justify-between text-sm mb-2"><span>Sharpshooter</span><Switch checked={!!data.ss} onCheckedChange={(v) => data.onChange({ ss: v })} /></div>
      <div className="flex items-center justify-between text-sm mb-2"><span>Polearm Master</span><Switch checked={!!data.pam} onCheckedChange={(v) => data.onChange({ pam: v })} /></div>
      <div className="flex items-center justify-between text-sm"><span>Crossbow Expert</span><Switch checked={!!data.cbe} onCheckedChange={(v) => data.onChange({ cbe: v })} /></div>
    </NodeContainer>
    <Handle type="source" position={Position.Right} />
  </div>
);

const ClassFeaturesNode = ({ data }: any) => {
  const level = data.level ?? 5;
  const sneakDice = Math.ceil(level / 2);
  const rageBonus = level >= 16 ? 4 : level >= 9 ? 3 : level >= 3 ? 2 : 2;
  return (
    <div>
      <Handle type="target" position={Position.Left} />
      <NodeContainer title="Class Features" icon={Shield}>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between"><span>Rogue Sneak Attack</span><Switch checked={!!data.sneak} onCheckedChange={(v) => data.onChange({ sneak: v })} /></div>
          {data.sneak && (<div className="text-xs text-muted-foreground">Approx: {sneakDice}d6 once/turn on hit</div>)}
          <div className="flex items-center justify-between"><span>Barbarian Rage</span><Switch checked={!!data.rage} onCheckedChange={(v) => data.onChange({ rage: v })} /></div>
          {data.rage && (<div className="text-xs text-muted-foreground">+{rageBonus} melee damage per hit</div>)}
          <div className="flex items-center justify-between"><span>Paladin Divine Smite</span><Switch checked={!!data.smite} onCheckedChange={(v) => data.onChange({ smite: v })} /></div>
          {data.smite && (
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <Label className="text-xs">Smite Dice (d8)</Label>
                <Slider value={[data.smiteDice ?? 2]} min={0} max={5} step={1} onValueChange={([v]) => data.onChange({ smiteDice: v })} />
              </div>
              <div>
                <Label className="text-xs">Smites/Round</Label>
                <Slider value={[data.smitesPerRound ?? 1]} min={0} max={2} step={1} onValueChange={([v]) => data.onChange({ smitesPerRound: v })} />
              </div>
            </div>
          )}
        </div>
      </NodeContainer>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

const BuffsNode = ({ data }: any) => (
  <div>
    <Handle type="target" position={Position.Left} />
    <NodeContainer title="Buffs & Rider Damage" icon={Sparkles}>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between"><span>Bless (≈ +2.5 to hit)</span><Switch checked={!!data.bless} onCheckedChange={(v) => data.onChange({ bless: v })} /></div>
        <div className="flex items-center justify-between"><span>Hex / Hunter's Mark (+1d6 on hit)</span><Switch checked={!!data.d6onhit} onCheckedChange={(v) => data.onChange({ d6onhit: v })} /></div>
      </div>
    </NodeContainer>
    <Handle type="source" position={Position.Right} />
  </div>
);

const OutputNode = ({ data }: any) => {
  const { summary } = data;
  return (
    <div>
      <Handle type="target" position={Position.Left} />
      <NodeContainer title="DPR Output" icon={Sigma}>
        {summary ? (
          <div className="text-sm">
            <div className="flex items-baseline gap-2"><span className="text-muted-foreground">To-hit:</span> <span className="font-semibold">+{summary.toHit}</span></div>
            <div className="flex items-baseline gap-2"><span className="text-muted-foreground">Mode:</span> <span className="font-semibold">{summary.advMode}</span></div>
            <div className="flex items-baseline gap-2"><span className="text-muted-foreground">Hit chance vs AC {summary.targetAC}:</span> <span className="font-semibold">{Math.round(summary.pHit * 100)}%</span></div>
            <div className="flex items-baseline gap-2"><span className="text-muted-foreground">Crit chance:</span> <span className="font-semibold">{Math.round(summary.pCrit * 100)}%</span></div>
            <div className="flex items-baseline gap-2"><span className="text-muted-foreground">Attacks/round:</span> <span className="font-semibold">{summary.attacks}</span></div>
            <div className="border-t my-2" />
            <div className="text-lg">DPR: <span className="font-bold">{summary.dpr.toFixed(2)}</span></div>
            {summary.notes?.length ? (<ul className="text-xs mt-2 list-disc ml-4">{summary.notes.map((n: string, i: number) => (<li key={i}>{n}</li>))}</ul>) : null}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Connect a Fighting Style / Weapon / Feats / Features / Buffs to compute DPR.</div>
        )}
      </NodeContainer>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

const nodeTypes = { fighterStyle: FighterStyleNode, weapon: WeaponNode, feats: FeatNode, features: ClassFeaturesNode, buffs: BuffsNode, output: OutputNode };

// ----------------------------- App Component ------------------------------------

export default function App() {
  // Global knobs
  const [level, setLevel] = useState(5);
  const [str, setStr] = useState(16);
  const [dex, setDex] = useState(14);
  const [targetAC, setTargetAC] = useState(16);
  const [advMode, setAdvMode] = useState<"normal" | "adv" | "dis">("normal");
  const [useVersatile, setUseVersatile] = useState(false);
  const [resist, setResist] = useState<"none" | "slashing" | "piercing" | "bludgeoning">("none");
  const [vuln, setVuln] = useState<"none" | "slashing" | "piercing" | "bludgeoning">("none");

  const prof = useMemo(() => proficiencyBonus(level), [level]);
  const attacksBase = useMemo(() => fighterAttacksPerRound(level), [level]);

  // Graph state
  const initialNodes = useMemo(() => [
    { id: "style-1", type: "fighterStyle", position: { x: 80, y: 200 }, data: { styleId: "dueling", onChange: (p: any) => updateNodeData("style-1", p) } },
    { id: "wpn-1", type: "weapon", position: { x: 80, y: 20 }, data: { weaponId: "longsword", onChange: (p: any) => updateNodeData("wpn-1", p) } },
    { id: "feat-1", type: "feats", position: { x: 80, y: 380 }, data: { gwm: false, ss: false, pam: false, cbe: false, onChange: (p: any) => updateNodeData("feat-1", p) } },
    { id: "feat-2", type: "features", position: { x: 80, y: 560 }, data: { level, onChange: (p: any) => updateNodeData("feat-2", p) } },
    { id: "buff-1", type: "buffs", position: { x: 80, y: 740 }, data: { bless: false, d6onhit: false, onChange: (p: any) => updateNodeData("buff-1", p) } },
    { id: "out-1", type: "output", position: { x: 620, y: 240 }, data: { summary: null } },
  ], []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([
    { id: "e1", source: "wpn-1", target: "out-1" },
    { id: "e2", source: "style-1", target: "out-1" },
    { id: "e3", source: "feat-1", target: "out-1" },
    { id: "e4", source: "feat-2", target: "out-1" },
    { id: "e5", source: "buff-1", target: "out-1" },
  ]);

  // Imperative helper to update node data
  const updateNodeData = useCallback((id: string, patch: any) => { setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))); }, [setNodes]);
  const onConnect = useCallback((params: any) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  // Compute summaries for output nodes based on inbound connections
  const computeGraph = useCallback(() => {
    const map = new Map(nodes.map((n) => [n.id, n] as const));

    const nextNodes = nodes.map((n) => {
      if (n.type !== "output") return n;

      const incoming = edges.filter((e) => e.target === n.id);
      const styleNode = incoming.map((e) => map.get(e.source)).find((x) => x?.type === "fighterStyle");
      const weaponNode = incoming.map((e) => map.get(e.source)).find((x) => x?.type === "weapon");
      const featNode = incoming.map((e) => map.get(e.source)).find((x) => x?.type === "feats");
      const featuresNode = incoming.map((e) => map.get(e.source)).find((x) => x?.type === "features");
      const buffsNode = incoming.map((e) => map.get(e.source)).find((x) => x?.type === "buffs");

      if (!weaponNode) return { ...n, data: { ...n.data, summary: null } };

      const styleId = styleNode?.data?.styleId as string | undefined;
      const feats = featNode?.data || {};
      const features = { ...(featuresNode?.data || {}), level };
      const buffs = buffsNode?.data || {};
      const weapon = WEAPON_PRESETS.find((w) => w.id === weaponNode.data.weaponId) ?? WEAPON_PRESETS[0];

      const strMod = abilityMod(str);
      const dexMod = abilityMod(dex);
      const isRanged = weapon.ranged === true;
      const usesDex = isRanged || weapon.finesse;

      let toHit = prof + (usesDex ? dexMod : strMod);
      const notes: string[] = [];

      if (styleId === "archery" && isRanged) { toHit += 2; notes.push("Archery: +2 to hit applied."); }
      if (styleId === "defense") { notes.push("Defense: +1 AC (not factored into DPR)."); }
      if (buffs.bless) { toHit += 2.5; notes.push("Bless: +≈2.5 to hit EV."); }

      const qualifiesGWM = weapon.tags?.includes("gwm");
      const qualifiesSS = weapon.tags?.includes("ss");
      if (feats.gwm && qualifiesGWM && !isRanged) { toHit -= 5; notes.push("GWM: -5 to hit/+10 dmg."); }
      if (feats.ss && qualifiesSS && isRanged) { toHit -= 5; notes.push("Sharpshooter: -5 to hit/+10 dmg."); }

      const ac = targetAC;
      const basePHit = clamp((21 + toHit - ac) / 20, 0, 1);
      const basePCrit = 0.05;
      const pHit = advTransform(basePHit, advMode);
      const pCrit = advTransform(basePCrit, advMode);

      const dice = useVersatile && weapon.versatile ? weapon.versatile : weapon.dice;
      const baseDieAvg = diceAverage(dice, { greatWeaponFighting: styleId === "great-weapon" && weapon.handed === "2h" && !isRanged });
      if (styleId === "great-weapon" && weapon.handed === "2h" && !isRanged) { notes.push("Great Weapon Fighting: reroll 1s & 2s estimated."); }

      const dmgMod = usesDex ? dexMod : strMod;

      let flatDamageBonus = 0;
      let extraAttacks = 0;

      if (styleId === "dueling" && weapon.handed === "1h" && !isRanged) { flatDamageBonus += 2; notes.push("Dueling: +2 damage with 1H melee."); }
      if (styleId === "two-weapon" && weapon.properties.includes("light") && !isRanged) { extraAttacks += 1; notes.push("Two-Weapon Fighting: includes offhand attack (adds mod)."); }

      if (feats.gwm && qualifiesGWM && !isRanged) { flatDamageBonus += 10; }
      if (feats.ss && qualifiesSS && isRanged) { flatDamageBonus += 10; }
      if (feats.pam && weapon.tags?.includes("pam") && !isRanged) { extraAttacks += 1; notes.push("Polearm Master: bonus 1d4 attack added."); }
      if (feats.cbe && isRanged && weapon.id.includes("crossbow")) { extraAttacks += 1; notes.push("Crossbow Expert: bonus attack added."); }

      const riderOnHitAvg = buffs.d6onhit ? DICE_AVG.d6 : 0;
      if (buffs.d6onhit) notes.push("Hex/Hunter's Mark: +1d6 on hit.");

      const levelLocal = level;
      const rageBonus = features.rage ? (levelLocal >= 16 ? 4 : levelLocal >= 9 ? 3 : 2) : 0;
      if (rageBonus && !isRanged) { flatDamageBonus += rageBonus; notes.push(`Rage: +${rageBonus} melee damage per hit.`); }

      let smiteDice = 0, smitesPerRound = 0;
      if (features.smite) { smiteDice = features.smiteDice ?? 2; smitesPerRound = features.smitesPerRound ?? 1; }

      const sneakDice = features.sneak ? Math.min(10, Math.ceil(levelLocal / 2)) : 0;

      const critDiceAvg = diceAverage(dice, { greatWeaponFighting: styleId === "great-weapon" && weapon.handed === "2h" && !isRanged });
      const avgWeapon = baseDieAvg + dmgMod + flatDamageBonus + riderOnHitAvg;
      const dmgPerAttack = (pHit - pCrit) * avgWeapon + pCrit * (avgWeapon + critDiceAvg);

      let attacksPerRound = attacksBase;
      if (extraAttacks) attacksPerRound += extraAttacks;

      const pNonCritHit = Math.max(pHit - pCrit, 0);
      const pAnyPrimaryHit = 1 - Math.pow(1 - pNonCritHit, Math.max(1, attacksBase));
      const sneakAvg = sneakDice ? pAnyPrimaryHit * diceAverage(`${sneakDice}d6`) : 0;

      const d8avg = DICE_AVG.d8;
      const smiteAvg = smiteDice && smitesPerRound ? smitesPerRound * ((pNonCritHit * (smiteDice * d8avg)) + (pCrit * (smiteDice * 2 * d8avg))) : 0;

      let pamBonusAvg = 0;
      if (feats.pam && weapon.tags?.includes("pam") && !isRanged) {
        const buttAvg = DICE_AVG.d4 + dmgMod + (features.rage ? rageBonus : 0) + riderOnHitAvg;
        pamBonusAvg = (pHit - pCrit) * buttAvg + pCrit * (buttAvg + DICE_AVG.d4);
      }

      let dpr = dmgPerAttack * attacksPerRound + sneakAvg + smiteAvg;
      if (pamBonusAvg) dpr += pamBonusAvg;

      let multiplier = 1;
      if (resist !== "none" && resist === weapon.type) { multiplier *= 0.5; notes.push(`Target resists ${weapon.type} damage.`); }
      if (vuln !== "none" && vuln === weapon.type) { multiplier *= 2; notes.push(`Target vulnerable to ${weapon.type} damage.`); }

      dpr *= multiplier;

      return { ...n, data: { ...n.data, summary: { toHit: Math.round(toHit), advMode, targetAC: ac, pHit, pCrit, attacks: attacksPerRound, dpr, notes } } };
    });

    setNodes(nextNodes);
  }, [nodes, edges, setNodes, level, prof, str, dex, targetAC, attacksBase, useVersatile, advMode, resist, vuln]);

  React.useEffect(() => { computeGraph(); }, [nodes.length, JSON.stringify(edges), level, str, dex, targetAC, useVersatile, advMode, resist, vuln]);

  const addNode = (type: keyof typeof nodeTypes) => {
    const id = `${type}-${crypto.randomUUID().slice(0, 6)}`;
    const y = 40 + Math.random() * 760;
    const base: any = { id, type, position: { x: 80, y }, data: { onChange: (p: any) => updateNodeData(id, p) } };
    if (type === "weapon") base.data.weaponId = WEAPON_PRESETS[0].id;
    if (type === "fighterStyle") base.data.styleId = "dueling";
    if (type === "feats") Object.assign(base.data, { gwm: false, ss: false, pam: false, cbe: false });
    if (type === "features") Object.assign(base.data, { level });
    if (type === "buffs") Object.assign(base.data, { bless: false, d6onhit: false });
    if (type === "output") base.data.summary = null;
    setNodes((nds) => [...nds, base]);
  };

  return (
    <div className="w-full h-full grid grid-cols-12 gap-3 p-3 bg-slate-50">
      <div className="col-span-8 h-[85vh] rounded-2xl overflow-hidden border bg-white">
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={(p) => setEdges((eds) => addEdge(p, eds))} nodeTypes={nodeTypes as any} fitView>
          <Background />
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <div className="col-span-4 space-y-3">
        <Card className="border rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between"><h3 className="font-semibold">Global Settings</h3><Badge variant="secondary">5e</Badge></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Level: {level}</Label>
                <Slider value={[level]} min={1} max={20} step={1} onValueChange={([v]) => setLevel(v)} />
              </div>
              <div className="grid grid-cols-2 gap-2 items-end">
                <div><Label>STR: {str}</Label><Slider value={[str]} min={8} max={20} step={1} onValueChange={([v]) => setStr(v)} /></div>
                <div><Label>DEX: {dex}</Label><Slider value={[dex]} min={8} max={20} step={1} onValueChange={([v]) => setDex(v)} /></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Target AC</Label>
                <div className="flex items-center gap-2"><Input type="number" value={targetAC} onChange={(e) => setTargetAC(parseInt(e.target.value || "0", 10))} /><Badge variant="outline">vs</Badge></div>
              </div>
              <div>
                <Label>Roll Mode</Label>
                <Select value={advMode} onValueChange={(v) => setAdvMode(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="adv">Advantage</SelectItem>
                    <SelectItem value="dis">Disadvantage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 mt-1"><Switch checked={useVersatile} onCheckedChange={setUseVersatile} /><Label>Use versatile die</Label></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Resistance</Label>
                  <Select value={resist} onValueChange={(v) => setResist(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="slashing">Slashing</SelectItem>
                      <SelectItem value="piercing">Piercing</SelectItem>
                      <SelectItem value="bludgeoning">Bludgeoning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Vulnerability</Label>
                  <Select value={vuln} onValueChange={(v) => setVuln(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="slashing">Slashing</SelectItem>
                      <SelectItem value="piercing">Piercing</SelectItem>
                      <SelectItem value="bludgeoning">Bludgeoning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">Proficiency: <strong>+{proficiencyBonus(level)}</strong> • Base Attacks/Round (Fighter): <strong>{fighterAttacksPerRound(level)}</strong></div>
          </CardContent>
        </Card>

        <Card className="border rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold mb-2">Add Nodes</h3>
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={() => addNode("weapon")} variant="secondary" className="justify-start"><Plus className="w-4 h-4 mr-2"/>Weapon</Button>
              <Button onClick={() => addNode("fighterStyle")} variant="secondary" className="justify-start"><Plus className="w-4 h-4 mr-2"/>Style</Button>
              <Button onClick={() => addNode("feats")} variant="secondary" className="justify-start"><Plus className="w-4 h-4 mr-2"/>Feats</Button>
              <Button onClick={() => addNode("features")} variant="secondary" className="justify-start"><Plus className="w-4 h-4 mr-2"/>Features</Button>
              <Button onClick={() => addNode("buffs")} variant="secondary" className="justify-start"><Plus className="w-4 h-4 mr-2"/>Buffs</Button>
              <Button onClick={() => addNode("output")} variant="secondary" className="justify-start"><Plus className="w-4 h-4 mr-2"/>Output</Button>
            </div>
            <div className="text-xs text-muted-foreground">Typical wiring: Weapon → Output; Style/Feats/Features/Buffs → Output. Create multiple outputs to compare builds.</div>
          </CardContent>
        </Card>

        <Card className="border rounded-2xl">
          <CardContent className="p-4 space-y-2">
            <h3 className="font-semibold">Notes</h3>
            <ul className="text-sm list-disc ml-5 space-y-1">
              <li>Advantage/disadvantage applied to both hit and crit chances via probability transforms.</li>
              <li>GWM/SS: -5 to hit, +10 damage when weapon qualifies (heavy melee for GWM; ranged ammunition for SS).</li>
              <li>Polearm Master adds a bonus 1d4 attack if using a qualifying weapon (glaive/halberd/spear).</li>
              <li>Rogue Sneak Attack modeled once/turn with probability of at least one primary hit.</li>
              <li>Divine Smite adds chosen d8s per smite on hit; crit doubles smite dice.</li>
              <li>Rage adds +2/+3/+4 melee damage scaling by level.</li>
              <li>Resist/Vulnerability multiplies final DPR by 0.5x/2x if it matches weapon's damage type.</li>
              <li>Crits modeled as one extra set of weapon dice (and smite dice) on crit.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
