# Roadmap

The repo is public at https://github.com/justin-newman/gh500-course. Each item below has a GitHub issue labeled `roadmap`.

## Where the PoC stands

| Works now | Not built yet |
| --- | --- |
| One course (GH-500) as data; engine is course-agnostic | Hosting |
| Lessons, labs, drills, timed mock exams, study plan, self-ratings | A feedback backend outside the artifact |
| Progress saved per viewer (artifact store or browser) | The agent that triages reports |
| "Report a problem" on every question, queued with question id and version | A written source policy and a learning-science basis for the design |
| Validator in CI as the merge gate | Second course |

## Phase 1: host it (about 1 day)

1. Deploy `dist/gh-500/index.html` to a static host (GitHub Pages first; Azure Static Web Apps or Cloudflare Pages later if needed).
2. Add a tiny API (one serverless function) with two routes: `POST /progress` and `POST /feedback`.
3. Swap the browser-only adapters in `src/app.js` (`connect`, `flushFeedback`) for calls to that API.

## Phase 2: research how to make studying easier

Deep research into what helps people learn and remember technical material, then turn it into concrete course changes.

1. Review the evidence on retrieval practice, spaced repetition, interleaving, worked examples, feedback timing and cognitive load.
2. Research what helps learners with ADHD and other attention or reading differences, and how that fits the course's short-core, full-details lesson shape.
3. Study how certification candidates actually prepare: common failure points, study time, and what they say helps.
4. Write the findings to `docs/research/learning.md`, with sources and a confidence level for each claim.
5. Turn each finding worth acting on into an issue (for example, spaced review of missed questions or a smarter study plan).

## Phase 3: research where the correct information comes from

Deep research into which sources to trust, how to settle conflicts between them, and how to notice when they change.

1. Map every source the course uses or could use: the official study guide (skills measured), GitHub Docs, Microsoft Learn modules, the GitHub changelog and blog, the CodeQL docs, and the docs' public change history.
2. Rank them into a source hierarchy, and write the rule for when sources disagree (today the reference sheet lists 9 conflicts between the training and the docs).
3. Find how to detect changes: study guide updates, changelog entries, deprecations and retirements, docs page edits.
4. Write the policy to `docs/SOURCES.md`: hierarchy, citation rules, how often each source is rechecked, and what triggers a content review.
5. Feed the result into the validator (for example, flag facts with a retirement date that has passed) and into the self-healing pipeline.

## Phase 4: self-healing questions

See `docs/SELF-HEALING.md`. About 2 days once Phase 1 exists. The triage agent checks reports against the source policy from Phase 3.

## Phase 5: more courses

1. Copy `courses/gh-500` to `courses/<new-id>`.
2. Replace the content. The validator tells you what's missing.
3. Build with `node scripts/build.mjs <new-id>`.

## Ongoing: content upkeep

1. Close the validator's guideline warnings (lessons with fewer than 2 questions, a lab over 5 steps).
2. Recheck dated facts after their dates pass, such as the sync SBOM endpoint retiring 2026-11-13.
3. Keep the study plan usable after its fixed dates (the current plan ends 2026-11-20).

## Later: paid access (parked)

Not planned yet. When it starts: sign-in, checkout and per-course entitlements. Decide then how to handle content already public in this repo: keep the GH-500 bank free, or put new and paid content in a private repo.
