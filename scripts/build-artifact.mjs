// Builds the Claude artifact version of a course: page content only, with CSS, data and app inlined.
//   dist-artifact/<course>/artifact.html
// The hosted site is built by Vite (npm run build). Usage: node scripts/build-artifact.mjs [course-id]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { loadCourse } from "./course.mjs";

const { id, data, head, body } = loadCourse(process.argv[2] || "gh-500");

// Keep "</script>" and friends out of the inline JSON.
const json = JSON.stringify(data).replace(/</g, "\\u003c");
const css = readFileSync("src/styles.css", "utf8");
const app = readFileSync("src/app.js", "utf8");

const out = `dist-artifact/${id}/artifact.html`;
mkdirSync(`dist-artifact/${id}`, { recursive: true });
writeFileSync(out,
  head + `<style>${css}</style>\n` +
  body + `<script type="application/json" id="course-data">${json}</script>\n<script>${app}</script>\n`
);
const kb = n => (n / 1024).toFixed(0) + " KB";
console.log(`Built ${id} v${data.build.version}${data.build.commit ? " (" + data.build.commit + ")" : ""} artifact: ${data.lessons.length} lessons, ${data.questions.length} questions, ${data.labs.length} labs. ${out} ${kb(readFileSync(out).length)}`);
