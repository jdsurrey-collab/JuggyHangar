import { fetchAllPages } from "./api.js";

export async function getLocations(onProgress) {
  return fetchAllPages("/locations", {}, onProgress);
}

// The API has no x/y/z coordinates anywhere — this is a schematic diagram
// (star at center, bodies ranked around it, their own satellites ranked
// around them), not a to-scale map. Outposts/asteroids are excluded; there
// are thousands of them and including them would bury the handful of major
// bodies and trade hubs that actually matter here.
const MAP_CLASSIFICATIONS = new Set(["Planet", "Moon", "Manmade", "Settlement"]);

export function buildSystemMap(locations) {
  const visible = locations.filter(
    (loc) =>
      !loc.hide_in_starmap &&
      MAP_CLASSIFICATIONS.has(loc.type?.classification) &&
      loc.name &&
      !loc.name.includes("UNINITIALIZED")
  );

  const bySystem = new Map();
  for (const loc of visible) {
    const sys = loc.system || "Unknown System";
    if (!bySystem.has(sys)) bySystem.set(sys, []);
    bySystem.get(sys).push(loc);
  }

  const systems = [];
  for (const [name, locs] of bySystem) {
    const byUuid = new Map(locs.map((l) => [l.uuid, l]));
    const topLevel = locs.filter((l) => !l.parent || !byUuid.has(l.parent.uuid));
    const childrenByParent = new Map();
    for (const l of locs) {
      if (l.parent && byUuid.has(l.parent.uuid)) {
        if (!childrenByParent.has(l.parent.uuid)) childrenByParent.set(l.parent.uuid, []);
        childrenByParent.get(l.parent.uuid).push(l);
      }
    }
    systems.push({
      name,
      starName: locs[0]?.star?.name || name,
      bodies: topLevel
        .map((body) => ({ ...body, children: childrenByParent.get(body.uuid) || [] }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  }
  return systems.sort((a, b) => b.bodies.length - a.bodies.length);
}

// Index of location uuid -> commodities tradeable there, built from the
// same per-commodity pricing data the Trade Routes page already fetches
// (so the map can answer "what's bought/sold here" without a separate
// per-location API call, which doesn't exist anyway).
export function buildLocationTradeIndex(commodities) {
  const index = new Map();
  for (const commodity of commodities) {
    for (const p of commodity.uex_prices?.purchase || []) {
      const uuid = p.starmap_location?.uuid;
      if (!uuid) continue;
      if (!index.has(uuid)) index.set(uuid, []);
      index.get(uuid).push({
        name: commodity.name,
        buy: p.price_buy > 0 ? p.price_buy : null,
        sell: p.price_sell > 0 ? p.price_sell : null,
      });
    }
  }
  return index;
}
