const globalToggle = document.getElementById("globalToggle");
const siteToggle = document.getElementById("siteToggle");
const siteLabel = document.getElementById("siteLabel");

let currentHost = "";

// Get the active tab's hostname
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs[0]?.url) return;
  try {
    currentHost = new URL(tabs[0].url).hostname;
  } catch {
    currentHost = "";
  }
  siteLabel.textContent = currentHost || "N/A";
  loadState();
});

function loadState() {
  chrome.storage.local.get(["globalEnabled", "siteOverrides"], (data) => {
    const global = data.globalEnabled !== false;
    const overrides = data.siteOverrides || {};

    globalToggle.checked = global;

    // Site toggle: if override exists use it, otherwise follow global
    const siteEnabled = currentHost in overrides ? overrides[currentHost] : global;
    siteToggle.checked = siteEnabled;
  });
}

globalToggle.addEventListener("change", () => {
  const enabled = globalToggle.checked;
  chrome.storage.local.set({ globalEnabled: enabled });

  // If no site-specific override, update the current tab too
  chrome.storage.local.get(["siteOverrides"], (data) => {
    const overrides = data.siteOverrides || {};
    if (!(currentHost in overrides)) {
      siteToggle.checked = enabled;
      sendToTab(enabled);
    }
  });
});

siteToggle.addEventListener("change", () => {
  const enabled = siteToggle.checked;
  chrome.storage.local.get(["globalEnabled", "siteOverrides"], (data) => {
    const global = data.globalEnabled !== false;
    const overrides = data.siteOverrides || {};

    if (enabled === global) {
      // Matches global — remove the override
      delete overrides[currentHost];
    } else {
      overrides[currentHost] = enabled;
    }

    chrome.storage.local.set({ siteOverrides: overrides });
    sendToTab(enabled);
  });
});

function sendToTab(enabled) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "setState", enabled });
    }
  });
}
