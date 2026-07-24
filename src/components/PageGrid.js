import { html } from "../html.js";
import { PAGES } from "../pages.js";
import { navigate } from "../router.js";

export function PageGrid({ current, onNavigate, compact }) {
  return html`
    <div
      class="page-grid"
      style=${{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? "140px" : "200px"}, 1fr))`,
        gap: compact ? "8px" : "16px",
      }}
    >
      ${PAGES.map((p) => {
        const active = current === p.path || (current || "").startsWith(`${p.path}/`);
        return html`
          <div
            key=${p.path}
            class="card"
            style=${{
              cursor: "pointer",
              alignItems: compact ? "flex-start" : "center",
              textAlign: compact ? "left" : "center",
              padding: compact ? "10px" : "20px 14px",
              borderColor: active ? "var(--accent)" : undefined,
              gap: compact ? "2px" : "8px",
            }}
            onClick=${() => {
              navigate(p.path);
              onNavigate?.();
            }}
          >
            <div style=${{ fontSize: compact ? "1.3rem" : "2rem" }}>${p.icon}</div>
            <div class="ship-name" style=${{ fontSize: compact ? "0.85rem" : "1rem" }}>${p.label}</div>
            ${!compact && html`<div class="ship-meta">${p.desc}</div>`}
          </div>
        `;
      })}
    </div>
  `;
}
