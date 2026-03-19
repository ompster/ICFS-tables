// ICFS - Tables v2.0 — background.js (MV3 service worker)

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "icfs-toggle-table",
      title: "Toggle zebra stripes on this table",
      contexts: ["all"]
    });
    chrome.contextMenus.create({
      id: "icfs-stripe-all",
      title: "Stripe all tables on this page",
      contexts: ["all"]
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === "icfs-toggle-table") {
    // Send to all frames — the one that had the right-click will handle it
    broadcastToAllFrames(tab.id, { type: "contextToggleTable" });
  } else if (info.menuItemId === "icfs-stripe-all") {
    broadcastToAllFrames(tab.id, { type: "stripeAll" });
  }
});

// Forward popup messages to all frames in the active tab
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "broadcastToFrames") {
    broadcastToAllFrames(msg.tabId, msg.payload, sendResponse);
    return true; // keep channel open for async response
  }
  if (msg.type === "queryFrames") {
    // Collect table lists from all frames and merge
    collectFromAllFrames(msg.tabId, { type: "getTableList" }, (results) => {
      sendResponse(results);
    });
    return true;
  }
});

function broadcastToAllFrames(tabId, payload, callback) {
  if (typeof chrome.webNavigation !== "undefined") {
    chrome.webNavigation.getAllFrames({ tabId }, (frames) => {
      if (!frames) { if (callback) callback([]); return; }
      const promises = frames.map(f =>
        new Promise(resolve => {
          chrome.tabs.sendMessage(tabId, payload, { frameId: f.frameId }, (resp) => {
            // Ignore errors for frames where content script isn't injected
            if (chrome.runtime.lastError) { resolve(null); return; }
            resolve(resp);
          });
        })
      );
      Promise.all(promises).then(results => {
        if (callback) callback(results.filter(Boolean));
      });
    });
  } else {
    chrome.tabs.sendMessage(tabId, payload, (resp) => {
      if (callback) callback(resp ? [resp] : []);
    });
  }
}

function collectFromAllFrames(tabId, payload, callback) {
  if (typeof chrome.webNavigation !== "undefined") {
    chrome.webNavigation.getAllFrames({ tabId }, (frames) => {
      if (!frames) { callback([]); return; }
      const promises = frames.map(f =>
        new Promise(resolve => {
          chrome.tabs.sendMessage(tabId, payload, { frameId: f.frameId }, (resp) => {
            if (chrome.runtime.lastError) { resolve([]); return; }
            resolve(resp || []);
          });
        })
      );
      Promise.all(promises).then(results => {
        // Flatten and deduplicate by tableId
        const flat = results.flat();
        const seen = new Set();
        callback(flat.filter(item => {
          if (seen.has(item.tableId)) return false;
          seen.add(item.tableId);
          return true;
        }));
      });
    });
  } else {
    chrome.tabs.sendMessage(tabId, payload, (resp) => {
      callback(resp || []);
    });
  }
}
