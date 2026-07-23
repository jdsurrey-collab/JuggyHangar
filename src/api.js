export const BASE = "https://api.star-citizen.wiki/api/v2";
const TTL_MS = 12 * 60 * 60 * 1000; // matches upstream cache-control: 12h
const DB_NAME = "sc-hangar-cache";
const STORE = "responses";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "url" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function cacheRead(url) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(url);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function cacheWrite(url, data) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ url, data, ts: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* best-effort cache, ignore failures (e.g. private browsing) */
  }
}

export async function cachedGet(url) {
  const cached = await cacheRead(url);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.data;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    const data = await res.json();
    cacheWrite(url, data);
    return data;
  } catch (err) {
    if (cached) return cached.data; // stale-while-error fallback
    throw err;
  }
}

function encodeFilters(params) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) qs.set(key, value);
  return qs.toString();
}

export async function fetchAllPages(path, params = {}, onProgress) {
  const results = [];
  let page = 1;
  let lastPage = 1;
  do {
    const qs = encodeFilters({ ...params, "page[number]": page });
    const json = await cachedGet(`${BASE}${path}?${qs}`);
    results.push(...(json.data || []));
    lastPage = json.meta?.last_page || 1;
    if (onProgress) onProgress(page, lastPage);
    page += 1;
  } while (page <= lastPage);
  return results;
}

export async function getVehicleList(onProgress) {
  return fetchAllPages("/vehicles", {}, onProgress);
}

export async function getVehicleDetail(className) {
  const json = await cachedGet(`${BASE}/vehicles/${encodeURIComponent(className)}`);
  return json.data;
}

// filter[type] values seen on the live API: WeaponGun, Turret, Missile,
// MissileLauncher, Shield, PowerPlant, Cooler, QuantumDrive
export async function getItemsByType(type, onProgress) {
  return fetchAllPages("/items", { "filter[type]": type }, onProgress);
}

export const ITEM_TYPES = {
  WeaponGun: "Guns",
  Turret: "Turrets",
  Missile: "Missiles",
  MissileLauncher: "Missile Racks",
  Shield: "Shields",
  PowerPlant: "Power Plants",
  Cooler: "Coolers",
  QuantumDrive: "Quantum Drives",
};

export async function clearCache() {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
