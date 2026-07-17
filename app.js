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
      talkTimer = setInterval(() => {
        mouthOpen.setAttribute("ry", (3 + Math.random() * 11).toFixed(1));
        mouthOpen.setAttribute("rx", (11 + Math.random() * 7).toFixed(1));
      }, 110);
    }
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

  /* ---------- keyboard shortcuts ---------- */
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    const idx = "12345".indexOf(e.key);
    if (idx !== -1) {
      autoInput.checked = false;
      setState(STATES[idx]);
    } else if (e.key.toLowerCase() === "g") {
      gs.checked = !gs.checked;
      gs.dispatchEvent(new Event("change"));
    }
  });

  /* ---------- click the avatar for a boop ---------- */
  avatar.addEventListener("click", () => {
    burst(8);
    say(pick(["Boop received. Morale +10.", "Hey! That tickles my pixels.", "Careful — I'm load-bearing for this stream."]));
  });

  /* ---------- hello ---------- */
  setState("idle", { speak: false });
  setTimeout(() => say("Hey chat! This is what I look like, apparently. 🧡"), 600);
})();
