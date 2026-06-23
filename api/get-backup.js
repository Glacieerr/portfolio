function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-admin-key"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders()
    }
  });
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function githubHeaders(token) {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeBackupPath(path, backupFolder) {
  const value = String(path || "").trim();

  if (!value) return "";
  if (value.includes("..")) return "";
  if (!value.startsWith(`${backupFolder}/`)) return "";

  const pattern = new RegExp(`^${escapeRegExp(backupFolder)}/works-.+\\.json$`, "i");

  if (!pattern.test(value)) return "";

  return value;
}

function decodeBase64Text(contentBase64) {
  return Buffer.from(String(contentBase64 || "").replace(/\n/g, ""), "base64").toString("utf8");
}

function getBackupType(path) {
  if (String(path || "").includes("/works-before-restore-")) {
    return {
      key: "before-restore",
      label: "回滚前安全备份",
      description: "这是执行回滚之前保存的当前版本。通常用于撤销一次错误回滚，不一定是你想恢复的旧版本。"
    };
  }

  return {
    key: "before-publish",
    label: "发布前备份",
    description: "这是发布 works.json 之前保存的旧版本。通常是最常用的回滚目标。"
  };
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function getTitle(work) {
  return (
    normalizeText(work?.title?.zh) ||
    normalizeText(work?.title?.en) ||
    normalizeText(work?.slug) ||
    normalizeText(work?.id) ||
    "Untitled"
  );
}

function summarizeWorks(works) {
  const published = works.filter((work) => work.status !== "draft");
  const draft = works.filter((work) => work.status === "draft");
  const featured = works.filter((work) => work.featured);

  return {
    total: works.length,
    published: published.length,
    draft: draft.length,
    featured: featured.length,
    previewItems: works.slice(0, 12).map((work, index) => ({
      index: index + 1,
      id: work.id || "",
      slug: work.slug || "",
      title: getTitle(work),
      category: work.category || "",
      status: work.status || "published",
      featured: Boolean(work.featured),
      mediaType: work.mediaType || "image",
      img: work.img || ""
    }))
  };
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export async function GET(request) {
  try {
    const adminKey = request.headers.get("x-admin-key");
    const expectedAdminKey = requireEnv("ADMIN_KEY");

    if (!adminKey || adminKey !== expectedAdminKey) {
      return json({
        ok: false,
        error: "Unauthorized"
      }, 401);
    }

    const token = requireEnv("GITHUB_TOKEN");
    const owner = requireEnv("GITHUB_OWNER");
    const repo = requireEnv("GITHUB_REPO");
    const branch = process.env.GITHUB_BRANCH || "cms-v1";
    const backupFolder = process.env.BACKUP_FOLDER || "data/backups";

    const url = new URL(request.url);
    const backupPath = normalizeBackupPath(url.searchParams.get("path"), backupFolder);

    if (!backupPath) {
      return json({
        ok: false,
        error: "Invalid backup path."
      }, 400);
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${backupPath}`;

    const response = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
      method: "GET",
      headers: githubHeaders(token)
    });

    const result = await response.json().catch(async () => ({
      raw: await response.text()
    }));

    if (!response.ok) {
      return json({
        ok: false,
        error: "Failed to read backup file.",
        detail: result
      }, response.status);
    }

    const text = decodeBase64Text(result.content);

    let works;

    try {
      works = JSON.parse(text);
    } catch {
      return json({
        ok: false,
        error: "Backup file is not valid JSON."
      }, 400);
    }

    if (!Array.isArray(works)) {
      return json({
        ok: false,
        error: "Backup JSON must be an array."
      }, 400);
    }

    const backupType = getBackupType(backupPath);
    const summary = summarizeWorks(works);

    return json({
      ok: true,
      branch,
      path: backupPath,
      name: result.name || backupPath.split("/").pop(),
      size: result.size || 0,
      sha: result.sha || null,
      htmlUrl: result.html_url || null,
      downloadUrl: result.download_url || null,
      backupType,
      summary
    });
  } catch (error) {
    return json({
      ok: false,
      error: error.message || "Internal Server Error"
    }, 500);
  }
}