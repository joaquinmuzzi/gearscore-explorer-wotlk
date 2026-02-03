const DATA_URL = "./GS.json";

const typeColors = {
  high: "#60a5fa",
  mid: "#a78bfa",
  low: "#34d399",
  ranged: "#fbbf24",
  two_hand: "#f87171",
  legendary: "#f97316",
};

const legendLabels = {
  high: "High-slot",
  mid: "Mid-slot",
  low: "Low-slot",
  ranged: "Ranged",
  two_hand: "Two-Hand",
};

const summaryEl = document.getElementById("summary");
const searchInput = document.getElementById("searchInput");
const resultsEl = document.getElementById("results");
const resultCountEl = document.getElementById("resultCount");
const tableBody = document.querySelector("#ilvlTable tbody");
const legendEl = document.getElementById("legend");
const canvas = document.getElementById("gsChart");
const ctx = canvas.getContext("2d");
const typeCanvas = document.getElementById("typeChart");
const typeCtx = typeCanvas.getContext("2d");
const hoverInfo = document.getElementById("hoverInfo");
const typeToggles = document.querySelectorAll("input[data-type]");
const calcIlvlInput = document.getElementById("calcIlvl");
const calcTypeSelect = document.getElementById("calcType");
const calcBtn = document.getElementById("calcBtn");
const calcResult = document.getElementById("calcResult");
const coefEls = {
  high: {
    a: document.getElementById("coef-high-a"),
    b: document.getElementById("coef-high-b"),
  },
  mid: {
    a: document.getElementById("coef-mid-a"),
    b: document.getElementById("coef-mid-b"),
  },
  low: {
    a: document.getElementById("coef-low-a"),
    b: document.getElementById("coef-low-b"),
  },
  ranged: {
    a: document.getElementById("coef-ranged-a"),
    b: document.getElementById("coef-ranged-b"),
  },
  two_hand: {
    a: document.getElementById("coef-two-hand-a"),
    b: document.getElementById("coef-two-hand-b"),
  },
};

let itemIndex = [];
let itemMap = new Map();
let ilvlGs = {};
let itemType = {};
let itemNames = {};
let ilvlList = [];
const visibleTypes = new Set(Object.keys(legendLabels));
let hoverIlvl = null;

function setStatus(message) {
  summaryEl.textContent = message;
}

function buildIndex(data) {
  const gsData = data.GS_DATA || {};
  const legendary = data.LEGENDARY || {};
  ilvlGs = data.ILVL_GS || {};
  itemType = data.ITEM_TYPE || {};
  itemNames = window.ITEM_NAMES || {};

  const items = [];
  const map = new Map();

  for (const [type, byIlvl] of Object.entries(gsData)) {
    for (const [ilvl, ids] of Object.entries(byIlvl)) {
      const gsValue = ilvlGs[ilvl]?.[itemType[type]] ?? 0;
      for (const itemId of ids) {
        const entry = {
          id: itemId,
          ilvl: Number(ilvl),
          type,
          gs: gsValue,
          name: itemNames[itemId] || "",
        };
        items.push(entry);
        map.set(itemId, entry);
      }
    }
  }

  for (const [itemId, gsValue] of Object.entries(legendary)) {
    const existing = map.get(itemId);
    if (existing) {
      existing.gs = gsValue;
      existing.type = "legendary";
    } else {
      const entry = {
        id: itemId,
        ilvl: null,
        type: "legendary",
        gs: gsValue,
        name: itemNames[itemId] || "",
      };
      items.push(entry);
      map.set(itemId, entry);
    }
  }

  return { items, map };
}

function formatNumber(value) {
  if (value === null || value === undefined) return "-";
  return Number(value).toLocaleString("es-AR");
}

function renderSummary(items) {
  const total = items.length;
  const grouped = items.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});
  const cachedNames = Object.keys(itemNames || {}).length;

  summaryEl.innerHTML = `
    <div><span class="badge">Items: ${formatNumber(total)}</span></div>
    <div>Cached names: ${formatNumber(cachedNames)}</div>
    <div>High-slot: ${formatNumber(grouped.high || 0)}</div>
    <div>Mid-slot: ${formatNumber(grouped.mid || 0)}</div>
    <div>Low-slot: ${formatNumber(grouped.low || 0)}</div>
    <div>Ranged: ${formatNumber(grouped.ranged || 0)}</div>
    <div>Two-Hand: ${formatNumber(grouped.two_hand || 0)}</div>
  `;
}

