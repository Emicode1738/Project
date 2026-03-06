// time.js

// 3-minute timer configuration
const DURATION = 1 * 60 * 1000; // 1 minute

// Start a 3-minute timer for a tab
function startTabTimer(tab, circle, openCheckCallback) {
  let progress = 0; // 0-100%
  const interval = Math.max(1, Math.floor(DURATION / 100)); // 100 steps across DURATION

  tab.timer = setInterval(() => {
    progress += 1;
    circle.style.background = `conic-gradient(#1e3a8a ${progress}%, #ccc ${progress}%)`;
    if (progress >= 100) {
      clearInterval(tab.timer);
      openCheckCallback(tab); // trigger check page
    }
  }, interval);
}

// Stop a tab's timer
function stopTabTimer(tab) {
  if (tab.timer) clearInterval(tab.timer);
}
