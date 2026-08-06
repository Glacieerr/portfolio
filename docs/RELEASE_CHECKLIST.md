# Personal Portfolio CMS v1 Release Checklist

## Repository

- [x] Working tree is clean
- [x] `cms-v1` is synchronized with `origin/cms-v1`
- [x] No `.env` files are tracked
- [x] No tokens or Admin Keys are present in source files
- [x] Test markers have been removed from `data/works.json`

## Public portfolio

- [x] Homepage loads successfully
- [x] Chinese and English switching works
- [x] Category filtering works
- [x] Published projects are visible
- [x] Draft projects are hidden
- [x] Featured projects display correctly
- [x] Image projects display correctly
- [x] Video projects display correctly
- [x] Project links work
- [x] Desktop layout works
- [x] Mobile layout works
- [x] Browser console has no critical errors

## CMS editor

- [x] Existing projects load
- [x] New projects can be created
- [x] Existing projects can be edited
- [x] Projects can be deleted
- [x] Search and filters work
- [x] JSON preview updates
- [x] JSON import works
- [x] JSON export works
- [x] Media preview works

## Draft recovery

- [x] Unsaved form edits are automatically stored
- [x] Refreshing the page offers draft recovery
- [x] Restoring a draft repopulates the form
- [x] Saving to the local list clears the draft
- [x] Discarding a draft does not delete a saved project

## Publishing

- [x] Content validation works
- [x] Publish diff identifies added projects
- [x] Publish diff identifies modified fields
- [x] Publish diff identifies removed projects
- [x] Publish note is required
- [x] Publish history loads
- [x] Successful publishing creates a GitHub commit
- [x] Vercel deploys the new commit

## Backups

- [x] Publishing creates a backup
- [x] Backup types are clearly labeled
- [x] Backup preview shows titles and descriptions
- [x] Backup preview shows media and links
- [x] Backup fingerprint is visible
- [x] Restore creates a safety backup
- [x] Restore updates `data/works.json`

## Safety

- [x] Wrong Admin Key returns HTTP 401
- [x] Stale SHA returns HTTP 409 `REMOTE_CHANGED`
- [x] Unsafe branch returns HTTP 409 `UNSAFE_BRANCH`
- [x] Disallowed browser origin returns HTTP 403 `ORIGIN_NOT_ALLOWED`
- [x] System status reports `cms-v1`
- [x] Safe branch reports `cms-v1`
- [x] `ALLOWED_ORIGIN` is not `*`
- [x] System status reports that writes are ready

## Release

- [x] Phase 14 pull request is merged into `main`
- [x] `main` is synchronized locally
- [x] `cms-v1` is synchronized with `main`
- [x] Git tag `v1.0.0` is created
- [x] Git tag `v1.0.0` is pushed
- [x] Production portfolio is checked after release