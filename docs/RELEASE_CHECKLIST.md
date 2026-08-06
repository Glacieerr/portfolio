# Personal Portfolio CMS v1 Release Checklist

## Repository

- [ ] Working tree is clean
- [ ] `cms-v1` is synchronized with `origin/cms-v1`
- [ ] No `.env` files are tracked
- [ ] No tokens or Admin Keys are present in source files
- [ ] Test markers have been removed from `data/works.json`

## Public portfolio

- [ ] Homepage loads successfully
- [ ] Chinese and English switching works
- [ ] Category filtering works
- [ ] Published projects are visible
- [ ] Draft projects are hidden
- [ ] Featured projects display correctly
- [ ] Image projects display correctly
- [ ] Video projects display correctly
- [ ] Project links work
- [ ] Desktop layout works
- [ ] Mobile layout works
- [ ] Browser console has no critical errors

## CMS editor

- [ ] Existing projects load
- [ ] New projects can be created
- [ ] Existing projects can be edited
- [ ] Projects can be deleted
- [ ] Search and filters work
- [ ] JSON preview updates
- [ ] JSON import works
- [ ] JSON export works
- [ ] Media preview works

## Draft recovery

- [ ] Unsaved form edits are automatically stored
- [ ] Refreshing the page offers draft recovery
- [ ] Restoring a draft repopulates the form
- [ ] Saving to the local list clears the draft
- [ ] Discarding a draft does not delete a saved project

## Publishing

- [ ] Content validation works
- [ ] Publish diff identifies added projects
- [ ] Publish diff identifies modified fields
- [ ] Publish diff identifies removed projects
- [ ] Publish note is required
- [ ] Publish history loads
- [ ] Successful publishing creates a GitHub commit
- [ ] Vercel deploys the new commit

## Backups

- [ ] Publishing creates a backup
- [ ] Backup types are clearly labeled
- [ ] Backup preview shows titles and descriptions
- [ ] Backup preview shows media and links
- [ ] Backup fingerprint is visible
- [ ] Restore creates a safety backup
- [ ] Restore updates `data/works.json`

## Safety

- [ ] Wrong Admin Key returns HTTP 401
- [ ] Stale SHA returns HTTP 409 `REMOTE_CHANGED`
- [ ] Unsafe branch returns HTTP 409 `UNSAFE_BRANCH`
- [ ] Disallowed browser origin returns HTTP 403 `ORIGIN_NOT_ALLOWED`
- [ ] System status reports `cms-v1`
- [ ] Safe branch reports `cms-v1`
- [ ] `ALLOWED_ORIGIN` is not `*`
- [ ] System status reports that writes are ready

## Release

- [ ] Phase 14 pull request is merged into `main`
- [ ] `main` is synchronized locally
- [ ] `cms-v1` is synchronized with `main`
- [ ] Git tag `v1.0.0` is created
- [ ] Git tag `v1.0.0` is pushed
- [ ] Production portfolio is checked after release