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
  high: "High",
  mid: "Mid",
  low: "Low",
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

let itemIndex = [];
let itemMap = new Map();
let ilvlGs = {};
let itemType = {};

function setStatus(message) {
  summaryEl.textContent = message;
}

function buildIndex(data) {
  const gsData = data.GS_DATA || {};
  const legendary = data.LEGENDARY || {};
  ilvlGs = data.ILVL_GS || {};
  itemType = data.ITEM_TYPE || {};

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

  summaryEl.innerHTML = `
    <div><span class="badge">Ítems: ${formatNumber(total)}</span></div>
    <div>High: ${formatNumber(grouped.high || 0)}</div>
    <div>Mid: ${formatNumber(grouped.mid || 0)}</div>
    <div>Low: ${formatNumber(grouped.low || 0)}</div>
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
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const padding = { left: 50, right: 20, top: 20, bottom: 40 };

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, width, height);

  const ilvls = Object.keys(ilvlGs).map(Number);
  const gsValues = Object.values(ilvlGs).flatMap((row) => row);
  const minIlvl = Math.min(...ilvls);
  const maxIlvl = Math.max(...ilvls);
  const minGs = 0;
  const maxGs = Math.max(...gsValues);

  const xScale = (ilvl) =>
    padding.left + ((ilvl - minIlvl) / (maxIlvl - minIlvl)) * (width - padding.left - padding.right);
  const yScale = (gs) =>
    height - padding.bottom - (gs / (maxGs - minGs)) * (height - padding.top - padding.bottom);

  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  ctx.fillStyle = "#9ca3af";
  ctx.font = "12px Inter, sans-serif";
  ctx.fillText("Item Level", width / 2 - 30, height - 10);
  ctx.save();
  ctx.translate(12, height / 2 + 20);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("GearScore", 0, 0);
  ctx.restore();

  const types = Object.keys(legendLabels);
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
}

function renderResults(items, query) {
  const trimmed = query.trim();
  if (!trimmed) {
    resultsEl.innerHTML = "<div class=\"result-card\">Ingresa un ID para buscar.</div>";
    resultCountEl.textContent = "";
    return;
  }

  const filtered = items
    .filter((item) => item.id.includes(trimmed))
    .slice(0, 200);

  resultCountEl.textContent = `${filtered.length} resultados`;
  resultsEl.innerHTML = filtered
    .map((item) => {
      const ilvl = item.ilvl ?? "-";
      const gs = item.gs ?? "-";
      const typeLabel = item.type.replace("_", "-");
      const link = `https://wotlk.evowow.com/?item=${item.id}`;
      return `
        <div class="result-card">
          <strong>Item ID ${item.id}</strong>
          <div class="result-meta">
            <span>Tipo: ${typeLabel}</span>
            <span>Item Level: ${ilvl}</span>
            <span>GearScore: ${gs}</span>
          </div>
          <a href="${link}" target="_blank" rel="noreferrer">Abrir en wotlk.evowow.com</a>
        </div>
      `;
    })
    .join("");
}

async function init() {
  setStatus("Cargando datos de GsChecker...");
  try {
    const embedded = window.GS_DATA;
    const data = embedded ? embedded : await loadJson();

    const { items, map } = buildIndex(data);
    itemIndex = items;
    itemMap = map;

    renderSummary(itemIndex);
    renderLegend();
    renderTable();
    renderChart();

    renderResults(itemIndex, "");
    searchInput.addEventListener("input", (event) => {
      renderResults(itemIndex, event.target.value);
    });
  } catch (err) {
    summaryEl.innerHTML = `
      <div class="badge">Error</div>
      <div>No se pudo cargar GS.json</div>
    `;
    resultsEl.innerHTML =
      "<div class=\"result-card\">No hay datos disponibles.</div>";
  }
}

async function loadJson() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error("No se pudo cargar GS.json");
  return res.json();
}

window.addEventListener("resize", () => {
  if (itemIndex.length) renderChart();
});

init();
