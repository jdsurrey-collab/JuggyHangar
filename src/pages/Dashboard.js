import { html } from "../html.js";
import { PageGrid } from "../components/PageGrid.js";

export function Dashboard() {
  return html`
    <div>
      <div style=${{ marginBottom: "24px" }}>
        <h1 style=${{ margin: "0 0 6px" }}>Welcome to Juggy Hangar</h1>
        <div class="ship-meta">Pick a tool to get started.</div>
      </div>
      <${PageGrid} current="/" />
    </div>
  `;
}
