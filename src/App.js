import { useEffect, useState } from "react";
import { html } from "./html.js";
import { useHashRoute, matchRoute, navigate } from "./router.js";
import { preloadEverything } from "./preload.js";
import { SplashScreen } from "./components/SplashScreen.js";
import { PageGrid } from "./components/PageGrid.js";
import { Dashboard } from "./pages/Dashboard.js";
import { ShipList } from "./pages/ShipList.js";
import { ShipDetail } from "./pages/ShipDetail.js";
import { PartsBrowser } from "./pages/PartsBrowser.js";
import { MyHangar } from "./pages/MyHangar.js";
import { ImportBuild } from "./pages/ImportBuild.js";
import { ShipCompare } from "./pages/ShipCompare.js";
import { TradeRoutes } from "./pages/TradeRoutes.js";
import { TierList } from "./pages/TierList.js";
import { Mining } from "./pages/Mining.js";
import { StarMap } from "./pages/StarMap.js";
import { PatchNotes } from "./pages/PatchNotes.js";

function GridMenuButton({ path }) {
  const [open, setOpen] = useState(false);
  return html`
    <div style=${{ position: "relative" }}>
      <button
        class=${`btn ${open ? "active" : ""}`}
        title="All pages"
        aria-label="Open page menu"
        onClick=${() => setOpen((o) => !o)}
        style=${{ fontSize: "1.1rem", lineHeight: 1, padding: "6px 10px" }}
      >▦</button>
      ${open &&
      html`<div
        onClick=${() => setOpen(false)}
        style=${{ position: "fixed", inset: 0, zIndex: 40 }}
      ></div>`}
      ${open &&
      html`
        <div
          style=${{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 41,
            background: "var(--bg-panel-alt)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "12px",
            width: "440px",
            maxWidth: "80vw",
            boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
          }}
        >
          <${PageGrid} current=${path} compact=${true} onNavigate=${() => setOpen(false)} />
        </div>
      `}
    </div>
  `;
}

export function App() {
  const path = useHashRoute();
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState([]);

  useEffect(() => {
    let cancelled = false;
    preloadEverything((list) => !cancelled && setProgress(list)).finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return html`<${SplashScreen} progress=${progress} />`;
  }

  let page;
  let shipParams;
  if (path === "/") {
    page = html`<${Dashboard} />`;
  } else if (path === "/ships") {
    page = html`<${ShipList} />`;
  } else if ((shipParams = matchRoute("/ships/:className/:hangarId", path))) {
    page = html`<${ShipDetail} className=${shipParams.className} hangarId=${shipParams.hangarId} />`;
  } else if ((shipParams = matchRoute("/ships/:className", path))) {
    page = html`<${ShipDetail} className=${shipParams.className} />`;
  } else if (path.startsWith("/hangar")) {
    page = html`<${MyHangar} />`;
  } else if ((shipParams = matchRoute("/compare/:classNames", path))) {
    page = html`<${ShipCompare} classNames=${shipParams.classNames} />`;
  } else if (path === "/compare") {
    page = html`<${ShipCompare} />`;
  } else if ((shipParams = matchRoute("/import/:code", path))) {
    page = html`<${ImportBuild} code=${shipParams.code} />`;
  } else if (path.startsWith("/parts")) {
    page = html`<${PartsBrowser} />`;
  } else if (path.startsWith("/trades")) {
    page = html`<${TradeRoutes} />`;
  } else if (path === "/tier-list") {
    page = html`<${TierList} />`;
  } else if (path === "/mining") {
    page = html`<${Mining} />`;
  } else if ((shipParams = matchRoute("/map/:highlight", path))) {
    page = html`<${StarMap} highlight=${shipParams.highlight} />`;
  } else if (path === "/map") {
    page = html`<${StarMap} />`;
  } else if (path === "/whats-new") {
    page = html`<${PatchNotes} />`;
  } else {
    page = html`<div class="empty">Unknown route: ${path}</div>`;
  }

  return html`
    <div class="app-shell">
      <div class="topnav">
        <${GridMenuButton} path=${path} />
        <div class="brand" style=${{ cursor: "pointer" }} onClick=${() => navigate("/")}>
          JUGGY <span>HANGAR</span>
        </div>
        <div style=${{ flex: 1 }}></div>
        <div class="patch">data: star-citizen.wiki (live patch)</div>
      </div>
      <main>${page}</main>
    </div>
  `;
}
