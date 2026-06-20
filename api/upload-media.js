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

function sanitizeFileName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getExtensionFromMime(mimeType) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif"
  };

  return map[mimeType] || "";
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

    const body = await request.json();

    const originalName = body.fileName || "";
    const mimeType = body.mimeType || "";
    const contentBase64 = body.contentBase64 || "";
    const slug = body.slug || "";

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

    if (!allowedTypes.includes(mimeType)) {
      return json({
        ok: false,
        error: "Only JPG, PNG, WEBP and GIF images are allowed."
      }, 400);
    }

    if (!contentBase64 || typeof contentBase64 !== "string") {
      return json({
        ok: false,
        error: "Missing image content."
      }, 400);
    }

    const estimatedBytes = Math.ceil((contentBase64.length * 3) / 4);
    const maxBytes = 4 * 1024 * 1024;

    if (estimatedBytes > maxBytes) {
      return json({
        ok: false,
        error: "Image is too large. Please keep it under 4MB."
      }, 400);
    }

    const ext = getExtensionFromMime(mimeType);
    const baseName =
      sanitizeFileName(slug) ||
      sanitizeFileName(originalName) ||
      `work-cover-${Date.now()}`;

    const filePath = `images/works/${baseName}.${ext}`;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    let sha = null;

    const existingResponse = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
      method: "GET",
      headers: githubHeaders(token)
    });

    if (existingResponse.ok) {
      const existingFile = await existingResponse.json();
      sha = existingFile.sha;
    } else if (existingResponse.status !== 404) {
      const detail = await existingResponse.text();

      return json({
        ok: false,
        error: "Failed to check existing media file on GitHub.",
        detail
      }, existingResponse.status);
    }

    const updateResponse = await fetch(apiUrl, {
      method: "PUT",
      headers: githubHeaders(token),
      body: JSON.stringify({
        message: `cms: upload media ${filePath}`,
        content: contentBase64,
        branch,
        ...(sha ? { sha } : {})
      })
    });

    const updateResult = await updateResponse.json();

    if (!updateResponse.ok) {
      return json({
        ok: false,
        error: "Failed to upload media to GitHub.",
        detail: updateResult
      }, updateResponse.status);
    }

    return json({
      ok: true,
      message: "Media uploaded to GitHub",
      branch,
      path: filePath,
      downloadUrl: updateResult.content?.download_url || null,
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