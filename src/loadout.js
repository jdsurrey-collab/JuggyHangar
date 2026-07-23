// Slot discovery + weapon/missile metrics + per-slot optimization.
//
// The star-citizen.wiki port tree nests real hardpoints inside their mount:
// a ship's top-level "Turret" (gimbal) port carries an equipped_item (the
// mount) whose own .ports array holds the actual "WeaponGun" port, and a
// "MissileLauncher" (rack) port's equipped_item.ports holds the individual
// "Missile" ports. We walk both port.ports and port.equipped_item.ports to
// find every slot a player can actually swap gear into.

const SLOT_TYPES = new Set(["WeaponGun", "Missile"]);

export function collectSlots(vehicle) {
  const slots = [];
  let counter = 0;

  function walk(ports, pathLabel) {
    for (const port of ports || []) {
      if (SLOT_TYPES.has(port.type) && port.editable) {
        counter += 1;
        slots.push({
          id: `${port.type}-${counter}-${port.name || ""}`,
          type: port.type,
          label: pathLabel || port.display_name || port.name,
          sizeMin: port.sizes?.min ?? port.size ?? 0,
          sizeMax: port.sizes?.max ?? port.size ?? 0,
          equippedItem: port.equipped_item || null,
        });
      }
      const nested = port.equipped_item?.ports;
      if (nested?.length) walk(nested, port.equipped_item?.name || pathLabel);
      if (port.ports?.length) walk(port.ports, pathLabel);
    }
  }

  walk(vehicle.ports, null);
  return slots;
}

export function gunMetrics(item) {
  const vw = item?.vehicle_weapon;
  const dpsMap = vw?.damage?.dps || {};
  const dps = Object.values(dpsMap).reduce((a, b) => a + (b || 0), 0);
  const power = item?.resource_network?.usage?.power?.max ?? 0;
  const coolant = item?.resource_network?.usage?.coolant?.max ?? 0;
  return {
    dps,
    alpha: vw?.damage?.alpha_total ?? 0,
    sustained: vw?.damage?.sustained_60s ?? dps,
    powerDraw: power,
    coolantDraw: coolant,
    heatPerShot: vw?.heat?.per_shot ?? 0,
  };
}

export function missileMetrics(item) {
  const dmg = item?.missile?.damage_total ?? 0;
  return { damage: dmg };
}

export function itemSize(item) {
  return item?.size ?? 0;
}

// candidates: full catalog for the relevant type (WeaponGun or Missile)
export function compatibleCandidates(slot, catalog) {
  return catalog.filter(
    (item) => item.type === slot.type && itemSize(item) >= slot.sizeMin && itemSize(item) <= slot.sizeMax
  );
}

export const OBJECTIVES = {
  dps: { label: "Max Sustained DPS", metric: (m) => m.dps ?? 0 },
  alpha: { label: "Max Alpha Strike", metric: (m) => m.alpha ?? 0 },
  sustained: { label: "Max 60s Sustained", metric: (m) => m.sustained ?? 0 },
  power: { label: "Min Power Draw", metric: (m) => -(m.powerDraw ?? 0) },
};

