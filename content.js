// ICFS - Tables v2.0 — content.js
// Runs in all frames (including iframes) for full Autotask/legacy ASP support.

const host = location.hostname;

// ── Defaults ──────────────────────────────────────────────────────────────
const DEFAULT_COLORS = {
  odd:   "#ffffff",
  even:  "#dce8fc",
  hover: "#b8d1f5"
};

// ── State ──────────────────────────────────────────────────────────────────
let currentColors = { ...DEFAULT_COLORS };
let currentMethod = "js";
let globalEnabled = true;
let tableOverrides = {}; // { tableId: bool }
let injectedStyleEl = null;
let _zebraObserver = null;
let _lastRightClickedTable = null; // For context menu targeting
let _tableIdCounter = 0;

// ── Boot: load settings then apply ─────────────────────────────────────────
chrome.storage.local.get(
  ["globalEnabled", "globalMethod", "globalColors", "siteOverrides", "tableOverrides"],
  (data) => {
    const overrides = data.siteOverrides || {};
    const siteData = overrides[host] || {};

    globalEnabled = data.globalEnabled !== false;
    const siteEnabled = "enabled" in siteData ? siteData.enabled : globalEnabled;

    currentMethod = siteData.method || data.globalMethod || "js";
    currentColors = Object.assign(
      {},
      DEFAULT_COLORS,
      data.globalColors || {},
      siteData.colors || {}
    );

    // Table-level overrides for this host
    const allTableOverrides = data.tableOverrides || {};
    tableOverrides = allTableOverrides[host] || {};

    applyState(siteEnabled);
  }
);

// ── Message listener (from popup + background) ─────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case "setState":
      applyState(msg.enabled);
      break;

    case "setMethod":
      currentMethod = msg.method;
      restripe();
      break;

    case "setColors":
      currentColors = msg.colors;
      updateInjectedStyle();
      restripe();
      break;

    case "contextToggleTable":
      handleContextToggleTable();
      break;

    case "stripeAll":
      applyState(true);
      break;

    case "getTableList":
      sendResponse(getTableList());
      return true; // async

    case "toggleTableById":
      toggleTableById(msg.tableId, msg.enabled);
      break;

    case "clearTableOverrides":
      clearTableOverrides();
      break;
  }
});

// ── Track right-clicked element so context menu can target it ──────────────
document.addEventListener("contextmenu", (e) => {
  _lastRightClickedTable = e.target.closest("table");
}, true);

// ── Apply / remove global state ────────────────────────────────────────────
function applyState(enabled) {
  document.documentElement.setAttribute("data-zebra", enabled ? "on" : "off");

  if (enabled) {
    stripeTables();
    startObserver();
  } else {
    stopObserver();
    unstripeTables();
  }
}

function restripe() {
  // Re-apply to all currently striped tables
  const wasEnabled = document.documentElement.getAttribute("data-zebra") === "on";
  if (wasEnabled) {
    unstripeTables();
    stripeTables();
  }
}

// ── MutationObserver for dynamic/AJAX content ──────────────────────────────
function startObserver() {
  if (_zebraObserver) return;
  _zebraObserver = new MutationObserver(_onMutation);
  _zebraObserver.observe(document.documentElement, { childList: true, subtree: true });
}

function stopObserver() {
  if (_zebraObserver) {
    _zebraObserver.disconnect();
    _zebraObserver = null;
  }
}

let _mutationTimer = null;
function _onMutation(mutations) {
  // Debounce — AJAX pages can fire hundreds of mutations; wait for quiet
  const hasTableChange = mutations.some(m =>
    Array.from(m.addedNodes).some(n =>
      n.nodeType === 1 && (n.tagName === "TABLE" || n.querySelector?.("table"))
    )
  );
  if (!hasTableChange) return;
  clearTimeout(_mutationTimer);
  _mutationTimer = setTimeout(stripeTables, 150);
}

// ── Core striping ──────────────────────────────────────────────────────────
function stripeTables() {
  if (currentMethod === "css") {
    stripeCss();
  } else if (currentMethod === "auto") {
    stripeAuto();
  } else {
    stripeJs();
  }
}

// ── JS method: inline style injection (the gold standard for legacy pages) ──
function stripeJs() {
  removeInjectedStyle();

  document.querySelectorAll("table").forEach((table) => {
    const tableId = ensureTableId(table);
    const shouldStripe = resolveTableEnabled(tableId);
    if (!shouldStripe) {
      unstripeTable(table);
      return;
    }

    markTable(table);
    const rows = getDataRows(table);
    rows.forEach((row, i) => {
      const color = i % 2 === 0 ? currentColors.odd : currentColors.even;
      applyRowColor(row, color);
    });
  });

  // Inject hover style dynamically (CSS hover + JS inline styles need a stylesheet)
  injectHoverStyle();
}

