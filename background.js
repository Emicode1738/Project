const timers = {};
const DURATION = 30 * 60 * 1000; // 30 minutes
let _currentAlarmTab = null;

// Restore timers stored in chrome.storage when the service worker starts
chrome.storage.local.get({ timerEndTimes: {}, tabs: [] }, ({ timerEndTimes, tabs }) => {
  try {
    // If there are no saved tabs at all, clear any persisted timers immediately.
    if (!tabs || (Array.isArray(tabs) && tabs.length === 0)) {
      if (timerEndTimes && Object.keys(timerEndTimes).length) {
        chrome.storage.local.set({ timerEndTimes: {} });
      }
      return;
    }
    const knownIds = new Set((tabs || []).map(t => Number(t.id)));
    Object.entries(timerEndTimes).forEach(([idStr, end]) => {
      const tabId = Number(idStr);
      const endTime = Number(end);
      if (!tabId || !endTime || isNaN(endTime)) {
        delete timerEndTimes[idStr];
        return;
      }
      // Only restore timers for tabs that still exist in stored `tabs`
      if (!knownIds.has(tabId)) {
        delete timerEndTimes[idStr];
        return;
      }
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        // If end time passed, finish immediately for that tab
        finishTimer(tabId);
      } else {
        timers[tabId] = {
          endTime,
          timeoutId: setTimeout(() => finishTimer(tabId), remaining)
        };
      }
    });
    // persist any cleaned-up timerEndTimes
    chrome.storage.local.set({ timerEndTimes });
  } catch (e) {
    console.warn('restoreTimers failed', e);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      console.log('background onMessage', msg && msg.action, msg);
      if (msg.action === "startTimer") {
        startTimer(msg.tab.id, msg.tab.name);
        sendResponse({ endTime: timers[msg.tab.id].endTime });
        return;
      }

      if (msg.action === "resetTimer") {
        // Stop any playing alarm for this tab and restart the timer immediately
        try {
          chrome.runtime.sendMessage({ action: 'stopAlarm', tabId: msg.tabId }, () => {
            if (chrome.runtime.lastError) {
              // No receiver currently available; that's OK — just log for diagnostics
              console.warn('resetTimer stopAlarm sendMessage failed:', chrome.runtime.lastError.message);
            }
          });
        } catch (e) {}
        // mark as not finished
        chrome.storage.local.get({ tabs: [] }, ({ tabs }) => {
          chrome.storage.local.set({
            tabs: tabs.map(t => t.id === msg.tabId ? { ...t, finished: false } : t)
          });
        });
        startTimer(msg.tabId);
        // Respond with the new endTime so callers can update UI immediately
        sendResponse({ endTime: timers[msg.tabId] ? timers[msg.tabId].endTime : null });
        return;
      }

      if (msg.action === "ensureOffscreen") {
        // Create offscreen document now (called from popup user gesture)
        try {
          const exists = await chrome.offscreen.hasDocument();
          if (!exists) {
            await chrome.offscreen.createDocument({
              url: "offscreen.html",
              reasons: ["AUDIO_PLAYBACK"],
              justification: "Play alarm sound"
            });
          }
        } catch (e) {
          console.warn('ensureOffscreen failed', e);
        }
        sendResponse({ ok: true });
        return;
      }

      if (msg.action === "stopTimer") {
        stopTimer(msg.tabId);
        sendResponse({ ok: true });
        return;
      }      if (msg.action === "getEndTime") {
        if (timers[msg.tabId]) {
          sendResponse({ endTime: timers[msg.tabId].endTime });
          return;
        }
        // fallback to persisted timers
        try {
          chrome.storage.local.get({ timerEndTimes: {} }, ({ timerEndTimes }) => {
            const et = timerEndTimes[msg.tabId];
            sendResponse(et ? { endTime: et } : {});
          });
          return; // Keep message channel open for async response
        } catch (e) {
          sendResponse({});
        }
        return;
      }

      if (msg.action === "userLoggedIn") {
        // Handle user login from PJTSite
        console.log('User logged in:', msg.data.user);
        chrome.storage.local.set({ 
          loggedIn: msg.data.user,
          userToken: msg.data.token 
        });
        sendResponse({ success: true });
        return;
      }
    } catch (err) {
      console.error('background onMessage error:', err && err.stack ? err.stack : err);
      try { sendResponse({ error: String(err) }); } catch (e) {}
    }
  })();

  // Keep the message channel open for async responses
  return true;
});

