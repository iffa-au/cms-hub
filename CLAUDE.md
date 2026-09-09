@AGENTS.md

# Working with me on this project

Project knowledge lives in `AGENTS.md` (above). This file is Claude Code
specific.

The public site is `../iffa-2026` and has its own `CLAUDE.md` with the same
session habits — they apply here too. In short:

- Keep sessions scoped to one task; suggest `/clear` on a subject change.
- Update `docs/STATUS.md` before finishing a piece of work, so the next
  session can start cold.
- Don't spawn subagents unless asked.

## Specific to this repo

**The local backend talks to the production database.** `MONGO_URI` in
`backend/.env` points at live Mongo. Every write from a local `npm run dev` is
a production write — confirm before any `updateMany`, `deleteMany`, or bulk
script, and report exactly what was changed.

**Verify against the right projection.** The public and staff submission
endpoints project different fields; `contactEmail` and `logoKey` exist only on
the staff side. Checking a staff-only field against the public API and
concluding it's absent is a false negative that has happened here before.
Query MongoDB directly when the question is about stored data.

**Deploys are manual.** Backend changes do nothing until App Runner redeploys.
Never describe a committed backend change as live.

**Never create `.env.backup*` files.** They are not in `.gitignore` and hold
real secrets — `MONGO_URI`, both JWT secrets, the Arcjet and Mailchimp keys.
