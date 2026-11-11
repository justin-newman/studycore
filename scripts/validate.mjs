// Content gate for a course. Runs locally and in CI on every pull request,
// so a person or an agent can't merge content that breaks the course rules.
// Usage: node scripts/validate.mjs [course-id]
import { readFileSync, existsSync, readdirSync } from "node:fs";

const id = process.argv[2] || "gh-500";
const dir = `courses/${id}`;
// Lessons live in lessons.json or, split by domain, in lessons/*.json.
const lessonFiles = existsSync(`${dir}/lessons`) ? readdirSync(`${dir}/lessons`).filter(f => f.endsWith(".json")).sort().map(f => `lessons/${f}`) : ["lessons.json"];
const files = ["course.json", ...lessonFiles, "questions.json", "labs.json", "plan.json", "reference.json"];
const raw = {}, data = {};
const errors = [], warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

for (const f of files) {
  try { raw[f] = readFileSync(`${dir}/${f}`, "utf8"); data[f] = JSON.parse(raw[f]); }
  catch (e) { err(f, "can't read or parse: " + e.message); }
}
if (errors.length) finish();

const course = data["course.json"], questions = data["questions.json"];
const lessons = lessonFiles.flatMap(f => { if (!Array.isArray(data[f])) err(f, "must be a JSON array of lessons"); return Array.isArray(data[f]) ? data[f] : []; });
const labs = data["labs.json"], plan = data["plan.json"];

