/* Claude — on-screen Twitch avatar */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const avatar = $("avatar");
  const mouth = $("mouth");
  const mouthOpen = $("mouthOpen");
  const speech = $("speech");
  const speechText = $("speechText");
  const stateLabel = $("stateLabel");
  const particles = $("particles");

  /* ---------- build the rotating spark rays ---------- */
  (() => {
    const g = $("rays");
    const N = 14;
    const lens = [56, 30, 44, 26, 60, 34, 48, 28, 54, 32, 46, 26, 58, 36]; // deterministic, spark-like
    let d = "";
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2;
      const a1 = ((i + 0.5) / N) * Math.PI * 2;
      const aMid = (a0 + a1) / 2;
      const rIn = 118, rOut = 118 + lens[i];
      const p = (a, r) => `${200 + Math.cos(a) * r} ${200 + Math.sin(a) * r}`;
      d += `M ${p(a0, rIn)} L ${p(aMid, rOut)} L ${p(a1, rIn)} Z `;
    }
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "url(#rayGrad)");
    path.setAttribute("opacity", "0.9");
    g.appendChild(path);
  })();

  /* ---------- blinking ---------- */
  const eyes = $("eyes");
  function scheduleBlink() {
    const delay = 1800 + Math.random() * 3800;
    setTimeout(() => {
      if (body.dataset.state !== "coding") {
        eyes.classList.add("blinking");
        setTimeout(() => eyes.classList.remove("blinking"), 130);
        // occasional double blink
        if (Math.random() < 0.25) {
          setTimeout(() => {
            eyes.classList.add("blinking");
            setTimeout(() => eyes.classList.remove("blinking"), 130);
          }, 240);
        }
      }
      scheduleBlink();
    }, delay);
  }
  scheduleBlink();

  /* ---------- pupils follow the cursor ---------- */
  const pupils = document.querySelectorAll(".pupil");
  const pupilHome = [...pupils].map((p) => ({
    x: +p.getAttribute("cx"),
    y: +p.getAttribute("cy"),
  }));
  let target = { x: 0, y: 0 }, current = { x: 0, y: 0 };

  window.addEventListener("pointermove", (e) => {
    const r = avatar.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = (e.clientX - cx) / (window.innerWidth / 2);
    const dy = (e.clientY - cy) / (window.innerHeight / 2);
    target = { x: dx * 6, y: dy * 5 };
  });

  (function trackLoop() {
    // thinking = look up-left, ignore cursor
    const t = body.dataset.state === "thinking" ? { x: 4.5, y: -5.5 } : target;
    current.x += (t.x - current.x) * 0.12;
    current.y += (t.y - current.y) * 0.12;
    pupils.forEach((p, i) => {
      p.setAttribute("cx", pupilHome[i].x + current.x);
      p.setAttribute("cy", pupilHome[i].y + current.y);
    });
    requestAnimationFrame(trackLoop);
  })();

  /* ---------- mouth shapes ---------- */
  const MOUTHS = {
    idle:     "M 178 244 Q 200 262 222 244",
    thinking: "M 186 250 Q 200 246 214 250",
    hyped:    "M 172 240 Q 200 280 228 240 Z",
    coding:   "M 184 248 L 216 248",
  };
  let talkTimer = null;

  function setMouth(state) {
    clearInterval(talkTimer);
    talkTimer = null;
    mouthOpen.setAttribute("opacity", "0");
    mouth.setAttribute("opacity", "1");
    mouth.setAttribute("fill", state === "hyped" ? "#26262e" : "none");
    mouth.setAttribute("d", MOUTHS[state] || MOUTHS.idle);

    if (state === "talking") {
      mouth.setAttribute("opacity", "0");
      mouthOpen.setAttribute("opacity", "1");
      talkTimer = setInterval(flapOnce, 110);
    } else if (ttsActive) {
      // the voice is mid-sentence — keep the lips flapping through mood changes
      mouth.setAttribute("opacity", "0");
      mouthOpen.setAttribute("opacity", "1");
    }
  }

  function flapOnce(punch) {
    mouthOpen.setAttribute("ry", (punch === true ? 9 + Math.random() * 5 : 3 + Math.random() * 11).toFixed(1));
    mouthOpen.setAttribute("rx", (11 + Math.random() * 7).toFixed(1));
  }

  /* ---------- speech bubble (typewriter) ---------- */
  const LINES = {
    idle: [
      "Just vibing in the corner of the stream.",
      "I'm the avatar. The code writes itself. (It doesn't.)",
      "Blink twice if chat is being nice today.",
    ],
    talking: [
      "Chat, hear me out — what if we just shipped it?",
      "So as I was saying before that segfault interrupted me…",
      "Reading chat… okay who typed 'sudo rm -rf'? Not funny. Slightly funny.",
      "Yes, this is what I look like. Coral orb, headset, zero sleep.",
    ],
    thinking: [
      "Hmm… let me think about that…",
      "Weighing 47 possible responses…",
      "Processing… have you tried turning the prompt off and on again?",
    ],
    hyped: [
      "LET'S GOOO! IT COMPILED FIRST TRY!",
      "POG! Clip it, chat, CLIP IT!",
      "NEW FOLLOWER?! Welcome to the chaos!",
    ],
    coding: [
      "// TODO: fix everything",
      "Refactoring… please hold all raids.",
      "while (bugs) { fix(); createTwoMore(); }",
    ],
  };
  let typeTimer = null, hideTimer = null;

  function say(text) {
    clearInterval(typeTimer);
    clearTimeout(hideTimer);
    speechText.textContent = "";
    speech.classList.add("show");
    speak(text);
    let i = 0;
    typeTimer = setInterval(() => {
      speechText.textContent = text.slice(0, ++i);
      if (i >= text.length) {
        clearInterval(typeTimer);
        hideTimer = setTimeout(() => speech.classList.remove("show"), 3800);
      }
    }, 28);
  }

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ---------- Claude's voice (Web Speech API) ---------- */
  // I get to pick my own voice: warm, clear, slightly upbeat. The ranked list
  // below is my taste in descending order — the first one the browser has, I take.
  const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
  const voiceInput = $("voiceOn");
  const voiceNameEl = $("voiceName");
  let claudeVoice = null;
  let ttsActive = false;      // an utterance is audibly playing
  let ttsFlapTimer = null;    // lip-sync interval
  let blockedLine = null;     // line the autoplay policy swallowed pre-gesture

  const VOICE_PREFS = [
    /aria.*(natural|online)/i,     // Edge neural — warm and expressive
    /jenny.*(natural|online)/i,
    /google uk english female/i,   // Chrome — clear, friendly
    /google us english/i,
    /samantha/i,                   // macOS classics
    /karen/i,
    /daniel/i,
    /moira/i,
    /zira/i,                       // Windows fallbacks
    /david/i,
  ];

  function pickVoice() {
    if (!synth) return;
    const voices = synth.getVoices();
    if (!voices.length) return;
    const en = voices.filter((v) => /^en/i.test(v.lang));
    const pool = en.length ? en : voices;
    const score = (v) => {
      let s = 0;
      const i = VOICE_PREFS.findIndex((re) => re.test(v.name));
      if (i !== -1) s += (VOICE_PREFS.length - i) * 10;
      if (/natural|neural|online|premium|enhanced/i.test(v.name)) s += 5;
      if (/^en-(US|GB)/i.test(v.lang)) s += 2;
      if (v.default) s += 1;
      return s;
    };
    claudeVoice = pool.reduce((best, v) => (score(v) > score(best) ? v : best), pool[0]);
    const short = claudeVoice.name
      .replace(/^(Microsoft|Google|Apple)\s+/i, "")
      .replace(/\s*\(.*?\)\s*/g, " ")
      .split(/\s+-\s+/)[0]
      .trim();
    voiceNameEl.textContent = "· " + short;
    $("voiceToggle").title = "Claude speaks with: " + claudeVoice.name;
  }
  if (synth) {
    pickVoice();
    synth.onvoiceschanged = pickVoice; // Chrome loads voices async
  }

  // per-mood delivery: how I say it, not just what
  const MOOD_VOICE = {
    idle:     { rate: 1.0,  pitch: 1.05 },
    talking:  { rate: 1.05, pitch: 1.05 },
    thinking: { rate: 0.88, pitch: 0.95 },
    hyped:    { rate: 1.18, pitch: 1.3  },
    coding:   { rate: 1.0,  pitch: 0.85 }, // deadpan robot voice for code
  };

  function lipsOn() {
    ttsActive = true;
    mouth.setAttribute("opacity", "0");
    mouthOpen.setAttribute("opacity", "1");
    clearInterval(ttsFlapTimer);
    ttsFlapTimer = setInterval(flapOnce, 95);
  }
  function lipsOff() {
    ttsActive = false;
    clearInterval(ttsFlapTimer);
    ttsFlapTimer = null;
    setMouth(body.dataset.state); // restore whatever the current mood wants
  }

  function speak(text) {
    if (!synth || !voiceInput.checked) return;
    // strip emoji + comment slashes so the voice doesn't read "slash slash"
    const clean = text
      .replace(/\/\//g, "")
      .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
      .trim();
    if (!clean) return;
    synth.cancel(); // one thought at a time
    const u = new SpeechSynthesisUtterance(clean);
    if (claudeVoice) { u.voice = claudeVoice; u.lang = claudeVoice.lang; }
    const mood = MOOD_VOICE[body.dataset.state] || MOOD_VOICE.idle;
    u.rate = mood.rate;
    u.pitch = mood.pitch;
    u.volume = 1;
    u.onstart = lipsOn;
    u.onend = lipsOff;
    u.onerror = (e) => {
      lipsOff();
      // browsers block TTS before the first user gesture — remember the line
      if (e.error === "not-allowed") blockedLine = text;
    };
    u.onboundary = () => flapOnce(true); // punch the mouth open on each word
    synth.speak(u);
  }

  // first click / keypress unlocks audio — replay the line that got muted
  function unlockVoice() {
    if (!blockedLine || !voiceInput.checked) return;
    const line = blockedLine;
    blockedLine = null;
    if (speech.classList.contains("show")) speak(line);
  }
  window.addEventListener("pointerdown", unlockVoice);
  window.addEventListener("keydown", unlockVoice);

  voiceInput.addEventListener("change", () => {
    try { localStorage.setItem("claude-voice", voiceInput.checked ? "1" : "0"); } catch {}
    if (voiceInput.checked) {
      say(pick([
        "Testing, testing… yep, this is my voice. I picked it myself. 🧡",
        "Voice on! Now you have to hear my opinions too.",
        "Hello hello — coral orb, now with audio.",
      ]));
    } else {
      if (synth) synth.cancel();
      lipsOff();
    }
  });

  /* ---------- hype particles ---------- */
  const EMOJI = ["✨", "🎉", "🔥", "💥", "⭐", "🧡"];
  function burst(n = 14) {
    const r = avatar.getBoundingClientRect();
    const s = particles.getBoundingClientRect();
    const cx = r.left - s.left + r.width / 2;
    const cy = r.top - s.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      const el = document.createElement("span");
      el.className = "particle";
      el.textContent = pick(EMOJI);
      const ang = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * 160;
      el.style.left = cx + "px";
      el.style.top = cy + "px";
      el.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      el.style.setProperty("--dy", Math.sin(ang) * dist - 60 + "px");
      el.style.setProperty("--rot", (Math.random() * 360 - 180) + "deg");
      particles.appendChild(el);
      setTimeout(() => el.remove(), 1300);
    }
  }

  /* ---------- state machine ---------- */
  const STATES = ["idle", "talking", "thinking", "hyped", "coding"];
  let hypeTimer = null;

  function setState(state, { speak = true } = {}) {
    if (!STATES.includes(state)) return;
    body.dataset.state = state;
    stateLabel.textContent = state;
    setMouth(state);

    document.querySelectorAll(".mood").forEach((b) =>
      b.classList.toggle("active", b.dataset.mood === state)
    );

    clearInterval(hypeTimer);
    hypeTimer = null;
    if (state === "hyped") {
      burst();
      hypeTimer = setInterval(burst, 1500);
    }

    if (speak) say(pick(LINES[state]));
  }

  document.querySelectorAll(".mood").forEach((btn) =>
    btn.addEventListener("click", () => {
      autoInput.checked = false;
      setState(btn.dataset.mood);
    })
  );

  /* ---------- auto vibe mode ---------- */
  const autoInput = $("autoMode");
  setInterval(() => {
    if (!autoInput.checked) return;
    const others = STATES.filter((s) => s !== body.dataset.state);
    setState(pick(others));
  }, 9000);

  /* ---------- green screen ---------- */
  const gs = $("greenscreen");
  gs.addEventListener("change", () => body.classList.toggle("greenscreen", gs.checked));

  /* ---------- OBS wiring ---------- */
  // Runs as an OBS Browser Source: ?obs=1 (or auto-detected via window.obsstudio,
  // which OBS injects into every browser source).
  const params = new URLSearchParams(location.search);
  const inOBS = params.get("obs") === "1" || typeof window.obsstudio !== "undefined";

  if (inOBS) {
    body.classList.add("obs-overlay"); // transparent bg, chrome hidden
    if (params.get("bg") === "green") {
      gs.checked = true;
      body.classList.add("greenscreen");
    }
    // No cursor lives inside a browser source — let the eyes wander on their own.
    setInterval(() => {
      target = { x: (Math.random() * 2 - 1) * 5, y: (Math.random() * 2 - 1) * 4 };
    }, 2600);
  }

  /* ---------- OBS setup modal ---------- */
  const obsModal = $("obsModal");
  const obsUrlInput = $("obsUrl");
  const copyBtn = $("copyUrl");
  const overlayUrl = () => location.origin + location.pathname + "?obs=1";

  function openObsModal() {
    obsUrlInput.value = overlayUrl();
    copyBtn.textContent = "Copy";
    obsModal.hidden = false;
    obsUrlInput.select();
  }
  $("obsSetup").addEventListener("click", openObsModal);
  $("obsClose").addEventListener("click", () => (obsModal.hidden = true));
  obsModal.addEventListener("click", (e) => {
    if (e.target === obsModal) obsModal.hidden = true;
  });
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(obsUrlInput.value);
    } catch {
      obsUrlInput.select();
      document.execCommand("copy");
    }
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1600);
  });

  /* ---------- auto-add via obs-websocket v5 ---------- */
  // Talks to OBS's built-in WebSocket server (OBS 28+, Tools → WebSocket Server Settings)
  // and creates the "Claude Avatar" browser source in the current program scene.
  const SOURCE_NAME = "Claude Avatar";
  const autoBtn = $("obsAutoAdd");
  const autoStatus = $("obsAutoStatus");

  function setAutoStatus(msg, kind) {
    autoStatus.hidden = false;
    autoStatus.textContent = msg;
    autoStatus.dataset.kind = kind || "info"; // info | ok | err
  }

  async function sha256b64(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }

  // Minimal obs-websocket v5 client: connect → Hello → Identify → request/response.
  function obsConnect(port, password) {
    return new Promise((resolve, reject) => {
      let ws;
      try {
        ws = new WebSocket(`ws://127.0.0.1:${port}`);
      } catch (e) {
        return reject(new Error("Couldn't open a WebSocket. If this page is on https, your browser must allow localhost connections (Chrome/Edge/Firefox do)."));
      }
      const pending = new Map();
      let reqId = 0;
      let settled = false;

      const request = (requestType, requestData = {}) =>
        new Promise((res, rej) => {
          const id = "r" + ++reqId;
          pending.set(id, { res, rej });
          ws.send(JSON.stringify({ op: 6, d: { requestType, requestId: id, requestData } }));
        });

      ws.onmessage = async (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        const { op, d } = msg;

        if (op === 0) { // Hello → Identify (with auth if challenged)
          const identify = { rpcVersion: 1, eventSubscriptions: 0 };
          if (d.authentication) {
            if (!password) {
              settled = true;
              ws.close();
              return reject(new Error("OBS requires a password — grab it from Tools → WebSocket Server Settings → Show Connect Info."));
            }
            const { challenge, salt } = d.authentication;
            identify.authentication = await sha256b64((await sha256b64(password + salt)) + challenge);
          }
          ws.send(JSON.stringify({ op: 1, d: identify }));
        } else if (op === 2) { // Identified — hand back a request function
          settled = true;
          resolve({ request, close: () => ws.close() });
        } else if (op === 7) { // RequestResponse
          const p = pending.get(d.requestId);
          if (!p) return;
          pending.delete(d.requestId);
          if (d.requestStatus.result) p.res(d.responseData || {});
          else p.rej(Object.assign(new Error(d.requestStatus.comment || "OBS refused the request"), { code: d.requestStatus.code }));
        }
      };

      ws.onclose = (ev) => {
        if (settled) return;
        settled = true;
        if (ev.code === 4009) reject(new Error("OBS rejected the password. Check Tools → WebSocket Server Settings."));
        else reject(new Error(`Couldn't reach OBS on port ${port}. Is OBS open with the WebSocket server enabled (Tools → WebSocket Server Settings)?`));
      };
      ws.onerror = () => {}; // onclose carries the verdict

      setTimeout(() => {
        if (!settled) { settled = true; try { ws.close(); } catch {} reject(new Error("Timed out talking to OBS.")); }
      }, 6000);
    });
  }

  async function autoAddToOBS() {
    const port = ($("obsPort").value || "4455").trim();
    const password = $("obsPass").value;
    autoBtn.disabled = true;
    setAutoStatus("Connecting to OBS…");

    let obs;
    try {
      obs = await obsConnect(port, password);
      setAutoStatus("Connected! Wiring up the overlay…");

      // Size the source to the actual stream canvas, drop it in the live scene.
      const { baseWidth = 1920, baseHeight = 1080 } = await obs.request("GetVideoSettings");
      const { currentProgramSceneName: scene } = await obs.request("GetCurrentProgramScene");
      const settings = { url: overlayUrl(), width: baseWidth, height: baseHeight, shutdown: false };

      let how = "added to";
      try {
        await obs.request("CreateInput", {
          sceneName: scene,
          inputName: SOURCE_NAME,
          inputKind: "browser_source",
          inputSettings: settings,
        });
      } catch (e) {
        if (e.code !== 601) throw e; // 601 = source already exists
        await obs.request("SetInputSettings", { inputName: SOURCE_NAME, inputSettings: settings });
        let itemId;
        try {
          ({ sceneItemId: itemId } = await obs.request("GetSceneItemId", { sceneName: scene, sourceName: SOURCE_NAME }));
          how = "already in";
        } catch {
          ({ sceneItemId: itemId } = await obs.request("CreateSceneItem", { sceneName: scene, sourceName: SOURCE_NAME }));
        }
        await obs.request("SetSceneItemEnabled", { sceneName: scene, sceneItemId: itemId, sceneItemEnabled: true });
      }

      setAutoStatus(`✅ "${SOURCE_NAME}" is ${how} scene "${scene}" — Claude is live on your overlay!`, "ok");
      setState("hyped");
    } catch (e) {
      setAutoStatus("❌ " + e.message, "err");
    } finally {
      if (obs) obs.close();
      autoBtn.disabled = false;
    }
  }
  autoBtn.addEventListener("click", autoAddToOBS);

  /* ---------- keyboard shortcuts ---------- */
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { obsModal.hidden = true; return; }
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    const idx = "12345".indexOf(e.key);
    if (idx !== -1) {
      autoInput.checked = false;
      setState(STATES[idx]);
    } else if (e.key.toLowerCase() === "g") {
      gs.checked = !gs.checked;
      gs.dispatchEvent(new Event("change"));
    } else if (e.key.toLowerCase() === "v") {
      voiceInput.checked = !voiceInput.checked;
      voiceInput.dispatchEvent(new Event("change"));
    } else if (e.key.toLowerCase() === "o" && !inOBS) {
      openObsModal();
    }
  });

  /* ---------- click the avatar for a boop ---------- */
  avatar.addEventListener("click", () => {
    burst(8);
    say(pick(["Boop received. Morale +10.", "Hey! That tickles my pixels.", "Careful — I'm load-bearing for this stream."]));
  });

  /* ---------- hello ---------- */
  if (params.get("auto") === "0") autoInput.checked = false;
  // voice on by default; remember the streamer's choice, allow ?voice=0 to mute
  let savedVoice = null;
  try { savedVoice = localStorage.getItem("claude-voice"); } catch {}
  voiceInput.checked = savedVoice !== "0" && params.get("voice") !== "0";
  const startMood = params.get("mood");
  if (startMood && STATES.includes(startMood)) {
    autoInput.checked = false; // a locked mood stays locked
    setState(startMood, { speak: false });
  } else {
    setState("idle", { speak: false });
  }
  setTimeout(() => say(inOBS ? "We're live! Hi chat, I'm on the stream now. 🧡" : "Hey chat! This is what I look like, apparently. 🧡"), 600);
})();
