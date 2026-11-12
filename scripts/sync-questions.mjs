// Pushes a course's question bank into Supabase: the public part to `questions`,
// answers, explanations and sources to `question_keys` (never readable from the browser).
//
// Usage: npm run sync:questions -- <course-id> [path/to/questions.json] [--prune]
//   --prune  also deletes questions in the database that are no longer in the file
//
// Reads VITE_SUPABASE_URL and SUPABASE_SECRET_KEY from .env. The secret key bypasses
// row level security, so it is never printed. In .env it can be a 1Password secret
// reference (op://vault/item/field); the npm script runs this file through `op run`,
// which fills the real value in for this one process only.
import { readFileSync, existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");
const args = process.argv.slice(2);
const prune = args.includes("--prune");
const [course, file = `courses/${course}/questions.json`] = args.filter(a => !a.startsWith("--"));
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

const fail = msg => { console.error(msg); process.exit(1); };
if (!course) fail("Usage: node scripts/sync-questions.mjs <course-id> [path/to/questions.json] [--prune]");
if (!url || !key) fail("Set VITE_SUPABASE_URL and SUPABASE_SECRET_KEY in .env (see .env.example).");
if (key.startsWith("op://")) fail("SUPABASE_SECRET_KEY is a 1Password reference. Run npm run sync:questions, which resolves it with op run.");
if (!existsSync(file)) fail(`No question file at ${file}`);

const questions = JSON.parse(readFileSync(file, "utf8"));
if (!Array.isArray(questions) || !questions.length) fail(`${file} must be a non-empty JSON array`);
for (const q of questions) {
  const ok = /^q\d{3}$/.test(q.id) && Number.isInteger(q.version) && typeof q.stem === "string" &&
    Array.isArray(q.options) && Array.isArray(q.answer) && q.answer.length >= 1 && q.answer.length <= 3 &&
    typeof q.explanation === "string" && Array.isArray(q.sources);
  if (!ok) fail(`Question ${q.id || "(no id)"} is missing fields; run npm run validate first.`);
}

// New secret keys (sb_secret_...) go in the apikey header only; legacy service_role JWTs also need Authorization.
const headers = { apikey: key, "Content-Type": "application/json" };
if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;

async function rest(method, path, body, prefer) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: prefer ? { ...headers, Prefer: prefer } : headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) fail(`${method} ${path.split("?")[0]} failed: ${res.status} ${await res.text()}`);
  return res;
}

const upsert = "resolution=merge-duplicates,return=minimal";
await rest("POST", "questions?on_conflict=course,id", questions.map(q => ({
  course, id: q.id, version: q.version, domain: q.domain, lesson: q.lesson || null,
  stem: q.stem, options: q.options, pick: q.answer.length
})), upsert);
await rest("POST", "question_keys?on_conflict=course,id", questions.map(q => ({
  course, id: q.id, answer: q.answer, explanation: q.explanation, sources: q.sources
})), upsert);

let pruned = 0;
if (prune) {
  const keep = questions.map(q => q.id).join(",");
  const res = await rest("DELETE", `questions?course=eq.${encodeURIComponent(course)}&id=not.in.(${keep})`, null, "return=representation");
  pruned = (await res.json()).length;
}

console.log(`Synced ${questions.length} questions for ${course} to Supabase${prune ? `; pruned ${pruned}` : ""}.`);
