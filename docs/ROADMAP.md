# Roadmap

The repo is public at https://github.com/justin-newman/studycore. Each item below has a GitHub issue labeled `roadmap`.

## Where the project stands

| Works now | Not built yet |
| --- | --- |
| One course (GH-500) as data; engine is course-agnostic | The app reading from and saving to Supabase |
| Lessons, labs, drills, timed mock exams, study plan, self-ratings | A private home for the question bank |
| Live on Vercel (https://studycore-nu.vercel.app), redeployed on every push to `main` | Automated tests for the database rules |
| Supabase schema: questions readable with an anonymous session, answer keys locked behind `check_answers` | The agent that triages reports |
| Question sync script, with the secret key read from 1Password | A written source policy and a learning-science basis for the design |
| Validator in CI as the merge gate | Second course |

## Phase 1: host it and connect the database

Done: Vite build, Vercel hosting (#1), Supabase schema and access rules, the question bank synced and verified, and the access rules tested from outside.

### 1.1 Connect the app to Supabase (#2)

1. Add the Supabase URL and publishable key to Vercel as environment variables.
2. Start an anonymous session when the page opens. No sign-in screen, no email, no name.
3. Load questions from Supabase. Check drill answers and grade mock exams through `check_answers`.
4. Save progress and question reports to Supabase, keeping the browser copy as a backup and an offline queue.
5. Show a clear message when questions can't load, and add a "don't include personal information" hint to the report box.

### 1.2 Move the question bank to a private repo (#8)

1. Create a private `studycore-content` repo holding each course's `questions.json`.
2. Run the question checks (count, domain weights, sources) there, and keep the lesson checks here.
3. Sync to Supabase when a change merges, with the secret key coming from 1Password or a GitHub Actions secret.
4. Remove `questions.json` from this repo, so neither the repo nor the built site carries the answer keys.

### 1.3 Retire the Claude artifact (#9)

1. Confirm the hosted site covers what the artifact did (saved progress, reports).
2. Remove `build:artifact`, `scripts/build-artifact.mjs` and the claude.ai-only code in `src/app.js`.
3. Decide whether "Fresh from Claude" comes back later through a server-side call.

### 1.4 Test and harden the database (#10, #11)

1. Turn the manual access check into an automated test: no session sees nothing, a session sees questions but never answers, viewers only touch their own rows.
2. Test `check_answers`, including multi-select answers in any order.
3. Add abuse limits: a CAPTCHA on anonymous sign-ins and a cap on reports per viewer.
4. Apply migrations from the repo through CI instead of by hand.

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

See `docs/SELF-HEALING.md`. About 2 days once Phase 1.1 exists. The triage agent checks reports against the source policy from Phase 3.

## Phase 5: more courses

1. Copy `courses/gh-500` to `courses/<new-id>`.
2. Replace the content. The validator tells you what's missing.
3. Build with `COURSE=<new-id> npm run build`.

## Ongoing: content upkeep

1. Close the validator's guideline warnings (lessons with fewer than 2 questions, a lab over 5 steps).
2. Recheck dated facts after their dates pass, such as the sync SBOM endpoint retiring 2026-11-13.
3. Keep the study plan usable after its fixed dates (the current plan ends 2026-11-20).
