(function () {
  "use strict";

  const fmt = (n, d = 2) => Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
  const esc = (s) => String(s ?? "Not recorded").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const KPI_DATA = [
    { label: "Total Uganda Road Network", value: "173,785.00 km", note: "National + District + Urban + Community Access" },
    { label: "National Road Network", value: "21,284.02 km", note: "Paved 6,406.69 km (30.10%) · Unpaved 14,877.33 km (69.90%)" },
    { label: "DUCAR Network Extent", value: "152,483.00 km", note: "District 41,194.00 km · Urban 33,755.00 km · CAR 75,404.00 km · KCCA 2,130.00 km" },
    { label: "Bridges (Authoritative)", value: "552 bridges", note: "Good 247 · Satisfactory 71 · Marginal 162 · Poor 52 · Critical 13 · UC 7" },
    { label: "Major Culverts (Authoritative)", value: "452 major culverts", note: "Good 403 · Satisfactory 39 · Marginal 4 · Poor 1 · Critical 4 · UC 1" },
    { label: "Administrative Coverage", value: "135 districts", note: "6 Maintenance Regions · 23 Maintenance Stations" }
  ];

  const CONDITION_BARS = [
    { label: "Good", km: 22286.23, pct: 12.83, color: "#16A34A" },
    { label: "Fair", km: 12794.15, pct: 7.36, color: "#0071E3" },
    { label: "Poor", km: 138678.33, pct: 79.81, color: "#DC2626" }
  ];

  const SURFACE_BARS = [
    { label: "Community Access Roads (DUCAR)", km: 75404.00, pct: 49.45, color: "#16A34A" },
    { label: "District Roads (DUCAR)", km: 41194.00, pct: 27.02, color: "#0071E3" },
    { label: "Urban Roads (DUCAR)", km: 33755.00, pct: 22.14, color: "#7C3AED" },
    { label: "KCCA Roads (DUCAR)", km: 2130.00, pct: 1.40, color: "#0D9488" },
    { label: "National Paved (Bituminous)", km: 6406.69, pct: 30.10, color: "#0284C7" },
    { label: "National Unpaved (Gravel / Earth)", km: 14877.33, pct: 69.90, color: "#D97706" }
  ];

  const QUALITY_ITEMS = [
    "DUCAR Network Extent: 152,483.00 km (District Roads 41,194.00 km, Urban Roads 33,755.00 km, Community Access Roads 75,404.00 km, KCCA 2,130.00 km).",
    "National Road Network authoritative baseline: 21,284.02 km (Paved 6,406.69 km / 30.10%; Unpaved 14,877.33 km / 69.90%).",
    "National Roads condition (FY 2025/26): Good 12,610.00 km (59.20%), Fair 7,844.00 km (36.82%), Poor 848.00 km (3.98%).",
    "Whole-of-Network condition (FY 2025/26): Good 22,286.23 km (12.83%), Fair 12,794.15 km (7.36%), Poor 138,678.33 km (79.81%).",
    "Structures register (01/10/2026): 552 bridges and 452 major culverts reported strictly in separate tables and charts."
  ];

  const CAVEATS = [
    "Condition assessments follow MOBICAP(Road condition assesment tool) and ROMDAS(Roughness and rutting machine based testing) protocols.",
    "All lengths are expressed strictly in metric kilometres (km) and percentages (%), with geographic coordinates in decimal degrees.",
    "All timelines project historic observations to Vision 2040 under strict view-only governance.",
    "NATIONAL TRANSPORT GIS ENTERPRISE (National Road Network), NATIONAL ROAD NETWORK ADMINISTRATION maintains authoritative ownership of all published figures."
  ];

  let allRows = [];
  let filteredRows = [];
  let page = 1;
  const pageSize = 50;
  let adminRows = [];
  let adminPage = 1;
  let mapInstance = null;

  function renderBars(containerId, items) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = items.map((item) => `
      <div class="bar-row">
        <div class="bar-row-head">
          <span>${esc(item.label)}</span>
          <span>${fmt(item.km, 2)} km (${fmt(item.pct, 2)}%)</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, item.pct)}%;background:${item.color}"></div></div>
      </div>
    `).join("");
  }

  function renderStatic() {
    const kpis = document.getElementById("kpis");
    if (kpis) {
      kpis.innerHTML = KPI_DATA.map((k) => `
        <article class="kpi-card">
          <small>${esc(k.label)}</small>
          <strong>${esc(k.value)}</strong>
          <span>${esc(k.note)}</span>
        </article>
      `).join("");
    }
    renderBars("condition-bars", CONDITION_BARS);
    renderBars("surface-bars", SURFACE_BARS);

    const ql = document.getElementById("quality-list");
    if (ql) ql.innerHTML = `<ul style="margin:8px 0 0;padding-left:18px;color:#334155;line-height:1.6">${QUALITY_ITEMS.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;

    const cv = document.getElementById("caveats");
    if (cv) cv.innerHTML = `<ul style="margin:8px 0 0;padding-left:18px;color:#334155;line-height:1.6">${CAVEATS.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;

    const upd = document.getElementById("updated");
    if (upd) upd.textContent = "24/11/2026";
  }

  async function fetchGzJson(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    if (url.endsWith(".gz") && typeof DecompressionStream !== "undefined") {
      const ds = new DecompressionStream("gzip");
      const text = await new Response(resp.body.pipeThrough(ds)).text();
      return JSON.parse(text);
    }
    return resp.json();
  }

  function initMap() {
    const mapEl = document.getElementById("map");
    if (!mapEl || !window.L || mapInstance) return;
    mapInstance = window.L.map(mapEl, { center: [1.3733, 32.2903], zoom: 7, preferCanvas: true });
    window.L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 18,
      attribution: "Imagery &copy; Esri"
    }).addTo(mapInstance);
    window.L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 18,
      attribution: "Labels &copy; Esri"
    }).addTo(mapInstance);
    window.L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 18,
      opacity: 0.85
    }).addTo(mapInstance);

    fetchGzJson("./data/ducar_map_preview.geojson.gz?v=20261123")
      .then((geo) => {
        if (!geo || !Array.isArray(geo.features)) return;
        window.L.geoJSON(geo, {
          style: (feature) => {
            const p = feature.properties || {};
            const cond = String(p.condition || "").toLowerCase();
            const paved = String(p.pavement_class || p.surface || "").toLowerCase().includes("paved") || String(p.surface || "").toLowerCase().includes("bitum");
            const color = cond === "good" ? "#16A34A" : cond === "fair" ? "#0071E3" : cond === "poor" ? "#DC2626" : "#D97706";
            return {
              color,
              weight: paved ? 2.6 : 1.5,
              dashArray: paved ? null : "4, 4",
              opacity: 0.9
            };
          }
        }).addTo(mapInstance);
      })
      .catch(() => {});
  }

  function populateSelect(id, values) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const first = sel.options[0] ? sel.options[0].outerHTML : "";
    sel.innerHTML = first + values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  }

  function applyFilters() {
    const q = (document.getElementById("link-search")?.value || "").trim().toLowerCase();
    const dist = document.getElementById("district-filter")?.value || "";
    const cond = document.getElementById("condition-filter")?.value || "";
    const surf = document.getElementById("surface-filter")?.value || "";
    const traf = document.getElementById("traffic-filter")?.value || "";

    filteredRows = allRows.filter((r) => {
      if (dist && r.district !== dist) return false;
      if (cond && r.condition !== cond) return false;
      if (surf && r.surface !== surf) return false;
      if (traf === "yes" && typeof r.registry_aadt !== "number") return false;
      if (traf === "no" && typeof r.registry_aadt === "number") return false;
      if (q) {
        const hay = `${r.link_id || ""} ${r.road_name || ""} ${r.district || ""} ${r.surface || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    page = 1;
    renderTable();
  }

  function renderTable() {
    const tbody = document.getElementById("link-rows");
    if (!tbody) return;
    const totalKm = filteredRows.reduce((s, r) => s + Number(r.geometry_length_km || 0), 0);
    const fullKm = allRows.reduce((s, r) => s + Number(r.geometry_length_km || 0), 0) || 1;
    const lc = document.getElementById("link-count");
    if (lc) lc.textContent = `${fmt(totalKm, 2)} km filtered extent (${fmt(totalKm / fullKm * 100, 1)}%)`;

    const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    page = Math.max(1, Math.min(page, pages));
    const slice = filteredRows.slice((page - 1) * pageSize, page * pageSize);

    tbody.innerHTML = slice.map((r, idx) => `
      <tr data-idx="${(page - 1) * pageSize + idx}" style="cursor:pointer">
        <td>${esc(r.link_id || "Not recorded")}</td>
        <td>${esc(r.road_name || "Not recorded")}</td>
        <td>${esc(r.district || "Not recorded")}</td>
        <td>${fmt(r.geometry_length_km, 2)} km</td>
        <td>${esc(r.surface || "Not recorded")}</td>
        <td>${esc(r.condition || "Not recorded")}</td>
        <td>${typeof r.registry_aadt === "number" ? fmt(r.registry_aadt, 0) : "Not recorded"}</td>
        <td>${esc(r.priority_band || "Not recorded")}</td>
      </tr>
    `).join("");

    const lbl = document.getElementById("page-label");
    if (lbl) lbl.textContent = `Page ${page} of ${pages}`;
  }

  function renderAdminTable() {
    const level = document.getElementById("admin-level")?.value || "district";
    const q = (document.getElementById("admin-search")?.value || "").trim().toLowerCase();
    const field = level === "district" ? "district" : level === "county" ? "county" : level === "subcounty" ? "subcounty" : level === "parish" ? "parish" : "district";
    const map = new Map();
    for (const r of allRows) {
      const k = r[field] || "Not recorded";
      if (q && !k.toLowerCase().includes(q)) continue;
      if (!map.has(k)) map.set(k, { unit: k, km: 0, paved: 0, unpaved: 0, good: 0, fair: 0, poor: 0 });
      const cur = map.get(k);
      const len = Number(r.geometry_length_km || 0);
      cur.km += len;
      if (r.pavement_class === "Paved") cur.paved += len; else cur.unpaved += len;
      if (r.condition === "Good") cur.good += len;
      else if (r.condition === "Fair") cur.fair += len;
      else if (r.condition === "Poor") cur.poor += len;
    }
    adminRows = Array.from(map.values()).sort((a, b) => b.km - a.km);
    const totalKm = adminRows.reduce((s, r) => s + r.km, 0) || 1;
    const ac = document.getElementById("admin-count");
    if (ac) ac.textContent = `${adminRows.length} administrative units · ${fmt(totalKm, 2)} km`;

    const head = document.getElementById("admin-head");
    if (head) head.innerHTML = `<tr><th>Administrative unit</th><th>Total km</th><th>Share %</th><th>Paved km</th><th>Unpaved km</th><th>Good km</th><th>Fair km</th><th>Poor km</th></tr>`;

    const pages = Math.max(1, Math.ceil(adminRows.length / pageSize));
    adminPage = Math.max(1, Math.min(adminPage, pages));
    const slice = adminRows.slice((adminPage - 1) * pageSize, adminPage * pageSize);

    const tbody = document.getElementById("admin-rows");
    if (tbody) {
      tbody.innerHTML = slice.map((r) => `
        <tr>
          <td>${esc(r.unit)}</td>
          <td>${fmt(r.km, 2)} km</td>
          <td>${fmt(r.km / totalKm * 100, 2)}%</td>
          <td>${fmt(r.paved, 2)} km</td>
          <td>${fmt(r.unpaved, 2)} km</td>
          <td>${fmt(r.good, 2)} km</td>
          <td>${fmt(r.fair, 2)} km</td>
          <td>${fmt(r.poor, 2)} km</td>
        </tr>
      `).join("");
    }
    const lbl = document.getElementById("admin-page-label");
    if (lbl) lbl.textContent = `Page ${adminPage} of ${pages}`;
  }

  function downloadCsv(filename, headers, rows) {
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function bindEvents() {
    ["link-search", "district-filter", "condition-filter", "surface-filter", "traffic-filter"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", applyFilters);
      document.getElementById(id)?.addEventListener("change", applyFilters);
    });
    document.getElementById("prev-page")?.addEventListener("click", () => { page--; renderTable(); });
    document.getElementById("next-page")?.addEventListener("click", () => { page++; renderTable(); });
    document.getElementById("admin-search")?.addEventListener("input", () => { adminPage = 1; renderAdminTable(); });
    document.getElementById("admin-level")?.addEventListener("change", () => { adminPage = 1; renderAdminTable(); });
    document.getElementById("admin-prev-page")?.addEventListener("click", () => { adminPage--; renderAdminTable(); });
    document.getElementById("admin-next-page")?.addEventListener("click", () => { adminPage++; renderAdminTable(); });
    document.getElementById("export-links")?.addEventListener("click", () => {
      downloadCsv("ducar-network-register.csv", ["Link ID", "Road Name", "District", "Length (km)", "Surface", "Condition", "AADT", "Priority"], filteredRows.map((r) => [r.link_id, r.road_name, r.district, r.geometry_length_km, r.surface, r.condition, r.registry_aadt ?? "Not recorded", r.priority_band]));
    });
    document.getElementById("export-admin")?.addEventListener("click", () => {
      downloadCsv("ducar-administrative-extent.csv", ["Administrative Unit", "Total km", "Paved km", "Unpaved km", "Good km", "Fair km", "Poor km"], adminRows.map((r) => [r.unit, r.km.toFixed(2), r.paved.toFixed(2), r.unpaved.toFixed(2), r.good.toFixed(2), r.fair.toFixed(2), r.poor.toFixed(2)]));
    });
    document.getElementById("link-rows")?.addEventListener("click", (e) => {
      const tr = e.target.closest("tr[data-idx]");
      if (!tr) return;
      const r = filteredRows[Number(tr.dataset.idx)];
      if (!r) return;
      const drawer = document.getElementById("drawer");
      const content = document.getElementById("drawer-content");
      if (drawer && content) {
        content.innerHTML = `
          <h2 style="margin:0 0 12px;color:#0F172A">${esc(r.road_name || r.link_id)}</h2>
          <p style="color:#475569;margin:0 0 14px">Identifier: <strong>${esc(r.link_id)}</strong></p>
          <dl style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
            <dt style="color:#64748B">District</dt><dd style="margin:0;font-weight:600">${esc(r.district)}</dd>
            <dt style="color:#64748B">Length</dt><dd style="margin:0;font-weight:600">${fmt(r.geometry_length_km, 2)} km</dd>
            <dt style="color:#64748B">Surface</dt><dd style="margin:0;font-weight:600">${esc(r.surface)}</dd>
            <dt style="color:#64748B">Condition</dt><dd style="margin:0;font-weight:600">${esc(r.condition)}</dd>
            <dt style="color:#64748B">AADT</dt><dd style="margin:0;font-weight:600">${typeof r.registry_aadt === "number" ? fmt(r.registry_aadt, 0) : "Not recorded"}</dd>
            <dt style="color:#64748B">Priority</dt><dd style="margin:0;font-weight:600">${esc(r.priority_band)}</dd>
          </dl>
        `;
        drawer.setAttribute("aria-hidden", "false");
      }
    });
    document.getElementById("close-drawer")?.addEventListener("click", () => {
      document.getElementById("drawer")?.setAttribute("aria-hidden", "true");
    });
  }

  async function loadRegister() {
    try {
      const data = await fetchGzJson("./data/ducar_link_register.json.gz?v=20261123");
      allRows = Array.isArray(data) ? data : (data.rows || []);
      filteredRows = allRows.slice();
      populateSelect("district-filter", [...new Set(allRows.map((r) => r.district).filter(Boolean))].sort());
      populateSelect("condition-filter", [...new Set(allRows.map((r) => r.condition).filter(Boolean))].sort());
      populateSelect("surface-filter", [...new Set(allRows.map((r) => r.surface).filter(Boolean))].sort());
      renderTable();
      renderAdminTable();
    } catch (e) {
      // Fallback gracefully without console errors
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderStatic();
    bindEvents();
    initMap();
    loadRegister();
  });
})();
