# GH-500 exam prep course

An interactive study course for the **GH-500: GitHub Advanced Security** certification exam. It covers lessons, hands-on labs, practice questions, timed mock exams and a week-by-week study plan, all built into a single HTML file that runs in any browser.

## Who it's for

People preparing for GH-500 who want a structured plan instead of a pile of links. I built it to prepare for the exam myself. Lessons put a short core first (a goal, a few key points, an exam trap, a two-minute action) and keep the full detail in a collapsible section underneath, so the course works for short, focused study sessions.

## What's in it

| Part | Count |
| --- | --- |
| Lessons, each with a short core plus full details | 32, covering all 68 exam objectives (July 2026 skills outline) |
| Practice questions, weighted by exam domain | 84, including 11 multi-select |
| Hands-on labs with prerequisites, steps and a done-check | 16 |
| Study plan | 5 weeks |
| Reference sheet, including where the training and GitHub Docs disagree | 1 |

Every lesson and question cites at least one source (GitHub Docs, Microsoft Learn or the CodeQL docs). The practice questions are original study aids, not real exam items.

## Built with

- Plain JavaScript, HTML and CSS. No framework and no runtime dependencies.
- Node.js (20 or newer) scripts for validation and the build. No npm packages to install.
- Course content as JSON, so a new exam is a new folder of data and the engine doesn't change.
- GitHub Actions runs the content validator on every push and pull request.

## Run it

```sh
git clone https://github.com/justin-newman/gh500-course.git
cd gh500-course
npm run build
```

Then open `dist/gh-500/index.html` in a browser. The build prints a summary starting with `OK gh-500: 32 lessons`, followed by any guideline warnings.

| Command | What it does |
| --- | --- |
| `npm run validate` | Checks the content only |
| `npm run build` | Validates, then writes `dist/gh-500/index.html` (hostable) and `dist/gh-500/artifact.html` (Claude artifact version) |
| `node scripts/build.mjs <course-id>` | Builds a different course folder |

## Layout

| Path | What it holds |
| --- | --- |
| `courses/<id>/` | One course's content as JSON |
| `src/` | The engine: `template.html`, `styles.css`, `app.js` |
| `scripts/validate.mjs` | The content gate (runs in CI) |
| `scripts/build.mjs` | The build |
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

Planned work is in [`docs/ROADMAP.md`](docs/ROADMAP.md): hosting the course, a small API for progress and question reports, a self-healing question pipeline ([`docs/SELF-HEALING.md`](docs/SELF-HEALING.md)), and more courses on the same engine.

## License

[MIT](LICENSE). Copyright 2026 Justin Newman.
