import { getVehicleList, getItemsByType, ITEM_TYPES } from "./api.js";
import { getAllCommodityPrices } from "./tradeApi.js";
import { getLocations } from "./starmapApi.js";
import { getLatestCommLinks } from "./commLinksApi.js";

// Every data source the app's tabs pull from, fetched once up front so
// visiting any tab afterward is instant — otherwise each tab pays its own
// "first visit" cache-miss cost independently, and three different tabs
// (Trade Routes, Mining, Star Map) all happen to share the same commodity
// price fetch anyway. Grouped to match the app's tabs rather than one row
// per HTTP request, so the splash reads as "Fleet, Parts, Trade, Map,
// News" instead of a dozen near-identical progress bars for each of the 8
// item types.
export async function preloadEverything(onProgress) {
  const state = {
    fleet: { label: "Fleet Database", done: 0, total: 1 },
    parts: { label: "Parts Catalog", done: 0, total: 1 },
    commodities: { label: "Trade & Mining Prices", done: 0, total: 1 },
    locations: { label: "Star Map Locations", done: 0, total: 1 },
    patchNotes: { label: "Patch Notes", done: 0, total: 1 },
  };
  const emit = () => onProgress?.(Object.values(state));

  const partsTypes = Object.keys(ITEM_TYPES);
  const partsProgress = new Map(partsTypes.map((type) => [type, { done: 0, total: 1 }]));
  function updateParts() {
    let done = 0;
    let total = 0;
    for (const v of partsProgress.values()) {
      done += v.done;
      total += v.total;
    }
    state.parts = { label: "Parts Catalog", done, total: total || 1 };
    emit();
  }

  await Promise.allSettled([
    getVehicleList((page, total) => {
      state.fleet = { label: "Fleet Database", done: page, total };
      emit();
    }),
    ...partsTypes.map((type) =>
      getItemsByType(type, (page, total) => {
        partsProgress.set(type, { done: page, total });
        updateParts();
      })
    ),
    getAllCommodityPrices((done, total) => {
      state.commodities = { label: "Trade & Mining Prices", done, total };
      emit();
    }),
    getLocations((page, total) => {
      state.locations = { label: "Star Map Locations", done: page, total };
      emit();
    }),
    getLatestCommLinks(2).then(() => {
      state.patchNotes = { label: "Patch Notes", done: 1, total: 1 };
      emit();
    }),
  ]);
}