function startTimer(tabId, name = "") {
  stopTimer(tabId);

  console.log('startTimer', tabId, name);

  const endTime = Date.now() + DURATION;

  timers[tabId] = {
    endTime,
    timeoutId: setTimeout(() => finishTimer(tabId, name), DURATION)
  };
  // persist endTime so timers survive service-worker restarts
  try {
    chrome.storage.local.get({ timerEndTimes: {} }, ({ timerEndTimes }) => {
      timerEndTimes[tabId] = endTime;
      chrome.storage.local.set({ timerEndTimes });
    });
  } catch (e) {}
}

function stopTimer(tabId) {
  if (timers[tabId]) {
    clearTimeout(timers[tabId].timeoutId);
    delete timers[tabId];
  }
  // remove persisted endTime
  try {
    chrome.storage.local.get({ timerEndTimes: {} }, ({ timerEndTimes }) => {
      if (timerEndTimes && timerEndTimes[tabId]) {
        delete timerEndTimes[tabId];
        chrome.storage.local.set({ timerEndTimes });
      }
    });
  } catch (e) {}
}

async function finishTimer(tabId, name) {
  console.log('finishTimer called for', tabId, 'name:', name);
  // Only mark finished and show notification if the tab exists in stored `tabs`.
  chrome.storage.local.get({ tabs: [], timerEndTimes: {} }, async ({ tabs, timerEndTimes }) => {
    const foundTab = (tabs || []).find(t => t.id === tabId);
    if (foundTab) {
      console.log('finishTimer: tab found, will show notification for', tabId);
      const updated = tabs.map(t => (t.id === tabId ? { ...t, finished: true } : t));
      chrome.storage.local.set({ tabs: updated });

      // Show notification instead of playing alarm
      try {
        const tabName = foundTab.name || name || 'Unknown Tab';
        chrome.notifications.create({
          type: "basic",
          iconUrl: "berry.png",
          title: "Timer Finished!",
          message: `30 minutes have passed. Is "${tabName}" still relevant?`
        });
      } catch (e) {
        console.warn('notification creation failed', e);
      }
    } else {
      console.warn('finishTimer: tab not found in stored tabs, skipping notification for', tabId);
    }

    // cleanup in-memory and persisted entries regardless
    delete timers[tabId];
    if (timerEndTimes && timerEndTimes[tabId]) {
      delete timerEndTimes[tabId];
      chrome.storage.local.set({ timerEndTimes });
    }
  });
}

/* ===== OFFSCREEN AUDIO (works when popup closed) ===== */
async function playAlarm() {
  // Ensure offscreen audio document exists and ask it to play the alarm.
  const tabId = arguments[0];
  const exists = await chrome.offscreen.hasDocument();
  if (!exists) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Play alarm sound"
    });
  }

  // Send play request and wait for either alarmEnded or alarmStopped for this tab
  try {
    // Attempt to send the message and retry a few times if the offscreen listener isn't ready yet.
    const maxRetries = 6;
    let attempt = 0;
    await new Promise(resolve => {
      const trySend = () => {
        attempt += 1;
        chrome.runtime.sendMessage({ action: "playAlarm", tabId }, () => {
          if (chrome.runtime.lastError) {
            console.warn(`playAlarm sendMessage attempt ${attempt} failed:`, chrome.runtime.lastError.message);
            if (attempt < maxRetries) {
              setTimeout(trySend, 200);
            } else {
              // give up and resolve so alarm flow continues (fallbacks may occur)
              resolve();
            }
          } else {
            resolve();
          }
        });
      };
      trySend();
    });
  } catch (e) {}

  return new Promise(resolve => {
    const handler = (msg, sender, resp) => {
      if ((msg.action === 'alarmEnded' || msg.action === 'alarmStopped') && msg.tabId === tabId) {
        chrome.runtime.onMessage.removeListener(handler);
        resolve();
      }
    };
    chrome.runtime.onMessage.addListener(handler);
  });
}
