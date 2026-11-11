# Self-healing questions

Goal: a learner flags a question, an agent checks the claim against the docs, and a correct claim becomes a merged fix without a person writing it.

## Flow

1. **Report.** The learner selects "Report a problem" and picks a reason: wrong answer, unclear, not on this exam, outdated, other. The app stores `{qid, qVersion, reason, comment, at, build}`.
2. **Collect.** A scheduled job reads new reports, groups them by `qid`, and drops reports whose `qVersion` is older than the current question (already fixed).
3. **Evaluate.** A triage agent gets the question, the reports and the cited sources. It fetches the docs and decides: `valid`, `invalid`, or `needs-human`. It must quote the docs passage that supports the decision.
4. **Fix.** For `valid`, the agent edits `questions.json`, bumps `version`, updates `sources`, and opens a PR that links the reports and the quoted passage.
5. **Review.** A second agent, with no access to the first one's reasoning, reviews the PR against the docs. CI runs `npm run validate`.
6. **Merge.** Merge when CI passes and the reviewer approves. `needs-human` and reviewer disagreement go to a person.
7. **Close the loop.** Mark the reports resolved, and show "Updated after learner feedback" on the question.

## Guardrails

| Risk | Control |
| --- | --- |
| A report tries to steer the agent ("ignore your instructions") | Reports are data. The agent decides from docs only and must quote them. |
| One loud learner rewrites the bank | Auto-fix needs 2 or more independent reports, or 1 report plus a docs quote the reviewer confirms. |
| Agent and reviewer agree on a wrong fix | Reviewer runs separately, cites docs independently, and can't see the fixer's reasoning. |
| Domain balance drifts | The validator enforces the weight ranges on every PR. |
| Exam objectives change | A monthly job diffs the official study guide and opens an issue listing affected objectives. |

## Building it

| Piece | PoC (artifact) | Hosted |
| --- | --- | --- |
| Report store | Artifact store, doc `feedback/<viewer id>` (owner reads all) | `POST /feedback` writes a GitHub issue labeled `question-report` |
| Trigger | Ask Claude: "triage the GH-500 reports" | GitHub Actions on a schedule or on the issue label |
| Fixer and reviewer | Claude Code sessions | Claude Code GitHub Action, two jobs with separate prompts |
| Merge gate | `npm run validate` plus review | Branch ruleset: required check plus required review |
