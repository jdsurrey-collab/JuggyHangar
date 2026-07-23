import { useEffect, useMemo, useState } from "react";
import { html } from "../html.js";
import { getItemsByType, ITEM_TYPES } from "../api.js";
import { gunMetrics } from "../loadout.js";

function fmt(n, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });
}

// Cheapest in-game shop listing for an item, from UEX Corp pricing data.
// price_buy of 0 means that terminal only buys/sells the item back, not sells it.
function cheapestPurchase(item) {
  const purchases = (item.uex_prices?.purchase || []).filter((p) => p.price_buy > 0);
  if (!purchases.length) return null;
  return purchases.reduce((best, p) => (p.price_buy < best.price_buy ? p : best));
}

const COLUMNS = {
  WeaponGun: [
    { key: "size", label: "Size", get: (i) => i.size, numeric: true },
    { key: "wtype", label: "Weapon Type", get: (i) => i.vehicle_weapon?.type || i.sub_type_label },
    { key: "dps", label: "DPS", get: (i) => gunMetrics(i).dps, numeric: true },
    { key: "alpha", label: "Alpha", get: (i) => gunMetrics(i).alpha, numeric: true },
    { key: "sustained", label: "60s Sustained", get: (i) => gunMetrics(i).sustained, numeric: true },
    { key: "power", label: "Power Draw", get: (i) => gunMetrics(i).powerDraw, numeric: true },
  ],
  Turret: [
    { key: "size", label: "Size", get: (i) => i.size, numeric: true },
    { key: "wtype", label: "Turret Type", get: (i) => i.sub_type_label },
  ],
  Missile: [
    { key: "size", label: "Size", get: (i) => i.size, numeric: true },
    { key: "damage", label: "Damage", get: (i) => i.missile?.damage_total, numeric: true },
    { key: "speed", label: "Speed", get: (i) => i.missile?.speed, numeric: true },
  ],
  MissileLauncher: [
    { key: "size", label: "Size", get: (i) => i.size, numeric: true },
  ],
  Shield: [
    { key: "size", label: "Size", get: (i) => i.size, numeric: true },
    { key: "hp", label: "Max HP", get: (i) => i.shield?.max_health, numeric: true },
    { key: "regen", label: "Regen/s", get: (i) => i.shield?.regen_rate, numeric: true },
    { key: "regenTime", label: "Full Regen (s)", get: (i) => i.shield?.regen_time, numeric: true },
  ],
  PowerPlant: [
    { key: "size", label: "Size", get: (i) => i.size, numeric: true },
    { key: "power", label: "Power Output", get: (i) => i.resource_network?.generation?.power, numeric: true },
  ],
  Cooler: [
    { key: "size", label: "Size", get: (i) => i.size, numeric: true },
    { key: "cooling", label: "Cooling Rate", get: (i) => i.resource_network?.generation?.coolant, numeric: true },
  ],
  QuantumDrive: [
    { key: "size", label: "Size", get: (i) => i.size, numeric: true },
    { key: "speed", label: "Drive Speed", get: (i) => i.quantum_drive?.standard_jump?.drive_speed, numeric: true },
    { key: "range", label: "Jump Range", get: (i) => i.quantum_drive?.jump_range_formatted },
  ],
};

export function PartsBrowser() {
  const [type, setType] = useState("WeaponGun");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ page: 0, total: 1 });
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const columns = useMemo(
    () => [
      { key: "name", label: "Name", get: (i) => i.name },
      ...(COLUMNS[type] || []),
      {
        key: "price",
        label: "Cheapest Price",
        get: (i) => cheapestPurchase(i)?.price_buy ?? null,
        numeric: true,
        defaultDir: "asc",
        format: (v) => (v == null ? "not sold in-game" : `${fmt(v, 0)} aUEC`),
      },
      {
        key: "location",
        label: "Sold At",
        get: (i) => {
          const p = cheapestPurchase(i);
          if (!p) return null;
          const system = p.starmap_location?.star_system_name;
          return `${p.terminal_name}${system ? ` (${system})` : ""}`;
        },
      },
    ],
    [type]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSortKey("name");
    getItemsByType(type, (page, total) => !cancelled && setProgress({ page, total }))
      .then((data) => !cancelled && setItems(data))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [type]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const col = columns.find((c) => c.key === sortKey) || columns[0];
    let list = items.filter((i) => !q || `${i.name} ${i.manufacturer?.name || ""}`.toLowerCase().includes(q));
    list = list.slice().sort((a, b) => {
      const av = col.get(a);
      const bv = col.get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return av.localeCompare(bv) * (sortDir === "asc" ? 1 : -1);
      return (av - bv) * (sortDir === "asc" ? 1 : -1);
    });
    return list;
  }, [items, search, sortKey, sortDir, columns]);

  return html`
    <div>
      <div class="toolbar">
        <select value=${type} onChange=${(e) => setType(e.target.value)}>
          ${Object.entries(ITEM_TYPES).map(([key, label]) => html`<option value=${key}>${label}</option>`)}
        </select>
        <input type="text" placeholder="Search parts..." value=${search} onInput=${(e) => setSearch(e.target.value)} />
        ${!loading && html`<span class="pill">${filteredSorted.length} items</span>`}
        ${loading && html`<span class="ship-meta">Loading page ${progress.page || 1} of ${progress.total}...</span>`}
      </div>

      ${loading
        ? html`<div class="loading">Loading ${ITEM_TYPES[type]}...</div>`
        : html`
            <table>
              <thead>
                <tr>
                  ${columns.map(
                    (c) => html`
                      <th class=${c.numeric ? "num" : ""} style=${{ cursor: "pointer" }} onClick=${() => {
                        if (sortKey === c.key) setSortDir(sortDir === "asc" ? "desc" : "asc");
                        else {
                          setSortKey(c.key);
                          setSortDir(c.defaultDir || (c.numeric ? "desc" : "asc"));
                        }
                      }}>
                        ${c.label}${sortKey === c.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                      </th>
                    `
                  )}
                </tr>
              </thead>
              <tbody>
                ${filteredSorted.map(
                  (item, i) => html`
                    <tr key=${item.uuid || i}>
                      ${columns.map((c) => {
                        const raw = c.get(item);
                        const display = c.format
                          ? c.format(raw)
                          : c.numeric
                          ? fmt(raw, c.key === "regenTime" ? 2 : 1)
                          : raw ?? "—";
                        return html`<td class=${c.numeric ? "num" : ""}>${display}</td>`;
                      })}
                    </tr>
                  `
                )}
              </tbody>
            </table>
          `}
    </div>
  `;
}
