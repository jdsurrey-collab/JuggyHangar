import { cachedGet } from "./api.js";

// Comm-links live under /api/comm-links, not /api/v2/... like everything
// else this app fetches — a different, older part of the same wiki API.
const COMM_LINKS_URL = "https://api.star-citizen.wiki/api/comm-links";

// There are 6000+ comm-links going back years; a "what's new" feed only
// ever needs the first page or two (already newest-first), so this
// deliberately does NOT walk the full archive the way fetchAllPages does
// for catalogs.
export async function getLatestCommLinks(pages = 2) {
  const results = [];
  for (let page = 1; page <= pages; page++) {
    const qs = new URLSearchParams({ "page[number]": page, per_page: 30 });
    const json = await cachedGet(`${COMM_LINKS_URL}?${qs}`);
    results.push(...(json.data || []));
    if (page >= (json.meta?.last_page || 1)) break;
  }
  return results;
}

// The translation blob repeats the title as its first line — strip that
// so the preview doesn't show the title twice.
export function previewText(commLink, maxLength = 320) {
  const full = commLink.translations?.en_EN || "";
  const withoutTitle = full.startsWith(commLink.title) ? full.slice(commLink.title.length) : full;
  const trimmed = withoutTitle.replace(/^\s+/, "");
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}
