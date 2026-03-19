// ICFS - Tables v2.0 — popup.js

// ── Presets ───────────────────────────────────────────────────────────────
const PRESETS = {
  blue:     { odd: "#ffffff", even: "#dce8fc", hover: "#b8d1f5" },
  green:    { odd: "#ffffff", even: "#d6f0de", hover: "#a8dbb5" },
  grey:     { odd: "#ffffff", even: "#f0f0f0", hover: "#d8d8d8" },
  purple:   { odd: "#ffffff", even: "#ede7f6", hover: "#cdb8f7" },
  contrast: { odd: "#ffffff", even: "#000000", hover: "#ffff00" },
};

const METHOD_DESCS = {
  js:   "JS: Walks the DOM and injects inline styles. Works on legacy ASP/iframe pages.",
  css:  "CSS: Injects a stylesheet with nth-child selectors. Lighter weight.",
  auto: "Auto: Tries CSS first, falls back to JS if inline styles conflict.",
};

// ── DOM refs ──────────────────────────────────────────────────────────────
const siteLabel       = document.getElementById("siteLabel");
const globalToggle    = document.getElementById("globalToggle");
const siteToggle      = document.getElementById("siteToggle");
const methodBtns      = document.querySelectorAll(".method-btn");
const methodDesc      = document.getElementById("methodDesc");
const presetSelect    = document.getElementById("presetSelect");
const colorOdd        = document.getElementById("colorOdd");
const colorEven       = document.getElementById("colorEven");
const colorHover      = document.getElementById("colorHover");
const siteColorLabel  = document.getElementById("siteColorLabel");
const siteColorBtn    = document.getElementById("siteColorBtn");
const tableList       = document.getElementById("tableList");
const clearOverridesBtn = document.getElementById("clearOverridesBtn");

// ── State ─────────────────────────────────────────────────────────────────
let currentHost    = "";
let activeTabId    = null;
let globalEnabled  = true;
let siteOverrides  = {};
let globalMethod   = "js";
let globalColors   = { ...PRESETS.blue };
let hasSiteColorOverride = false;

// ── Boot ──────────────────────────────────────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs[0]?.url) return;
  activeTabId = tabs[0].id;
  try {
    currentHost = new URL(tabs[0].url).hostname;
  } catch {
    currentHost = "";
  }
  siteLabel.textContent = currentHost || "N/A";
  loadState();
});

function loadState() {
  chrome.storage.local.get(
    ["globalEnabled", "globalMethod", "globalColors", "siteOverrides", "tableOverrides"],
    (data) => {
      globalEnabled = data.globalEnabled !== false;
      globalMethod  = data.globalMethod  || "js";
      globalColors  = { ...PRESETS.blue, ...(data.globalColors || {}) };
      siteOverrides = data.siteOverrides || {};

      const site = siteOverrides[currentHost] || {};
      const siteEnabled = "enabled" in site ? site.enabled : globalEnabled;
      const siteMethod  = site.method || globalMethod;
      const siteColors  = site.colors ? { ...globalColors, ...site.colors } : { ...globalColors };
      hasSiteColorOverride = !!site.colors;

      // Toggles
      globalToggle.checked = globalEnabled;
      siteToggle.checked   = siteEnabled;

      // Method
      setActiveMethod(siteMethod, false);

      // Colours
      colorOdd.value   = siteColors.odd;
      colorEven.value  = siteColors.even;
      colorHover.value = siteColors.hover;
      syncPresetDropdown(siteColors);
      updateSiteColorLabel();

      // Table list
      loadTableList(data.tableOverrides || {});
    }
  );
}

// ── Global toggle ─────────────────────────────────────────────────────────
globalToggle.addEventListener("change", () => {
  globalEnabled = globalToggle.checked;
  chrome.storage.local.set({ globalEnabled });

  // If site has no explicit override, sync site toggle visually + send message
  const site = siteOverrides[currentHost] || {};
  if (!("enabled" in site)) {
    siteToggle.checked = globalEnabled;
    broadcastState(globalEnabled);
  }
});

// ── Site toggle ───────────────────────────────────────────────────────────
siteToggle.addEventListener("change", () => {
  const enabled = siteToggle.checked;
  const site = siteOverrides[currentHost] || {};

  if (enabled === globalEnabled) {
    delete site.enabled;
  } else {
    site.enabled = enabled;
  }

  if (Object.keys(site).length === 0) {
    delete siteOverrides[currentHost];
  } else {
    siteOverrides[currentHost] = site;
  }

  chrome.storage.local.set({ siteOverrides });
  broadcastState(enabled);
});

// ── Method buttons ────────────────────────────────────────────────────────
methodBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const method = btn.dataset.method;
    setActiveMethod(method, true);
  });
});

function setActiveMethod(method, persist) {
  methodBtns.forEach(b => b.classList.toggle("active", b.dataset.method === method));
  methodDesc.textContent = METHOD_DESCS[method];

  if (!persist) return;

  const site = siteOverrides[currentHost] || {};
  if (method === globalMethod) {
    delete site.method;
  } else {
    site.method = method;
  }
  if (Object.keys(site).length === 0) {
    delete siteOverrides[currentHost];
  } else {
    siteOverrides[currentHost] = site;
  }
  chrome.storage.local.set({ siteOverrides });
  sendToTab({ type: "setMethod", method });
}

// ── Preset dropdown ───────────────────────────────────────────────────────
presetSelect.addEventListener("change", () => {
  const val = presetSelect.value;
  if (val === "custom") return;
  const preset = PRESETS[val];
  colorOdd.value   = preset.odd;
  colorEven.value  = preset.even;
  colorHover.value = preset.hover;
  applyColours(true);
});

