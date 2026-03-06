const DURATION = 1 * 60 * 1000; // 1 minute

document.addEventListener("DOMContentLoaded", () => {
  const addBtn = document.getElementById("addTab");
  const nameInput = document.getElementById("tabName");
  const urlInput = document.getElementById("tabURL");
  const savedTabs = document.getElementById("savedTabs");
  const counter = document.getElementById("counter");
  const authArea = document.getElementById('authArea');
  const appArea = document.getElementById('appArea');
  const logoutBtn = document.createElement('button');
  logoutBtn.textContent = 'Logout';
  logoutBtn.style.marginLeft = '8px';
  logoutBtn.onclick = () => {
    chrome.storage.local.remove('loggedIn', () => {
      authArea.style.display = 'block';
      appArea.style.display = 'none';
      try { logoutBtn.remove(); } catch (e) {}
    });
  };

  const signInBtn = document.getElementById('signInBtn');
  signInBtn.onclick = () => {
    const loginURL = chrome.runtime.getURL('PJTSite/login.html');
    chrome.tabs.create({ url: loginURL });
  };

  chrome.storage.local.get({ tabs: [], loggedIn: null }, ({ tabs, loggedIn }) => {
    if (!loggedIn) {
      authArea.style.display = 'block';
      appArea.style.display = 'none';
    } else {
      authArea.style.display = 'none';
      appArea.style.display = 'block';
      document.querySelector('.header').appendChild(logoutBtn);
      render(tabs);
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.tabs) {
      render(changes.tabs.newValue);
    }
    if (area === 'local' && changes.loggedIn) {
      const val = changes.loggedIn.newValue;
      if (val) {
        authArea.style.display = 'none';
        appArea.style.display = 'block';
        document.querySelector('.header').appendChild(logoutBtn);
        chrome.runtime.sendMessage({ action: "ensureOffscreen" }, () => {});
        chrome.storage.local.get({ tabs: [] }, ({ tabs }) => render(tabs));
      } else {
        authArea.style.display = 'block';
        appArea.style.display = 'none';
        try { logoutBtn.remove(); } catch (e) {}
      }
    }
  });

  addBtn.onclick = () => {
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    if (!name || !url) return;

    chrome.storage.local.get({ loggedIn: null }, ({ loggedIn }) => {
      if (!loggedIn) return alert('Please log in first.');
      chrome.storage.local.get({ tabs: [] }, ({ tabs }) => {
        if (tabs.length >= 20) return alert("Max 20 tabs allowed");
        if (tabs.some(t => t.name.toLowerCase() === name.toLowerCase())) {
          if (chrome.notifications && chrome.notifications.create) {
            chrome.notifications.create({
              type: "basic",
              iconUrl: "berry.png",
              title: "Duplicate name",
              message: "A tab with that name already exists."
            });
          } else {
            alert("A tab with that name already exists.");
          }
          return;
        }

        const tab = { id: Date.now(), name, url, finished: false };
        chrome.storage.local.set({ tabs: [...tabs, tab] });
        chrome.runtime.sendMessage({ action: "startTimer", tab }, () => {});
        chrome.runtime.sendMessage({ action: "ensureOffscreen" }, () => {});

        nameInput.value = "";
        urlInput.value = "";
      });
    });
  };

  function render(tabs) {
    savedTabs.innerHTML = "";
    counter.textContent = `${tabs.length} / 20`;

    if (!tabs.length) {
      savedTabs.innerHTML =
        '<p class="placeholder">Saved tabs will appear here</p>';
      return;
    }

    tabs.slice(0, 20).forEach(tab => createTab(tab));
  }

  function createTab(tab) {
    const row = document.createElement("div");
    row.className = "tab-cell";

    const circle = document.createElement("div");
    circle.className = "circle";

    const name = document.createElement("span");
    name.textContent = tab.name;
    name.onclick = () => chrome.tabs.create({ url: tab.url });

    const tick = document.createElement("span");
    tick.textContent = "✔";
    tick.className = "tick";
    tick.title = "Reset timer";
    tick.onclick = e => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: "resetTimer", tabId: tab.id }, res => {
        setFinished(tab.id, false);
        if (res?.endTime) animate(circle, res.endTime, false);
      });
    };

    const del = document.createElement("button");
    del.textContent = "✕";
    del.className = "delete-btn";
    del.onclick = e => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: "stopTimer", tabId: tab.id }, () => {
        if (chrome.runtime.lastError) console.warn('stopTimer sendMessage failed:', chrome.runtime.lastError.message);
      });
      remove(tab.id);
    };

    const right = document.createElement("div");
    right.append(tick, del);

    row.append(circle, name, right);
    savedTabs.appendChild(row);

    chrome.runtime.sendMessage(
      { action: "getEndTime", tabId: tab.id },
      res => res?.endTime && animate(circle, res.endTime, tab.finished)
    );
  }

  function animate(circle, endTime, finished) {
    function frame() {
      if (finished) {
        circle.style.background =
          "conic-gradient(#1e3a8a 100%, #1e3a8a 100%)";
        return;
      }

      const progress =
        100 - ((endTime - Date.now()) / DURATION) * 100;
      const pct = Math.min(Math.max(progress, 0), 100);

      circle.style.background =
        `conic-gradient(#1e3a8a ${pct}%, #ccc ${pct}%)`;

      if (pct < 100) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function setFinished(id, val) {
    chrome.storage.local.get({ tabs: [] }, ({ tabs }) => {
      chrome.storage.local.set({
        tabs: tabs.map(t => t.id === id ? { ...t, finished: val } : t)
      });
    });
  }

  function remove(id) {
    chrome.storage.local.get({ tabs: [] }, ({ tabs }) => {
      chrome.storage.local.set({ tabs: tabs.filter(t => t.id !== id) });
    });
  }
});




