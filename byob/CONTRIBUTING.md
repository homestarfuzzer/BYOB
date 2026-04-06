# Contributing to BYOB

Thanks for wanting to contribute! BYOB is intentionally simple — the biggest way to help is adding more labs.

## Adding a Lab (easiest contribution)

1. Fork the repo
2. Edit `labs/labs.json` — add your entry following the schema in the README
3. Test it locally (`npm start` → try starting and stopping your lab)
4. Open a PR with:
   - The lab entry
   - A note confirming it works on your machine
   - The Docker image source / license

**Lab checklist:**
- [ ] Image is publicly available on Docker Hub
- [ ] Image is free to use
- [ ] Port doesn't conflict with existing labs
- [ ] `imageSize` is a reasonable estimate
- [ ] At least one resource link included

## Reporting Issues

Open a GitHub issue with:
- Your OS and Docker version
- What you expected vs what happened
- Any console output from the terminal where you ran `npm start`

## Code Changes

For anything beyond `labs.json`:
- Keep the code readable — no minification, no clever tricks
- Match the existing style (2 spaces, single quotes, no semicolons)
- No new dependencies without opening an issue first
- Test on at least one platform before PR

## Scope

See `CLAUDE.md` for what's in and out of scope. Short version: keep it simple, keep it local, keep it free.
