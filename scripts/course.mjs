// Shared course loader for the Vite build (vite.config.js) and the Claude artifact build (build-artifact.mjs).
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function gitCommit() {
  // Vercel builds without a full git checkout, but it exposes the commit.
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try { return execFileSync("git", ["rev-parse", "--short", "HEAD"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return ""; }
}

// Returns the course data the app reads, plus the template split into head and body with the text placeholders filled.
export function loadCourse(id = "gh-500") {
  const dir = `courses/${id}`;
  if (!existsSync(dir)) throw new Error(`No course folder ${dir}`);
  const read = f => JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
  // Lessons live either in lessons.json or, for a bigger course, one file per domain in lessons/.
  const lessons = existsSync(`${dir}/lessons`)
    ? readdirSync(`${dir}/lessons`).filter(f => f.endsWith(".json")).sort().flatMap(f => read(`lessons/${f}`))
    : read("lessons.json");
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));

  const data = {
    course: read("course.json"),
    lessons,
    questions: read("questions.json"),
    labs: read("labs.json"),
    plan: read("plan.json"),
    reference: read("reference.json"),
    build: { version: pkg.version, commit: gitCommit(), builtAt: new Date().toISOString() }
  };

  const exam = data.course.exam;
  const values = {
    TITLE: escHtml(data.course.title),
    DESCRIPTION: escHtml(`${exam.code} ${exam.name}: lessons, labs, practice questions and a study plan.`),
    EXAM_CODE: escHtml(exam.code),
    EXAM_NAME: escHtml(exam.name)
  };
  // A function replacement so "$" in the content is never treated as a pattern.
  const filled = readFileSync("src/template.html", "utf8").replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in values ? values[k] : m));
  const [head, body] = filled.split("<!-- body -->");
  return { id, data, head, body };
}
