import { useEffect, useMemo, useState } from "react";
import { html } from "../html.js";
import { getLatestCommLinks, previewText } from "../commLinksApi.js";

export function PatchNotes() {
  const [links, setLinks] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    getLatestCommLinks(2).then((data) => !cancelled && setLinks(data));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!links) return [];
    const q = search.trim().toLowerCase();
    return q ? links.filter((l) => l.title.toLowerCase().includes(q)) : links;
  }, [links, search]);

  if (!links) {
    return html`<div class="loading">Loading the latest from RSI...</div>`;
  }

  return html`
    <div>
      <div class="toolbar">
        <input type="text" placeholder="Search patch notes..." value=${search} onInput=${(e) => setSearch(e.target.value)} />
        <span class="pill">${filtered.length} posts</span>
      </div>

      ${filtered.map(
        (link) => html`
          <section class="panel" key=${link.id}>
            <h2 style=${{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}>
              <span>${link.title}</span>
              <span class="ship-meta" style=${{ fontWeight: 400 }}>${link.created_at_human}</span>
            </h2>
            <div class="toolbar" style=${{ marginBottom: "10px" }}>
              <span class="pill">${link.channel}</span>
              ${link.category && link.category !== "Undefined" && html`<span class="pill">${link.category}</span>`}
            </div>
            <p style=${{ color: "var(--text-dim)", whiteSpace: "pre-line" }}>${previewText(link)}</p>
            <a href=${link.rsi_url} target="_blank" rel="noreferrer">Read full post on RSI ↗</a>
          </section>
        `
      )}

      <div class="footer-note">
        Pulled live from Roberts Space Industries' official comm-links via star-citizen.wiki.
      </div>
    </div>
  `;
}
