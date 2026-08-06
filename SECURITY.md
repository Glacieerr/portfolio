# Security Policy

## Supported version

The currently supported release is:

```text
Personal Portfolio CMS v1.x
Secret handling

The following values must never be committed to the repository:

ADMIN_KEY
GITHUB_TOKEN
.env files containing credentials
copied Vercel environment exports
GitHub personal access tokens

Secrets must be stored only in the deployment environment.

Authentication

CMS API requests use the x-admin-key request header.

The Admin Key should:

be unique to this project;
be sufficiently long and random;
not be reused for another service;
be rotated if it is exposed.
GitHub permissions

The GitHub Token should use the minimum permissions needed by the CMS.

The project currently requires repository content access to:

read data/works.json;
update data/works.json;
create backups;
upload media;
read commit history.
Branch protection

Write operations are allowed only when:

GITHUB_BRANCH === CMS_SAFE_BRANCH

The intended value is:

cms-v1

The CMS must not write directly to main.

Concurrency protection

Publishing uses the current GitHub file SHA.

A stale CMS session must receive:

HTTP 409
REMOTE_CHANGED

instead of overwriting a newer remote version.

Browser origin policy

Production uses an exact ALLOWED_ORIGIN.

Origin checking is an additional browser protection and is not a replacement for authentication.

Non-browser requests may not include an Origin header, but still require the correct Admin Key.

Incident response

If a credential may have been exposed:

Revoke or rotate the affected credential.
Update the Vercel environment variable.
Redeploy the project.
Review recent GitHub commits.
Inspect data/works.json, media uploads, and backups.
Restore a known-good backup when necessary.
Do not publish secrets in a public issue.
Reporting a vulnerability

Do not include tokens, Admin Keys, private repository data, or sensitive screenshots in a public issue.

Provide a minimal description of the affected route, expected behavior, and observed behavior without including credentials.