// ── CSS method: attribute-based stylesheet injection ───────────────────────
function stripeCss() {
  // Mark roles + indices (no inline colour injection), then let the CSS handle colours
  document.querySelectorAll("table").forEach((table) => {
    const tableId = ensureTableId(table);
    const shouldStripe = resolveTableEnabled(tableId);
    if (!shouldStripe) {
      unstripeTable(table);
      return;
    }
    markTable(table);
    getDataRows(table); // stamps data-zebra-role and data-zebra-index="odd"/"even"
  });

  injectCssStyle();
}

// ── Auto method: try CSS, detect conflicts, fall back to JS ───────────────
function stripeAuto() {
  // Stamp roles first
  document.querySelectorAll("table").forEach((table) => {
    const tableId = ensureTableId(table);
    const shouldStripe = resolveTableEnabled(tableId);
    if (!shouldStripe) {
      unstripeTable(table);
      return;
    }
    markTable(table);
    getDataRows(table);
  });

  injectCssStyle();

  // After a short delay, check if CSS is winning
  setTimeout(() => {
    const needsJs = cssIsLosing();
    if (needsJs) {
      removeInjectedStyle();
      stripeJs();
    }
  }, 80);
}

function cssIsLosing() {
  // Sample "even"-indexed rows and check if computed background matches our even colour
  const target = currentColors.even.toLowerCase();
  const rows = document.querySelectorAll('tr[data-zebra-index="even"]');
  let checked = 0;
  for (const row of rows) {
    const computed = getComputedStyle(row).backgroundColor;
    const hex = rgbToHex(computed);
    if (hex && hex.toLowerCase() !== target) return true;
    if (++checked >= 3) break;
  }
  return false;
}

// ── Style injection helpers ────────────────────────────────────────────────
function injectHoverStyle() {
  const css = `
    [data-zebra="on"] table[data-zebra-table] tr[data-zebra-role="data"]:hover td,
    [data-zebra="on"] table[data-zebra-table] tr[data-zebra-role="data"]:hover th,
    [data-zebra="on"] table[data-zebra-table] tr[data-zebra-role="data"]:hover {
      background-color: ${currentColors.hover} !important;
      transition: background-color 0.15s ease;
    }
  `;
  setInjectedStyle(css);
}

function injectCssStyle() {
  const { odd, even, hover } = currentColors;
  const css = `
    [data-zebra="on"] table[data-zebra-table] tr[data-zebra-index] td,
    [data-zebra="on"] table[data-zebra-table] tr[data-zebra-index] th {
      transition: background-color 0.15s ease;
    }
    [data-zebra="on"] table[data-zebra-table] tr[data-zebra-index="odd"] td,
    [data-zebra="on"] table[data-zebra-table] tr[data-zebra-index="odd"] th,
    [data-zebra="on"] table[data-zebra-table] tr[data-zebra-index="odd"] {
      background-color: ${odd} !important;
    }
    [data-zebra="on"] table[data-zebra-table] tr[data-zebra-index="even"] td,
    [data-zebra="on"] table[data-zebra-table] tr[data-zebra-index="even"] th,
    [data-zebra="on"] table[data-zebra-table] tr[data-zebra-index="even"] {
      background-color: ${even} !important;
    }
    [data-zebra="on"] table[data-zebra-table] tr[data-zebra-role="data"]:hover td,
    [data-zebra="on"] table[data-zebra-table] tr[data-zebra-role="data"]:hover th,
    [data-zebra="on"] table[data-zebra-table] tr[data-zebra-role="data"]:hover {
      background-color: ${hover} !important;
    }
  `;
  setInjectedStyle(css);
}

function setInjectedStyle(css) {
  if (!injectedStyleEl) {
    injectedStyleEl = document.createElement("style");
    injectedStyleEl.id = "zebra-injected-style";
    (document.head || document.documentElement).appendChild(injectedStyleEl);
  }
  injectedStyleEl.textContent = css;
}

function removeInjectedStyle() {
  if (injectedStyleEl) {
    injectedStyleEl.remove();
    injectedStyleEl = null;
  }
}

function updateInjectedStyle() {
  // Re-inject with new colours without full restripe (for live colour preview)
  if (injectedStyleEl) {
    if (currentMethod === "css" || currentMethod === "auto") {
      injectCssStyle();
    } else {
      injectHoverStyle();
    }
  }
}

// ── DOM helpers ────────────────────────────────────────────────────────────
function ensureTableId(table) {
  if (!table.hasAttribute("data-zebra-id")) {
    table.setAttribute("data-zebra-id", String(++_tableIdCounter));
  }
  return table.getAttribute("data-zebra-id");
}

