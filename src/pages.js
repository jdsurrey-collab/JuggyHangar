// Single source of truth for every top-level page, used by both the
// Dashboard (full-page grid) and the grid-menu overlay in App.js so they
// never drift out of sync with each other.
export const PAGES = [
  { path: "/ships", label: "Fleet", desc: "Browse every ship with live stats", icon: "🚀" },
  { path: "/tier-list", label: "Tier List", desc: "S/A/B/C/D rankings by role", icon: "🏆" },
  { path: "/compare", label: "Compare", desc: "Side-by-side ship stats", icon: "⚖" },
  { path: "/parts", label: "Parts Catalog", desc: "Weapons, shields, coolers, and more", icon: "🔧" },
  { path: "/mining", label: "Mining", desc: "Laser catalog and ore values", icon: "⛏" },
  { path: "/trades", label: "Trade Routes", desc: "Commodity buy/sell arbitrage", icon: "📈" },
  { path: "/map", label: "Star Map", desc: "Schematic system diagrams", icon: "🗺" },
  { path: "/hangar", label: "My Hangar", desc: "Your saved ships and loadouts", icon: "🛰" },
  { path: "/whats-new", label: "What's New", desc: "Latest official patch notes", icon: "📰" },
];
