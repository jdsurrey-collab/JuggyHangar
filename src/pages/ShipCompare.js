import { useEffect, useMemo, useState } from "react";
import { html } from "../html.js";
import { getVehicleList } from "../api.js";
import { combatRating } from "../loadout.js";
import { navigate } from "../router.js";

function fmt(n, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

const ROWS = [
  { label: "Manufacturer", get: (v) => v.manufacturer?.name || "—" },
  { label: "Career / Role", get: (v) => `${v.career || "—"}${v.role ? ` / ${v.role}` : ""}` },
  { label: "Size Class", get: (v) => `S${v.size_class ?? "?"}` },
  { label: "Combat Score", get: (v) => fmt(combatRating(v), 1), best: (v) => combatRating(v) },
  { label: "SCM Speed (m/s)", get: (v) => fmt(v.speed?.scm), best: (v) => v.speed?.scm ?? 0 },
  { label: "Max Speed (m/s)", get: (v) => fmt(v.speed?.max), best: (v) => v.speed?.max ?? 0 },
  { label: "Hull HP", get: (v) => fmt(v.health), best: (v) => v.health ?? 0 },
  { label: "Shield HP", get: (v) => fmt(v.shield_hp), best: (v) => v.shield_hp ?? 0 },
  { label: "Pilot DPS", get: (v) => fmt(v.weaponry?.pilot_dps, 1), best: (v) => v.weaponry?.pilot_dps ?? 0 },
  { label: "Pilot Alpha", get: (v) => fmt(v.weaponry?.pilot_alpha, 1), best: (v) => v.weaponry?.pilot_alpha ?? 0 },
  { label: "Mass (kg)", get: (v) => fmt(v.mass) },
  { label: "Cargo (SCU)", get: (v) => fmt(v.cargo_capacity), best: (v) => v.cargo_capacity ?? 0 },
  { label: "Crew", get: (v) => `${v.crew?.min ?? "?"}–${v.crew?.max ?? "?"}` },
  {
    label: "Quantum Speed (Mm/s)",
    get: (v) => fmt((v.quantum?.quantum_speed ?? 0) / 1000000),
    best: (v) => v.quantum?.quantum_speed ?? 0,
  },
  { label: "Pledge Price (USD)", get: (v) => (v.msrp ? `$${v.msrp}` : "—") },
];

export function ShipCompare({ classNames }) {
  const [ships, setShips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => (classNames ? classNames.split(",").filter(Boolean) : []));
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    getVehicleList()
      .then((data) => !cancelled && setShips(data))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    navigate(selected.length ? `/compare/${selected.join(",")}` : "/compare");
    // eslint-disable-next-line
  }, [selected]);

  const byClassName = useMemo(() => new Map(ships.map((s) => [s.class_name, s])), [ships]);
  const selectedShips = selected.map((cn) => byClassName.get(cn)).filter(Boolean);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return ships
      .filter((s) => !selected.includes(s.class_name) && `${s.name} ${s.manufacturer?.name || ""}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [ships, search, selected]);

  function addShip(className) {
    if (selected.length >= 4 || selected.includes(className)) return;
    setSelected([...selected, className]);
    setSearch("");
  }

  function removeShip(className) {
    setSelected(selected.filter((cn) => cn !== className));
  }

  return html`
    <div>
      <div class="toolbar" style=${{ position: "relative" }}>
        <input
          type="text"
          placeholder=${selected.length >= 4 ? "Maximum 4 ships" : "Add a ship to compare..."}
          value=${search}
          disabled=${selected.length >= 4}
          onInput=${(e) => setSearch(e.target.value)}
        />
        ${searchResults.length > 0 &&
        html`
          <div
            style=${{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: "4px",
              background: "var(--bg-panel-alt)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              zIndex: 20,
              minWidth: "260px",
              maxHeight: "260px",
              overflowY: "auto",
            }}
          >
            ${searchResults.map(
              (s) => html`
                <div
                  key=${s.class_name}
                  style=${{ padding: "8px 12px", cursor: "pointer" }}
                  onClick=${() => addShip(s.class_name)}
                >
                  ${s.name} <span class="ship-meta">${s.manufacturer?.name || ""}</span>
                </div>
              `
            )}
          </div>
        `}
        ${loading && html`<span class="ship-meta">Loading fleet database...</span>`}
      </div>

      ${selectedShips.length === 0
        ? html`<div class="empty">Search for a ship above to start comparing (up to 4 at once).</div>`
        : html`
            <div style=${{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Stat</th>
                    ${selectedShips.map(
                      (s) => html`
                        <th key=${s.class_name}>
                          ${s.name}
                          <button
                            class="btn"
                            style=${{ marginLeft: "8px", padding: "1px 6px", fontSize: "0.7rem" }}
                            onClick=${() => removeShip(s.class_name)}
                          >✕</button>
                        </th>
                      `
                    )}
                  </tr>
                </thead>
                <tbody>
                  ${ROWS.map((row) => {
                    const values = selectedShips.map((s) => row.best?.(s));
                    const maxValue = row.best && selectedShips.length > 1 ? Math.max(...values) : null;
                    return html`
                      <tr key=${row.label}>
                        <td>${row.label}</td>
                        ${selectedShips.map((s, i) => {
                          const isBest = maxValue != null && values[i] === maxValue && maxValue > 0;
                          return html`<td class=${isBest ? "delta-up" : ""}>${row.get(s)}</td>`;
                        })}
                      </tr>
                    `;
                  })}
                </tbody>
              </table>
            </div>
          `}
    </div>
  `;
}
