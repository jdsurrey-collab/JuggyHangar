import { useEffect, useMemo, useState } from "react";
import { html } from "../html.js";
import { getAllCommodityPrices, bestTrade } from "../tradeApi.js";

function fmt(n, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

const SORTS = {
  profit: { label: "Profit / unit", get: (r) => r.trade.profit },
  margin: { label: "Margin %", get: (r) => r.trade.margin ?? -Infinity },
  name: { label: "Name", get: (r) => r.commodity.name },
};

export function TradeRoutes() {
  const [commodities, setCommodities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 1 });
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("profit");
  const [cargoSize, setCargoSize] = useState(64);

  useEffect(() => {
    let cancelled = false;
    getAllCommodityPrices((done, total) => !cancelled && setProgress({ done, total }))
      .then((data) => !cancelled && setCommodities(data))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    const withTrades = commodities
      .map((commodity) => ({ commodity, trade: bestTrade(commodity) }))
      .filter((r) => r.trade);
    const q = search.trim().toLowerCase();
    const filtered = q ? withTrades.filter((r) => r.commodity.name.toLowerCase().includes(q)) : withTrades;
    const sort = SORTS[sortKey];
    return filtered.slice().sort((a, b) => {
      const av = sort.get(a);
      const bv = sort.get(b);
      if (typeof av === "string") return av.localeCompare(bv);
      return bv - av;
    });
  }, [commodities, search, sortKey]);

  return html`
    <div>
      <div class="toolbar">
        <input
          type="text"
          placeholder="Search commodities..."
          value=${search}
          onInput=${(e) => setSearch(e.target.value)}
        />
        <select value=${sortKey} onChange=${(e) => setSortKey(e.target.value)}>
          ${Object.entries(SORTS).map(([key, s]) => html`<option value=${key}>Sort: ${s.label}</option>`)}
        </select>
        <label class="ship-meta">
          Cargo (SCU):
          <input
            type="text"
            inputmode="numeric"
            value=${cargoSize}
            onInput=${(e) => setCargoSize(Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)}
            style=${{ width: "70px", marginLeft: "6px" }}
          />
        </label>
        ${!loading && html`<span class="pill">${rows.length} tradeable goods</span>`}
        ${loading && html`<span class="ship-meta">Loading prices... ${progress.done}/${progress.total}</span>`}
      </div>

      ${loading && rows.length === 0
        ? html`<div class="loading">Loading commodity prices from every terminal...</div>`
        : html`
            <div style=${{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Commodity</th>
                    <th class="num">Buy Price</th>
                    <th>Buy At</th>
                    <th class="num">Sell Price</th>
                    <th>Sell At</th>
                    <th class="num">Profit / unit</th>
                    <th class="num">Margin</th>
                    <th class="num">Profit / ${fmt(cargoSize)} SCU</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map(({ commodity, trade }) => {
                    const isProfit = trade.profit > 0;
                    return html`
                      <tr key=${commodity.uuid}>
                        <td>${commodity.name}</td>
                        <td class="num">${fmt(trade.buy.price_buy)}</td>
                        <td>${trade.buy.terminal_name} <span class="ship-meta">(${trade.buy.starmap_location?.star_system_name})</span></td>
                        <td class="num">${fmt(trade.sell.price_sell)}</td>
                        <td>${trade.sell.terminal_name} <span class="ship-meta">(${trade.sell.starmap_location?.star_system_name})</span></td>
                        <td class=${`num ${isProfit ? "delta-up" : "delta-down"}`}>${fmt(trade.profit)}</td>
                        <td class=${`num ${isProfit ? "delta-up" : "delta-down"}`}>${trade.margin != null ? `${(trade.margin * 100).toFixed(0)}%` : "—"}</td>
                        <td class="num">${fmt(trade.profit * cargoSize)}</td>
                      </tr>
                    `;
                  })}
                </tbody>
              </table>
            </div>
          `}

      <div class="footer-note">
        Prices are per unit (assumed 1 SCU) from the cheapest buy terminal and highest sell terminal for each good —
        independent of each other and of travel distance, so this is a per-unit arbitrage reference, not a full route
        planner (no travel-time or fuel-cost weighting).
      </div>
    </div>
  `;
}
