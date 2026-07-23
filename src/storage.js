// Personal "My Hangar" persistence: saved ships + the loadout the user picked
// for each. Stored client-side in localStorage — this is user-owned data, not
// API cache, so it doesn't belong in the IndexedDB cache used by api.js.

const KEY = "sc-hangar-my-fleet-v1";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function writeAll(entries) {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export function newHangarId() {
  return `hg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listHangarEntries() {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getHangarEntry(id) {
  return readAll().find((e) => e.id === id) || null;
}

export function saveHangarEntry(entry) {
  const entries = readAll();
  const idx = entries.findIndex((e) => e.id === entry.id);
  const now = Date.now();
  const record = { ...entry, updatedAt: now, createdAt: entry.createdAt || now };
  if (idx >= 0) entries[idx] = record;
  else entries.push(record);
  writeAll(entries);
  return record;
}

export function removeHangarEntry(id) {
  writeAll(readAll().filter((e) => e.id !== id));
}
