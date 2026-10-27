# Repository collaboration rules

These instructions apply to GPT/Codex, Claude, and other coding agents across this repository.

## Branches and pull requests
- Read CONTRIBUTING.md before editing. Start from the latest remote main and inspect open PRs.
- Use a short-lived task branch: gpt/<task> or claude/<task>.
- Never push commits directly to main; never force-push main or a shared branch.
- If active work overlaps the same files or data contract, coordinate scope with the user before editing. Branches alone do not prevent logical conflicts.
- Submit a PR targeting main. Describe the resulting behavior, validation, and known limitations.
- Before merging, fetch the latest main, inspect intervening changes, resolve conflicts on the task branch, and repeat relevant checks.
- Merge only when the user's authorization covers the change and relevant checks pass.
- Verify GitHub Pages deployment after site changes; a merge alone is not evidence of publication.

## Site-specific checks
- Preserve film IDs, screening keys, user-provided synopses, runtimes, credits, and screening editions unless a change is explicitly requested.
- Keep localStorage key style-kaleidoscope-plan-v1 and existing saved selections and share-link compatibility.
- Distinguish awards, nominations, competition selections, and retrospective rankings accurately. Do not invent honors.
- Keep sources out of the public UI as requested; record research evidence in PR notes when factual changes require it.
- For UI changes, check desktop and narrow mobile layouts and the affected film, schedule, Gantt, and personal-plan routes.
- For personal-plan changes, check persistence, add/remove behavior, conflict detection, share/import links, PNG and ICS export as relevant.
- Gantt and personal itineraries must display cinema and auditorium. Film titles must display the screening edition; 笑傲江湖2：东方不败 is 4K修复.
- Do not claim checks ran unless they did. Document-only changes require diff and link review.
