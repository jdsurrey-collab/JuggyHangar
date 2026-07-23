import { useEffect, useMemo, useState } from "react";
import { html } from "../html.js";
import { getItemsByType } from "../api.js";
import { getHangarEntry, newHangarId, saveHangarEntry } from "../storage.js";
import { navigate } from "../router.js";
import { buildShareUrl } from "../share.js";
import {
  collectSlots,
  optimizeGuns,
  optimizeGunsConstrained,
  computeWeaponBudgets,
  gunMetrics,
  missileMetrics,
  sumMetrics,
  compatibleCandidates,
  OBJECTIVES,
} from "../loadout.js";

function fmt(n, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function DeltaTag({ current, recommended }) {
  const diff = recommended - current;
  if (Math.abs(diff) < 0.5) return html`<span class="ship-meta">no change</span>`;
  const cls = diff > 0 ? "delta-up" : "delta-down";
  const sign = diff > 0 ? "+" : "";
  return html`<span class=${cls}>${sign}${fmt(diff, 1)}</span>`;
}

function SlotSelect({ value, candidates, catalogLoading, onChange }) {
  const options = candidates.slice();
  if (value && !options.some((o) => o.uuid === value.uuid)) options.unshift(value);
  return html`
    <select
      disabled=${catalogLoading && !options.length}
      value=${value?.uuid || ""}
      onChange=${(e) => {
        const uuid = e.target.value;
        if (!uuid) return onChange(null);
        const item = options.find((o) => o.uuid === uuid) || null;
        onChange(item);
      }}
    >
      <option value="">— empty —</option>
      ${options.map((o) => html`<option value=${o.uuid}>${o.name}</option>`)}
    </select>
  `;
}

export function LoadoutOptimizer({ vehicle, hangarId }) {
  const [gunCatalog, setGunCatalog] = useState(null);
  const [missileCatalog, setMissileCatalog] = useState(null);
  const [progress, setProgress] = useState("");
  const [objectiveKey, setObjectiveKey] = useState("dps");
  const [selections, setSelections] = useState({});
  const [nickname, setNickname] = useState("");
  const [entryId, setEntryId] = useState(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [budgetConstrained, setBudgetConstrained] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProgress("Loading weapon catalog...");
    getItemsByType("WeaponGun", (p, t) => setProgress(`Loading weapon catalog... ${p}/${t}`))
      .then((data) => !cancelled && setGunCatalog(data))
      .then(() => !cancelled && setProgress("Loading missile catalog..."))
      .then(() => getItemsByType("Missile"))
      .then((data) => !cancelled && setMissileCatalog(data))
      .finally(() => !cancelled && setProgress(""));
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-initialize the editable loadout whenever we switch ships or open a
  // different saved hangar entry for the same ship.
  useEffect(() => {
    const currentSlots = collectSlots(vehicle);
    const entry = hangarId ? getHangarEntry(hangarId) : null;
    const initial = {};
    for (const slot of currentSlots) {
      if (entry) {
        const saved = entry.slots.find((s) => s.slotId === slot.id);
        initial[slot.id] = saved ? saved.item : null;
      } else {
        initial[slot.id] = slot.equippedItem;
      }
    }
    setSelections(initial);
    setNickname(entry?.nickname || `${vehicle.name} Build`);
    setEntryId(entry?.id || null);
    setSaveMessage("");
  }, [vehicle.class_name, hangarId]);

  const gunSlots = useMemo(() => collectSlots(vehicle).filter((s) => s.type === "WeaponGun"), [vehicle]);
  const missileSlots = useMemo(() => collectSlots(vehicle).filter((s) => s.type === "Missile"), [vehicle]);
  const budgets = useMemo(() => computeWeaponBudgets(vehicle), [vehicle]);

  const gunPlan = useMemo(() => {
    if (!gunCatalog) return null;
    return budgetConstrained
      ? optimizeGunsConstrained(gunSlots, gunCatalog, objectiveKey, budgets)
      : optimizeGuns(gunSlots, gunCatalog, objectiveKey);
  }, [gunSlots, gunCatalog, objectiveKey, budgetConstrained, budgets]);

  const missilePlan = useMemo(() => {
    if (!missileCatalog) return null;
    return missileSlots.map((slot) => {
      const candidates = compatibleCandidates(slot, missileCatalog);
      let best = null;
      let bestDmg = -Infinity;
      for (const item of candidates) {
        const dmg = missileMetrics(item).damage;
        if (dmg > bestDmg) {
          bestDmg = dmg;
          best = item;
        }
      }
      return { slot, recommended: best, candidates };
    });
  }, [missileSlots, missileCatalog]);

  if (gunSlots.length === 0 && missileSlots.length === 0) {
    return html`<section class="panel"><h2>Loadout Optimizer</h2><div class="empty">This vehicle has no swappable weapon or missile hardpoints.</div></section>`;
  }

  function setSelection(slotId, item) {
    setSelections((prev) => ({ ...prev, [slotId]: item }));
    setSaveMessage("");
  }

  function fillRecommended() {
    const next = { ...selections };
    for (const row of gunPlan || []) next[row.slot.id] = row.recommended;
    for (const row of missilePlan || []) next[row.slot.id] = row.recommended;
    setSelections(next);
    setSaveMessage("");
  }

  function resetToStock() {
    const currentSlots = collectSlots(vehicle);
    const next = {};
    for (const slot of currentSlots) next[slot.id] = slot.equippedItem;
    setSelections(next);
    setSaveMessage("");
  }

  function handleShare() {
    const currentSlots = collectSlots(vehicle);
    const url = buildShareUrl({
      className: vehicle.class_name,
      shipName: vehicle.name,
      shipImage: vehicle.images?.[0]?.thumbnail_url || null,
      nickname: nickname.trim() || vehicle.name,
      slots: currentSlots.map((slot) => ({
        slotId: slot.id,
        type: slot.type,
        label: slot.label,
        size: slot.sizeMax,
        item: selections[slot.id] || null,
      })),
    });
    navigator.clipboard
      .writeText(url)
      .then(() => setSaveMessage("Share link copied to clipboard!"))
      .catch(() => setSaveMessage(url));
  }

  function handleSave() {
    const currentSlots = collectSlots(vehicle);
    const id = entryId || newHangarId();
    const record = {
      id,
      className: vehicle.class_name,
      shipName: vehicle.name,
      shipImage: vehicle.images?.[0]?.thumbnail_url || null,
      msrp: vehicle.msrp ?? null,
      nickname: nickname.trim() || vehicle.name,
      slots: currentSlots.map((slot) => ({
        slotId: slot.id,
        type: slot.type,
        label: slot.label,
        size: slot.sizeMax,
        item: selections[slot.id] || null,
      })),
    };
    const saved = saveHangarEntry(record);
    setEntryId(saved.id);
    setSaveMessage(`Saved to My Hangar as "${saved.nickname}".`);
    if (!hangarId) navigate(`/ships/${encodeURIComponent(vehicle.class_name)}/${saved.id}`);
  }

  const selectedGunItems = gunSlots.map((s) => selections[s.id]).filter(Boolean);
  const selectedGunMetrics = sumMetrics(selectedGunItems);
  const recommendedGunMetrics = gunPlan ? sumMetrics(gunPlan.map((r) => r.recommended).filter(Boolean)) : null;

  return html`
    <section class="panel">
      <h2>Loadout Optimizer${hangarId ? html` <span class="pill">editing saved build</span>` : null}</h2>
      <div class="toolbar">
        <label class="ship-meta">Optimize for:</label>
        <select value=${objectiveKey} onChange=${(e) => setObjectiveKey(e.target.value)}>
          ${Object.entries(OBJECTIVES).map(([key, o]) => html`<option value=${key}>${o.label}</option>`)}
        </select>
        <button class="btn" onClick=${fillRecommended}>Fill All Recommended</button>
        <button class="btn" onClick=${resetToStock}>Reset to Stock</button>
        <label class="ship-meta" style=${{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked=${budgetConstrained}
            onChange=${(e) => setBudgetConstrained(e.target.checked)}
          />
          Respect power/cooling budget
        </label>
        ${progress && html`<span class="ship-meta">${progress}</span>`}
      </div>
      ${budgetConstrained &&
      html`<div class="footer-note" style=${{ marginTop: 0, marginBottom: "12px", borderTop: "none", paddingTop: 0 }}>
        Budget estimated from your equipped Power Plant/Cooler output minus shield, cooling, and quantum drive draw —
        a simplification of Star Citizen's real power triangle, not an exact in-game match.
      </div>`}

      ${gunSlots.length > 0 &&
      html`
        <div class="loadout-summary">
          <div class="stat-box">
            <div class="label">Your Sustained DPS</div>
            <div class="value">${fmt(selectedGunMetrics.dps, 1)}</div>
          </div>
          <div class="stat-box">
            <div class="label">Best Possible DPS</div>
            <div class="value">
              ${recommendedGunMetrics ? fmt(recommendedGunMetrics.dps, 1) : "…"}
              ${recommendedGunMetrics && html`<small><${DeltaTag} current=${selectedGunMetrics.dps} recommended=${recommendedGunMetrics.dps} /></small>`}
            </div>
          </div>
          <div class="stat-box">
            <div class="label">Your Alpha Strike</div>
            <div class="value">${fmt(selectedGunMetrics.alpha, 1)}</div>
          </div>
          <div class="stat-box">
            <div class="label">Your Power Draw</div>
            <div class="value">
              ${fmt(selectedGunMetrics.power, 2)}
              ${budgetConstrained && html`<small> / ${fmt(budgets.power, 2)} budget</small>`}
            </div>
          </div>
          ${budgetConstrained &&
          html`<div class="stat-box">
            <div class="label">Your Coolant Draw</div>
            <div class="value">${fmt(selectedGunMetrics.coolant, 2)} <small> / ${fmt(budgets.coolant, 2)} budget</small></div>
          </div>`}
        </div>

        <table>
          <thead>
            <tr>
              <th>Hardpoint</th>
              <th class="num">Size</th>
              <th>Your Loadout</th>
              <th class="num">DPS</th>
              <th>Recommended</th>
              <th class="num">Rec. DPS</th>
            </tr>
          </thead>
          <tbody>
            ${gunSlots.map((slot) => {
              const candidates = gunCatalog ? compatibleCandidates(slot, gunCatalog) : [];
              const selected = selections[slot.id];
              const selM = selected ? gunMetrics(selected) : null;
              const rec = gunPlan?.find((r) => r.slot.id === slot.id)?.recommended;
              const recM = rec ? gunMetrics(rec) : null;
              return html`
                <tr key=${slot.id} class="hardpoint-row">
                  <td>${slot.label || "Hardpoint"}</td>
                  <td class="num">S${slot.sizeMax}</td>
                  <td>
                    <${SlotSelect}
                      slot=${slot}
                      value=${selected}
                      candidates=${candidates}
                      catalogLoading=${!gunCatalog}
                      onChange=${(item) => setSelection(slot.id, item)}
                    />
                  </td>
                  <td class="num">${selM ? fmt(selM.dps, 1) : "—"}</td>
                  <td>
                    ${rec ? rec.name : progress ? "…" : "—"}
                    ${rec &&
                    html`<button
                      class="btn"
                      style=${{ marginLeft: "8px", padding: "2px 8px", fontSize: "0.75rem" }}
                      onClick=${() => setSelection(slot.id, rec)}
                    >use</button>`}
                  </td>
                  <td class="num">${recM ? fmt(recM.dps, 1) : "—"}</td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      `}

      ${missileSlots.length > 0 &&
      html`
        <h2 style=${{ marginTop: "20px" }}>Missile Racks</h2>
        <table>
          <thead>
            <tr>
              <th>Rack</th>
              <th class="num">Size</th>
              <th>Your Missile</th>
              <th class="num">Damage</th>
              <th>Best Available</th>
              <th class="num">Damage</th>
            </tr>
          </thead>
          <tbody>
            ${missileSlots.map((slot) => {
              const candidates = missileCatalog ? compatibleCandidates(slot, missileCatalog) : [];
              const selected = selections[slot.id];
              const selDmg = selected ? missileMetrics(selected).damage : null;
              const rec = missilePlan?.find((r) => r.slot.id === slot.id)?.recommended;
              const recDmg = rec ? missileMetrics(rec).damage : null;
              return html`
                <tr key=${slot.id} class="hardpoint-row">
                  <td>${slot.label || "Missile"}</td>
                  <td class="num">S${slot.sizeMax}</td>
                  <td>
                    <${SlotSelect}
                      slot=${slot}
                      value=${selected}
                      candidates=${candidates}
                      catalogLoading=${!missileCatalog}
                      onChange=${(item) => setSelection(slot.id, item)}
                    />
                  </td>
                  <td class="num">${selDmg != null ? fmt(selDmg) : "—"}</td>
                  <td>
                    ${rec ? rec.name : progress ? "…" : "—"}
                    ${rec &&
                    html`<button
                      class="btn"
                      style=${{ marginLeft: "8px", padding: "2px 8px", fontSize: "0.75rem" }}
                      onClick=${() => setSelection(slot.id, rec)}
                    >use</button>`}
                  </td>
                  <td class="num">${recDmg != null ? fmt(recDmg) : "—"}</td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      `}

      <div class="toolbar" style=${{ marginTop: "18px" }}>
        <input
          type="text"
          placeholder="Name this build..."
          value=${nickname}
          onInput=${(e) => setNickname(e.target.value)}
          style=${{ minWidth: "260px" }}
        />
        <button class="btn active" onClick=${handleSave}>${entryId ? "Update Saved Build" : "Save to My Hangar"}</button>
        <button class="btn" onClick=${handleShare}>Copy Share Link</button>
        ${saveMessage && html`<span class="ship-meta">${saveMessage}</span>`}
      </div>

      <div class="footer-note">
        ${budgetConstrained
          ? "Recommendations are chosen to fit within the estimated power/cooling budget above (see note near the top for how that's estimated)."
          : "Recommendations pick the best compatible item per hardpoint independently for the chosen objective — power/cooling totals are shown for reference only. Tick \"Respect power/cooling budget\" to enforce them."}
      </div>
    </section>
  `;
}
