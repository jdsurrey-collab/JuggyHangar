import { useEffect, useMemo, useState } from "react";
import { html } from "../html.js";
import { listHangarEntries, removeHangarEntry } from "../storage.js";
import { missileMetrics, sumMetrics } from "../loadout.js";
import { buildShareUrl } from "../share.js";
import { navigate } from "../router.js";

function fmt(n, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function MyHangar() {
  const [entries, setEntries] = useState(() => listHangarEntries());
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    setEntries(listHangarEntries());
  }, []);

  function handleDelete(e, id, nickname) {
    e.stopPropagation();
    if (!window.confirm(`Remove "${nickname}" from My Hangar?`)) return;
    removeHangarEntry(id);
    setEntries(listHangarEntries());
  }

  function handleShare(e, entry) {
    e.stopPropagation();
    const url = buildShareUrl(entry);
    navigator.clipboard
      .writeText(url)
      .then(() => setShareMessage(`Link copied for "${entry.nickname}"!`))
      .catch(() => setShareMessage(url));
    setTimeout(() => setShareMessage(""), 4000);
  }

  const perEntryStats = useMemo(
    () =>
      entries.map((entry) => {
        const guns = entry.slots.filter((s) => s.type === "WeaponGun" && s.item).map((s) => s.item);
        const missiles = entry.slots.filter((s) => s.type === "Missile" && s.item).map((s) => s.item);
        const gunTotals = sumMetrics(guns);
        const missileDamage = missiles.reduce((sum, m) => sum + (missileMetrics(m).damage || 0), 0);
        return { entry, guns, missiles, gunTotals, missileDamage };
      }),
    [entries]
  );

  const fleetTotals = useMemo(
    () =>
      perEntryStats.reduce(
        (acc, { entry, gunTotals, missileDamage }) => {
          acc.dps += gunTotals.dps;
          acc.alpha += gunTotals.alpha;
          acc.missileDamage += missileDamage;
          acc.value += entry.msrp || 0;
          return acc;
        },
        { dps: 0, alpha: 0, missileDamage: 0, value: 0 }
      ),
    [perEntryStats]
  );

  if (entries.length === 0) {
    return html`
      <div class="empty">
        No ships saved yet. Open a ship from the Fleet tab, build a loadout in the Loadout Optimizer, and click
        "Save to My Hangar".
      </div>
    `;
  }

  return html`
    <div>
      <div class="loadout-summary">
        <div class="stat-box">
          <div class="label">Saved Builds</div>
          <div class="value">${entries.length}</div>
        </div>
        <div class="stat-box">
          <div class="label">Combined Sustained DPS</div>
          <div class="value">${fmt(fleetTotals.dps, 1)}</div>
        </div>
        <div class="stat-box">
          <div class="label">Combined Alpha Strike</div>
          <div class="value">${fmt(fleetTotals.alpha, 1)}</div>
        </div>
        <div class="stat-box">
          <div class="label">Fleet Pledge Value</div>
          <div class="value">${fleetTotals.value ? `$${fmt(fleetTotals.value)}` : "—"}</div>
        </div>
      </div>

      <div class="toolbar">
        <span class="pill">${entries.length} saved ${entries.length === 1 ? "build" : "builds"}</span>
        ${shareMessage && html`<span class="ship-meta">${shareMessage}</span>`}
      </div>
      <div class="grid">
        ${perEntryStats.map(({ entry, guns, missiles, gunTotals, missileDamage }) => {
          return html`
            <div
              key=${entry.id}
              class="card"
              style=${{ cursor: "pointer" }}
              onClick=${() => navigate(`/ships/${encodeURIComponent(entry.className)}/${entry.id}`)}
            >
              ${entry.shipImage ? html`<img src=${entry.shipImage} alt=${entry.shipName} />` : null}
              <div class="ship-name">${entry.nickname}</div>
              <div class="ship-meta">${entry.shipName}</div>
              <div class="stat-row"><span>Guns</span><b>${guns.length} / ${entry.slots.filter((s) => s.type === "WeaponGun").length}</b></div>
              <div class="stat-row"><span>Sustained DPS</span><b>${fmt(gunTotals.dps, 1)}</b></div>
              <div class="stat-row"><span>Alpha Strike</span><b>${fmt(gunTotals.alpha, 1)}</b></div>
              ${missiles.length > 0 && html`<div class="stat-row"><span>Missile Damage</span><b>${fmt(missileDamage)}</b></div>`}
              <div class="stat-row"><span>Updated</span><b>${new Date(entry.updatedAt).toLocaleDateString()}</b></div>
              <div class="toolbar" style=${{ marginTop: "4px" }}>
                <button class="btn" onClick=${(e) => handleShare(e, entry)}>Share</button>
                <button class="btn" onClick=${(e) => handleDelete(e, entry.id, entry.nickname)}>Remove</button>
              </div>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}
