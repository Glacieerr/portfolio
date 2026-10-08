# Personal Portfolio CMS

A bilingual, Git-backed personal portfolio and lightweight content management system.

The project provides a public portfolio website and a browser-based CMS for managing software, tools, UI/UX, photography, art, motion projects, media assets, and application release metadata.

## Features

### Public portfolio

- Chinese and English language switching
- Category filtering
- Responsive desktop and mobile layout
- Image and video project support
- Featured and published project states
- Data-driven rendering from `data/works.json`
- Canonical production domain at `https://yecanyuan.com`

### CMS administration

- Create, edit, delete, filter, and search projects
- JSON import, export, and preview
- Media Library 2.0 backed by Vercel Blob
- Image, screenshot, video, and Android APK asset support
- Direct signed uploads with progress and cancellation
- Content validation before publishing
- Publish diff review
- Custom Git commit messages
- Publish history
- Automatic publishing backups
- Detailed backup previews
- One-click backup restore
- Browser-local editor draft recovery
- Remote SHA conflict protection
- Safe-branch and environment checks
- Reference protection before deleting Blob assets
- SilNest Android release metadata management

## Architecture

```text
CMS Admin
    │
    ├── Content / release metadata
    │       │
    │       ▼
    │   Vercel Functions
    │       │
    │       ▼
    │   GitHub REST API
    │       │
    │       ▼
    │     cms-v1
    │       │
    │       ├── Vercel Preview
    │       │
    │       └── Pull Request to main
    │                   │
    │                   ▼
    │                 main
    │                   │
    │                   ▼
    │           Vercel Production
    │                   │
    │                   ▼
    │             yecanyuan.com
    │
    └── Media / release assets
            │
            ▼
        Vercel Blob
        portfolio-media
```

The CMS does not use a traditional application database.

Structured project content is stored in:

```text
data/works.json
```

Application release metadata is stored in:

```text
data/apps/silnest.json
```

Uploaded media and release assets are stored in:

```text
Vercel Blob
Store: portfolio-media
```

Automatic publishing backups are stored in:

```text
data/backups/
```

GitHub remains the source of truth for structured CMS content, version history, backups, and the pull-request release workflow.

## Project structure

```text
portfolio/
├─ index.html
├─ admin/
│  ├─ index.html
│  ├─ admin.css
│  └─ admin.js
├─ api/
│  ├─ health.js
│  ├─ publish.js
│  ├─ get-works.js
│  ├─ blob-media.js
│  ├─ app-release.js
│  ├─ list-backups.js
│  ├─ get-backup.js
│  ├─ restore-backup.js
│  ├─ list-publishes.js
│  ├─ cms-status.js
│  ├─ upload-media.js        # legacy compatibility
│  └─ list-media.js          # legacy compatibility
├─ apps/
│  └─ silnest/
│     ├─ index.html
│     ├─ privacy/
│     ├─ support/
│     ├─ app-pages.css
│     ├─ app-pages.js
│     └─ assets/
├─ data/
│  ├─ works.json
│  ├─ apps/
│  │  └─ silnest.json
│  └─ backups/
├─ images/
│  └─ works/                 # legacy media retained during migration cleanup
├─ docs/
├─ package.json
└─ vercel.json
```

## Publishing workflow

```text
Edit project
→ Save to local CMS list
→ Validate content
→ Review publish diff
→ Enter publish note
→ Verify remote SHA
→ Create automatic backup
→ Commit structured content to cms-v1
→ Inspect Vercel Preview
→ Open pull request
→ Merge stable changes to main
→ Vercel Production
→ yecanyuan.com
```

## Media workflow

```text
Choose media
→ Request a protected signed upload
→ Upload directly from the browser to Vercel Blob
→ Store the resulting public Blob URL in project / release metadata
→ Validate references before deletion
```

Supported CMS media roles include:

- Project cover images
- Project screenshots
- Project videos
- Android APK release assets

## Safety model

The CMS includes several independent protection layers:

- Admin Key authentication
- GitHub Token stored only in Vercel
- Safe-branch write lock
- Remote SHA concurrency protection
- Browser origin restriction
- Automatic publishing backups
- One-click restore
- Local editor draft recovery
- Publish diff review
- Content validation
- Blob pathname, type, and size validation
- Reference protection before Blob deletion
- Preview / Production branch separation

CORS and origin checks are supplemental browser protections. The Admin Key remains the primary CMS authentication secret.

## Required environment variables

| Variable | Purpose | Sensitive |
| --- | --- | --- |
| `ADMIN_KEY` | Authenticates CMS requests | Yes |
| `GITHUB_TOKEN` | Authorizes GitHub API access | Yes |
| `GITHUB_OWNER` | GitHub repository owner | No |
| `GITHUB_REPO` | GitHub repository name | No |
| `GITHUB_BRANCH` | Active CMS write branch (`cms-v1`) | No |
| `CMS_SAFE_BRANCH` | Only branch allowed for CMS writes | No |
| `GITHUB_FILE_PATH` | Path to `works.json` | No |
| `ALLOWED_ORIGIN` | Allowed production CMS origin (`https://yecanyuan.com`) | No |
| `BLOB_STORE_ID` | Connected Vercel Blob store | No |

Vercel Blob access is provided through the connected Vercel project / OIDC configuration. Do not commit local environment credentials or `.env.local`.

Optional / legacy variables:

| Variable | Default | Notes |
| --- | --- | --- |
| `MEDIA_FOLDER` | `images/works` | Legacy Git-backed media compatibility |
| `BACKUP_FOLDER` | `data/backups` | Git-backed publishing backups |

Never commit `ADMIN_KEY`, `GITHUB_TOKEN`, or temporary environment credentials to the repository.

## Local development

The static website and CMS interface can be opened with a local static server such as VS Code Live Server:

```text
http://127.0.0.1:5500/
http://127.0.0.1:5500/admin/
```

Production API write operations may reject local browser requests after `ALLOWED_ORIGIN` is restricted. This is intentional.

## Deployment

- `cms-v1` is the active CMS write / preview branch.
- `main` is the stable branch tracked by the Vercel Production environment.
- Stable changes are merged from `cms-v1` into `main` through pull requests.
- `https://yecanyuan.com` is the canonical production domain.
- `www.yecanyuan.com` permanently redirects to `yecanyuan.com`.
- GitHub Pages is retired and is no longer part of the production hosting path.

## Security

See `SECURITY.md`.

## Release checklist

See `docs/RELEASE_CHECKLIST.md`.

## Version

Personal Portfolio CMS v1.1.0
