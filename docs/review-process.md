# Development loop & review process

Three roles:
- **Owner (Carlo)** — picks the next WP, runs sessions, plays the test games, merges.
- **Builder (Opus via Claude Code)** — implements one WP per session following CLAUDE.md.
- **Reviewer (Claude, chat)** — reviews completed WPs, maintains backlog, updates specs, plans next iteration.

## The loop

```
1. PICK      Owner picks next WP from backlog/ (order in backlog/README.md)
2. BUILD     Claude Code session: "Read CLAUDE.md and backlog/WP-0XX. Implement it."
             Session ends with worklog entry + green `npm run check`.
3. PUSH      Owner pushes branch `wp/0XX-short-name` to GitHub, opens PR.
4. REVIEW    Owner opens a chat with Reviewer and shares:
             - repo URL (public repo → reviewer fetches files directly), or
             - the PR diff pasted/uploaded, plus docs/worklog.md
             Reviewer checks against the WP review checklist and CLAUDE.md
             invariants, and returns: verdict (approve / fix list), updated
             backlog priorities, and any spec corrections.
5. FIX       If fix list: new Claude Code session: "Apply the review notes in
             docs/reviews/WP-0XX.md". Back to step 4. (Paste reviewer output
             into that file.)
6. MERGE     Owner merges. Reviewer marks WP done in backlog/README.md next session.
```

Keep the repo public (or share files) so the reviewer can fetch raw files from GitHub — that makes step 4 a 5-minute "here's the repo, review WP-004" message.

## What the reviewer checks (every WP)
1. Acceptance criteria in the WP file — literally, one by one.
2. CLAUDE.md invariants: I/O only in main process, pure engine, zod on all external payloads, typed IPC, no new deps without note, no `any`.
3. Riot policy hard rules — grep for anything touching cooldowns, hidden identities, TLS-disable hacks.
4. Test quality: fixtures are real recorded payloads, not hand-invented; edge cases (dead player, empty item slots, ARAM, remake) covered where relevant.
5. Worklog honesty: deviations documented, INBOX.md updated with discovered work.

## Cadence & discipline
- One WP in flight at a time. No parallel sessions until the project has a stable core (post WP-007).
- If a WP takes >2 build sessions, it's mis-scoped: stop, bring it back to the reviewer to split.
- Reviewer owns the backlog: after each review, it may reorder, split, or rewrite upcoming WPs based on what the code revealed. Specs are living documents.
- Anything discovered mid-session goes to `backlog/INBOX.md`, never into scope creep.
