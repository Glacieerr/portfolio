# Personal Portfolio CMS

A bilingual, Git-backed personal portfolio and lightweight content management system.

The project provides a public portfolio website and a browser-based CMS for managing software, tools, UI/UX, photography, art, and motion projects.

## Features

### Public portfolio

- Chinese and English language switching
- Category filtering
- Responsive desktop and mobile layout
- Image and video project support
- Featured and published project states
- Data-driven rendering from `data/works.json`

### CMS administration

- Create, edit, delete, filter, and search projects
- JSON import, export, and preview
- Media upload and media library
- Content validation before publishing
- Publish diff review
- Custom Git commit messages
- Publish history
- Automatic publishing backups
- Detailed backup previews
- One-click backup restore
- Browser-local editor draft recovery
- Remote SHA conflict protection
- Environment and safe-branch checks

## Architecture

```text
CMS Admin
    │
    ▼
Vercel Functions
    │
    ▼
GitHub REST API
    │
    ▼
cms-v1 branch
    │
    ├── Vercel deployment
    │
    └── Pull request to main
              │
              ▼
        GitHub Pages

The CMS does not use a traditional database. Project content is stored in:

data/works.json

Uploaded media is stored in:

images/works/

Automatic publishing backups are stored in:

data/backups/
Project structure
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
│  ├─ upload-media.js
│  ├─ list-media.js
│  ├─ list-backups.js
│  ├─ get-backup.js
│  ├─ restore-backup.js
│  ├─ list-publishes.js
│  └─ cms-status.js
├─ data/
│  ├─ works.json
│  └─ backups/
├─ images/
│  └─ works/
├─ docs/
├─ package.json
└─ vercel.json
Publishing workflow
Edit project
→ Save to local CMS list
→ Validate content
→ Review publish diff
→ Enter publish note
→ Verify remote SHA
→ Create automatic backup
→ Commit works.json to GitHub
→ Deploy through Vercel
→ Merge stable changes to main
Safety model

The CMS includes several independent protection layers:

Admin Key authentication
GitHub Token stored only in Vercel
Safe-branch write lock
Remote SHA concurrency protection
Browser origin restriction
Automatic publishing backups
One-click restore
Local editor draft recovery
Publish diff review
Content validation

CORS and origin checks are supplemental browser protections. The Admin Key remains the primary CMS authentication secret.

Required environment variables
Variable	Purpose	Sensitive
ADMIN_KEY	Authenticates CMS requests	Yes
GITHUB_TOKEN	Authorizes GitHub API access	Yes
GITHUB_OWNER	GitHub repository owner	No
GITHUB_REPO	GitHub repository name	No
GITHUB_BRANCH	Active CMS write branch	No
CMS_SAFE_BRANCH	Only branch allowed for writes	No
GITHUB_FILE_PATH	Path to works.json	No
ALLOWED_ORIGIN	Allowed production CMS origin	No

Optional variables:

Variable	Default
MEDIA_FOLDER	images/works
BACKUP_FOLDER	data/backups

Never commit ADMIN_KEY or GITHUB_TOKEN to the repository.

Local development

The static website and CMS interface can be opened with a local static server such as VS Code Live Server.

http://127.0.0.1:5500/
http://127.0.0.1:5500/admin/

Production API write operations may reject local browser requests after ALLOWED_ORIGIN is restricted. This is intentional.

Deployment
cms-v1 is the active CMS development and Vercel branch.
main is the stable branch used for the public production portfolio.
Stable changes are merged from cms-v1 into main through pull requests.
Security

See SECURITY.md.

Release checklist

See docs/RELEASE_CHECKLIST.md.

Version
Personal Portfolio CMS v1.0.0