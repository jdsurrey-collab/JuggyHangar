import { useEffect, useMemo, useState } from "react";
import { html } from "../html.js";
import { getItemsByType } from "../api.js";
import { getAllCommodityPrices, bestSell } from "../tradeApi.js";

function fmt(n, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function modifier(laser, name) {
  const value = laser.modifier_map?.[name];
  return value == null ? "—" : `${value > 0 ? "+" : ""}${value}%`;
}

export function Mining() {
  const [lasers, setLasers] = useState(null);
  const [ores, setOres] = useState(null);
  const [progress, setProgress] = useState("");
  const [sortKey, setSortKey] = useState("throughput");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    getItemsByType("WeaponMining").then((data) => !cancelled && setLasers(data));
    setProgress("Loading commodity prices...");
    getAllCommodityPrices((done, total) => !cancelled && setProgress(`Loading commodity prices... ${done}/${total}`))
      .then((commodities) => {
        if (cancelled) return;
        const byUuid = new Map(commodities.map((c) => [c.uuid, c]));
        const raw = commodities
          .filter((c) => c.is_mineable && c.refined_version)
          .map((ore) => {
            const refined = byUuid.get(ore.refined_version.uuid);
            const sell = refined ? bestSell(refined) : null;
            return { ore, refined, sell };
          });
        setOres(raw);
      })
      .finally(() => !cancelled && setProgress(""));
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredOres = useMemo(() => {
    if (!ores) return [];
    const q = search.trim().toLowerCase();
    let list = q ? ores.filter((r) => r.ore.name.toLowerCase().includes(q)) : ores.slice();
    list.sort((a, b) => {
      if (sortKey === "value") return (b.sell?.price_sell ?? -1) - (a.sell?.price_sell ?? -1);
      if (sortKey === "instability") return (b.ore.instability ?? 0) - (a.ore.instability ?? 0);
      return a.ore.name.localeCompare(b.ore.name);
    });
    return list;
  }, [ores, search, sortKey]);

  const sortedLasers = useMemo(() => {
    if (!lasers) return [];
    return lasers.slice().sort((a, b) => (b.mining_laser?.extraction_throughput ?? 0) - (a.mining_laser?.extraction_throughput ?? 0));
  }, [lasers]);

  return html`
    <div>
      <section class="panel">
        <h2>Mining Lasers</h2>
        ${!lasers
          ? html`<div class="loading">Loading mining lasers...</div>`
          : html`
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Manufacturer</th>
                    <th class="num">Size</th>
                    <th class="num">Power Range</th>
                    <th class="num">Optimal Range</th>
                    <th class="num">Max Range</th>
                    <th class="num">Extraction Throughput</th>
                    <th class="num">Instability</th>
                    <th class="num">Inert Materials</th>
                  </tr>
                </thead>
                <tbody>
                  ${sortedLasers.map((laser) => {
                    const m = laser.mining_laser || {};
                    return html`
                      <tr key=${laser.uuid}>
                        <td>${laser.name}</td>
                        <td>${laser.manufacturer?.name || "—"}</td>
                        <td class="num">${laser.size}</td>
                        <td class="num">${m.laser_power ? `${fmt(m.laser_power.min)}–${fmt(m.laser_power.max)}` : "—"}</td>
                        <td class="num">${fmt(m.optimal_range)} m</td>
                        <td class="num">${fmt(m.maximum_range)} m</td>
                        <td class="num">${fmt(m.extraction_throughput)}</td>
                        <td class="num">${modifier(m, "laser_instability")}</td>
                        <td class="num">${modifier(m, "inert_materials")}</td>
                      </tr>
                    `;
                  })}
                </tbody>
              </table>
            `}
      </section>

      <section class="panel">
        <h2>Ore Value Reference</h2>
        <div class="toolbar">
          <input type="text" placeholder="Search ores..." value=${search} onInput=${(e) => setSearch(e.target.value)} />
          <select value=${sortKey} onChange=${(e) => setSortKey(e.target.value)}>
            <option value="value">Sort: Refined Value</option>
            <option value="instability">Sort: Instability</option>
            <option value="name">Sort: Name</option>
          </select>
          ${progress && html`<span class="ship-meta">${progress}</span>`}
          ${ores && html`<span class="pill">${filteredOres.length} mineable ores</span>`}
        </div>
        ${!ores
          ? html`<div class="loading">Loading ore data...</div>`
          : html`
              <table>
                <thead>
                  <tr>
                    <th>Raw Ore</th>
                    <th>Tier</th>
                    <th class="num">Instability</th>
                    <th class="num">Resistance</th>
                    <th class="num">Volatility</th>
                    <th>Refines To</th>
                    <th class="num">Best Sell Price</th>
                    <th>Sell At</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredOres.map(({ ore, refined, sell }) => html`
                    <tr key=${ore.uuid}>
                      <td>${ore.name}</td>
                      <td>${ore.tier || "—"}</td>
                      <td class="num">${fmt(ore.instability)}</td>
                      <td class="num">${fmt(ore.resistance)}</td>
                      <td class="num">${fmt(ore.volatility)}</td>
                      <td>${refined?.name || ore.refined_version?.name || "—"}</td>
                      <td class="num">${sell ? `${fmt(sell.price_sell)} aUEC` : "not sold"}</td>
                      <td>${sell ? `${sell.terminal_name} (${sell.starmap_location?.star_system_name})` : "—"}</td>
                    </tr>
                  `)}
                </tbody>
              </table>
            `}
      </section>

      <div class="footer-note">
        Refined value reflects the best current sell price for the processed commodity — raw ore itself has no
        market price (it's only sellable after refining). This app doesn't model refinery method yield%/loss or
        per-rock composition, so treat this as a "which ores are worth mining" reference, not exact aUEC/hour math.
      </div>
    </div>
  `;
}
