import { useEffect, useMemo, useState } from "react";
import { html } from "../html.js";
import { getLocations, buildSystemMap, buildLocationTradeIndex } from "../starmapApi.js";
import { getAllCommodityPrices } from "../tradeApi.js";

const WIDTH = 800;
const HEIGHT = 800;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
const BODY_RADIUS = 300;
const CHILD_RADIUS = 42;

function fmt(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

function ringPositions(center, radius, count) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
  });
}

export function StarMap({ highlight }) {
  const [locations, setLocations] = useState(null);
  const [progress, setProgress] = useState({ page: 0, total: 1 });
  const [commodities, setCommodities] = useState(null);
  const [tradeProgress, setTradeProgress] = useState("");
  const [systemIndex, setSystemIndex] = useState(0);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getLocations((page, total) => !cancelled && setProgress({ page, total })).then(
      (data) => !cancelled && setLocations(data)
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setTradeProgress("Loading trade data for this map...");
    getAllCommodityPrices((done, total) => !cancelled && setTradeProgress(`Loading trade data... ${done}/${total}`))
      .then((data) => !cancelled && setCommodities(data))
      .finally(() => !cancelled && setTradeProgress(""));
    return () => {
      cancelled = true;
    };
  }, []);

  const systems = useMemo(() => (locations ? buildSystemMap(locations) : []), [locations]);
  const tradeIndex = useMemo(() => (commodities ? buildLocationTradeIndex(commodities) : new Map()), [commodities]);

  const highlightUuids = useMemo(() => (highlight ? highlight.split(",").filter(Boolean) : []), [highlight]);

  // Jump to whichever system tab actually contains the first highlighted
  // location once systems are loaded (e.g. arriving from a Trade Routes link).
  useEffect(() => {
    if (!highlightUuids.length || !systems.length) return;
    const idx = systems.findIndex((s) => s.bodies.some((b) => b.uuid === highlightUuids[0] || b.children.some((c) => c.uuid === highlightUuids[0])));
    if (idx >= 0) setSystemIndex(idx);
  }, [systems, highlightUuids]);

  if (!locations) {
    return html`<div class="loading">Loading starmap locations... page ${progress.page || 1} of ${progress.total}</div>`;
  }

  const system = systems[systemIndex];
  const bodyPositions = system ? ringPositions(CENTER, BODY_RADIUS, system.bodies.length) : [];

  // Flat lookup of every rendered node's uuid -> screen position, used to
  // find highlighted points and draw a connecting line between them.
  const pointByUuid = new Map();
  if (system) {
    system.bodies.forEach((body, i) => {
      pointByUuid.set(body.uuid, bodyPositions[i]);
      const childPositions = ringPositions(bodyPositions[i], CHILD_RADIUS, Math.max(body.children.length, 1));
      body.children.forEach((child, j) => pointByUuid.set(child.uuid, childPositions[j]));
    });
  }

  const highlightPoints = highlightUuids.map((uuid) => pointByUuid.get(uuid)).filter(Boolean);
  const missingHighlight = highlightUuids.length > highlightPoints.length && highlightPoints.length > 0;

  const selectedInfo = selected
    ? system?.bodies.find((b) => b.uuid === selected) || system?.bodies.flatMap((b) => b.children).find((c) => c.uuid === selected)
    : null;
  const selectedTrades = selected ? tradeIndex.get(selected) || [] : [];

  return html`
    <div>
      <div class="toolbar">
        ${systems.map(
          (s, i) => html`
            <button key=${s.name} class=${`btn ${i === systemIndex ? "active" : ""}`} onClick=${() => { setSystemIndex(i); setSelected(null); }}>
              ${s.name}
            </button>
          `
        )}
        ${tradeProgress && html`<span class="ship-meta">${tradeProgress}</span>`}
      </div>

      ${missingHighlight &&
      html`<div class="ship-meta" style=${{ marginBottom: "10px" }}>
        One of the highlighted trade locations is in a different system — switch tabs to see it.
      </div>`}

      <div style=${{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
        <svg
          viewBox=${`0 0 ${WIDTH} ${HEIGHT}`}
          style=${{ width: "100%", maxWidth: "640px", background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "8px" }}
        >
          ${highlightPoints.length === 2 &&
          html`<line
            x1=${highlightPoints[0].x} y1=${highlightPoints[0].y}
            x2=${highlightPoints[1].x} y2=${highlightPoints[1].y}
            stroke="var(--accent-2)" stroke-width="2" stroke-dasharray="6,6"
          />`}

          <circle cx=${CENTER.x} cy=${CENTER.y} r="18" fill="#f5d76e" />
          <text x=${CENTER.x} y=${CENTER.y + 34} text-anchor="middle" fill="var(--text)" font-size="13">${system?.starName || ""}</text>

          ${system?.bodies.map((body, i) => {
            const pos = bodyPositions[i];
            const isHighlighted = highlightUuids.includes(body.uuid);
            const childPositions = ringPositions(pos, CHILD_RADIUS, Math.max(body.children.length, 1));
            return html`
              <g key=${body.uuid}>
                <line x1=${CENTER.x} y1=${CENTER.y} x2=${pos.x} y2=${pos.y} stroke="var(--border)" stroke-width="1" />
                <circle
                  cx=${pos.x} cy=${pos.y} r=${isHighlighted ? 14 : 10}
                  fill=${isHighlighted ? "var(--accent-2)" : "var(--accent)"}
                  style=${{ cursor: "pointer" }}
                  onClick=${() => setSelected(body.uuid)}
                />
                <text x=${pos.x} y=${pos.y - 16} text-anchor="middle" fill="var(--text)" font-size="12">${body.name}</text>
                ${body.children.map((child, j) => {
                  const cpos = childPositions[j];
                  const childHighlighted = highlightUuids.includes(child.uuid);
                  return html`
                    <g key=${child.uuid}>
                      <line x1=${pos.x} y1=${pos.y} x2=${cpos.x} y2=${cpos.y} stroke="var(--border)" stroke-width="1" />
                      <circle
                        cx=${cpos.x} cy=${cpos.y} r=${childHighlighted ? 8 : 5}
                        fill=${childHighlighted ? "var(--accent-2)" : "var(--text-dim)"}
                        style=${{ cursor: "pointer" }}
                        onClick=${() => setSelected(child.uuid)}
                      />
                    </g>
                  `;
                })}
              </g>
            `;
          })}
        </svg>

        <div style=${{ flex: "1", minWidth: "260px" }}>
          ${selectedInfo
            ? html`
                <section class="panel">
                  <h2>${selectedInfo.name}</h2>
                  <div class="ship-meta">${selectedInfo.type?.classification || "—"}</div>
                  <p style=${{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
                    ${(selectedInfo.description || "").split("\n")[0].slice(0, 220)}
                  </p>
                  ${selectedTrades.length > 0
                    ? html`
                        <table>
                          <thead><tr><th>Commodity</th><th class="num">Buy</th><th class="num">Sell</th></tr></thead>
                          <tbody>
                            ${selectedTrades.map(
                              (t, i) => html`<tr key=${i}><td>${t.name}</td><td class="num">${t.buy ? fmt(t.buy) : "—"}</td><td class="num">${t.sell ? fmt(t.sell) : "—"}</td></tr>`
                            )}
                          </tbody>
                        </table>
                      `
                    : html`<div class="ship-meta">No trade terminal data for this location.</div>`}
                </section>
              `
            : html`<div class="empty">Click a body or station to see details and what's traded there.</div>`}
        </div>
      </div>

      <div class="footer-note">
        This is a schematic diagram, not a to-scale map — the API has no real coordinates, so bodies are arranged
        evenly around their star/planet rather than at accurate distances. Outposts and asteroid fields are hidden to
        keep the diagram readable.
      </div>
    </div>
  `;
}
