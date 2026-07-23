// Encodes a hangar build into a compact, URL-safe code (and back) so it can
// be shared as a link. Items are pruned to just the fields the rest of the
// app actually reads (gunMetrics/missileMetrics + display name/size) —
// raw catalog items carry a lot of description/image/pricing bulk that would
// otherwise bloat the link.

function compactItem(item) {
  if (!item) return null;
  const compact = { uuid: item.uuid, name: item.name, size: item.size, type: item.type };
  if (item.vehicle_weapon) {
    compact.vehicle_weapon = { damage: item.vehicle_weapon.damage };
  }
  if (item.missile) {
    compact.missile = { damage_total: item.missile.damage_total };
  }
  if (item.resource_network?.usage) {
    compact.resource_network = { usage: item.resource_network.usage };
  }
  return compact;
}

export function encodeShareCode(entry) {
  const compact = {
    className: entry.className,
    shipName: entry.shipName,
    shipImage: entry.shipImage || null,
    nickname: entry.nickname,
    slots: entry.slots.map((s) => ({
      slotId: s.slotId,
      type: s.type,
      label: s.label,
      size: s.size,
      item: compactItem(s.item),
    })),
  };
  const json = JSON.stringify(compact);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeShareCode(code) {
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const json = decodeURIComponent(escape(atob(padded)));
  return JSON.parse(json);
}

export function buildShareUrl(entry) {
  const code = encodeShareCode(entry);
  return `${location.origin}${location.pathname}#/import/${code}`;
}