// Greedy per-slot optimization: each slot's candidates are independent
// (compatibility only depends on the slot's own size/type), so maximizing
// each slot's objective metric independently maximizes the ship total for
// any additive objective. Power/cooling budgets are surfaced as totals for
// the user to judge, not enforced as a hard constraint yet.
export function optimizeGuns(slots, catalog, objectiveKey) {
  const objective = OBJECTIVES[objectiveKey] || OBJECTIVES.dps;
  return slots.map((slot) => {
    const candidates = compatibleCandidates(slot, catalog);
    let best = null;
    let bestScore = -Infinity;
    for (const item of candidates) {
      const score = objective.metric(gunMetrics(item));
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
    return { slot, recommended: best, candidates };
  });
}

export function sumMetrics(items) {
  return items.reduce(
    (acc, item) => {
      const m = gunMetrics(item);
      acc.dps += m.dps;
      acc.alpha += m.alpha;
      acc.sustained += m.sustained;
      acc.power += m.powerDraw;
      acc.coolant += m.coolantDraw;
      return acc;
    },
    { dps: 0, alpha: 0, sustained: 0, power: 0, coolant: 0 }
  );
}

const SYSTEM_TYPES = ["Shield", "PowerPlant", "Cooler", "QuantumDrive"];

// Estimates how much power/cooling headroom is left for weapons, derived
// from the ship's actually-equipped Power Plant/Cooler output minus what its
// other equipped systems (shields, coolers, quantum drive) draw. Star
// Citizen's real power triangle (pips, dynamic reallocation) is far more
// dynamic than this — this is a static approximation, not a game-accurate
// simulation, but it's internally consistent (same resource_network units
// the weapon draw figures already use) and matches stock loadouts fitting
// their own ship.
export function computeWeaponBudgets(vehicle) {
  const systems = (vehicle.ports || []).filter((p) => SYSTEM_TYPES.includes(p.type) && p.equipped_item);
  let powerGenerated = 0;
  let coolantGenerated = 0;
  let powerConsumed = 0;
  let coolantConsumed = 0;
  for (const p of systems) {
    const rn = p.equipped_item.resource_network || {};
    const gen = rn.generation || {};
    const usage = rn.usage || {};
    powerGenerated += gen.power || 0;
    coolantGenerated += gen.coolant || 0;
    // Skip a system's own usage of the resource type it itself produces —
    // in this data a Power Plant's "usage.power" mirrors its own rated
    // output, which reads as a self-referential artifact rather than a
    // real external draw.
    if (p.type !== "PowerPlant") powerConsumed += usage.power?.max ?? 0;
    if (p.type !== "Cooler") coolantConsumed += usage.coolant?.max ?? 0;
  }
  return {
    power: Math.max(0, powerGenerated - powerConsumed),
    coolant: Math.max(0, coolantGenerated - coolantConsumed),
  };
}

// Multiple-choice knapsack over gun hardpoints with two resource
// constraints (power, coolant). Exact multi-dimensional knapsack is
// NP-hard and capital ships can have dozens of hardpoints with large
// candidate lists, so instead of a dense DP table (which blows up with
// ship size) this starts from the unconstrained-best pick per slot, then
// repeatedly downgrades whichever single slot swap frees the most needed
// resource for the least value sacrificed, until both budgets are
// satisfied. Not guaranteed globally optimal, but scales to any ship size
// and never violates the budget it's given.
export function optimizeGunsConstrained(slots, catalog, objectiveKey, budgets) {
  const objective = OBJECTIVES[objectiveKey] || OBJECTIVES.dps;
  const EMPTY = { item: null, metrics: { dps: 0, alpha: 0, sustained: 0, powerDraw: 0, coolantDraw: 0 }, score: 0 };

  const slotOptions = slots.map((slot) => {
    const options = compatibleCandidates(slot, catalog).map((item) => {
      const metrics = gunMetrics(item);
      return { item, metrics, score: objective.metric(metrics) };
    });
    options.sort((a, b) => b.score - a.score);
    options.push(EMPTY); // always the last resort, regardless of nominal score
    return { slot, options };
  });

  const chosen = slotOptions.map(() => 0); // index into each slot's options, starts at unconstrained-best

  function totals() {
    let power = 0;
    let coolant = 0;
    slotOptions.forEach((s, i) => {
      const opt = s.options[chosen[i]];
      power += opt.metrics.powerDraw;
      coolant += opt.metrics.coolantDraw;
    });
    return { power, coolant };
  }

  let t = totals();
  let guard = 0;
  const guardLimit = slotOptions.reduce((sum, s) => sum + s.options.length, 0) + 100;
  while ((t.power > budgets.power || t.coolant > budgets.coolant) && guard < guardLimit) {
    guard += 1;
    let bestMove = null;
    slotOptions.forEach((s, i) => {
      const currentIdx = chosen[i];
      const current = s.options[currentIdx];
      const next = s.options[currentIdx + 1];
      if (!next) return; // already at EMPTY, nothing left to downgrade
      const powerFreed = current.metrics.powerDraw - next.metrics.powerDraw;
      const coolantFreed = current.metrics.coolantDraw - next.metrics.coolantDraw;
      const relief = (t.power > budgets.power ? powerFreed : 0) + (t.coolant > budgets.coolant ? coolantFreed : 0);
      const valueLost = current.score - next.score;
      // Prefer whichever single-step downgrade relieves the most violated
      // budget per unit of value given up. If no immediate next-step
      // relieves anything (relief <= 0), still allow the least-bad move so
      // the search can step past a locally awkward option instead of
      // stalling — the same slot may unlock a real improvement one step
      // further down its list.
      const efficiency = relief > 0 ? valueLost / relief : Infinity;
      if (
        !bestMove ||
        efficiency < bestMove.efficiency ||
        (efficiency === bestMove.efficiency && relief > bestMove.relief)
      ) {
        bestMove = { slotIndex: i, efficiency, relief };
      }
    });
    if (!bestMove) break; // every slot is already at EMPTY
    chosen[bestMove.slotIndex] += 1;
    t = totals();
  }

  return slotOptions.map((s, i) => {
    const opt = s.options[chosen[i]];
    return { slot: s.slot, recommended: opt.item, candidates: s.options.map((o) => o.item).filter(Boolean) };
  });
}

export function combatRating(vehicle) {
  const dps = vehicle.weaponry?.pilot_dps ?? 0;
  const ehp = (vehicle.health ?? 0) + (vehicle.shield_hp ?? 0);
  const speed = vehicle.speed?.scm ?? 0;
  return Math.sqrt(dps * ehp) / 50 + speed / 50;
}
