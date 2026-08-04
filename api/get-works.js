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

function decodeBase64Text(contentBase64) {
  return Buffer.from(String(contentBase64 || "").replace(/\n/g, ""), "base64").toString("utf8");
}

function createContentFingerprint(text) {
  let hash = 5381;
  const value = String(text || "");

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) + value.charCodeAt(index);
    hash >>>= 0;
  }

  return hash.toString(16).padStart(8, "0");
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
    const filePath = process.env.GITHUB_FILE_PATH || "data/works.json";

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

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
        error: "Failed to read works.json from GitHub.",
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
        error: "Remote works.json is not valid JSON."
      }, 400);
    }

    if (!Array.isArray(works)) {
      return json({
        ok: false,
        error: "Remote works.json must be an array."
      }, 400);
    }

    return json({
      ok: true,
      branch,
      filePath,
      sha: result.sha || null,
      size: result.size || 0,
      fingerprint: createContentFingerprint(text),
      works
    });
  } catch (error) {
    return json({
      ok: false,
      error: error.message || "Internal Server Error"
    }, 500);
  }
}