function renderLegend() {
  legendEl.innerHTML = Object.entries(legendLabels)
    .map(
      ([type, label]) =>
        `<span><i style="background:${typeColors[type]}"></i>${label}</span>`
    )
    .join("");
}

function renderTypeChart(items) {
  if (!typeCanvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = typeCanvas.getBoundingClientRect();
  typeCanvas.width = rect.width * dpr;
  typeCanvas.height = rect.height * dpr;
  typeCtx.setTransform(1, 0, 0, 1, 0, 0);
  typeCtx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const padding = { left: 50, right: 20, top: 16, bottom: 34 };

  const order = ["high", "mid", "low", "ranged", "two_hand", "legendary"];
  const labels = {
    ...legendLabels,
    legendary: "Legendary",
  };
  const counts = order.map((type) => ({
    type,
    value: items.filter((item) => item.type === type).length,
  }));
  const maxValue = Math.max(1, ...counts.map((c) => c.value));

  typeCtx.clearRect(0, 0, width, height);
  typeCtx.fillStyle = "#f8fafc";
  typeCtx.fillRect(0, 0, width, height);

  typeCtx.strokeStyle = "#e5e7eb";
  typeCtx.lineWidth = 1;
  typeCtx.beginPath();
  typeCtx.moveTo(padding.left, padding.top);
  typeCtx.lineTo(padding.left, height - padding.bottom);
  typeCtx.lineTo(width - padding.right, height - padding.bottom);
  typeCtx.stroke();

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barGap = 12;
  const barWidth = (chartWidth - barGap * (order.length - 1)) / order.length;

  typeCtx.font = "12px Inter, sans-serif";
  typeCtx.fillStyle = "#4b5563";

  counts.forEach((entry, index) => {
    const x = padding.left + index * (barWidth + barGap);
    const barHeight = (entry.value / maxValue) * chartHeight;
    const y = height - padding.bottom - barHeight;

    typeCtx.fillStyle = typeColors[entry.type] || "#9ca3af";
    typeCtx.fillRect(x, y, barWidth, barHeight);

    typeCtx.fillStyle = "#374151";
    typeCtx.textAlign = "center";
    typeCtx.fillText(labels[entry.type] || entry.type, x + barWidth / 2, height - 12);
    typeCtx.fillText(entry.value.toString(), x + barWidth / 2, y - 6);
  });
}

function renderTable() {
  const ilvls = Object.keys(ilvlGs)
    .map(Number)
    .sort((a, b) => b - a);

  tableBody.innerHTML = ilvls
    .map((ilvl) => {
      const row = ilvlGs[ilvl];
      return `
        <tr>
          <td>${ilvl}</td>
          <td>${row?.[itemType.high] ?? "-"}</td>
          <td>${row?.[itemType.mid] ?? "-"}</td>
          <td>${row?.[itemType.low] ?? "-"}</td>
          <td>${row?.[itemType.ranged] ?? "-"}</td>
          <td>${row?.[itemType.two_hand] ?? "-"}</td>
        </tr>
      `;
    })
    .join("");
}

function renderChart() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const padding = { left: 50, right: 20, top: 20, bottom: 40 };

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  const ilvls = ilvlList;
  const gsValues = Object.values(ilvlGs).flatMap((row) => row);
  const minIlvl = Math.min(...ilvls);
  const maxIlvl = Math.max(...ilvls);
  const minGs = 0;
  const maxGs = Math.max(...gsValues);

  const xScale = (ilvl) =>
    padding.left + ((ilvl - minIlvl) / (maxIlvl - minIlvl)) * (width - padding.left - padding.right);
  const yScale = (gs) =>
    height - padding.bottom - (gs / (maxGs - minGs)) * (height - padding.top - padding.bottom);

  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  ctx.fillStyle = "#4b5563";
  ctx.font = "12px Inter, sans-serif";
  ctx.fillText("Item Level", width / 2 - 30, height - 10);
  ctx.save();
  ctx.translate(12, height / 2 + 20);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("GearScore", 0, 0);
  ctx.restore();

  const yTicks = 5;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= yTicks; i += 1) {
    const value = Math.round((maxGs / yTicks) * i);
    const y = yScale(value);
    ctx.strokeStyle = "#e5e7eb";
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillStyle = "#6b7280";
    ctx.fillText(value.toString(), padding.left - 6, y);
  }

  const xTicks = 6;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i <= xTicks; i += 1) {
    const value = Math.round(minIlvl + ((maxIlvl - minIlvl) / xTicks) * i);
    const x = xScale(value);
    ctx.strokeStyle = "#eef2f7";
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, height - padding.bottom);
    ctx.stroke();
    ctx.fillStyle = "#6b7280";
    ctx.fillText(value.toString(), x, height - padding.bottom + 6);
  }

  const types = Object.keys(legendLabels).filter((type) => visibleTypes.has(type));
  for (const type of types) {
    const points = Object.keys(ilvlGs)
      .map(Number)
      .sort((a, b) => a - b)
      .map((ilvl) => ({
        ilvl,
        gs: ilvlGs[ilvl]?.[itemType[type]] ?? null,
      }))
      .filter((p) => p.gs !== null && p.gs !== undefined && p.gs !== 0);

    if (!points.length) continue;

    ctx.strokeStyle = typeColors[type];
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, idx) => {
      const x = xScale(p.ilvl);
      const y = yScale(p.gs);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = typeColors[type];
    points.forEach((p) => {
      const x = xScale(p.ilvl);
      const y = yScale(p.gs);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  if (hoverIlvl !== null) {
    const x = xScale(hoverIlvl);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, height - padding.bottom);
    ctx.stroke();
  }
}

function renderHoverInfo(ilvl) {
  if (!hoverInfo) return;
  if (ilvl === null) {
    hoverInfo.textContent = "Move your mouse over the chart to see values.";
    return;
  }
  const values = Object.keys(legendLabels)
    .filter((type) => visibleTypes.has(type))
    .map((type) => {
      const value = ilvlGs[ilvl]?.[itemType[type]] ?? "-";
      return `${legendLabels[type]}: ${value}`;
    })
    .join(" · ");
  hoverInfo.textContent = `Item Level ${ilvl} → ${values}`;
}

function calculateGearScore() {
  if (!calcIlvlInput || !calcTypeSelect || !calcResult) return;
  const ilvl = Number(calcIlvlInput.value);
  const type = calcTypeSelect.value;
  if (!Number.isFinite(ilvl) || ilvl <= 0) {
    calcResult.textContent = "Please enter a valid item level.";
    return;
  }
  const row = ilvlGs[ilvl];
  if (row && itemType[type] !== undefined) {
    const value = row[itemType[type]];
    if (value) {
      calcResult.textContent = `Estimated GS: ${value} (exact ILVL_GS match).`;
      return;
    }
  }

  const ilvls = Object.keys(ilvlGs).map(Number).sort((a, b) => a - b);
  const nearest = ilvls.reduce(
    (prev, curr) => (Math.abs(curr - ilvl) < Math.abs(prev - ilvl) ? curr : prev),
    ilvls[0]
  );
  const nearestRow = ilvlGs[nearest];
  const nearestValue = nearestRow?.[itemType[type]];
  if (nearestValue) {
    calcResult.textContent = `Estimated GS: ${nearestValue} (nearest ilvl: ${nearest}).`;
    return;
  }
  calcResult.textContent = "No GS data available for that type/ilvl.";
}

function updateCoefficients() {
  const ilvls = Object.keys(ilvlGs).map(Number).sort((a, b) => a - b);
  const types = Object.keys(coefEls);
  types.forEach((type) => {
    const index = itemType[type];
    if (index === undefined) return;
    const points = ilvls
      .map((ilvl) => ({ ilvl, gs: ilvlGs[ilvl]?.[index] ?? 0 }))
      .filter((p) => p.gs > 0);
    if (points.length < 2) return;
    const first = points[0];
    const last = points[points.length - 1];
    const a = (last.gs - first.gs) / (last.ilvl - first.ilvl);
    const b = first.gs - a * first.ilvl;
    const aEl = coefEls[type]?.a;
    const bEl = coefEls[type]?.b;
    if (aEl) aEl.textContent = a.toFixed(2);
    if (bEl) bEl.textContent = b.toFixed(0);
  });
}

function renderResults(items, query) {
  const trimmed = query.trim();
  if (!trimmed) {
    resultsEl.innerHTML = "<div class=\"result-card\">Enter an ID or name to search.</div>";
    resultCountEl.textContent = "";
    return;
  }

  const normalized = normalizeText(trimmed);
  const isIdQuery = /^\d+$/.test(trimmed);
  if (!isIdQuery && Object.keys(itemNames || {}).length === 0) {
    resultsEl.innerHTML = "<div class=\"result-card\">No cached names found. Generate item-names.js to enable name search.</div>";
    resultCountEl.textContent = "0 results";
    return;
  }

  const filtered = items
    .filter((item) => {
      if (isIdQuery) return item.id.includes(trimmed);
      if (!item.name) return false;
      return normalizeText(item.name).includes(normalized);
    })
    .slice(0, 200);

  resultCountEl.textContent = `${filtered.length} results`;
  resultsEl.innerHTML = filtered
    .map((item) => {
      const ilvl = item.ilvl ?? "-";
      const gs = item.gs ?? "-";
      const typeLabel = legendLabels[item.type] || item.type.replace("_", "-");
      const name = item.name ? item.name : "(no cached name)";
      const link = `https://wotlk.evowow.com/?item=${item.id}`;
      return `
        <div class="result-card">
          <strong>${name} <span class="badge">ID ${item.id}</span></strong>
          <div class="result-meta">
            <span>Type: ${typeLabel}</span>
            <span>Item Level: ${ilvl}</span>
            <span>GearScore: ${gs}</span>
          </div>
          <a href="${link}" target="_blank" rel="noreferrer">Open on wotlk.evowow.com</a>
        </div>
      `;
    })
    .join("");
}

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


async function init() {
  setStatus("Loading GearScore data...");
  try {
    const embedded = window.GS_DATA;
    const data = embedded ? embedded : await loadJson();

    const { items, map } = buildIndex(data);
    itemIndex = items;
    itemMap = map;
    ilvlList = Object.keys(ilvlGs).map(Number).sort((a, b) => a - b);

    renderSummary(itemIndex);
    renderLegend();
    renderTable();
    renderChart();
    renderTypeChart(itemIndex);
    renderHoverInfo(null);
    updateCoefficients();

    renderResults(itemIndex, "");
    searchInput.addEventListener("input", (event) => {
      renderResults(itemIndex, event.target.value);
    });

    calcBtn?.addEventListener("click", () => {
      calculateGearScore();
    });
    calcIlvlInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") calculateGearScore();
    });

    typeToggles.forEach((toggle) => {
      toggle.addEventListener("change", (event) => {
        const type = event.target.dataset.type;
        if (!type) return;
        if (event.target.checked) {
          visibleTypes.add(type);
        } else {
          visibleTypes.delete(type);
        }
        renderChart();
        renderHoverInfo(hoverIlvl);
      });
    });

    canvas.addEventListener("mousemove", (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const minIlvl = Math.min(...ilvlList);
      const maxIlvl = Math.max(...ilvlList);
      const padding = { left: 50, right: 20, top: 20, bottom: 40 };
      const ratio = (x - padding.left) / (rect.width - padding.left - padding.right);
      const clamped = Math.min(1, Math.max(0, ratio));
      const target = minIlvl + (maxIlvl - minIlvl) * clamped;
      const nearest = ilvlList
        .reduce((prev, curr) => (Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev), minIlvl);
      hoverIlvl = nearest;
      renderChart();
      renderHoverInfo(nearest);
    });

    canvas.addEventListener("mouseleave", () => {
      hoverIlvl = null;
      renderChart();
      renderHoverInfo(null);
    });

    
  } catch (err) {
    summaryEl.innerHTML = `
      <div class="badge">Error</div>
      <div>Could not load GS.json</div>
    `;
    resultsEl.innerHTML =
      "<div class=\"result-card\">No data available.</div>";
  }
}

async function loadJson() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error("Could not load GS.json");
  return res.json();
}

window.addEventListener("resize", () => {
  if (itemIndex.length) {
    renderChart();
    renderTypeChart(itemIndex);
  }
});

init();
