import { useEffect, useState } from "react";
import { html } from "../html.js";
import { getVehicleDetail } from "../api.js";
import { LoadoutOptimizer } from "../components/LoadoutOptimizer.js";
import { navigate } from "../router.js";

const SYSTEM_TYPES = ["Shield", "PowerPlant", "Cooler", "QuantumDrive"];

function localized(field) {
  if (field == null) return "";
  if (typeof field === "string") return field;
  return field.en_EN || Object.values(field)[0] || "";
}

function StatBox({ label, value, unit }) {
  return html`
    <div class="stat-box">
      <div class="label">${label}</div>
      <div class="value">${value}${unit ? html` <small>${unit}</small>` : null}</div>
    </div>
  `;
}

export function ShipDetail({ className, hangarId }) {
  const [vehicle, setVehicle] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setVehicle(null);
    setError(null);
    getVehicleDetail(className)
      .then((data) => !cancelled && setVehicle(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [className]);

  if (error) return html`<div class="empty">Failed to load ship: ${error}</div>`;
  if (!vehicle) return html`<div class="loading">Loading ship data...</div>`;

  const img = vehicle.images?.[0]?.original_url || vehicle.images?.[0]?.thumbnail_url;
  const systems = (vehicle.ports || []).filter((p) => SYSTEM_TYPES.includes(p.type));

  return html`
    <div>
      <button
        class="btn"
        onClick=${() => navigate(hangarId ? "/hangar" : "/ships")}
        style=${{ marginBottom: "16px" }}
      >← Back to ${hangarId ? "My Hangar" : "Fleet"}</button>

      <div class="detail-header">
        ${img && html`<img src=${img} alt=${vehicle.name} />`}
        <div class="info">
          <h1>${vehicle.name}</h1>
          <div class="sub">
            ${vehicle.manufacturer?.name} · ${vehicle.career} ${vehicle.role ? `/ ${vehicle.role}` : ""} ·
            Size ${vehicle.size_class}
          </div>
          <p>${localized(vehicle.game_description) || localized(vehicle.description)}</p>
        </div>
      </div>

      <div class="stat-grid">
        <${StatBox} label="SCM Speed" value=${Math.round(vehicle.speed?.scm ?? 0)} unit="m/s" />
        <${StatBox} label="Max Speed" value=${Math.round(vehicle.speed?.max ?? 0)} unit="m/s" />
        <${StatBox} label="Hull HP" value=${Math.round(vehicle.health ?? 0).toLocaleString()} />
        <${StatBox} label="Shield HP" value=${Math.round(vehicle.shield_hp ?? 0).toLocaleString()} />
        <${StatBox} label="Pilot DPS" value=${Math.round(vehicle.weaponry?.pilot_dps ?? 0).toLocaleString()} />
        <${StatBox} label="Pilot Alpha" value=${Math.round(vehicle.weaponry?.pilot_alpha ?? 0).toLocaleString()} />
        <${StatBox} label="Mass" value=${Math.round(vehicle.mass ?? 0).toLocaleString()} unit="kg" />
        <${StatBox} label="Cargo" value=${vehicle.cargo_capacity ?? 0} unit="SCU" />
        <${StatBox} label="Crew" value=${`${vehicle.crew?.min ?? "?"}–${vehicle.crew?.max ?? "?"}`} />
        <${StatBox} label="Quantum Speed" value=${Math.round((vehicle.quantum?.quantum_speed ?? 0) / 1000000)} unit="Mm/s" />
      </div>

      <section class="panel">
        <h2>Ship Systems</h2>
        <table>
          <thead>
            <tr><th>System</th><th>Size</th><th>Equipped</th><th>Manufacturer</th></tr>
          </thead>
          <tbody>
            ${systems.map(
              (p, i) => html`
                <tr key=${i}>
                  <td>${p.type}</td>
                  <td>S${p.sizes?.max ?? "?"}</td>
                  <td>${p.equipped_item?.name || "empty"}</td>
                  <td>${p.equipped_item?.manufacturer?.name || "—"}</td>
                </tr>
              `
            )}
          </tbody>
        </table>
      </section>

      <${LoadoutOptimizer} vehicle=${vehicle} hangarId=${hangarId} />

      <div class="footer-note">
        Data sourced live from api.star-citizen.wiki, version ${vehicle.version}.
      </div>
    </div>
  `;
}
