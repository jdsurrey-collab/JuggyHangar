import { BASE, cachedGet, fetchAllPages } from "./api.js";

export async function getCommodityList(onProgress) {
  return fetchAllPages("/commodities", {}, onProgress);
}

export async function getCommodityDetail(slug) {
  const json = await cachedGet(`${BASE}/commodities/${encodeURIComponent(slug)}`);
  return json.data;
}

// The commodity list endpoint doesn't include uex_prices, only the detail
// endpoint does — so a full trade board needs one request per commodity
// (~200). Each is cached individually afterward (same 12h IndexedDB cache
// as the rest of the app), so this is only slow on a cold cache. Modest
// concurrency keeps a first load to a few seconds instead of ~200 * ~200ms
// done one at a time.
export async function getAllCommodityPrices(onProgress) {
  const list = await getCommodityList();
  const results = [];
  const concurrency = 6;
  let index = 0;
  let done = 0;

  async function worker() {
    while (index < list.length) {
      const i = index++;
      try {
        results.push(await getCommodityDetail(list[i].slug));
      } catch {
        // skip commodities that fail to load rather than aborting the whole board
      } finally {
        done++;
        if (onProgress) onProgress(done, list.length);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// Cheapest terminal to buy at + best terminal to sell at, independent of
// each other (this app doesn't have travel-time/distance data to weigh a
// true route, just the per-unit arbitrage).
export function bestTrade(commodity) {
  const purchases = commodity.uex_prices?.purchase || [];
  const buys = purchases.filter((p) => p.price_buy > 0);
  const sells = purchases.filter((p) => p.price_sell > 0);
  if (!buys.length || !sells.length) return null;
  const buy = buys.reduce((best, p) => (p.price_buy < best.price_buy ? p : best));
  const sell = sells.reduce((best, p) => (p.price_sell > best.price_sell ? p : best));
  const profit = sell.price_sell - buy.price_buy;
  return { buy, sell, profit, margin: buy.price_buy > 0 ? profit / buy.price_buy : null };
}

// Best place to sell, independent of whether the good is buyable anywhere.
// Mined raw materials refine into goods (Quantainium, etc.) that are
// mining-only — sellable at plenty of terminals but never purchasable from
// one — so bestTrade()'s buy+sell requirement always returns null for them.
export function bestSell(commodity) {
  const sells = (commodity.uex_prices?.purchase || []).filter((p) => p.price_sell > 0);
  if (!sells.length) return null;
  return sells.reduce((best, p) => (p.price_sell > best.price_sell ? p : best));
}
