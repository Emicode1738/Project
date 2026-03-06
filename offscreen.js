// Synthesize a short beep sequence using AudioContext so no external file is required
let _ctx = null;
function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
}

let _synthNodes = [];
let _synthStopRequested = false;

async function playBeepSequence() {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch (e) { console.warn('ctx.resume failed', e); }
    }

    _synthStopRequested = false;
    _synthNodes = [];

    const duration = 0.25; // seconds per beep
    const gap = 0.12; // gap between beeps
    const freqs = [880, 660, 880];
    let t = ctx.currentTime + 0.02;
    for (const f of freqs) {
      if (_synthStopRequested) break;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.6, t + 0.01);
      o.start(t);
      g.gain.linearRampToValueAtTime(0, t + duration);
      // schedule stop slightly after to avoid clicks
      o.stop(t + duration + 0.02);
      _synthNodes.push({ o, g });
      t += duration + gap;
    }

    // wait until all scheduled stops have passed, unless stopped early
    const waitUntil = t + 0.05;
    while (ctx.currentTime < waitUntil) {
      if (_synthStopRequested) break;
      await new Promise(r => setTimeout(r, 50));
    }
  } catch (e) {
    console.error('playBeepSequence error', e);
  } finally {
    // cleanup
    _synthNodes = [];
    _synthStopRequested = false;
  }
}
// Try to play provided alarm.wav first, fall back to synthesized beeps
const audio = new Audio('alarm.wav');
audio.preload = 'auto';
let _playingTab = null;

// Diagnostic events for audio
audio.addEventListener('error', e => console.warn('audio element error', e, audio.error && audio.error.code));
audio.addEventListener('playing', () => console.log('audio playing event'));
audio.addEventListener('ended', () => console.log('audio ended event'));
audio.addEventListener('pause', () => console.log('audio pause event'));

async function playAlarmAudioOrBeep(tabId) {
  _playingTab = tabId;
  // Try audio file first
  try {
    audio.currentTime = 0;

    const onEnded = () => {
      try {
        chrome.runtime.sendMessage({ action: 'alarmEnded', tabId }, () => {
          if (chrome.runtime.lastError) console.warn('alarmEnded sendMessage failed:', chrome.runtime.lastError.message);
        });
      } catch (e) {}
      audio.removeEventListener('ended', onEnded);
      _playingTab = null;
    };

    audio.addEventListener('ended', onEnded);

    const p = audio.play();
    if (p && p.catch) {
      await p.catch(err => { throw err; });
    }

    // If play succeeded, the 'ended' handler will resolve the flow when the audio actually finishes.
    return;
  } catch (e) {
    console.warn('audio.play failed, falling back to synth', e);
    // fall through to synth
  }

  // Synth fallback
  try {
    await playBeepSequence();
    try {
      chrome.runtime.sendMessage({ action: 'alarmEnded', tabId }, () => {
        if (chrome.runtime.lastError) console.warn('alarmEnded sendMessage failed:', chrome.runtime.lastError.message);
      });
    } catch (e) {}
  } catch (e) {
    console.error('synth fallback failed', e);
  } finally {
    _playingTab = null;
  }
}

function stopAlarmForTab(tabId) {
  // Stop audio file if it's the same tab
  let stopped = false;
  if (_playingTab === tabId) {
    try {
      audio.pause();
      audio.currentTime = 0;
      stopped = true;
    } catch (e) {}
    _playingTab = null;
  }

  // Stop synth if running
  if (_synthNodes && _synthNodes.length) {
    try {
      _synthStopRequested = true;
      for (const n of _synthNodes) {
        try { n.g.gain.cancelScheduledValues(0); } catch (e) {}
        try { n.o.stop(); } catch (e) {}
      }
    } catch (e) {}
    _synthNodes = [];
    stopped = true;
  }

  try {
    chrome.runtime.sendMessage({ action: 'alarmStopped', tabId }, () => {
      if (chrome.runtime.lastError) console.warn('alarmStopped sendMessage failed:', chrome.runtime.lastError.message);
    });
  } catch (e) {}
  return stopped;
}

chrome.runtime.onMessage.addListener(msg => {
  console.log('offscreen received message', msg && msg.action, msg);
  if (msg.action === "playAlarm") {
    console.log('offscreen: playAlarm for', msg.tabId);
    playAlarmAudioOrBeep(msg.tabId);
  }
  if (msg.action === "stopAlarm") {
    console.log('offscreen: stopAlarm for', msg.tabId);
    stopAlarmForTab(msg.tabId);
  }
});