/* Style rules from the house style and the ADHD reading rules. */
for (const f of files) {
  raw[f].split("\n").forEach((line, i) => {
    if (/—/.test(line)) err(`${f}:${i + 1}`, "em dash; use a colon, comma, parentheses or a period");
    if (/–/.test(line)) err(`${f}:${i + 1}`, "en dash; use a hyphen for ranges");
    // Three dots are allowed only as an infix operator inside a code span, like Git's `{base}...{head}`.
    const prose = line.replace(/`[^`]*`/g, span => span.replace(/(?<=[^\s.`])\.\.\.(?=[^\s.`])/g, ""));
    if (/…|\.\.\./.test(prose)) err(`${f}:${i + 1}`, "ellipsis");
  });
}
const isUrl = s => typeof s === "string" && /^https:\/\/\S+$/.test(s);
const maxLen = (where, s, n, label) => { if (typeof s !== "string" || !s.trim()) err(where, `${label} is missing`); else if (s.length > n) err(where, `${label} is ${s.length} chars; keep it under ${n}`); };

/* Course and objectives */
for (const k of ["title"]) if (/[<>"'&]/.test(course[k] || "")) err("course", `${k} must not contain markup characters`);
for (const k of ["code", "name"]) if (/[<>"'&]/.test(course.exam[k] || "")) err("course", `exam.${k} must not contain markup characters`);
for (const k of ["studyGuide", "examPage", "sandbox"]) if (!isUrl(course.exam[k])) err("course", `exam.${k} must be an https URL`);
for (const s of data["reference.json"].sections || []) for (const l of s.links || []) if (!isUrl(l.url)) err(`reference "${s.title}"`, `link "${l.title}" must be an https URL`);
const domainIds = new Set(), objectiveIds = new Set();
for (const d of course.domains) {
  if (domainIds.has(d.id)) err("course", `duplicate domain ${d.id}`);
  domainIds.add(d.id);
  if (!Array.isArray(d.weight) || d.weight.length !== 2 || d.weight[0] > d.weight[1]) err(`course ${d.id}`, "weight must be [min, max]");
  for (const g of d.groups) for (const o of g.objectives) {
    if (objectiveIds.has(o.id)) err("course", `duplicate objective ${o.id}`);
    objectiveIds.add(o.id);
  }
}

/* Labs */
const labIds = new Set();
for (const l of labs) {
  const w = `lab ${l.id}`;
  if (labIds.has(l.id)) err(w, "duplicate id");
  labIds.add(l.id);
  if (!["free", "org", "local", "learn"].includes(l.requires)) err(w, "requires must be free, org, local or learn");
  if (!isUrl(l.link)) err(w, "link must be https");
  if (!Number.isInteger(l.minutes) || l.minutes < 5 || l.minutes > 90) err(w, "minutes must be 5 to 90");
  if (!Array.isArray(l.steps) || !l.steps.length || l.steps.length > 7) err(w, "1 to 7 steps");
  else if (l.steps.length > 5) warn(w, `${l.steps.length} steps; 5 is the guideline`);
  for (const k of ["prereqs", "tips"]) if (l[k] != null && (!Array.isArray(l[k]) || l[k].length > 5 || !l[k].every(s => typeof s === "string" && s.trim()))) err(w, `${k} must be up to 5 non-empty strings`);
  if (l.verify != null) maxLen(w, l.verify, 240, "verify (how you know it worked)");
  (l.domains || []).forEach(d => { if (!domainIds.has(d)) err(w, `unknown domain ${d}`); });
}
const checkTable = (w, t) => {
  if (!t || !Array.isArray(t.rows) || !t.rows.length) return err(w, "table needs rows");
  if (t.head && !Array.isArray(t.head)) return err(w, "table head must be an array");
  const width = t.head ? t.head.length : t.rows[0].length;
  t.rows.forEach((r, i) => { if (!Array.isArray(r) || r.length !== width) err(w, `table row ${i + 1} has ${r && r.length} cells; expected ${width}`); });
};

/* Lessons: the ADHD shape is enforced here */
const lessonIds = new Set(), covered = new Set();
for (const l of lessons) {
  const w = `lesson ${l.id}`;
  if (!/^l-[a-z0-9-]+$/.test(l.id)) err(w, "id must look like l-some-name");
  if (lessonIds.has(l.id)) err(w, "duplicate id");
  lessonIds.add(l.id);
  if (!domainIds.has(l.domain)) err(w, `unknown domain ${l.domain}`);
  maxLen(w, l.title, 60, "title");
  if (!Number.isInteger(l.minutes) || l.minutes < 3 || l.minutes > 20) err(w, "minutes must be 3 to 20; split a longer lesson");
  maxLen(w, l.goal, 160, "goal (one sentence)");
  if (!Array.isArray(l.points) || !l.points.length || l.points.length > 6) err(w, "1 to 6 key points; the rest goes in details");
  else {
    if (l.points.length > 5) warn(w, "6 key points; 5 is the guideline");
    l.points.forEach((p, i) => maxLen(w, p, 300, `point ${i + 1}`));
  }
  if (l.trap != null) maxLen(w, l.trap, 300, "trap");
  maxLen(w, l.tryIt, 240, "tryIt (one action under 2 minutes)");
  // Full details: the thorough layer under the short core. Sections, each with points, a table or a snippet.
  if (l.details != null) {
    if (!Array.isArray(l.details) || !l.details.length || l.details.length > 8) err(w, "details must be 1 to 8 sections");
    else l.details.forEach((s, si) => {
      const ws = `${w} details ${si + 1}`;
      maxLen(ws, s.title, 70, "title");
      if (!s.points && !s.table && !s.snippet) err(ws, "needs points, a table or a snippet");
      if (s.points != null) {
        if (!Array.isArray(s.points) || !s.points.length || s.points.length > 10) err(ws, "1 to 10 points");
        else s.points.forEach((p, i) => maxLen(ws, p, 320, `point ${i + 1}`));
      }
      if (s.table != null) checkTable(ws, s.table);
      if (s.snippet != null && (typeof s.snippet.label !== "string" || typeof s.snippet.code !== "string")) err(ws, "snippet needs label and code");
    });
  } else warn(w, "no details section; the core alone is rarely enough for the exam");
  if (!Array.isArray(l.sources) || !l.sources.length || !l.sources.every(isUrl)) err(w, "at least one https source");
  if (l.lab && !labIds.has(l.lab)) err(w, `unknown lab ${l.lab}`);
  if (l.snippet && (typeof l.snippet.label !== "string" || typeof l.snippet.code !== "string")) err(w, "snippet needs label and code");
  if (!Array.isArray(l.objectives) || !l.objectives.length) err(w, "list the objectives it covers");
  else l.objectives.forEach(o => { if (!objectiveIds.has(o)) err(w, `unknown objective ${o}`); covered.add(o); });
}
for (const o of objectiveIds) if (!covered.has(o)) err("coverage", `objective ${o} has no lesson`);

/* Questions */
const qIds = new Set(), perDomain = {}, perLesson = {};
let multi = 0;
for (const q of questions) {
  const w = `question ${q.id}`;
  if (!/^q\d{3}$/.test(q.id)) err(w, "id must look like q001");
  if (qIds.has(q.id)) err(w, "duplicate id");
  qIds.add(q.id);
  if (!domainIds.has(q.domain)) err(w, `unknown domain ${q.domain}`);
  perDomain[q.domain] = (perDomain[q.domain] || 0) + 1;
  if (q.lesson && !lessonIds.has(q.lesson)) err(w, `unknown lesson ${q.lesson}`);
  if (q.lesson) perLesson[q.lesson] = (perLesson[q.lesson] || 0) + 1;
  if (!Number.isInteger(q.version) || q.version < 1) err(w, "version must be a positive integer; bump it on every change");
  maxLen(w, q.stem, 400, "stem");
  if (!Array.isArray(q.options) || q.options.length < 4 || q.options.length > 5) err(w, "4 or 5 options");
  else {
    if (new Set(q.options.map(o => o.trim().toLowerCase())).size !== q.options.length) err(w, "duplicate options");
    q.options.forEach((o, i) => maxLen(w, o, 220, `option ${i + 1}`));
  }
  if (!Array.isArray(q.answer) || !q.answer.length || q.answer.length > 3) err(w, "answer must list 1 to 3 option indexes");
  else {
    if (new Set(q.answer).size !== q.answer.length) err(w, "duplicate answer index");
    q.answer.forEach(i => { if (!Number.isInteger(i) || i < 0 || i >= (q.options || []).length) err(w, `answer index ${i} out of range`); });
    if (q.answer.length > 1) multi++;
  }
  maxLen(w, q.explanation, 420, "explanation");
  if (!Array.isArray(q.sources) || !q.sources.length || !q.sources.every(isUrl)) err(w, "at least one https source");
}
if (questions.length < 50) err("questions", `${questions.length} questions; need at least 50`);
const total = questions.length;
for (const d of course.domains) {
  const share = (perDomain[d.id] || 0) / total * 100;
  if (share < d.weight[0] || share > d.weight[1]) err("questions", `${d.id} is ${share.toFixed(1)}% of the bank; the exam weight is ${d.weight[0]}-${d.weight[1]}%`);
}
for (const l of lessons) if ((perLesson[l.id] || 0) < 2) warn("coverage", `lesson ${l.id} has ${perLesson[l.id] || 0} question(s); aim for 2 or more`);

/* Plan */
const taskIds = new Set(), planned = new Set();
for (const w of plan) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(w.start) || !/^\d{4}-\d{2}-\d{2}$/.test(w.end)) err(`plan ${w.id}`, "start and end must be YYYY-MM-DD");
  maxLen(`plan ${w.id}`, w.goal, 160, "goal");
  for (const t of w.tasks) {
    const where = `plan ${w.id} task ${t.id}`;
    if (taskIds.has(t.id)) err(where, "duplicate task id");
    taskIds.add(t.id);
    if (t.kind === "lesson") { if (!lessonIds.has(t.id)) err(where, "no lesson with this id"); planned.add(t.id); }
    else if (t.kind === "lab") { if (!labIds.has(t.id)) err(where, "no lab with this id"); }
    else {
      if (!["module", "admin", "read", "practice", "rate", "exam"].includes(t.kind)) err(where, `unknown kind ${t.kind}`);
      maxLen(where, t.title, 90, "title");
      if (!Number.isInteger(t.minutes)) err(where, "minutes required (concrete time estimates)");
      if (t.link && !isUrl(t.link)) err(where, "link must be https");
    }
  }
}
for (const l of lessonIds) if (!planned.has(l)) err("plan", `lesson ${l} isn't scheduled in any week`);

finish();

function finish() {
  if (errors.length) {
    console.error(`Validation failed for ${id}: ${errors.length} problem${errors.length === 1 ? "" : "s"}`);
    errors.slice(0, 60).forEach(e => console.error("  " + e));
    if (errors.length > 60) console.error(`  and ${errors.length - 60} more`);
    process.exit(1);
  }
  const dist = Object.entries(perDomain).sort().map(([d, n]) => `${d} ${n} (${(n / total * 100).toFixed(0)}%)`).join(", ");
  const detailed = lessons.filter(l => l.details).length;
  console.log(`OK ${id}: ${lessons.length} lessons (${detailed} with full details) covering ${objectiveIds.size} objectives, ${total} questions (${multi} multi-select): ${dist}`);
  if (warnings.length && !process.argv.includes("--quiet")) {
    console.log(`${warnings.length} warning${warnings.length === 1 ? "" : "s"} (guidelines, not gates):`);
    warnings.slice(0, 40).forEach(w => console.log("  " + w));
    if (warnings.length > 40) console.log(`  and ${warnings.length - 40} more`);
  }
}
