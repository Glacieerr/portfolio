function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function createBackupTimestamp() {
  return new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replaceAll(".", "-");
}

function normalizeBackupPath(path, backupFolder) {
  const value = String(path || "").trim();

  if (!value) return "";

  if (!value.startsWith(`${backupFolder}/`)) return "";

  if (!/^data\/backups\/works-.+\.json$/i.test(value)) return "";

  if (value.includes("..")) return "";

  return value;
}

async function getGitHubFile({ owner, repo, branch, filePath, token }) {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

  const response = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
    method: "GET",
    headers: githubHeaders(token)
  });

  const result = await response.json().catch(async () => ({
    raw: await response.text()
  }));

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      result
    };
  }

  return {
    ok: true,
    status: response.status,
    result
  };
}

async function putGitHubFile({
  owner,
  repo,
  branch,
  filePath,
  token,
  message,
  contentBase64,
  sha
}) {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

  const response = await fetch(apiUrl, {
    method: "PUT",
    headers: githubHeaders(token),
    body: JSON.stringify({
      message,
      content: contentBase64,
      branch,
      ...(sha ? { sha } : {})
    })
  });

  const result = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      result
    };
  }

  return {
    ok: true,
    status: response.status,
    result
  };
}

function decodeBase64Text(contentBase64) {
  return Buffer.from(String(contentBase64 || "").replace(/\n/g, ""), "base64").toString("utf8");
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export async function POST(request) {
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
    const filePath = process.env.GITHUB_FILE_PATH || "data/works.json";
    const backupFolder = process.env.BACKUP_FOLDER || "data/backups";

    const body = await request.json();
    const backupPath = normalizeBackupPath(body.backupPath, backupFolder);

    if (!backupPath) {
      return json({
        ok: false,
        error: "Invalid backup path."
      }, 400);
    }

    const backupFileResponse = await getGitHubFile({
      owner,
      repo,
      branch,
      filePath: backupPath,
      token
    });

    if (!backupFileResponse.ok) {
      return json({
        ok: false,
        error: "Failed to read selected backup file.",
        detail: backupFileResponse.result
      }, backupFileResponse.status);
    }

    const backupContentText = decodeBase64Text(backupFileResponse.result.content);
    let restoredWorks;

    try {
      restoredWorks = JSON.parse(backupContentText);
    } catch {
      return json({
        ok: false,
        error: "Selected backup is not valid JSON."
      }, 400);
    }

    if (!Array.isArray(restoredWorks)) {
      return json({
        ok: false,
        error: "Selected backup JSON must be an array."
      }, 400);
    }

    const currentFileResponse = await getGitHubFile({
      owner,
      repo,
      branch,
      filePath,
      token
    });

    if (!currentFileResponse.ok) {
      return json({
        ok: false,
        error: "Failed to read current works.json before restore.",
        detail: currentFileResponse.result
      }, currentFileResponse.status);
    }

    const currentFile = currentFileResponse.result;
    const currentSha = currentFile.sha;
    const currentContentBase64 = String(currentFile.content || "").replace(/\n/g, "");

    const restoreTimestamp = createBackupTimestamp();
    const beforeRestorePath = `${backupFolder}/works-before-restore-${restoreTimestamp}.json`;

    const safetyBackupResult = await putGitHubFile({
      owner,
      repo,
      branch,
      filePath: beforeRestorePath,
      token,
      message: `cms: backup before restore ${restoreTimestamp}`,
      contentBase64: currentContentBase64
    });

    if (!safetyBackupResult.ok) {
      return json({
        ok: false,
        error: "Failed to create safety backup before restore.",
        detail: safetyBackupResult.result
      }, safetyBackupResult.status);
    }

    const restoredContentText = `${JSON.stringify(restoredWorks, null, 2)}\n`;
    const restoredContentBase64 = Buffer.from(restoredContentText, "utf8").toString("base64");

    const restoreResult = await putGitHubFile({
      owner,
      repo,
      branch,
      filePath,
      token,
      message: `cms: restore works from ${backupPath}`,
      contentBase64: restoredContentBase64,
      sha: currentSha
    });

    if (!restoreResult.ok) {
      return json({
        ok: false,
        error: "Safety backup was created, but failed to restore works.json.",
        safetyBackupPath: beforeRestorePath,
        detail: restoreResult.result
      }, restoreResult.status);
    }

    return json({
      ok: true,
      message: "Restored works.json from backup",
      branch,
      filePath,
      backupPath,
      safetyBackupPath: beforeRestorePath,
      restoredCount: restoredWorks.length,
      commitSha: restoreResult.result.commit?.sha || null,
      commitUrl: restoreResult.result.commit?.html_url || null,
      safetyBackupCommitSha: safetyBackupResult.result.commit?.sha || null,
      safetyBackupCommitUrl: safetyBackupResult.result.commit?.html_url || null
    });
  } catch (error) {
    return json({
      ok: false,
      error: error.message || "Internal Server Error"
    }, 500);
  }
}