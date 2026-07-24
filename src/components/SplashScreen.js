import { html } from "../html.js";

export function SplashScreen({ progress }) {
  const overallFraction = progress.length
    ? progress.reduce((sum, p) => sum + (p.total ? Math.min(1, p.done / p.total) : 0), 0) / progress.length
    : 0;
  const overallPct = Math.round(overallFraction * 100);

  return html`
    <div
      style=${{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "22px",
        padding: "24px",
      }}
    >
      <div style=${{ fontSize: "1.8rem", fontWeight: 700, letterSpacing: "0.02em" }}>
        JUGGY <span style=${{ color: "var(--accent)" }}>HANGAR</span>
      </div>
      <div class="ship-meta">Loading live data from star-citizen.wiki...</div>

      <div style=${{ width: "100%", maxWidth: "460px" }}>
        ${progress.map((p, i) => {
          const pct = Math.min(100, Math.round(((p.done || 0) / (p.total || 1)) * 100));
          return html`
            <div key=${i} style=${{ marginBottom: "12px" }}>
              <div
                style=${{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.78rem",
                  color: "var(--text-dim)",
                  marginBottom: "4px",
                }}
              >
                <span>${p.label}</span>
                <span>${pct >= 100 ? "done" : `${p.done || 0}/${p.total || 1}`}</span>
              </div>
              <div style=${{ height: "6px", background: "var(--bg-panel-alt)", borderRadius: "3px", overflow: "hidden" }}>
                <div
                  style=${{
                    height: "100%",
                    width: `${pct}%`,
                    background: "var(--accent)",
                    transition: "width 0.2s ease",
                  }}
                ></div>
              </div>
            </div>
          `;
        })}
      </div>

      <div class="ship-meta" style=${{ fontSize: "0.75rem" }}>${overallPct}%</div>
    </div>
  `;
}
