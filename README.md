# Exam prep courses

Run `npm run build`, then open `dist/gh-500/index.html` in a browser.

Self-contained exam prep courses: lessons, labs, practice questions, mock exams and a study plan, built into one HTML file per course. No dependencies beyond Node 20.

## Layout

| Path | What it holds |
| --- | --- |
| `courses/<id>/` | One course's content as JSON. A new exam is a new folder; the engine doesn't change. |
| `src/` | The engine: `template.html`, `styles.css`, `app.js`. |
| `scripts/validate.mjs` | The content gate. Runs in CI on every pull request. |
| `scripts/build.mjs` | Writes `dist/<id>/index.html` (hostable) and `dist/<id>/artifact.html` (Claude artifact preview). |
| `docs/` | Roadmap and the self-healing question pipeline design. |

## Course files

| File | Contents |
| --- | --- |
| `course.json` | Exam facts, domains with weights, every objective with a stable id |
| `lessons.json` | Short lessons, 3 to 15 minutes each |
| `questions.json` | Practice bank; each question has a `version` |
| `labs.json` | Hands-on labs, 5 steps at most |
| `plan.json` | Weekly plan; tasks point at lessons and labs by id |
| `reference.json` | Cheat sheet sections |

## Content rules (enforced by the validator)

1. Lessons: 3 to 15 minutes, a one-sentence goal, at most 5 key points, one "do this now" action under 2 minutes.
2. Lists cap at 5 items: lesson points, lab steps.
3. Every objective has at least one lesson; every lesson is scheduled in the plan.
4. At least 50 questions, and each domain's share of the bank sits inside its exam weight range.
5. Every question and lesson cites at least one https source.
6. No em dashes, en dashes or ellipses.

## Change a question

1. Edit it in `courses/gh-500/questions.json`.
2. Bump its `version`.
3. Run `npm run validate`.
4. Open a pull request. CI runs the same check.

## Where progress and reports go

| Running as | Progress | "Report a problem" |
| --- | --- | --- |
| Claude artifact | The viewer's private record in the artifact store, plus this browser | Shared store, doc `feedback/<viewer id>`; only the owner can read all reports |
| Static file or hosted site | This browser only | Queued in this browser until a backend exists (see `docs/ROADMAP.md`) |
