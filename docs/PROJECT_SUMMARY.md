# Personal Portfolio CMS — Project Summary

## 中文简历版本

### Personal Portfolio CMS｜个人作品集内容管理系统

独立规划并开发了一套基于 GitHub、Vercel 与 Vercel Blob 的双语个人作品集 CMS，将静态作品集升级为可管理、可发布、可回滚，并支持媒体与应用发布资产管理的内容平台。

- 使用原生 HTML、CSS、JavaScript 和 Vercel Functions 构建作品管理后台，支持中英文内容、项目分类、图片与视频媒体、草稿与精选状态。
- 基于 GitHub Contents API 实现内容发布、自动备份、提交历史和一键回滚，并使用 Vercel Blob 管理图片、视频与应用发布资产，无需传统数据库。
- 实现发布前内容校验、字段级差异预览、Git SHA 并发控制、安全分支锁、环境状态检查、浏览器本地草稿恢复和 Blob 引用删除保护。
- 建立 `cms-v1 → Pull Request → main` 的版本发布流程，通过 Vercel Preview / Production 隔离预览与正式环境，并以 `yecanyuan.com` 作为统一生产域名。
- 将媒体从 Git 仓库存储迁移到 Vercel Blob，并扩展 Media Library 2.0、视频上传和 Android APK 发布资产管理，使代码版本控制与大型媒体存储解耦。

## English resume version

### Personal Portfolio CMS

Designed and developed a bilingual, Git-backed content management system that upgrades a static portfolio into a manageable, publishable, recoverable, and media-aware content platform.

- Built a browser-based CMS with native HTML, CSS, JavaScript, and Vercel Functions for managing bilingual project content, categories, media, draft states, and featured projects.
- Integrated the GitHub Contents API for content publishing, automatic backups, commit history, and one-click restoration, while using Vercel Blob for images, videos, and application release assets without a traditional database.
- Implemented validation, field-level publish diffs, optimistic concurrency control using Git SHAs, safe-branch enforcement, environment diagnostics, browser-local draft recovery, and Blob reference protection before deletion.
- Established a controlled `cms-v1 → pull request → main` release workflow with Vercel Preview / Production environments and `yecanyuan.com` as the canonical production domain.
- Migrated media away from Git-backed storage into Vercel Blob and expanded the system with Media Library 2.0, video uploads, and Android APK release-asset management.

## Current Production Architecture

```text
                        yecanyuan.com
                              │
                              ▼
                            Vercel
                 ┌────────────┼────────────┐
                 │            │            │
              Frontend    Functions    Vercel Blob
                 │            │            │
          Portfolio /      CMS API      Images
          SilNest /        GitHub API   Videos
          Admin                         Android APK
                              │
                              ▼
                            GitHub
                     ┌────────┴────────┐
                     │                 │
                   main             cms-v1
                Production        CMS / Preview
```

- Production hosting: Vercel
- Production domain: `https://yecanyuan.com`
- Production branch: `main`
- CMS / preview branch: `cms-v1`
- CMS API: Vercel Functions
- Media and release assets: Vercel Blob (`portfolio-media`)
- DNS: Cloudflare
- Source control and structured content history: GitHub
- Legacy hosting: GitHub Pages — retired

## Technology

```text
HTML
CSS
JavaScript
Vercel Functions
Vercel Blob
GitHub REST API
Git / GitHub Pull Request workflow
Vercel Preview / Production deployments
Cloudflare DNS
Custom domain: yecanyuan.com

Core engineering topics
Git-backed CMS architecture
REST API integration
Object storage
Direct signed media uploads
Media / release asset management
Optimistic concurrency control
Content validation
Version history
Backup and restore
Reference-safe deletion
Security boundaries
Environment configuration
Preview / Production isolation
Responsive UI
Bilingual content systems
```

## Migration History

- Migrated production hosting from GitHub Pages to Vercel.
- Moved the canonical production domain to `https://yecanyuan.com` on Vercel while keeping Cloudflare as DNS provider.
- Separated `cms-v1` preview / CMS workflows from the `main` production branch.
- Migrated portfolio media from Git-backed storage to Vercel Blob.
- Added Media Library 2.0 with image, video, and Android APK release-asset workflows.
- Retired GitHub Pages from the production hosting path.
