# Personal Portfolio CMS — Project Summary

## 中文简历版本

### Personal Portfolio CMS｜个人作品集内容管理系统

独立规划并开发了一套基于 GitHub 与 Vercel 的双语个人作品集 CMS，将静态作品集升级为可管理、可发布、可回滚的内容系统。

- 使用原生 HTML、CSS、JavaScript 和 Vercel Functions 构建作品管理后台，支持中英文内容、项目分类、图片与视频媒体、草稿与精选状态。
- 基于 GitHub Contents API 实现内容发布、媒体上传、自动备份、提交历史和一键回滚，无需传统数据库。
- 实现发布前内容校验、字段级差异预览、Git SHA 并发控制、安全分支锁、环境状态检查和浏览器本地草稿恢复。
- 建立 `cms-v1 → Pull Request → main` 的版本发布流程，并通过 Vercel 与 GitHub Pages 完成开发环境和正式环境管理。

## English resume version

### Personal Portfolio CMS

Designed and developed a bilingual, Git-backed content management system that upgrades a static portfolio into a manageable, publishable, and recoverable content platform.

- Built a browser-based CMS with native HTML, CSS, JavaScript, and Vercel Functions for managing bilingual project content, categories, media, draft states, and featured projects.
- Integrated the GitHub Contents API for content publishing, media uploads, automatic backups, commit history, and one-click restoration without a traditional database.
- Implemented validation, field-level publish diffs, optimistic concurrency control using Git SHAs, safe-branch enforcement, environment diagnostics, and browser-local draft recovery.
- Established a controlled `cms-v1 → pull request → main` release workflow using Vercel and GitHub Pages.

## Technology

```text
HTML
CSS
JavaScript
Vercel Functions
GitHub REST API
GitHub Actions / Git-based deployment workflow
Vercel
GitHub Pages
Core engineering topics
Git-backed CMS architecture
REST API integration
Optimistic concurrency control
Content validation
Version history
Backup and restore
Security boundaries
Environment configuration
Responsive UI
Bilingual content systems