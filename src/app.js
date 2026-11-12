(function () {
  "use strict";

  /* ================= Data ================= */
  // Vite build: set by src/course-data.js. Claude artifact build: an inline JSON script tag.
  const DATA = window.COURSE_DATA || JSON.parse(document.getElementById("course-data").textContent);
  const COURSE = DATA.course, LESSONS = DATA.lessons, QUESTIONS = DATA.questions, LABS = DATA.labs, PLAN = DATA.plan, REF = DATA.reference, BUILD = DATA.build;
  const EXAM = COURSE.exam;
  const DOMAINS = COURSE.domains;
  const DOM = {}; DOMAINS.forEach(d => { DOM[d.id] = d; d.mid = (d.weight[0] + d.weight[1]) / 2; d.objectives = d.groups.flatMap(g => g.objectives); });
  const LESSON = {}; LESSONS.forEach(l => { LESSON[l.id] = l; });
  const LAB = {}; LABS.forEach(l => { LAB[l.id] = l; });
  const Q = {}; QUESTIONS.forEach(q => { Q[q.id] = q; });
  const LESSONS_BY_DOMAIN = {}; DOMAINS.forEach(d => { LESSONS_BY_DOMAIN[d.id] = LESSONS.filter(l => l.domain === d.id); });
  const Q_BY_LESSON = {}; QUESTIONS.forEach(q => { if (q.lesson) (Q_BY_LESSON[q.lesson] = Q_BY_LESSON[q.lesson] || []).push(q); });

  /* ================= Helpers ================= */
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const md = s => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const day = s => { const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmt = s => { const d = day(s); return MONTHS[d.getMonth()] + " " + d.getDate(); };
  const mins = m => m >= 60 ? Math.floor(m / 60) + "h" + (m % 60 ? " " + (m % 60) + "m" : "") : m + " min";
  const dlabel = id => "D" + DOM[id].num;
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
  const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
  function el(tag, attrs, kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]);
      // Content links must be https; anything else (javascript:, data:) is dropped.
      else if (k === "href") { if (/^https:\/\//i.test(attrs[k])) e.setAttribute("href", attrs[k]); }
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    }
    (kids || []).forEach(k => { if (k != null) e.appendChild(typeof k === "string" ? document.createTextNode(k) : k); });
    return e;
  }
  function renderTable(t) {
    // A table with a header row stacks into labelled blocks on narrow screens (see .stack in the CSS).
    const tbl = el("table", { class: t.head ? "stack" : "" });
    if (t.head) tbl.appendChild(el("thead", {}, [el("tr", {}, t.head.map(h => el("th", { text: h })))]));
    const tb = el("tbody");
    t.rows.forEach(r => tb.appendChild(el("tr", {}, r.map((c, i) => el(i === 0 && !t.head ? "th" : "td", { class: "md", html: md(c), "data-label": t.head ? t.head[i] : null })))));
    tbl.appendChild(tb);
    return el("div", { class: "tbl-wrap" }, [tbl]);
  }
  function renderSection(s, level) {
    const box = el("section", { class: "dsec" }, [el(level || "h4", { text: s.title })]);
    if (s.points) { const ul = el("ul", { class: "dpoints md" }); s.points.forEach(p => ul.appendChild(el("li", { html: md(p) }))); box.appendChild(ul); }
    if (s.table) box.appendChild(renderTable(s.table));
    if (s.snippet) box.appendChild(el("div", {}, [el("span", { class: "snip-label", text: s.snippet.label }), el("pre", {}, [el("code", { text: s.snippet.code })])]));
    return box;
  }
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3200);
  }
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* ================= State and sync ================= */
  const KEY = "course-" + COURSE.id + "-v2";
  const blank = () => ({ v: 2, examDate: EXAM.defaultExamDate, done: {}, conf: {}, answers: {}, tally: {}, mocks: [], reported: {}, updated: 0 });
  function normalize(s) {
    const out = Object.assign(blank(), s || {});
    // v1 stored done as true and per-domain quiz tallies
    for (const k in out.done) if (out.done[k] === true) out.done[k] = 1;
    if (s && s.quiz && !s.v) { for (const d in s.quiz) out.tally[d] = { r: s.quiz[d].r || 0, t: s.quiz[d].t || 0 }; }
    delete out.quiz;
    out.v = 2;
    return out;
  }
  let state = blank();
  (function loadLocal() {
    const raw = ls.get(KEY) || ls.get("gh500-progress-v1");
    if (raw) { try { state = normalize(JSON.parse(raw)); } catch (e) {} }
  })();

  let progressRef = null, feedbackRef = null, writeTimer = null, chain = Promise.resolve();
  function setSync(mode) {
    const s = $("sync");
    if (mode === "account") { s.textContent = "Saved to your account"; s.className = "pill ok"; }
    else if (mode === "error") { s.textContent = "Account save failed; saved on this device"; s.className = "pill warn"; }
    else { s.textContent = "Saved on this device"; s.className = "pill"; }
  }
  function enqueue(fn) { chain = chain.then(fn).catch(() => {}); return chain; }
  function pushProgress() {
    if (!progressRef) return;
    const body = JSON.parse(JSON.stringify(state));
    enqueue(() => progressRef.set(body).then(() => setSync("account"), e => {
      if (e && e.code === "invalid_argument") progressRef = null;
      setSync("error");
    }));
  }
  function commit() {
    state.updated = Date.now();
    ls.set(KEY, JSON.stringify(state));
    if (progressRef) { clearTimeout(writeTimer); writeTimer = setTimeout(pushProgress, 900); }
  }

  /* Question reports: queued locally, flushed to the shared store when it's available. */
  const FB_KEY = "course-" + COURSE.id + "-feedback-queue";
  let fbQueue = []; try { fbQueue = JSON.parse(ls.get(FB_KEY) || "[]"); } catch (e) { fbQueue = []; }
  function flushFeedback() {
    if (!feedbackRef || !fbQueue.length) return Promise.resolve(false);
    return enqueue(async () => {
      const snap = await feedbackRef.get();
      const cur = snap.exists ? (snap.data().reports || []).slice() : [];
      const sending = fbQueue.slice();
      await feedbackRef.set({ course: COURSE.id, reports: cur.concat(sending).slice(-300), updatedAt: Date.now() });
      fbQueue = fbQueue.slice(sending.length);
      ls.set(FB_KEY, JSON.stringify(fbQueue));
    }).then(() => true);
  }
  function sendReport(r) {
    fbQueue.push(Object.assign({ at: new Date().toISOString(), course: COURSE.id, build: BUILD.version }, r));
    ls.set(FB_KEY, JSON.stringify(fbQueue));
    if (r.qid) { state.reported[r.qid] = Date.now(); commit(); }
    if (feedbackRef) { flushFeedback(); toast("Report sent. It goes into the review queue."); }
    else toast("Report saved on this device. It's sent when you open the course signed in to Claude.");
  }

  async function connect() {
    const c = window.claude;
    if (!c || !c.use) { setSync("local"); return; }
    try {
      const [db, user] = await Promise.all([c.use("db"), c.use("user")]);
      const uid = user ? await user.id() : null;
      if (!db || !uid) { setSync("local"); return; }
      feedbackRef = db.doc("feedback/" + uid);
      const ref = db.doc("data/users/" + uid + "/" + COURSE.id);
      let snap = await ref.get();
      if (!snap.exists) {
        const legacy = await db.doc("data/users/" + uid + "/progress").get().catch(() => null);
        if (legacy && legacy.exists) snap = legacy;
      }
      progressRef = ref;
      if (snap.exists) {
        const remote = normalize(JSON.parse(JSON.stringify(snap.data() || {})));
        if ((remote.updated || 0) >= (state.updated || 0)) {
          state = remote; ls.set(KEY, JSON.stringify(state)); render(); setSync("account");
          if (snap.id === "progress") pushProgress();
        } else pushProgress();
      } else if (state.updated) pushProgress();
      else setSync("account");
      flushFeedback();
    } catch (e) { progressRef = null; setSync("local"); }
  }

  /* ================= Progress model ================= */
  function resolveTask(t) {
    if (t.kind === "lesson") { const l = LESSON[t.id]; return Object.assign({}, t, { title: "Lesson: " + l.title, minutes: l.minutes }); }
    if (t.kind === "lab") { const l = LAB[t.id]; return Object.assign({}, t, { title: "Lab: " + l.title, minutes: l.minutes }); }
    return t;
  }
  const WEEKS = PLAN.map(w => Object.assign({}, w, { tasks: w.tasks.map(resolveTask) }));
  const ALL_TASKS = WEEKS.flatMap(w => w.tasks);
  const isDone = id => !!state.done[id];
  function weekIndex() {
    const t = today();
    for (let i = 0; i < WEEKS.length; i++) if (t <= day(WEEKS[i].end)) return i;
    return WEEKS.length - 1;
  }
  function nextTask() {
    const wi = weekIndex();
    for (let i = 0; i <= wi; i++) { const t = WEEKS[i].tasks.find(x => !isDone(x.id)); if (t) return { t, wi: i }; }
    for (let i = wi + 1; i < WEEKS.length; i++) { const t = WEEKS[i].tasks.find(x => !isDone(x.id)); if (t) return { t, wi: i }; }
    return null;
  }
  function pace() {
    const t = today(); let expected = 0;
    WEEKS.forEach(w => {
      const s = day(w.start), e = day(w.end);
      if (t > e) expected += w.tasks.length;
      else if (t >= s) expected += Math.floor(w.tasks.length * ((t - s) / 864e5 + 1) / ((e - s) / 864e5 + 1));
    });
    const done = ALL_TASKS.filter(x => isDone(x.id)).length;
    return { expected, done, gap: expected - done };
  }
  function ratingScore(d) {
    let s = 0; d.objectives.forEach(o => { const v = state.conf[o.id]; s += v === 2 ? 1 : v === 1 ? .5 : 0; });
    return d.objectives.length ? s / d.objectives.length : 0;
  }
  function readiness() { let w = 0, s = 0; DOMAINS.forEach(d => { w += d.mid; s += d.mid * ratingScore(d); }); return Math.round(s / w * 100); }
  function accuracy(did) {
    let r = 0, t = 0;
    for (const id in state.answers) { const a = state.answers[id], q = Q[id]; if (!q || (did && q.domain !== did)) continue; t++; if (a.ok) r++; }
    const extra = did ? state.tally[did] : Object.values(state.tally).reduce((acc, x) => ({ r: acc.r + x.r, t: acc.t + x.t }), { r: 0, t: 0 });
    if (extra) { r += extra.r; t += extra.t; }
    return { r, t };
  }
  function recordAnswer(q, ok) {
    if (Q[q.id]) { const prev = state.answers[q.id] || { n: 0 }; state.answers[q.id] = { ok, n: prev.n + 1, at: Date.now() }; }
    else { const t = state.tally[q.domain] || { r: 0, t: 0 }; state.tally[q.domain] = { r: t.r + (ok ? 1 : 0), t: t.t + 1 }; }
    commit();
  }
  function markDone(id, on) {
    if (on) state.done[id] = Date.now(); else delete state.done[id];
    commit();
    if (on) {
      const doneCount = ALL_TASKS.filter(x => isDone(x.id)).length;
      const isLesson = !!LESSON[id];
      toast(isLesson ? "Lesson done. " + LESSONS.filter(l => isDone(l.id)).length + " of " + LESSONS.length + " lessons finished."
        : "Done. " + doneCount + " of " + ALL_TASKS.length + " plan tasks finished.");
    }
  }

  /* ================= Navigation ================= */
  const VIEWS = { today: viewToday, learn: viewLearn, practice: viewPractice, labs: viewLabs, plan: viewPlan, progress: viewProgress, reference: viewReference };
  let current = "today", currentArg = null;
  function go(name, arg) {
    if (LESSON[name]) { arg = name; name = "lesson"; }
    else if (LAB[name]) { arg = name; name = "labs"; }
    if (name !== "lesson" && !VIEWS[name]) name = "today";
    current = name; currentArg = arg == null ? null : arg;
    ls.set(KEY + "-view", name === "lesson" ? arg : name);
    try { history.replaceState(null, "", "#" + (name === "lesson" ? arg : name)); } catch (e) {}
    render();
    window.scrollTo(0, 0);
    if (name === "labs" && arg) setTimeout(() => { const n = $(arg); if (n) { n.scrollIntoView({ block: "start" }); n.classList.add("flash"); setTimeout(() => n.classList.remove("flash"), 1600); } }, 30);
  }
  function render() {
    stopMockTimer();
    const tab = current === "lesson" ? "learn" : current;
    document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-current", b.dataset.go === tab ? "page" : "false"));
    const v = $("view"); v.innerHTML = "";
    (current === "lesson" ? viewLesson : VIEWS[current])(v, currentArg);
  }

  /* Open a plan task wherever it lives. */
  function openTask(t) {
    if (t.kind === "lesson" || t.kind === "lab") return go(t.id);
    if (t.kind === "practice") return go("practice", t.ref === "mock" ? { mode: "mock" } : t.ref === "missed" ? { mode: "missed" } : { mode: "drill", domain: t.ref.length === 1 ? t.ref[0] : "all", domains: t.ref });
    if (t.kind === "rate") return go("progress", { domain: t.ref[0] });
  }
  function taskAction(t, primary) {
    const cls = primary ? "btn" : "linkbtn";
    if (t.link) return el("a", { class: cls, href: t.link, target: "_blank", rel: "noopener", text: primary ? "Open" : "Open" });
    if (t.kind === "exam") return null;
    return el("button", { class: cls, text: primary ? "Start" : "Go", onclick: () => openTask(t) });
  }
  function taskRow(t) {
    const done = isDone(t.id);
    const li = el("li", { class: "task" + (done ? " is-done" : "") });
    const cb = el("input", { type: "checkbox", class: "check", id: "t-" + t.id, "aria-label": "Done: " + t.title });
    cb.checked = done;
    cb.addEventListener("change", () => { markDone(t.id, cb.checked); render(); });
    const kind = t.kind === "module" ? "Official" : t.kind === "practice" ? "Practice" : t.kind === "rate" ? "Rate" : t.kind;
    li.appendChild(cb);
    li.appendChild(el("label", { for: "t-" + t.id, html: '<span class="kind k-' + t.kind + '">' + esc(kind) + '</span><span class="t-title">' + esc(t.title.replace(/^(Lesson|Lab): /, "")) + "</span>" }));
    const right = el("span", { class: "right" });
    const a = taskAction(t, false); if (a) right.appendChild(a);
    right.appendChild(el("span", { class: "mins", text: mins(t.minutes) }));
    li.appendChild(right);
    return li;
  }
  /* Show at most 5 open items, the rest behind one control. */
  function cappedTaskList(tasks, cap) {
    cap = cap || 5;
    const wrap = el("div");
    const open = tasks.filter(t => !isDone(t.id)), closed = tasks.filter(t => isDone(t.id));
    const ul = el("ul", { class: "tasks" });
    open.slice(0, cap).forEach(t => ul.appendChild(taskRow(t)));
    wrap.appendChild(ul);
    const rest = open.slice(cap).concat(closed);
    if (rest.length) {
      const more = el("button", { class: "more", text: "Show " + rest.length + " more (" + closed.length + " done)" });
      more.addEventListener("click", () => { rest.forEach(t => ul.appendChild(taskRow(t))); more.remove(); });
      wrap.appendChild(more);
    }
    if (!open.length && !closed.length) wrap.appendChild(el("p", { class: "muted", text: "Nothing here." }));
    return wrap;
  }

  /* ================= Today ================= */
  function viewToday(v) {
    const n = nextTask();
    const wi = weekIndex(), w = WEEKS[wi];
    const wDone = w.tasks.filter(t => isDone(t.id)).length;
    const p = pace();

    const next = el("section", { class: "next" });
    if (n) {
      next.appendChild(el("div", { class: "eyebrow", text: "Your next step · " + mins(n.t.minutes) }));
      next.appendChild(el("div", { class: "what", text: n.t.title }));
      const row = el("div", { class: "row" });
      const a = taskAction(n.t, true); if (a) row.appendChild(a);
      const md2 = el("button", { class: "btn quiet", text: "Mark done" });
      md2.addEventListener("click", () => { markDone(n.t.id, true); render(); });
      row.appendChild(md2);
      next.appendChild(row);
    } else {
      next.appendChild(el("div", { class: "eyebrow", text: "Plan complete" }));
      next.appendChild(el("div", { class: "what", text: "Every task is done. Take a mock exam to stay sharp." }));
      next.appendChild(el("div", { class: "row" }, [el("button", { class: "btn", text: "Start a mock exam", onclick: () => go("practice", { mode: "mock" }) })]));
    }
    v.appendChild(next);

    const paceTxt = today() < day(COURSE.planStart) ? "Plan starts " + fmt(COURSE.planStart)
      : p.gap <= 0 ? "On pace" : "Behind by " + plural(p.gap, "task");
    const paceCls = today() < day(COURSE.planStart) ? "accent" : p.gap <= 0 ? "ok" : p.gap > 4 ? "crit" : "warn";
    v.appendChild(el("p", { class: "state", html: "Week " + (wi + 1) + " of " + WEEKS.length + ": " + esc(w.title) + " · <strong>" + wDone + " of " + w.tasks.length + "</strong> done this week · <span class=\"pill " + paceCls + "\">" + esc(paceTxt) + "</span>" }));

    const lessonsDone = LESSONS.filter(l => isDone(l.id)).length;
    const labsDone = LABS.filter(l => isDone(l.id)).length;
    const answered = QUESTIONS.filter(q => state.answers[q.id]).length;
    const acc = accuracy();
    const ready = readiness();
    const stats = el("section", { class: "stats", "aria-label": "Progress" });
    [["Lessons", lessonsDone + "/" + LESSONS.length, pct(lessonsDone, LESSONS.length)],
     ["Labs", labsDone + "/" + LABS.length, pct(labsDone, LABS.length)],
     ["Questions seen", answered + "/" + QUESTIONS.length, pct(answered, QUESTIONS.length), acc.t ? pct(acc.r, acc.t) + "% correct" : "none answered yet"],
     ["Readiness", ready + "%", ready, "from your objective ratings"]].forEach(s => {
      stats.appendChild(el("div", { class: "stat" }, [
        el("div", { class: "v", text: s[1] }),
        el("div", { class: "k", text: s[0] + (s[3] ? " · " + s[3] : "") }),
        el("div", { class: "bar-meter thin", html: '<i style="width:' + s[2] + '%"></i>' })
      ]));
    });
    v.appendChild(stats);

    // Exam date
    const exam = day(state.examDate || EXAM.defaultExamDate);
    const diff = Math.round((exam - today()) / 864e5);
    const dateIn = el("input", { type: "date", id: "exam-date", value: state.examDate || EXAM.defaultExamDate });
    dateIn.addEventListener("change", () => { if (dateIn.value) { state.examDate = dateIn.value; commit(); render(); } });
    v.appendChild(el("section", { class: "card exam-row" }, [
      el("div", {}, [el("div", { class: "count", text: diff >= 0 ? String(diff) : "0" }), el("div", { class: "small muted", text: diff === 1 ? "day to exam" : diff >= 0 ? "days to exam" : "exam date has passed" })]),
      el("div", {}, [el("label", { for: "exam-date", text: isDone("w1-book") ? "Exam date" : "Target exam date" }), dateIn]),
      el("p", { class: "small muted", style: "flex:1 1 240px", text: isDone("w1-book") ? "Your booked date. The countdown and pace check use it." : "A target for now. You book in week 4, once your drill scores show you're on track; then set the real date here." })
    ]));

    // Wins this week
    const since = Math.min(day(w.start).getTime(), Date.now() - 7 * 864e5);
    const wins = ALL_TASKS.filter(t => state.done[t.id] > since).sort((a, b) => state.done[b.id] - state.done[a.id]);
    const winsCard = el("section", { class: "card" }, [el("h3", { text: wins.length ? "Your recent wins" : "Wins show up here" })]);
    if (wins.length) {
      const ul = el("ul", { class: "wins" });
      wins.slice(0, 5).forEach(t => ul.appendChild(el("li", { text: t.title })));
      if (wins.length > 5) ul.appendChild(el("li", { class: "muted", text: "and " + plural(wins.length - 5, "more") }));
      winsCard.appendChild(ul);
    } else winsCard.appendChild(el("p", { class: "muted small", style: "margin-top:6px", text: "Finish the step above and it appears here." }));
    v.appendChild(winsCard);

    // Rest of the week
    const rest = w.tasks.filter(t => !n || t.id !== n.t.id);
    const restCard = el("section", { class: "card" }, [el("div", { class: "row between" }, [el("h3", { text: "Also this week" }), el("button", { class: "linkbtn", text: "Full plan", onclick: () => go("plan") })])]);
    restCard.appendChild(cappedTaskList(rest));
    v.appendChild(restCard);

    v.appendChild(domainStrip());
  }

  function domainStrip() {
    const wrap = el("section", { "aria-label": "Exam domains" });
    wrap.appendChild(el("div", { class: "eyebrow", style: "margin-bottom:8px", text: "Domains, widths drawn to share of exam · bar = your readiness" }));
    const strip = el("div", { class: "strip" });
    DOMAINS.forEach(d => {
      const sc = Math.round(ratingScore(d) * 100);
      const b = el("button", { class: "seg", style: "flex:" + d.mid + " 1 0", title: d.name, onclick: () => go("progress", { domain: d.id }) }, [
        el("span", { class: "sid", html: "<span>" + dlabel(d.id) + " · " + d.weight[0] + "-" + d.weight[1] + "%</span><span>" + sc + "%</span>" }),
        el("span", { class: "sname", text: d.short }),
        el("span", { class: "bar-meter thin", html: '<i style="width:' + sc + '%"></i>' })
      ]);
      strip.appendChild(b);
    });
    wrap.appendChild(strip);
    return wrap;
  }

  /* ================= Learn ================= */
  let deepOpen = ls.get(KEY + "-deep") === "1";
  function nextLesson() { return LESSONS.find(l => !isDone(l.id)); }
  function viewLearn(v) {
    const nl = nextLesson();
    const done = LESSONS.filter(l => isDone(l.id)).length;
    const head = el("section", { class: "next" });
    const deepCb = el("input", { type: "checkbox", class: "check", id: "deep-open" }); deepCb.checked = deepOpen;
    deepCb.addEventListener("change", () => { deepOpen = deepCb.checked; ls.set(KEY + "-deep", deepOpen ? "1" : "0"); });
    v.appendChild(el("div", { class: "row between" }, [
      el("p", { class: "small muted", text: "Each lesson opens with the short version: goal, key points, exam trap, a 2-minute action. The full details sit under it." }),
      el("label", { class: "toggle", for: "deep-open" }, [deepCb, "Open full details by default"])
    ]));
    if (nl) {
      head.appendChild(el("div", { class: "eyebrow", text: "Next lesson · " + mins(nl.minutes) + " · " + dlabel(nl.domain) }));
      head.appendChild(el("div", { class: "what", text: nl.title }));
      head.appendChild(el("div", { class: "row" }, [el("button", { class: "btn", text: "Start lesson", onclick: () => go(nl.id) }), el("span", { class: "state", text: done + " of " + LESSONS.length + " lessons done" })]));
    } else {
      head.appendChild(el("div", { class: "what", text: "All " + LESSONS.length + " lessons done." }));
      head.appendChild(el("div", { class: "row" }, [el("button", { class: "btn", text: "Practice instead", onclick: () => go("practice") })]));
    }
    v.appendChild(head);
    DOMAINS.forEach(d => {
      const ls2 = LESSONS_BY_DOMAIN[d.id];
      const dn = ls2.filter(l => isDone(l.id)).length;
      const card = el("section", { class: "card" }, [
        el("div", { class: "row between" }, [
          el("div", {}, [el("div", { class: "eyebrow", text: dlabel(d.id) + " · " + d.weight[0] + "-" + d.weight[1] + "% of exam" }), el("h2", { text: d.short })]),
          el("span", { class: "pill" + (dn === ls2.length ? " ok" : ""), text: dn + " of " + ls2.length + " done" })
        ])
      ]);
      const list = el("div", { class: "lesson-list", style: "margin-top:8px" });
      ls2.forEach(l => {
        const cb = el("input", { type: "checkbox", class: "check", "aria-label": "Done: " + l.title });
        cb.checked = isDone(l.id);
        cb.addEventListener("change", () => { markDone(l.id, cb.checked); render(); });
        list.appendChild(el("div", { class: "lrow" + (isDone(l.id) ? " is-done" : "") }, [cb, el("button", { class: "ltitle", text: l.title, onclick: () => go(l.id) }), el("span", { class: "mins", text: mins(l.minutes) })]));
      });
      card.appendChild(list);
      v.appendChild(card);
    });
  }

  function viewLesson(v, id) {
    const l = LESSON[id];
    const siblings = LESSONS_BY_DOMAIN[l.domain];
    const idx = siblings.indexOf(l);
    const gi = LESSONS.indexOf(l);
    const next = LESSONS[gi + 1];
    const art = el("article", { class: "card lesson" });
    art.appendChild(el("div", { class: "row between" }, [
      el("button", { class: "linkbtn", text: "All lessons", onclick: () => go("learn") }),
      el("span", { class: "eyebrow", text: dlabel(l.domain) + " " + DOM[l.domain].short + " · lesson " + (idx + 1) + " of " + siblings.length })
    ]));
    art.appendChild(el("h1", { text: l.title }));
    art.appendChild(el("p", { class: "goal md", html: "<strong>Goal:</strong> " + md(l.goal) + ' <span class="mins">· ' + mins(l.minutes) + "</span>" }));
    const ul = el("ul", { class: "points md" });
    l.points.forEach(p => ul.appendChild(el("li", { html: md(p) })));
    art.appendChild(ul);
    if (l.trap) art.appendChild(el("div", { class: "trap md", html: "<b>Exam trap:</b> " + md(l.trap) }));
    if (l.snippet) art.appendChild(el("div", {}, [el("span", { class: "snip-label", text: l.snippet.label }), el("pre", {}, [el("code", { text: l.snippet.code })])]));
    art.appendChild(el("div", { class: "tryit md", html: "<b>Do this now (2 min):</b> <span>" + md(l.tryIt) + "</span>" }));

    if (l.details && l.details.length) {
      const n = l.details.reduce((a, s) => a + (s.points ? s.points.length : 0) + (s.table ? s.table.rows.length : 0) + (s.snippet ? 3 : 0), 0);
      const deep = el("details", { class: "deep", open: deepOpen });
      deep.appendChild(el("summary", {}, [el("span", { class: "deep-title", text: "Full details" }), el("span", { class: "small muted", text: l.details.length + " sections · about " + Math.max(2, Math.round(n / 4)) + " min · everything the exam can ask on this topic" })]));
      const body = el("div", { class: "deep-body" });
      l.details.forEach(s => body.appendChild(renderSection(s)));
      deep.appendChild(body);
      art.appendChild(deep);
    }

    const qs = (Q_BY_LESSON[l.id] || []).slice(0, 2);
    if (qs.length) {
      const box = el("section", { style: "display:grid;gap:12px" }, [el("h3", { text: "Check yourself" })]);
      qs.forEach((q, i) => box.appendChild(questionCard(q, { label: "Question " + (i + 1) + " of " + qs.length })));
      art.appendChild(box);
    }
    if (l.sources && l.sources.length) {
      const src = el("div", { class: "sources" }, [el("span", { class: "eyebrow", text: "Sources" })]);
      l.sources.forEach(s => src.appendChild(el("a", { href: s, target: "_blank", rel: "noopener", text: s.replace(/^https:\/\/(www\.)?/, "") })));
      art.appendChild(src);
    }
    const foot = el("div", { class: "lesson-foot" });
    const doneBtn = el("button", { class: "btn", text: isDone(l.id) ? (next ? "Next lesson: " + next.title : "Back to lessons") : (next ? "Mark done, next lesson" : "Mark done") });
    doneBtn.addEventListener("click", () => { if (!isDone(l.id)) markDone(l.id, true); go(next ? next.id : "learn"); });
    foot.appendChild(doneBtn);
    if (l.lab && LAB[l.lab]) foot.appendChild(el("button", { class: "btn ghost", text: "Related lab: " + LAB[l.lab].title, onclick: () => go(l.lab) }));
    art.appendChild(foot);
    v.appendChild(art);
  }

  /* ================= Question card ================= */
  const LETTERS = "ABCDEFG";
  const REASONS = [["wrong-answer", "The marked answer is wrong"], ["unclear", "The question is unclear or has two right answers"], ["off-exam", "Not something this exam covers"], ["outdated", "Outdated: GitHub changed this"], ["other", "Something else"]];
  function questionCard(q, opts) {
    opts = opts || {};
    const multi = q.answer.length > 1;
    let picks = [], checked = false;
    const card = el("div", { class: "card qcard" });
    function draw() {
      card.innerHTML = "";
      card.appendChild(el("div", { class: "qmeta" }, [
        el("span", { text: (opts.label ? opts.label + " · " : "") + dlabel(q.domain) + " " + DOM[q.domain].short }),
        el("span", { class: q.generated ? "pill accent" : "", text: q.generated ? "Written by Claude, verify in the docs" : (state.answers[q.id] ? (state.answers[q.id].ok ? "Last time: correct" : "Last time: missed") : "") })
      ]));
      card.appendChild(el("p", { class: "qtext", text: q.stem }));
      if (multi) card.appendChild(el("p", { class: "qhint", text: "Choose " + q.answer.length + "." }));
      const os = el("div", { class: "opts" });
      q.options.forEach((o, i) => {
        const b = el("button", { class: "opt", "aria-pressed": String(picks.includes(i)) }, [el("span", { class: "ol", text: LETTERS[i] }), el("span", { text: o })]);
        if (checked) {
          b.disabled = true;
          if (q.answer.includes(i)) b.classList.add(picks.includes(i) ? "right" : "missed");
          else if (picks.includes(i)) b.classList.add("wrong");
        } else b.addEventListener("click", () => {
          if (multi) { picks = picks.includes(i) ? picks.filter(x => x !== i) : picks.length < q.answer.length ? picks.concat(i) : picks; }
          else picks = [i];
          draw();
        });
        os.appendChild(b);
      });
      card.appendChild(os);
      if (checked) {
        const ok = sameSet(picks, q.answer);
        const why = el("div", { class: "why" }, [el("div", { html: "<strong>" + (ok ? "Correct." : "Not quite. Answer: " + q.answer.map(i => LETTERS[i]).join(" and ") + ".") + "</strong> " + md(q.explanation) })]);
        if (q.lesson && LESSON[q.lesson] && !opts.inLesson) why.appendChild(el("div", {}, [el("button", { class: "linkbtn", text: "Review the lesson: " + LESSON[q.lesson].title, onclick: () => go(q.lesson) })]));
        card.appendChild(why);
      }
      const acts = el("div", { class: "row between" });
      const left = el("div", { class: "row" });
      if (!checked) {
        const c = el("button", { class: "btn", text: "Check answer" });
        c.disabled = picks.length !== q.answer.length;
        c.addEventListener("click", () => { checked = true; recordAnswer(q, sameSet(picks, q.answer)); draw(); if (opts.onAnswered) opts.onAnswered(sameSet(picks, q.answer)); });
        left.appendChild(c);
      } else if (opts.onNext) left.appendChild(el("button", { class: "btn", text: opts.nextLabel || "Next question", onclick: opts.onNext }));
      acts.appendChild(left);
      acts.appendChild(reportControl(q, card));
      card.appendChild(acts);
    }
    draw();
    return card;
  }

  function reportControl(q, host) {
    if (state.reported[q.id]) return el("span", { class: "small muted", text: "You reported this question" });
    const btn = el("button", { class: "linkbtn small", text: "Report a problem" });
    btn.addEventListener("click", () => {
      if (host.querySelector(".report")) return;
      const form = el("form", { class: "report" });
      const fs = el("fieldset", {}, [el("legend", { text: "What's wrong with this question?" })]);
      REASONS.forEach((r, i) => {
        const id = "rr-" + q.id + "-" + i;
        const radio = el("input", { type: "radio", name: "reason-" + q.id, id, value: r[0] });
        if (i === 0) radio.required = true;
        fs.appendChild(el("label", { for: id }, [radio, r[1]]));
      });
      form.appendChild(fs);
      const ta = el("textarea", { id: "rc-" + q.id, maxlength: "600", placeholder: "What should it say instead? A docs link helps the reviewer." });
      form.appendChild(el("label", { for: "rc-" + q.id, class: "small muted", text: "Details (optional)" }));
      form.appendChild(ta);
      form.appendChild(el("div", { class: "row" }, [el("button", { class: "btn", type: "submit", text: "Send report" }), el("button", { class: "btn quiet", type: "button", text: "Cancel", onclick: () => form.remove() })]));
      form.addEventListener("submit", e => {
        e.preventDefault();
        const r = form.querySelector("input[type=radio]:checked");
        if (!r) return;
        const rep = { qid: q.id, qVersion: q.version || 1, reason: r.value, comment: ta.value.trim().slice(0, 600) };
        if (q.generated) Object.assign(rep, { qid: null, generated: { stem: q.stem, options: q.options, answer: q.answer, explanation: q.explanation, domain: q.domain } });
        sendReport(rep);
        form.remove();
        btn.replaceWith(el("span", { class: "small muted", text: "Reported. Thanks." }));
      });
      host.appendChild(form);
      form.querySelector("input").focus();
    });
    return btn;
  }

  /* ================= Practice ================= */
  let practice = { mode: "drill", domain: "all" };
  let drill = null, fresh = null, mock = null, mockTimer = null;
  const MOCK_KEY = "course-" + COURSE.id + "-mock";
  try { mock = JSON.parse(ls.get(MOCK_KEY) || "null"); } catch (e) { mock = null; }

  function drillDeck(domain, domains) {
    const pool = QUESTIONS.filter(q => domain !== "all" ? q.domain === domain : !domains || domains.includes(q.domain));
    const unseen = shuffle(pool.filter(q => !state.answers[q.id]));
    const missed = shuffle(pool.filter(q => state.answers[q.id] && !state.answers[q.id].ok));
    const right = shuffle(pool.filter(q => state.answers[q.id] && state.answers[q.id].ok));
    return unseen.concat(missed, right).map(q => q.id);
  }
  function missedIds() { return QUESTIONS.filter(q => state.answers[q.id] && !state.answers[q.id].ok).map(q => q.id); }

  function viewPractice(v, arg) {
    if (arg && arg.mode) {
      practice = { mode: arg.mode, domain: arg.domain || "all", domains: arg.domains };
      drill = null;
      currentArg = null;
    }
    if (mock && !mock.submitted && practice.mode !== "mock") {
      v.appendChild(el("section", { class: "callout trap" }, [el("span", { text: "A mock exam is in progress. " }), el("button", { class: "linkbtn", text: "Return to it", onclick: () => { practice.mode = "mock"; render(); } })]));
    }
    const missed = missedIds().length;
    const modes = el("section", { class: "modes", role: "group", "aria-label": "Practice mode" });
    [["drill", "Drill", "Unseen questions first, by domain"],
     ["mock", "Mock exam", EXAM.mock.questions + " questions, " + EXAM.mock.minutes + " min, weighted like the real exam"],
     ["missed", "Missed", missed ? plural(missed, "question") + " to redo" : "Nothing missed yet"],
     ["fresh", "Fresh from Claude", "5 new questions on any domain"]].forEach(m => {
      modes.appendChild(el("button", { class: "mode", "aria-pressed": String(practice.mode === m[0]), onclick: () => { practice.mode = m[0]; drill = null; render(); } }, [el("b", { text: m[1] }), el("span", { text: m[2] })]));
    });
    v.appendChild(modes);
    if (practice.mode === "mock") return viewMock(v);
    if (practice.mode === "fresh") return viewFresh(v);
    if (practice.mode === "missed") {
      if (!drill) drill = { ids: shuffle(missedIds()), i: 0, right: 0, kind: "missed" };
      return viewDeck(v, "Redo missed questions");
    }
    // drill
    const chips = el("div", { class: "chips", role: "group", "aria-label": "Domain" });
    [["all", "All domains"]].concat(DOMAINS.map(d => [d.id, dlabel(d.id) + " " + d.short])).forEach(o => {
      chips.appendChild(el("button", { class: "chip", "aria-pressed": String(practice.domain === o[0] && !practice.domains), onclick: () => { practice.domain = o[0]; practice.domains = null; drill = null; render(); } , text: o[1] }));
    });
    v.appendChild(chips);
    if (!drill) drill = { ids: drillDeck(practice.domain, practice.domains), i: 0, right: 0, kind: "drill" };
    viewDeck(v, practice.domains && practice.domain === "all" ? "Drill " + practice.domains.map(dlabel).join(" and ") : null);
  }

  function viewDeck(v, title) {
    if (title) v.appendChild(el("h2", { text: title }));
    if (!drill.ids.length) { v.appendChild(el("p", { class: "muted", text: drill.kind === "missed" ? "No missed questions. Drill a domain to find gaps." : "No questions in this set." })); return; }
    if (drill.i >= drill.ids.length) {
      v.appendChild(el("section", { class: "card", style: "display:grid;gap:10px" }, [
        el("h2", { text: "Set done: " + drill.right + " of " + drill.ids.length + " correct (" + pct(drill.right, drill.ids.length) + "%)" }),
        el("div", { class: "row" }, [el("button", { class: "btn", text: "Run it again", onclick: () => { drill = null; render(); } }), missedIds().length ? el("button", { class: "btn quiet", text: "Redo missed (" + missedIds().length + ")", onclick: () => { practice.mode = "missed"; drill = null; render(); } }) : null])
      ]));
      return;
    }
    const q = Q[drill.ids[drill.i]];
    v.appendChild(questionCard(q, {
      label: "Question " + (drill.i + 1) + " of " + drill.ids.length,
      onAnswered: ok => { if (ok) drill.right++; },
      onNext: () => { drill.i++; render(); },
      nextLabel: drill.i + 1 < drill.ids.length ? "Next question" : "See results"
    }));
  }

  /* ----- Mock exam ----- */
  function buildMock() {
    const n = EXAM.mock.questions, total = DOMAINS.reduce((a, d) => a + d.mid, 0);
    const raw = DOMAINS.map(d => ({ d, exact: n * d.mid / total }));
    raw.forEach(r => { r.k = Math.floor(r.exact); });
    let left = n - raw.reduce((a, r) => a + r.k, 0);
    raw.slice().sort((a, b) => (b.exact - b.k) - (a.exact - a.k)).forEach(r => { if (left > 0) { r.k++; left--; } });
    let ids = [];
    raw.forEach(r => { ids = ids.concat(shuffle(QUESTIONS.filter(q => q.domain === r.d.id)).slice(0, r.k).map(q => q.id)); });
    return { ids: shuffle(ids), picks: {}, flags: {}, i: 0, startedAt: Date.now(), minutes: EXAM.mock.minutes, submitted: false };
  }
  function saveMock() { if (mock) ls.set(MOCK_KEY, JSON.stringify(mock)); else ls.del(MOCK_KEY); }
  function stopMockTimer() { if (mockTimer) { clearInterval(mockTimer); mockTimer = null; } }
  function timeLeft() { return mock.startedAt + mock.minutes * 60000 - Date.now(); }
  function clock(ms) { ms = Math.max(0, ms); const m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000); return m + ":" + String(s).padStart(2, "0"); }

  function viewMock(v) {
    if (!mock || mock.submitted) {
      const last = state.mocks[state.mocks.length - 1];
      const card = el("section", { class: "card", style: "display:grid;gap:10px" }, [
        el("h2", { text: "Mock exam" }),
        el("p", { text: EXAM.mock.questions + " questions drawn to match each domain's share of the real exam. " + EXAM.mock.minutes + " minutes. No answers shown until you submit, like the real thing." }),
        el("p", { class: "small muted", text: "Target " + EXAM.mock.target + "% here before exam day. The real exam reports a scaled score (pass is 700), so this is a practice gauge, not a prediction." })
      ]);
      if (mock && mock.submitted) card.appendChild(mockResults());
      else if (last) card.appendChild(el("p", { class: "state", html: "Last mock: <strong>" + last.score + "%</strong> on " + esc(new Date(last.at).toLocaleDateString()) }));
      card.appendChild(el("div", { class: "row" }, [el("button", { class: "btn", text: mock && mock.submitted ? "Start a new mock" : "Start mock exam", onclick: () => { mock = buildMock(); saveMock(); render(); } })]));
      v.appendChild(card);
      return;
    }
    const q = Q[mock.ids[mock.i]];
    if (!q) { mock = null; saveMock(); render(); return; }
    const answeredN = mock.ids.filter(id => (mock.picks[id] || []).length).length;
    const top = el("div", { class: "row between" }, [
      el("span", { class: "state", html: "Question <strong>" + (mock.i + 1) + "</strong> of " + mock.ids.length + " · " + answeredN + " answered" }),
      el("span", { class: "pill", html: 'Time left <span class="timer" id="mock-timer">' + clock(timeLeft()) + "</span>" })
    ]);
    v.appendChild(top);
    const multi = q.answer.length > 1;
    const picks = mock.picks[q.id] || [];
    const card = el("div", { class: "card qcard" });
    card.appendChild(el("div", { class: "qmeta" }, [el("span", { text: "Mock exam" }), el("span", { text: mock.flags[q.id] ? "Flagged for review" : "" })]));
    card.appendChild(el("p", { class: "qtext", text: q.stem }));
    if (multi) card.appendChild(el("p", { class: "qhint", text: "Choose " + q.answer.length + "." }));
    const os = el("div", { class: "opts" });
    q.options.forEach((o, i) => {
      os.appendChild(el("button", { class: "opt", "aria-pressed": String(picks.includes(i)), onclick: () => {
        let p = mock.picks[q.id] || [];
        if (multi) p = p.includes(i) ? p.filter(x => x !== i) : p.length < q.answer.length ? p.concat(i) : p;
        else p = [i];
        mock.picks[q.id] = p; saveMock(); render();
      } }, [el("span", { class: "ol", text: LETTERS[i] }), el("span", { text: o })]));
    });
    card.appendChild(os);
    card.appendChild(el("div", { class: "row between" }, [
      el("div", { class: "row" }, [
        el("button", { class: "btn quiet", text: "Previous", disabled: mock.i === 0, onclick: () => { mock.i--; saveMock(); render(); } }),
        mock.i + 1 < mock.ids.length ? el("button", { class: "btn", text: "Next", onclick: () => { mock.i++; saveMock(); render(); } }) : el("button", { class: "btn", text: "Review and submit", onclick: () => submitMock(false) })
      ]),
      el("button", { class: "linkbtn small", text: mock.flags[q.id] ? "Remove flag" : "Flag for review", onclick: () => { mock.flags[q.id] = !mock.flags[q.id]; saveMock(); render(); } })
    ]));
    v.appendChild(card);
    const nav = el("div", { class: "qnav", "aria-label": "Jump to question" });
    mock.ids.forEach((id, i) => nav.appendChild(el("button", { class: ((mock.picks[id] || []).length ? "answered" : "") + (mock.flags[id] ? " flagged" : ""), "aria-current": String(i === mock.i), "aria-label": "Question " + (i + 1), text: String(i + 1), onclick: () => { mock.i = i; saveMock(); render(); } })));
    v.appendChild(el("section", { class: "card", style: "display:grid;gap:10px" }, [nav, el("div", { class: "row between" }, [
      el("span", { class: "small muted", text: "Filled = answered. Orange outline = flagged." }),
      el("div", { class: "row" }, [
        el("button", { class: "btn quiet", text: "Quit without scoring", onclick: () => { mock = null; saveMock(); render(); } }),
        el("button", { class: "btn", text: "Submit exam", onclick: () => submitMock(false) })
      ])
    ])]));
    mockTimer = setInterval(() => {
      const t = $("mock-timer");
      if (!mock || mock.submitted) return stopMockTimer();
      if (timeLeft() <= 0) { stopMockTimer(); submitMock(true); return; }
      if (t) t.textContent = clock(timeLeft());
    }, 1000);
  }
  function submitMock(timeUp) {
    const unanswered = mock.ids.filter(id => !(mock.picks[id] || []).length).length;
    if (!timeUp && unanswered && !submitMock.confirming) {
      submitMock.confirming = true;
      toast(plural(unanswered, "question") + " unanswered. Select Submit again to score anyway.");
      setTimeout(() => { submitMock.confirming = false; }, 4000);
      return;
    }
    submitMock.confirming = false;
    stopMockTimer();
    const by = {}; let right = 0;
    mock.ids.forEach(id => {
      const q = Q[id], ok = sameSet(mock.picks[id] || [], q.answer);
      by[q.domain] = by[q.domain] || [0, 0]; by[q.domain][1]++; if (ok) { by[q.domain][0]++; right++; }
      if ((mock.picks[id] || []).length) recordAnswer(q, ok);
    });
    mock.submitted = true; mock.score = pct(right, mock.ids.length); mock.right = right; mock.by = by;
    state.mocks.push({ at: Date.now(), score: mock.score, right, total: mock.ids.length, by });
    state.mocks = state.mocks.slice(-20);
    commit(); saveMock();
    if (timeUp) toast("Time is up. Your answers were scored.");
    render();
  }
  function mockResults() {
    const box = el("div", { style: "display:grid;gap:12px;margin-top:6px" });
    box.appendChild(el("div", { class: "row" }, [el("span", { class: "big-score", text: mock.score + "%" }), el("span", { class: "state", text: mock.right + " of " + mock.ids.length + " correct · " + (mock.score >= EXAM.mock.target ? "at or above your " + EXAM.mock.target + "% target" : "below your " + EXAM.mock.target + "% target") })]));
    DOMAINS.forEach(d => {
      const b = mock.by[d.id]; if (!b) return;
      box.appendChild(el("div", { class: "score-row" }, [el("span", { text: dlabel(d.id) + " " + d.short }), el("div", { class: "bar-meter", html: '<i style="width:' + pct(b[0], b[1]) + "%" + (pct(b[0], b[1]) < 70 ? ";background:var(--warn)" : "") + '"></i>' }), el("span", { class: "mono", text: b[0] + "/" + b[1] })]));
    });
    const wrong = mock.ids.filter(id => !sameSet(mock.picks[id] || [], Q[id].answer));
    if (wrong.length) {
      const det = el("details", {}, [el("summary", { text: "Review " + plural(wrong.length, "missed question") })]);
      wrong.forEach(id => { const q = Q[id]; det.appendChild(el("div", { class: "why", style: "margin-top:8px", html: "<strong>" + esc(q.stem) + "</strong><br>Answer: " + q.answer.map(i => LETTERS[i] + ". " + esc(q.options[i])).join("; ") + "<br>" + md(q.explanation) })); });
      box.appendChild(det);
    }
    return box;
  }

  /* ----- Fresh questions from Claude ----- */
  let sampleFn = null, sampleState = "pending", genCtl = null;
  async function initSample() {
    const c = window.claude;
    if (!c || !c.use) { sampleState = "absent"; return; }
    try { sampleFn = await c.use("sample"); } catch (e) { sampleFn = null; }
    sampleState = sampleFn ? "ready" : "absent";
    if (current === "practice" && practice.mode === "fresh") render();
  }
  function viewFresh(v) {
    if (!fresh) fresh = { domain: practice.domain === "all" ? "d1" : practice.domain, items: [], i: 0, status: "" };
    const chips = el("div", { class: "chips", role: "group", "aria-label": "Domain" });
    DOMAINS.forEach(d => chips.appendChild(el("button", { class: "chip", "aria-pressed": String(fresh.domain === d.id), text: dlabel(d.id) + " " + d.short, onclick: () => { fresh.domain = d.id; render(); } })));
    v.appendChild(chips);
    const card = el("section", { class: "card", style: "display:grid;gap:8px" });
    card.appendChild(el("p", { text: "Claude writes 5 new questions for " + dlabel(fresh.domain) + " from its objectives. Takes up to a minute and uses your Claude usage." }));
    const gen = el("button", { class: "btn", text: "Generate 5 questions", disabled: sampleState !== "ready" || !!genCtl });
    gen.addEventListener("click", () => generate(fresh.domain));
    const stop = el("button", { class: "btn quiet", text: "Stop", hidden: !genCtl, onclick: () => genCtl && genCtl.abort() });
    card.appendChild(el("div", { class: "row" }, [gen, stop]));
    const status = sampleState === "absent" ? "Fresh questions need the Claude app. The other modes work everywhere." : sampleState === "pending" ? "Connecting to Claude" : fresh.status;
    card.appendChild(el("p", { class: "small muted", text: status }));
    v.appendChild(card);
    if (fresh.items.length && fresh.i < fresh.items.length) {
      v.appendChild(questionCard(fresh.items[fresh.i], { label: "Fresh " + (fresh.i + 1) + " of " + fresh.items.length, onNext: () => { fresh.i++; render(); }, nextLabel: fresh.i + 1 < fresh.items.length ? "Next question" : "Finish set" }));
    } else if (fresh.items.length) v.appendChild(el("p", { class: "state", text: "Set finished. Generate another, or switch domain." }));
  }
  async function generate(did) {
    if (!sampleFn) return;
    const d = DOM[did];
    const obj = d.groups.map(g => "* " + g.title + ": " + g.objectives.map(o => o.text).join("; ")).join("\n");
    const existing = QUESTIONS.filter(q => q.domain === did).map(q => "- " + q.stem).join("\n");
    const prompt = "You write practice questions for the certification exam " + EXAM.code + ": " + EXAM.name + " (skills measured as of " + EXAM.objectivesAsOf + ").\n\n" +
      "Domain " + d.num + ": " + d.name + " (" + d.weight[0] + "-" + d.weight[1] + "% of the exam). Objectives:\n" + obj + "\n\n" +
      "Write 5 new questions that test these objectives the way a certification exam would: short realistic scenarios, plausible distractors, one unambiguous answer. Make 1 of the 5 a \"Choose two\" question with exactly two correct options. " +
      "Use only behavior documented in GitHub Docs. Use current product names: GitHub Secret Protection, GitHub Code Security, supply chain security. Write plainly and never use em dashes. " +
      "Don't repeat or closely paraphrase these existing questions:\n" + existing + "\n\n" +
      'Reply with only a JSON array of 5 objects like {"stem": "question text", "options": ["A", "B", "C", "D"], "answer": [0], "explanation": "one or two sentences on why"}. "answer" lists zero-based indexes of the correct options; vary their positions.';
    genCtl = new AbortController();
    fresh.status = "Writing questions. This can take up to a minute."; render();
    try {
      const res = await sampleFn.json(prompt, { signal: genCtl.signal, cache: false });
      const items = (Array.isArray(res) ? res : []).filter(x => x && typeof x.stem === "string" && Array.isArray(x.options) && x.options.length >= 4 && x.options.length <= 5 &&
        x.options.every(o => typeof o === "string") && Array.isArray(x.answer) && x.answer.length >= 1 && x.answer.length <= 2 && x.answer.every(i => Number.isInteger(i) && i >= 0 && i < x.options.length))
        .map((x, i) => ({ id: "gen-" + Date.now() + "-" + i, generated: true, domain: did, stem: x.stem, options: x.options, answer: x.answer, explanation: typeof x.explanation === "string" ? x.explanation : "" }));
      if (items.length) { fresh.items = items; fresh.i = 0; fresh.status = items.length + " new questions ready."; }
      else fresh.status = "The questions came back in a format the app can't read. Select Generate again.";
    } catch (e) {
      const c = e && e.code;
      if (c === "cancelled") fresh.status = "Stopped.";
      else if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(c)) { sampleState = "absent"; sampleFn = null; }
      else if (c === "rate_limited") fresh.status = "Too many requests right now. Try again in a minute.";
      else if (c === "invalid_json") fresh.status = "The questions came back in a format the app can't read. Select Generate again.";
      else if (c === "session_expired") fresh.status = "Sign in to Claude again, then retry.";
      else fresh.status = "Couldn't generate questions. Select Generate again.";
    }
    genCtl = null;
    if (current === "practice") render();
  }

  /* ================= Labs ================= */
  let labFilter = ls.get(KEY + "-lf") || "all";
  const REQ = { free: ["Free on a public repo", "req-free"], org: ["Needs org", "req-org"], local: ["Local CLI", "req-local"], learn: ["Launch from Learn", "req-learn"] };
  function viewLabs(v) {
    const nextLab = LABS.find(l => !isDone(l.id));
    if (nextLab) v.appendChild(el("section", { class: "next" }, [
      el("div", { class: "eyebrow", text: "Next lab · " + mins(nextLab.minutes) }),
      el("div", { class: "what", text: nextLab.title }),
      el("div", { class: "row" }, [el("a", { class: "btn", href: nextLab.link, target: "_blank", rel: "noopener", text: "Open lab" }), el("button", { class: "btn quiet", text: "See steps", onclick: () => go(nextLab.id) })])
    ]));
    v.appendChild(el("p", { class: "state", text: LABS.filter(l => isDone(l.id)).length + " of " + LABS.length + " labs done. \"Needs org\" labs need an organization with Secret Protection or Code Security." }));
    const chips = el("div", { class: "chips", role: "group", "aria-label": "Filter labs" });
    [["all", "All"], ["learn", "From the training"], ["free", "Free on a public repo"], ["org", "Needs org"], ["todo", "Not done"]].forEach(o => {
      chips.appendChild(el("button", { class: "chip", "aria-pressed": String(labFilter === o[0]), text: o[1], onclick: () => { labFilter = o[0]; ls.set(KEY + "-lf", labFilter); render(); } }));
    });
    v.appendChild(chips);
    const grid = el("div", { class: "labs" });
    LABS.filter(l => labFilter === "learn" ? l.fromTraining : labFilter === "free" ? l.requires === "free" : labFilter === "org" ? l.requires === "org" : labFilter === "todo" ? !isDone(l.id) : true).forEach(l => {
      const r = REQ[l.requires];
      const cb = el("input", { type: "checkbox", class: "check", id: "lab-done-" + l.id });
      cb.checked = isDone(l.id);
      cb.addEventListener("change", () => { markDone(l.id, cb.checked); render(); });
      const ol = el("ol");
      l.steps.forEach(s => ol.appendChild(el("li", { class: "md", html: md(s) })));
      const pre = l.prereqs ? el("div", { class: "lab-pre md" }, [el("b", { text: "Before you start: " }), el("span", { html: l.prereqs.map(md).join(" · ") })]) : null;
      const tips = l.tips ? el("ul", { class: "lab-tips md" }, l.tips.map(t => el("li", { html: md(t) }))) : null;
      grid.appendChild(el("article", { class: "card lab", id: l.id }, [
        el("div", { class: "row between" }, [el("span", { class: "pill", text: l.source + (l.fromTraining ? " · in the training" : "") }), el("span", { class: "pill " + r[1], text: r[0] })]),
        el("h3", { text: l.title }),
        el("div", { class: "mins", text: mins(l.minutes) + " · " + l.domains.map(dlabel).join(", ") }),
        pre,
        ol,
        l.code ? el("pre", {}, [el("code", { text: l.code })]) : null,
        l.verify ? el("div", { class: "lab-verify md", html: "<b>You're done when:</b> " + md(l.verify) }) : null,
        tips,
        el("div", { class: "lfoot" }, [el("a", { class: "btn", href: l.link, target: "_blank", rel: "noopener", text: "Open lab" }), el("label", { class: "toggle", for: "lab-done-" + l.id }, [cb, "Done"])])
      ]));
    });
    if (!grid.children.length) grid.appendChild(el("p", { class: "muted", text: "Every lab in this filter is done." }));
    v.appendChild(grid);
  }

  /* ================= Plan ================= */
  function viewPlan(v) {
    const p = pace(), cur = weekIndex();
    v.appendChild(el("p", { class: "state", html: "<strong>" + p.done + " of " + ALL_TASKS.length + "</strong> tasks done · about " + mins(ALL_TASKS.filter(t => !isDone(t.id)).reduce((a, t) => a + t.minutes, 0)) + " of work left · each week shows its next 5 open tasks" }));
    WEEKS.forEach((w, i) => {
      const n = w.tasks.filter(t => isDone(t.id)).length;
      const total = w.tasks.reduce((a, t) => a + t.minutes, 0);
      const card = el("section", { class: "card week" + (i === cur ? " current" : "") }, [
        el("div", { class: "week-head" }, [
          el("div", {}, [el("div", { class: "eyebrow", text: "Week " + (i + 1) + " · " + fmt(w.start) + " to " + fmt(w.end) + " · about " + mins(total) + (i === cur ? " · this week" : "") }), el("h2", { text: w.title }), el("p", { class: "small muted", text: w.goal })]),
          el("div", { class: "wprog" }, [el("span", { text: n + "/" + w.tasks.length }), el("div", { class: "bar-meter thin", html: '<i style="width:' + pct(n, w.tasks.length) + '%"></i>' })])
        ])
      ]);
      card.appendChild(cappedTaskList(w.tasks));
      v.appendChild(card);
    });
  }

  /* ================= Progress ================= */
  const LV = ["Not yet", "Shaky", "Solid"];
  let onlyGaps = ls.get(KEY + "-gaps") === "1";
  function viewProgress(v, arg) {
    const ready = readiness(), acc = accuracy();
    v.appendChild(el("p", { class: "state", html: "Readiness <strong>" + ready + "%</strong> from your ratings · practice accuracy <strong>" + (acc.t ? pct(acc.r, acc.t) + "%" : "none yet") + "</strong>" + (state.mocks.length ? " · last mock <strong>" + state.mocks[state.mocks.length - 1].score + "%</strong>" : "") }));
    const sum = el("section", { class: "card", style: "display:grid;gap:6px" }, [el("h3", { text: "By domain: rating, then practice accuracy" })]);
    DOMAINS.forEach(d => {
      const r = Math.round(ratingScore(d) * 100), a = accuracy(d.id);
      sum.appendChild(el("div", { class: "score-row" }, [el("span", { text: dlabel(d.id) + " " + d.short }), el("div", { class: "bar-meter", html: '<i style="width:' + r + '%"></i>' }), el("span", { class: "mono", text: r + "% · " + (a.t ? pct(a.r, a.t) + "%" : "n/a") })]));
    });
    v.appendChild(sum);
    const tools = el("div", { class: "row between" });
    const cb = el("input", { type: "checkbox", class: "check", id: "only-gaps" }); cb.checked = onlyGaps;
    cb.addEventListener("change", () => { onlyGaps = cb.checked; ls.set(KEY + "-gaps", onlyGaps ? "1" : "0"); list.classList.toggle("only-gaps", onlyGaps); });
    tools.appendChild(el("label", { class: "toggle", for: "only-gaps" }, [cb, "Hide objectives rated Solid"]));
    tools.appendChild(el("a", { href: EXAM.studyGuide, target: "_blank", rel: "noopener", class: "small", text: "Official study guide" }));
    v.appendChild(tools);
    const list = el("div", { class: onlyGaps ? "only-gaps" : "", style: "display:grid;gap:14px" });
    DOMAINS.forEach(d => {
      const sc = Math.round(ratingScore(d) * 100);
      const sec = el("section", { class: "card", id: "dom-" + d.id }, [el("div", { class: "dom-head" }, [
        el("div", {}, [el("div", { class: "eyebrow", text: dlabel(d.id) + " · " + d.weight[0] + "-" + d.weight[1] + "% of the exam" }), el("h2", { text: d.name })]),
        el("div", { class: "wprog mono small", style: "display:grid;gap:4px;text-align:right" }, [el("span", { text: "Ready " + sc + "%" }), el("div", { class: "bar-meter thin", html: '<i style="width:' + sc + '%"></i>' })])
      ])]);
      d.groups.forEach(g => {
        const lessonsFor = LESSONS.filter(l => g.objectives.some(o => (l.objectives || []).includes(o.id)));
        const grp = el("div", { class: "grp" }, [el("div", { class: "grp-title" }, [el("span", { text: g.title }), lessonsFor.length ? el("button", { class: "linkbtn small", text: "Lesson: " + lessonsFor[0].title, onclick: () => go(lessonsFor[0].id) }) : null])]);
        g.objectives.forEach(o => {
          const row = el("div", { class: "obj" + (state.conf[o.id] === 2 ? " is-solid" : "") }, [el("span", { text: o.text })]);
          const seg = el("span", { class: "seg3", role: "group", "aria-label": "Confidence" });
          LV.forEach((lab, vi) => seg.appendChild(el("button", { "data-v": String(vi), "aria-pressed": String(state.conf[o.id] === vi), text: lab, onclick: () => {
            if (state.conf[o.id] === vi) delete state.conf[o.id]; else state.conf[o.id] = vi;
            commit();
            seg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(state.conf[o.id] === +b.dataset.v)));
            row.classList.toggle("is-solid", state.conf[o.id] === 2);
          } })));
          row.appendChild(seg);
          grp.appendChild(row);
        });
        sec.appendChild(grp);
      });
      list.appendChild(sec);
    });
    v.appendChild(list);
    const rep = Object.keys(state.reported).length;
    v.appendChild(el("p", { class: "small muted", text: rep ? "You've reported " + plural(rep, "question") + ". Reports go to a review queue." : "See a bad question? Use Report a problem under it." }));
    if (arg && arg.domain) setTimeout(() => { const n = $("dom-" + arg.domain); if (n) n.scrollIntoView({ block: "start" }); }, 30);
  }

  /* ================= Reference ================= */
  function viewReference(v) {
    v.appendChild(el("p", { class: "state", text: "Facts to know cold, checked against GitHub Docs on " + EXAM.contentCheckedOn + ". GitHub ships changes often; confirm anything surprising on the linked page." }));
    const grid = el("div", { class: "ref-grid" });
    REF.sections.forEach(s => {
      const card = el("section", { class: "card" + (s.wide ? " wide" : ""), style: "display:grid;gap:10px" }, [el("h3", { text: s.title })]);
      if (s.table) card.appendChild(renderTable(s.table));
      if (s.items) { const ul = el("ul", { class: "ref-list md" }); s.items.forEach(i => ul.appendChild(el("li", { html: md(i) }))); card.appendChild(ul); }
      if (s.snippets) s.snippets.forEach(sn => card.appendChild(el("div", {}, [el("span", { class: "snip-label", text: sn.label }), el("pre", {}, [el("code", { text: sn.code })])])));
      if (s.links) { const ul = el("ul", { class: "ref-list" }); s.links.forEach(l => ul.appendChild(el("li", {}, [el("a", { href: l.url, target: "_blank", rel: "noopener", text: l.title }), l.note ? " (" + l.note + ")" : null]))); card.appendChild(ul); }
      if (s.note) card.appendChild(el("p", { class: "small muted md", html: md(s.note) }));
      grid.appendChild(card);
    });
    v.appendChild(grid);
  }

  /* ================= Boot ================= */
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-go]");
    if (b) { e.preventDefault(); go(b.dataset.go); }
  });
  $("foot").textContent = "Content checked " + EXAM.contentCheckedOn + " against the " + EXAM.code + " study guide (skills measured as of " + EXAM.objectivesAsOf + ") and GitHub Docs · build " + BUILD.version + (BUILD.commit ? " (" + BUILD.commit + ")" : "") + " · Practice questions are study aids, not real exam items.";
  const start = (location.hash || "").slice(1) || ls.get(KEY + "-view") || "today";
  if (LESSON[start] || LAB[start] || VIEWS[start]) go(start); else go("today");
  connect();
  initSample();
})();
