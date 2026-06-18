function setCors(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
}

function parseBody(req) {
  if (!req.body) return {};

  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  return req.body;
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

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    const adminKey = req.headers["x-admin-key"];
    const expectedAdminKey = requireEnv("ADMIN_KEY");

    if (!adminKey || adminKey !== expectedAdminKey) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized"
      });
    }

    const token = requireEnv("GITHUB_TOKEN");
    const owner = requireEnv("GITHUB_OWNER");
    const repo = requireEnv("GITHUB_REPO");
    const branch = process.env.GITHUB_BRANCH || "cms-v1";
    const filePath = process.env.GITHUB_FILE_PATH || "data/works.json";

    const body = parseBody(req);
    const works = body.works;
    const message = body.message || `cms: update works ${new Date().toISOString()}`;

    if (!Array.isArray(works)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid payload: works must be an array"
      });
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    const currentResponse = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
      method: "GET",
      headers: githubHeaders(token)
    });

    if (!currentResponse.ok) {
      const detail = await currentResponse.text();

      return res.status(currentResponse.status).json({
        ok: false,
        error: "Failed to read current works.json from GitHub",
        detail
      });
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
      return res.status(updateResponse.status).json({
        ok: false,
        error: "Failed to update works.json on GitHub",
        detail: updateResult
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Published to GitHub",
      branch,
      filePath,
      commitSha: updateResult.commit?.sha || null,
      commitUrl: updateResult.commit?.html_url || null
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Internal Server Error"
    });
  }
}