function syncPresetDropdown(colors) {
  for (const [key, preset] of Object.entries(PRESETS)) {
    if (
      preset.odd   === colors.odd   &&
      preset.even  === colors.even  &&
      preset.hover === colors.hover
    ) {
      presetSelect.value = key;
      return;
    }
  }
  presetSelect.value = "custom";
}

// ── Colour pickers ────────────────────────────────────────────────────────
[colorOdd, colorEven, colorHover].forEach(picker => {
  picker.addEventListener("input", () => {
    presetSelect.value = "custom";
    applyColours(false); // live preview, no persist yet
  });
  picker.addEventListener("change", () => {
    presetSelect.value = "custom";
    applyColours(true); // persist on final pick
    syncPresetDropdown({ odd: colorOdd.value, even: colorEven.value, hover: colorHover.value });
  });
});

function applyColours(persist) {
  const colors = {
    odd:   colorOdd.value,
    even:  colorEven.value,
    hover: colorHover.value
  };

  // Determine if we're changing global or site colours
  if (hasSiteColorOverride) {
    const site = siteOverrides[currentHost] || {};
    site.colors = colors;
    siteOverrides[currentHost] = site;
    if (persist) chrome.storage.local.set({ siteOverrides });
  } else {
    if (persist) chrome.storage.local.set({ globalColors: colors });
  }

  sendToTab({ type: "setColors", colors });
}

// ── Site colour override controls ─────────────────────────────────────────
siteColorBtn.addEventListener("click", () => {
  if (hasSiteColorOverride) {
    // Clear site override → revert to global
    const site = siteOverrides[currentHost] || {};
    delete site.colors;
    if (Object.keys(site).length === 0) {
      delete siteOverrides[currentHost];
    } else {
      siteOverrides[currentHost] = site;
    }
    hasSiteColorOverride = false;
    chrome.storage.local.set({ siteOverrides });

    // Restore pickers to global colours
    colorOdd.value   = globalColors.odd;
    colorEven.value  = globalColors.even;
    colorHover.value = globalColors.hover;
    syncPresetDropdown(globalColors);
    sendToTab({ type: "setColors", colors: globalColors });
  } else {
    // Promote current picker values to a site override
    hasSiteColorOverride = true;
    const site = siteOverrides[currentHost] || {};
    site.colors = {
      odd:   colorOdd.value,
      even:  colorEven.value,
      hover: colorHover.value
    };
    siteOverrides[currentHost] = site;
    chrome.storage.local.set({ siteOverrides });
  }
  updateSiteColorLabel();
});

function updateSiteColorLabel() {
  if (hasSiteColorOverride) {
    siteColorLabel.textContent = `Using: site colours`;
    siteColorBtn.textContent = "Use global";
  } else {
    siteColorLabel.textContent = `Using: global colours`;
    siteColorBtn.textContent = "Use for this site";
  }
}

// ── Table list ────────────────────────────────────────────────────────────
function loadTableList(allTableOverrides) {
  if (!activeTabId) return;
  const hostOverrides = allTableOverrides[currentHost] || {};

  // Use background's queryFrames to collect tables from ALL frames (iframes too)
  chrome.runtime.sendMessage(
    { type: "queryFrames", tabId: activeTabId },
    (tables) => {
      if (chrome.runtime.lastError || !tables || tables.length === 0) {
        tableList.innerHTML = '<div class="table-list-empty">No tables found.</div>';
        clearOverridesBtn.style.display = "none";
        return;
      }

      const hasOverrides = Object.keys(hostOverrides).length > 0;
      clearOverridesBtn.style.display = hasOverrides ? "block" : "none";

      tableList.innerHTML = "";
      tables.forEach(({ tableId, caption, rowCount, enabled }) => {
        const item = document.createElement("div");
        item.className = "table-item";

        const cap = document.createElement("span");
        cap.className = "table-caption";
        cap.title = caption;
        cap.innerHTML = `${escapeHtml(caption)} <span class="table-rows">(${rowCount}r)</span>`;

        const toggleLabel = document.createElement("label");
        toggleLabel.className = "toggle";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = enabled;
        input.addEventListener("change", () => {
          chrome.tabs.sendMessage(activeTabId, {
            type: "toggleTableById",
            tableId,
            enabled: input.checked
          });
          clearOverridesBtn.style.display = "block";
        });
        const sliderSpan = document.createElement("span");
        sliderSpan.className = "slider";
        toggleLabel.appendChild(input);
        toggleLabel.appendChild(sliderSpan);

        item.appendChild(cap);
        item.appendChild(toggleLabel);
        tableList.appendChild(item);
      });
    }
  );
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

clearOverridesBtn.addEventListener("click", () => {
  chrome.tabs.sendMessage(activeTabId, { type: "clearTableOverrides" });
  clearOverridesBtn.style.display = "none";
  // Reload table list after clearing
  chrome.storage.local.get(["tableOverrides"], (data) => {
    const all = data.tableOverrides || {};
    delete all[currentHost];
    chrome.storage.local.set({ tableOverrides: all }, () => {
      loadTableList({});
    });
  });
});

// ── Messaging helpers ─────────────────────────────────────────────────────
function sendToTab(message) {
  if (!activeTabId) return;
  chrome.tabs.sendMessage(activeTabId, message);
}

function broadcastState(enabled) {
  if (!activeTabId) return;
  // Send to main frame directly
  chrome.tabs.sendMessage(activeTabId, { type: "setState", enabled });
  // Ask background to broadcast to all frames
  chrome.runtime.sendMessage({
    type: "broadcastToFrames",
    tabId: activeTabId,
    payload: { type: "setState", enabled }
  });
}
