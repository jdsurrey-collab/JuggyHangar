import { useEffect, useMemo, useState } from "react";
import { html } from "../html.js";
import { getVehicleList } from "../api.js";
import { assignTiers, combatRating } from "../loadout.js";
import { navigate } from "../router.js";

const TIER_COLORS = {
  S: "#ff6b6b",
  A: "#ff9f43",
  B: "#f5d76e",
  C: "#3dd6d0",
  D: "#8b93a7",
};

function fmt(n, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function TierList() {
  const [ships, setShips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ page: 0, total: 1 });
  const [groupBy, setGroupBy] = useState("role");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    getVehicleList((page, total) => !cancelled && setProgress({ page, total }))
      .then((data) => !cancelled && setShips(data))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? ships.filter((s) => `${s.name} ${s.manufacturer?.name || ""}`.toLowerCase().includes(q))
      : ships;
    const keyFor = groupBy === "role" ? (s) => s.role || "Other" : (s) => `Size ${s.size_class ?? "?"}`;
    const map = new Map();
    for (const ship of filtered) {
      const key = keyFor(ship);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ship);
    }
    return Array.from(map.entries())
      .map(([key, groupShips]) => ({ key, ranked: assignTiers(groupShips) }))
      .sort((a, b) => b.ranked.length - a.ranked.length);
  }, [ships, groupBy, search]);

  if (loading) {
    return html`<div class="loading">Loading fleet database... page ${progress.page || 1} of ${progress.total}</div>`;
  }

  return html`
    <div>
      <div class="toolbar">
        <input
          type="text"
          placeholder="Search ships or manufacturers..."
          value=${search}
          onInput=${(e) => setSearch(e.target.value)}
        />
        <select value=${groupBy} onChange=${(e) => setGroupBy(e.target.value)}>
          <option value="role">Group by Role</option>
          <option value="size">Group by Size Class</option>
        </select>
        <span class="pill">${groups.length} groups</span>
      </div>

      ${groups.map(
        (group) => html`
          <section class="panel" key=${group.key}>
            <h2>${group.key} <span class="ship-meta">(${group.ranked.length} ships)</span></h2>
            <table>
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>#</th>
                  <th>Ship</th>
                  <th>Manufacturer</th>
                  <th class="num">Combat Score</th>
                  <th class="num">SCM Speed</th>
                  <th class="num">Hull + Shield</th>
                  <th class="num">Pilot DPS</th>
                </tr>
              </thead>
              <tbody>
                ${group.ranked.map(
                  ({ ship, score, rank, tier }) => html`
                    <tr
                      key=${ship.class_name}
                      style=${{ cursor: "pointer" }}
                      onClick=${() => navigate(`/ships/${encodeURIComponent(ship.class_name)}`)}
                    >
                      <td>
                        <span
                          class="pill"
                          style=${{ color: TIER_COLORS[tier], borderColor: TIER_COLORS[tier], fontWeight: 700 }}
                        >${tier}</span>
                      </td>
                      <td>${rank}</td>
                      <td>${ship.name}</td>
                      <td>${ship.manufacturer?.name || "—"}</td>
                      <td class="num">${fmt(score, 1)}</td>
                      <td class="num">${fmt(ship.speed?.scm)}</td>
                      <td class="num">${fmt((ship.health ?? 0) + (ship.shield_hp ?? 0))}</td>
                      <td class="num">${fmt(ship.weaponry?.pilot_dps, 1)}</td>
                    </tr>
                  `
                )}
              </tbody>
            </table>
          </section>
        `
      )}

      <div class="footer-note">
        Combat Score is a heuristic blend of pilot DPS, hull+shield EHP, and SCM speed — a relative ranking tool, not
        an authoritative balance rating. Tiers are percentile-based within each group (top 10% = S, next 20% = A, next
        30% = B, next 25% = C, remainder = D), so they reflect relative standing within that specific role/size class,
        not an absolute scale across the whole fleet.
      </div>
    </div>
  `;
}
