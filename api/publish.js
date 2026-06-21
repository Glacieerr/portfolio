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
    const works = body.works;
    const message = body.message || `cms: update works ${new Date().toISOString()}`;

    if (!Array.isArray(works)) {
      return json({
        ok: false,
        error: "Invalid payload: works must be an array"
      }, 400);
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    const currentResponse = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
      method: "GET",
      headers: githubHeaders(token)
    });

    if (!currentResponse.ok) {
      const detail = await currentResponse.text();

      return json({
        ok: false,
        error: "Failed to read current works.json from GitHub",
        detail
      }, currentResponse.status);
    }

    const currentFile = await currentResponse.json();
    const currentSha = currentFile.sha;
    const currentContentBase64 = String(currentFile.content || "").replace(/\n/g, "");

    const backupTimestamp = createBackupTimestamp();
    const backupPath = `${backupFolder}/works-${backupTimestamp}.json`;

    const backupResult = await putGitHubFile({
      owner,
      repo,
      branch,
      filePath: backupPath,
      token,
      message: `cms: backup works ${backupTimestamp}`,
      contentBase64: currentContentBase64
    });

    if (!backupResult.ok) {
      return json({
        ok: false,
        error: "Failed to create works.json backup before publishing.",
        detail: backupResult.result
      }, backupResult.status);
    }

    const contentText = `${JSON.stringify(works, null, 2)}\n`;
    const contentBase64 = Buffer.from(contentText, "utf8").toString("base64");

    const updateResult = await putGitHubFile({
      owner,
      repo,
      branch,
      filePath,
      token,
      message,
      contentBase64,
      sha: currentSha
    });

    if (!updateResult.ok) {
      return json({
        ok: false,
        error: "Backup was created, but failed to update works.json on GitHub.",
        backupPath,
        detail: updateResult.result
      }, updateResult.status);
    }

    return json({
      ok: true,
      message: "Published to GitHub with backup",
      branch,
      filePath,
      backupPath,
      backupCommitSha: backupResult.result.commit?.sha || null,
      backupCommitUrl: backupResult.result.commit?.html_url || null,
      commitSha: updateResult.result.commit?.sha || null,
      commitUrl: updateResult.result.commit?.html_url || null
    });
  } catch (error) {
    return json({
      ok: false,
      error: error.message || "Internal Server Error"
    }, 500);
  }
}