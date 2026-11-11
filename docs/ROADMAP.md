# Roadmap

Next: push this repo to a private GitHub repository. Everything below depends on it.

## Where the PoC stands

| Works now | Not built yet |
| --- | --- |
| One course (GH-500) as data; engine is course-agnostic | Accounts and paid access |
| Lessons, labs, drills, timed mock exams, study plan, self-ratings | Hosting |
| Progress saved per viewer (artifact store or browser) | A feedback backend outside the artifact |
| "Report a problem" on every question, queued with question id and version | The agent that triages reports |
| Validator in CI as the merge gate | Second course |

## Phase 1: host it (about 1 day)

1. Push to a private GitHub repo.
2. Deploy `dist/gh-500/index.html` to a static host (Azure Static Web Apps, Cloudflare Pages or GitHub Pages).
3. Add a tiny API (one serverless function) with two routes: `POST /progress` and `POST /feedback`.
4. Swap the browser-only adapters in `src/app.js` (`connect`, `flushFeedback`) for calls to that API.

## Phase 2: sell access (about 3 to 5 days)

1. Add sign-in (Entra External ID, Auth0 or Clerk).
2. Add checkout (Stripe Checkout) and store an entitlement per user per course.
3. Serve the course only to entitled users. A free preview can be Domain 1 lessons plus 10 questions.
4. Move question data behind the API so the full bank isn't in the public HTML.

## Phase 3: self-healing questions

See `docs/SELF-HEALING.md`. About 2 days once Phase 1 exists.

## Phase 4: more courses

1. Copy `courses/gh-500` to `courses/<new-id>`.
2. Replace the content. The validator tells you what's missing.
3. Build with `node scripts/build.mjs <new-id>`.
