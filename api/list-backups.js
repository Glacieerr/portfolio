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

function isBackupFile(name) {
  return /^works-.+\.json$/i.test(name || "");
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

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${backupFolder}`;

    const response = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
      method: "GET",
      headers: githubHeaders(token)
    });

    if (response.status === 404) {
      return json({
        ok: true,
        branch,
        folder: backupFolder,
        items: []
      });
    }

    if (!response.ok) {
      const detail = await response.text();

      return json({
        ok: false,
        error: "Failed to list backup folder from GitHub.",
        detail
      }, response.status);
    }

    const result = await response.json();

    if (!Array.isArray(result)) {
      return json({
        ok: false,
        error: "GitHub response is not a directory listing."
      }, 500);
    }

    const items = result
      .filter((item) => item.type === "file" && isBackupFile(item.name))
      .map((item) => ({
        name: item.name,
        path: item.path,
        size: item.size,
        sha: item.sha,
        downloadUrl: item.download_url,
        htmlUrl: item.html_url
      }))
      .sort((a, b) => b.name.localeCompare(a.name));

    return json({
      ok: true,
      branch,
      folder: backupFolder,
      items
    });
  } catch (error) {
    return json({
      ok: false,
      error: error.message || "Internal Server Error"
    }, 500);
  }
}