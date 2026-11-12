# Studycore

Interactive exam prep courses: lessons, hands-on labs, practice questions, timed mock exams and a week-by-week study plan. Each course is a folder of JSON content; one engine runs them all.

The first course is **GH-500: GitHub Advanced Security**. More certification courses will follow on the same engine.

## Who it's for

People preparing for a certification exam who want a structured plan instead of a pile of links. I built it to prepare for GH-500 myself. Lessons put a short core first (a goal, a few key points, an exam trap, a two-minute action) and keep the full detail in a collapsible section underneath, so the courses work for short, focused study sessions.

## What's in the GH-500 course

| Part | Count |
| --- | --- |
| Lessons, each with a short core plus full details | 32, covering all 68 exam objectives (July 2026 skills outline) |
| Practice questions, weighted by exam domain | 84, including 11 multi-select |
| Hands-on labs with prerequisites, steps and a done-check | 16 |
| Study plan | 5 weeks |
| Reference sheet, including where the training and GitHub Docs disagree | 1 |

Every lesson and question cites at least one source (GitHub Docs, Microsoft Learn or the CodeQL docs). The practice questions are original study aids, not real exam items.

## Built with

- Plain JavaScript, HTML and CSS. No UI framework and no runtime dependencies.
- [Vite](https://vite.dev) for the dev server and the production build.
- Node.js scripts for the content validator and the Claude artifact build.
- Course content as JSON, so a new exam is a new folder of data and the engine doesn't change.
- GitHub Actions runs the validator and both builds on every push and pull request. Vercel hosts the site.

## Run it

Needs Node.js 20.19 or newer.

```sh
git clone https://github.com/justin-newman/studycore.git
cd studycore
npm install
npm run dev
```

Then open the local address Vite prints (usually http://localhost:5173). Edits to the engine or the course JSON reload the page.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the dev server |
| `npm run validate` | Checks the content only. Prints a summary starting with `OK gh-500: 32 lessons`, followed by any guideline warnings. |
| `npm run build` | Validates, then builds the hostable site into `dist/` |
| `npm run preview` | Serves the `dist/` build locally |
| `npm run build:artifact` | Validates, then writes `dist-artifact/gh-500/artifact.html`, a single-file version for publishing as a Claude artifact |
| `COURSE=<id> npm run build` | Builds a different course folder |

## Layout

| Path | What it holds |
| --- | --- |
| `courses/<id>/` | One course's content as JSON |
| `index.html` | Vite entry page; the head and body come from `src/template.html` |
| `src/` | The engine: `template.html`, `styles.css`, `app.js`, plus the Vite entry `main.js` |
| `vite.config.js` | Loads the course into the build as `virtual:course-data` |
| `scripts/course.mjs` | Reads a course folder; shared by both builds |
| `scripts/validate.mjs` | The content gate (runs in CI) |
| `scripts/build-artifact.mjs` | The Claude artifact build |
| `docs/` | Roadmap and the self-healing question pipeline design |

## Course files

| File | Contents |
| --- | --- |
| `course.json` | Exam facts, domains with weights, every objective with a stable id |
| `lessons/d1.json` to `lessons/d6.json` | Lessons, one file per exam domain |
| `questions.json` | Practice bank; each question has a `version` |
| `labs.json` | Hands-on labs |
| `plan.json` | Weekly plan; tasks point at lessons and labs by id |
| `reference.json` | Reference sheet sections |

## Content rules

The validator fails the build on these:

1. Every objective has at least one lesson, and every lesson is scheduled in the plan.
2. At least 50 questions, and each domain's share of the bank sits inside its exam weight range.
3. Every lesson and question cites at least one https source.
4. Lessons run 3 to 20 minutes and have a one-sentence goal and a "try it" action under 2 minutes.
5. No em dashes, en dashes or ellipses.

These are guidelines and only print warnings: at most 5 key points per lesson, at most 5 steps per lab, at least 2 questions per lesson.

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

## Roadmap

Planned work is in [`docs/ROADMAP.md`](docs/ROADMAP.md) and the [roadmap issues](https://github.com/justin-newman/studycore/issues?q=is%3Aissue+label%3Aroadmap): hosting the course, research into how to make studying easier, research into where the correct information comes from and how to keep it current, a self-healing question pipeline ([`docs/SELF-HEALING.md`](docs/SELF-HEALING.md)), and more courses on the same engine.

## License

[MIT](LICENSE). Copyright 2026 Justin Newman.