function resolveTableEnabled(tableId) {
  if (tableId in tableOverrides) return tableOverrides[tableId];
  return true; // default: follow global/site state
}

function markTable(table) {
  table.setAttribute("data-zebra-table", "");
}

function getDataRows(table) {
  // Collect all TR elements across the full table (handles missing tbody/thead)
  const allRows = table.querySelectorAll("tr");
  const dataRows = [];
  let dataIndex = 0;

  allRows.forEach((row, i) => {
    const cells = row.querySelectorAll("td, th");
    if (cells.length === 0) return; // empty row

    // Header detection: row inside THEAD, or first row of all-TH cells
    const allTh = Array.from(cells).every(c => c.tagName === "TH");
    const isHeader = row.closest("thead") !== null || (i === 0 && allTh);

    if (isHeader) {
      row.setAttribute("data-zebra-role", "header");
      return;
    }

    row.setAttribute("data-zebra-role", "data");

    if (currentMethod === "css" || currentMethod === "auto") {
      // Use string values for CSS method so nth-child isn't needed
      row.setAttribute("data-zebra-index", dataIndex % 2 === 0 ? "odd" : "even");
    } else {
      row.setAttribute("data-zebra-index", String(dataIndex));
    }

    dataRows.push(row);
    dataIndex++;
  });

  return dataRows;
}

function applyRowColor(row, color) {
  row.style.setProperty("background-color", color, "important");
  row.querySelectorAll("td, th").forEach(cell => {
    cell.style.setProperty("background-color", color, "important");
  });
}

function unstripeTable(table) {
  table.removeAttribute("data-zebra-table");
  table.querySelectorAll("[data-zebra-role]").forEach(el => {
    el.removeAttribute("data-zebra-role");
    el.removeAttribute("data-zebra-index");
    el.style.removeProperty("background-color");
    el.querySelectorAll("td, th").forEach(cell => {
      cell.style.removeProperty("background-color");
    });
  });
}

function unstripeTables() {
  removeInjectedStyle();
  document.querySelectorAll("table[data-zebra-table]").forEach(unstripeTable);
}

// ── Per-table toggle (context menu) ───────────────────────────────────────
function handleContextToggleTable() {
  const table = _lastRightClickedTable;
  if (!table) return;

  const tableId = ensureTableId(table);
  const newState = !table.hasAttribute("data-zebra-table");

  tableOverrides[tableId] = newState;
  persistTableOverrides();

  const outlineColor = newState ? "#4285f4" : "#e74c3c";
  if (newState) {
    stripeOneTable(table);
  } else {
    unstripeTable(table);
  }
  table.style.setProperty("outline", `2px dashed ${outlineColor}`, "important");
  setTimeout(() => table.style.removeProperty("outline"), 2000);
}

function toggleTableById(tableId, enabled) {
  const table = document.querySelector(`[data-zebra-id="${tableId}"]`);
  if (!table) return;

  tableOverrides[tableId] = enabled;
  persistTableOverrides();

  if (enabled) {
    stripeOneTable(table);
  } else {
    unstripeTable(table);
  }
}

// Stripe a single table using the current method
function stripeOneTable(table) {
  markTable(table);
  const rows = getDataRows(table);
  if (currentMethod !== "css") {
    // JS or auto (single table): apply inline styles directly
    rows.forEach((row, i) => {
      const color = i % 2 === 0 ? currentColors.odd : currentColors.even;
      applyRowColor(row, color);
    });
    injectHoverStyle();
  }
  // For CSS method, the injected stylesheet already covers newly-marked tables
}

function clearTableOverrides() {
  tableOverrides = {};
  persistTableOverrides();
  restripe();
}

function persistTableOverrides() {
  chrome.storage.local.get(["tableOverrides"], (data) => {
    const all = data.tableOverrides || {};
    all[host] = tableOverrides;
    chrome.storage.local.set({ tableOverrides: all });
  });
}

// ── Table list for popup ───────────────────────────────────────────────────
function getTableList() {
  const tables = document.querySelectorAll("table");
  return Array.from(tables).map(table => {
    const tableId = ensureTableId(table);
    const rowCount = table.querySelectorAll("tr").length;
    const caption = table.caption?.textContent?.trim()
      || table.querySelector("th")?.textContent?.trim()?.slice(0, 30)
      || `Table (${rowCount} rows)`;
    return {
      tableId,
      caption,
      rowCount,
      enabled: table.hasAttribute("data-zebra-table")
    };
  });
}

// ── Utility: RGB string → hex ──────────────────────────────────────────────
function rgbToHex(rgb) {
  const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return null;
  return "#" + [m[1], m[2], m[3]]
    .map(x => parseInt(x).toString(16).padStart(2, "0"))
    .join("");
}
