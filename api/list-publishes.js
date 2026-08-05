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
      "Cache-Control": "no-store",
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
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function getPublishType(message) {
  const value = String(message || "").toLowerCase();

  if (value.includes("restore works")) {
    return {
      key: "restore",
      label: "回滚"
    };
  }

  if (value.startsWith("cms:")) {
    return {
      key: "publish",
      label: "CMS 发布"
    };
  }

  return {
    key: "manual",
    label: "其他提交"
  };
}

function splitCommitMessage(message) {
  const lines = String(message || "")
    .split("\n")
    .map((line) => line.trim());

  return {
    title: lines[0] || "Untitled commit",
    body: lines.slice(1).filter(Boolean).join("\n")
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
      return json(
        {
          ok: false,
          error: "Unauthorized"
        },
        401
      );
    }

    const token = requireEnv("GITHUB_TOKEN");
    const owner = requireEnv("GITHUB_OWNER");
    const repo = requireEnv("GITHUB_REPO");
    const branch = process.env.GITHUB_BRANCH || "cms-v1";
    const filePath = process.env.GITHUB_FILE_PATH || "data/works.json";

    const requestUrl = new URL(request.url);
    const requestedLimit = Number(requestUrl.searchParams.get("limit") || 20);
    const limit = Math.min(Math.max(requestedLimit, 1), 50);

    const params = new URLSearchParams({
      sha: branch,
      path: filePath,
      per_page: String(limit)
    });

    const apiUrl =
      `https://api.github.com/repos/${owner}/${repo}/commits?${params.toString()}`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: githubHeaders(token)
    });

    const result = await response.json();

    if (!response.ok) {
      return json(
        {
          ok: false,
          error: "Failed to read publish history from GitHub.",
          detail: result
        },
        response.status
      );
    }

    if (!Array.isArray(result)) {
      return json(
        {
          ok: false,
          error: "GitHub commits response must be an array."
        },
        500
      );
    }

    const items = result.map((item) => {
      const message = splitCommitMessage(item.commit?.message);
      const type = getPublishType(message.title);

      return {
        sha: item.sha || "",
        shortSha: String(item.sha || "").slice(0, 7),
        title: message.title,
        body: message.body,
        type,
        authorName:
          item.commit?.author?.name ||
          item.author?.login ||
          "Unknown author",
        authorLogin: item.author?.login || "",
        date:
          item.commit?.committer?.date ||
          item.commit?.author?.date ||
          null,
        htmlUrl: item.html_url || null,
        verified: Boolean(item.commit?.verification?.verified)
      };
    });

    return json({
      ok: true,
      branch,
      filePath,
      count: items.length,
      items
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Internal Server Error"
      },
      500
    );
  }
}