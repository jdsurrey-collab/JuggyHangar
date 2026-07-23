import { useMemo, useState } from "react";
import { html } from "../html.js";
import { decodeShareCode } from "../share.js";
import { newHangarId, saveHangarEntry } from "../storage.js";
import { navigate } from "../router.js";
import { gunMetrics, missileMetrics } from "../loadout.js";

export function ImportBuild({ code }) {
  const [saved, setSaved] = useState(false);

  const decoded = useMemo(() => {
    try {
      return { data: decodeShareCode(code), error: null };
    } catch (err) {
      return { data: null, error: "This share link looks corrupted or was created by a different version of the app." };
    }
  }, [code]);

  if (decoded.error) {
    return html`<div class="empty">${decoded.error}</div>`;
  }

  const build = decoded.data;

  function handleImport() {
    const entry = saveHangarEntry({
      id: newHangarId(),
      className: build.className,
      shipName: build.shipName,
      shipImage: build.shipImage,
      nickname: build.nickname,
      slots: build.slots,
    });
    setSaved(true);
    navigate(`/ships/${encodeURIComponent(entry.className)}/${entry.id}`);
  }

  return html`
    <div>
      <section class="panel">
        <h2>Import Shared Build</h2>
        <div class="detail-header">
          ${build.shipImage && html`<img src=${build.shipImage} alt=${build.shipName} style=${{ width: "220px" }} />`}
          <div class="info">
            <h1>${build.nickname}</h1>
            <div class="sub">${build.shipName}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr><th>Hardpoint</th><th class="num">Size</th><th>Item</th><th class="num">Stats</th></tr>
          </thead>
          <tbody>
            ${build.slots.map((s, i) => {
              const stats = !s.item
                ? "—"
                : s.type === "WeaponGun"
                ? `${gunMetrics(s.item).dps.toFixed(1)} DPS`
                : s.type === "Missile"
                ? `${missileMetrics(s.item).damage.toLocaleString()} dmg`
                : "—";
              return html`
                <tr key=${i}>
                  <td>${s.label}</td>
                  <td class="num">S${s.size}</td>
                  <td>${s.item?.name || "empty"}</td>
                  <td class="num">${stats}</td>
                </tr>
              `;
            })}
          </tbody>
        </table>

        <div class="toolbar" style=${{ marginTop: "16px" }}>
          <button class="btn active" onClick=${handleImport}>Add to My Hangar</button>
          ${saved && html`<span class="ship-meta">Saved!</span>`}
        </div>
      </section>
    </div>
  `;
}
