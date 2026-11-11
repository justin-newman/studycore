// Builds one course into two files:
//   dist/<course>/index.html     full document, for static hosting
//   dist/<course>/artifact.html  page content only, for publishing as a Claude artifact
// Usage: node scripts/build.mjs [course-id]
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const id = process.argv[2] || "gh-500";
const dir = `courses/${id}`;
const read = f => JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
// Lessons live either in lessons.json or, for a bigger course, one file per domain in lessons/.
const readLessons = () => existsSync(`${dir}/lessons`)
  ? readdirSync(`${dir}/lessons`).filter(f => f.endsWith(".json")).sort().flatMap(f => read(`lessons/${f}`))
  : read("lessons.json");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

let commit = "";
try { commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch {}

const data = {
  course: read("course.json"),
  lessons: readLessons(),
  questions: read("questions.json"),
  labs: read("labs.json"),
  plan: read("plan.json"),
  reference: read("reference.json"),
  build: { version: pkg.version, commit, builtAt: new Date().toISOString() }
};

// Keep "</script>" and friends out of the inline JSON.
const json = JSON.stringify(data).replace(/</g, "\\u003c");
// Text that lands in markup is escaped; only CSS, APP and DATA go in raw.
const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const values = {
  TITLE: escHtml(data.course.title),
  DESCRIPTION: escHtml(`${data.course.exam.code} ${data.course.exam.name}: lessons, labs, practice questions and a study plan.`),
  EXAM_CODE: escHtml(data.course.exam.code),
  EXAM_NAME: escHtml(data.course.exam.name),
  CSS: readFileSync("src/styles.css", "utf8"),
  APP: readFileSync("src/app.js", "utf8"),
  DATA: json
};
// A function replacement so "$" in the app code is never treated as a pattern.
const filled = readFileSync("src/template.html", "utf8").replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in values ? values[k] : m));
const [head, body] = filled.split("<!-- body -->");

mkdirSync(`dist/${id}`, { recursive: true });
writeFileSync(`dist/${id}/artifact.html`, head + body);
writeFileSync(
  `dist/${id}/index.html`,
  '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    head + "</head>\n<body>\n" + body + "</body>\n</html>\n"
);
const kb = n => (n / 1024).toFixed(0) + " KB";
console.log(`Built ${id} v${pkg.version}${commit ? " (" + commit + ")" : ""}: ${data.lessons.length} lessons, ${data.questions.length} questions, ${data.labs.length} labs. index.html ${kb(readFileSync(`dist/${id}/index.html`).length)}`);
