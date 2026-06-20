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
    const sha = currentFile.sha;

    const contentText = `${JSON.stringify(works, null, 2)}\n`;
    const contentBase64 = Buffer.from(contentText, "utf8").toString("base64");

    const updateResponse = await fetch(apiUrl, {
      method: "PUT",
      headers: githubHeaders(token),
      body: JSON.stringify({
        message,
        content: contentBase64,
        sha,
        branch
      })
    });

    const updateResult = await updateResponse.json();

    if (!updateResponse.ok) {
      return json({
        ok: false,
        error: "Failed to update works.json on GitHub",
        detail: updateResult
      }, updateResponse.status);
    }

    return json({
      ok: true,
      message: "Published to GitHub",
      branch,
      filePath,
      commitSha: updateResult.commit?.sha || null,
      commitUrl: updateResult.commit?.html_url || null
    });
  } catch (error) {
    return json({
      ok: false,
      error: error.message || "Internal Server Error"
    }, 500);
  }
}