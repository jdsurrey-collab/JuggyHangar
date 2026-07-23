import { html } from "./html.js";
import { useHashRoute, matchRoute, navigate } from "./router.js";
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

function NavLink({ to, current, children }) {
  const active = current === to || (to !== "/" && current.startsWith(to));
  return html`
    <a
      class=${active ? "active" : ""}
      href=${`#${to}`}
      onClick=${(e) => {
        e.preventDefault();
        navigate(to);
      }}
    >
      ${children}
    </a>
  `;
}

export function App() {
  const path = useHashRoute();

  let page;
  let shipParams;
  if (path === "/" || path === "/ships") {
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
  } else {
    page = html`<div class="empty">Unknown route: ${path}</div>`;
  }

  return html`
    <div class="app-shell">
      <div class="topnav">
        <div class="brand">JUGGY <span>HANGAR</span></div>
        <nav>
          <${NavLink} to="/ships" current=${path}>Fleet<//>
          <${NavLink} to="/tier-list" current=${path}>Tier List<//>
          <${NavLink} to="/compare" current=${path}>Compare<//>
          <${NavLink} to="/parts" current=${path}>Parts Catalog<//>
          <${NavLink} to="/mining" current=${path}>Mining<//>
          <${NavLink} to="/trades" current=${path}>Trade Routes<//>
          <${NavLink} to="/map" current=${path}>Star Map<//>
          <${NavLink} to="/hangar" current=${path}>My Hangar<//>
        </nav>
        <div class="patch">data: star-citizen.wiki (live patch)</div>
      </div>
      <main>${page}</main>
    </div>
  `;
}
