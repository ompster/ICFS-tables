// Get hostname for per-site memory
const host = location.hostname;

// Check stored state — default is ON
chrome.storage.local.get(["globalEnabled", "siteOverrides"], (data) => {
  const global = data.globalEnabled !== false;
  const overrides = data.siteOverrides || {};
  const enabled = host in overrides ? overrides[host] : global;
  applyState(enabled);
});

// Listen for toggle messages from popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "setState") {
    applyState(msg.enabled);
  }
});

function applyState(enabled) {
  document.body.setAttribute("data-zebra-tables", enabled ? "on" : "off");
  if (enabled) {
    stripeTables();
    // Re-stripe when DOM changes (dynamic content, AJAX loads)
    if (!window._zebraObserver) {
      window._zebraObserver = new MutationObserver(() => stripeTables());
      window._zebraObserver.observe(document.body, { childList: true, subtree: true });
    }
  } else {
    unstripeTables();
  }
}

function stripeTables() {
  document.querySelectorAll("table").forEach((table) => {
    const rows = table.querySelectorAll("tr");
    if (rows.length < 2) return;

    let dataIndex = 0;
    rows.forEach((row, i) => {
      // Skip header-like rows (first row, or rows only containing th)
      const cells = row.querySelectorAll("td, th");
      const isHeader = i === 0 || Array.from(cells).every(c => c.tagName === "TH");
      
      if (isHeader) {
        row.setAttribute("data-zebra-role", "header");
        return;
      }

      row.setAttribute("data-zebra-role", "data");
      row.setAttribute("data-zebra-index", dataIndex);

      const color = dataIndex % 2 === 0 ? "#ffffff" : "#dce8fc";
      row.style.setProperty("background-color", color, "important");
      row.querySelectorAll("td, th").forEach(cell => {
        cell.style.setProperty("background-color", color, "important");
      });

      dataIndex++;
    });
  });
}

function unstripeTables() {
  document.querySelectorAll("[data-zebra-role]").forEach(el => {
    el.removeAttribute("data-zebra-role");
    el.removeAttribute("data-zebra-index");
    el.style.removeProperty("background-color");
    el.querySelectorAll("td, th").forEach(cell => {
      cell.style.removeProperty("background-color");
    });
  });
}
