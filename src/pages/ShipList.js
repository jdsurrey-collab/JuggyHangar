import { useEffect, useMemo, useState } from "react";
import { html } from "../html.js";
import { getVehicleList } from "../api.js";
import { combatRating } from "../loadout.js";
import { navigate } from "../router.js";

const SORTS = {
  name: { label: "Name", get: (v) => v.name || "" },
  rating: { label: "Combat Score", get: (v) => combatRating(v) },
  dps: { label: "Pilot DPS", get: (v) => v.weaponry?.pilot_dps ?? 0 },
  alpha: { label: "Pilot Alpha", get: (v) => v.weaponry?.pilot_alpha ?? 0 },
  speed: { label: "SCM Speed", get: (v) => v.speed?.scm ?? 0 },
  hp: { label: "Hull + Shield HP", get: (v) => (v.health ?? 0) + (v.shield_hp ?? 0) },
  mass: { label: "Mass", get: (v) => v.mass ?? 0 },
};

export function ShipList() {
  const [ships, setShips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ page: 0, total: 1 });
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [manufacturer, setManufacturer] = useState("all");
  const [career, setCareer] = useState("all");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [compareSet, setCompareSet] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getVehicleList((page, total) => {
      if (!cancelled) setProgress({ page, total });
    })
      .then((data) => {
        if (!cancelled) setShips(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const manufacturers = useMemo(() => {
    const names = new Set(ships.map((s) => s.manufacturer?.name).filter(Boolean));
    return Array.from(names).sort();
  }, [ships]);

  const careers = useMemo(() => {
    const names = new Set(ships.map((s) => s.career).filter(Boolean));
    return Array.from(names).sort();
  }, [ships]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = ships.filter((s) => {
      if (q && !`${s.name} ${s.manufacturer?.name || ""}`.toLowerCase().includes(q)) return false;
      if (manufacturer !== "all" && s.manufacturer?.name !== manufacturer) return false;
      if (career !== "all" && s.career !== career) return false;
      return true;
    });
    const sort = SORTS[sortKey];
    list = list.slice().sort((a, b) => {
      const av = sort.get(a);
      const bv = sort.get(b);
      if (typeof av === "string") return av.localeCompare(bv) * (sortDir === "asc" ? 1 : -1);
      return (av - bv) * (sortDir === "asc" ? 1 : -1);
    });
    return list;
  }, [ships, search, manufacturer, career, sortKey, sortDir]);

  if (error) {
    return html`<div class="empty">Failed to load ships: ${error}</div>`;
  }

  function toggleCompare(className) {
    setCompareSet((prev) =>
      prev.includes(className) ? prev.filter((cn) => cn !== className) : prev.length < 4 ? [...prev, className] : prev
    );
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
        <select value=${manufacturer} onChange=${(e) => setManufacturer(e.target.value)}>
          <option value="all">All manufacturers</option>
          ${manufacturers.map((m) => html`<option value=${m}>${m}</option>`)}
        </select>
        <select value=${career} onChange=${(e) => setCareer(e.target.value)}>
          <option value="all">All careers</option>
          ${careers.map((c) => html`<option value=${c}>${c}</option>`)}
        </select>
        <select value=${sortKey} onChange=${(e) => setSortKey(e.target.value)}>
          ${Object.entries(SORTS).map(([key, s]) => html`<option value=${key}>Sort: ${s.label}</option>`)}
        </select>
        <button class="btn" onClick=${() => setSortDir(sortDir === "asc" ? "desc" : "asc")}>
          ${sortDir === "asc" ? "▲ Asc" : "▼ Desc"}
        </button>
        ${!loading && html`<span class="pill">${filtered.length} ships</span>`}
      </div>

      ${loading &&
      html`<div class="loading">
        Loading fleet database... page ${progress.page || 1} of ${progress.total}
      </div>`}

      ${!loading &&
      html`<div class="grid">
        ${filtered.map((s) => {
          const thumb = s.images?.[0]?.thumbnail_url;
          return html`
            <div
              key=${s.class_name}
              class="card"
              style=${{ cursor: "pointer" }}
              onClick=${() => navigate(`/ships/${encodeURIComponent(s.class_name)}`)}
            >
              ${thumb ? html`<img src=${thumb} alt=${s.name} />` : null}
              <div class="ship-name">${s.name}</div>
              <div class="ship-meta">
                ${s.manufacturer?.name || "Unknown"} · ${s.career || "—"} ${s.role ? `/ ${s.role}` : ""}
                <span class="badge-size">S${s.size_class ?? "?"}</span>
              </div>
              <div class="stat-row"><span>Combat Score</span><b>${combatRating(s).toFixed(1)}</b></div>
              <div class="stat-row"><span>SCM Speed</span><b>${Math.round(s.speed?.scm ?? 0)} m/s</b></div>
              <div class="stat-row"><span>Hull + Shield</span><b>${Math.round((s.health ?? 0) + (s.shield_hp ?? 0)).toLocaleString()}</b></div>
              <div class="stat-row"><span>Pilot DPS</span><b>${Math.round(s.weaponry?.pilot_dps ?? 0).toLocaleString()}</b></div>
              <label class="ship-meta" style=${{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked=${compareSet.includes(s.class_name)}
                  onClick=${(e) => e.stopPropagation()}
                  onChange=${() => toggleCompare(s.class_name)}
                />
                Compare
              </label>
            </div>
          `;
        })}
      </div>`}

      ${compareSet.length > 0 &&
      html`
        <div
          style=${{
            position: "fixed",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--bg-panel-alt)",
            border: "1px solid var(--border)",
            borderRadius: "999px",
            padding: "10px 18px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            zIndex: 30,
          }}
        >
          <span class="ship-meta">${compareSet.length} selected</span>
          <button class="btn active" onClick=${() => navigate(`/compare/${compareSet.join(",")}`)}>
            Compare Now
          </button>
          <button class="btn" onClick=${() => setCompareSet([])}>Clear</button>
        </div>
      `}
    </div>
  `;
}
