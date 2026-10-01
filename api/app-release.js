function getAllowedOrigin() {
  return (
    String(process.env.ALLOWED_ORIGIN || "*").trim() ||
    "*"
  );
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, x-admin-key",
    "Vary": "Origin"
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

function isAllowedRequestOrigin(request) {
  const allowedOrigin = getAllowedOrigin();

  if (allowedOrigin === "*") return true;

  const requestOrigin = String(
    request.headers.get("origin") || ""
  ).trim();

  if (!requestOrigin) return true;
  return requestOrigin === allowedOrigin;
}

function authorizeRequest(request) {
  const adminKey = request.headers.get("x-admin-key");
  const expectedAdminKey = requireEnv("ADMIN_KEY");

  if (!adminKey || adminKey !== expectedAdminKey) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  if (!isAllowedRequestOrigin(request)) {
    return json(
      {
        ok: false,
        code: "ORIGIN_NOT_ALLOWED",
        error: "Request origin is not allowed."
      },
      403
    );
  }

  return null;
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
  return Buffer.from(
    String(contentBase64 || "").replace(/\n/g, ""),
    "base64"
  ).toString("utf8");
}

const RELEASE_PATH = "data/apps/silnest.json";

function createDefaultRelease() {
  return {
    name: "声藏 · SilNest",
    android: {
      available: false,
      version: "",
      versionCode: "",
      fileName: "",
      url: "",
      pathname: "",
      size: 0,
      publishedAt: ""
    }
  };
}

async function getRemoteRelease() {
  const token = requireEnv("GITHUB_TOKEN");
  const owner = requireEnv("GITHUB_OWNER");
  const repo = requireEnv("GITHUB_REPO");
  const branch = process.env.GITHUB_BRANCH || "cms-v1";

  const url =
    `https://api.github.com/repos/${encodeURIComponent(owner)}/` +
    `${encodeURIComponent(repo)}/contents/${RELEASE_PATH}` +
    `?ref=${encodeURIComponent(branch)}`;

  const response = await fetch(url, {
    headers: githubHeaders(token)
  });

  if (response.status === 404) {
    return {
      branch,
      sha: null,
      data: createDefaultRelease()
    };
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Unable to read ${RELEASE_PATH}: HTTP ` +
      `${response.status}. ${detail}`
    );
  }

  const result = await response.json();
  const text = decodeBase64Text(result.content);
  const data = JSON.parse(text);

  return {
    branch,
    sha: result.sha || null,
    data
  };
}

function normalizeAndroidRelease(value) {
  const android = value && typeof value === "object"
    ? value
    : {};

  return {
    available: Boolean(android.available),
    version: String(android.version || "").trim().slice(0, 40),
    versionCode: String(android.versionCode || "").trim().slice(0, 40),
    fileName: String(android.fileName || "").trim().slice(0, 160),
    url: String(android.url || "").trim(),
    pathname: String(android.pathname || "").trim(),
    size: Number(android.size || 0),
    publishedAt: String(android.publishedAt || "").trim().slice(0, 40)
  };
}

function validateAndroidRelease(android) {
  if (!android.available) {
    return null;
  }

  if (!android.version) {
    return "Android version is required.";
  }

  if (!android.fileName.toLowerCase().endsWith(".apk")) {
    return "Android fileName must end with .apk.";
  }

  if (!android.pathname.startsWith("apps/silnest/android/")) {
    return "Android pathname is outside the allowed release folder.";
  }

  if (
    !android.url.startsWith("https://") ||
    !android.url.includes(".blob.vercel-storage.com/")
  ) {
    return "Android URL must be a Vercel Blob public URL.";
  }

  if (!Number.isFinite(android.size) || android.size <= 0) {
    return "Android release size must be greater than zero.";
  }

  return null;
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export async function GET(request) {
  try {
    const authError = authorizeRequest(request);
    if (authError) return authError;

    const remote = await getRemoteRelease();

    return json({
      ok: true,
      branch: remote.branch,
      filePath: RELEASE_PATH,
      sha: remote.sha,
      data: remote.data
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error?.message || "Unable to read app release metadata."
      },
      500
    );
  }
}

export async function POST(request) {
  try {
    const authError = authorizeRequest(request);
    if (authError) return authError;

    const branch = process.env.GITHUB_BRANCH || "cms-v1";
    const safeBranch = process.env.CMS_SAFE_BRANCH || "cms-v1";

    if (branch !== safeBranch) {
      return json(
        {
          ok: false,
          code: "UNSAFE_BRANCH",
          error:
            `Write blocked: current branch "${branch}" does not ` +
            `match safe branch "${safeBranch}".`
        },
        409
      );
    }

    const body = await request.json();
    const expectedSha = body.expectedSha ?? null;
    const android = normalizeAndroidRelease(body.android);
    const validationError = validateAndroidRelease(android);

    if (validationError) {
      return json(
        {
          ok: false,
          code: "INVALID_ANDROID_RELEASE",
          error: validationError
        },
        400
      );
    }

    const current = await getRemoteRelease();

    if ((current.sha || null) !== (expectedSha || null)) {
      return json(
        {
          ok: false,
          code: "REMOTE_CHANGED",
          error:
            "App release metadata changed remotely. Refresh before publishing.",
          expectedSha: expectedSha || null,
          currentSha: current.sha || null
        },
        409
      );
    }

    const token = requireEnv("GITHUB_TOKEN");
    const owner = requireEnv("GITHUB_OWNER");
    const repo = requireEnv("GITHUB_REPO");

    const nextData = {
      name: "声藏 · SilNest",
      android: {
        ...android,
        publishedAt:
          android.available && !android.publishedAt
            ? new Date().toISOString().slice(0, 10)
            : android.publishedAt
      }
    };

    const content = Buffer.from(
      `${JSON.stringify(nextData, null, 2)}\n`,
      "utf8"
    ).toString("base64");

    const url =
      `https://api.github.com/repos/${encodeURIComponent(owner)}/` +
      `${encodeURIComponent(repo)}/contents/${RELEASE_PATH}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: githubHeaders(token),
      body: JSON.stringify({
        message: android.available
          ? `cms: update SilNest Android release ${android.version}`
          : "cms: disable SilNest Android release",
        content,
        branch,
        ...(current.sha ? { sha: current.sha } : {})
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return json(
        {
          ok: false,
          error: "Failed to update SilNest release metadata on GitHub.",
          detail: result
        },
        response.status
      );
    }

    return json({
      ok: true,
      branch,
      filePath: RELEASE_PATH,
      sha: result.content?.sha || null,
      commitSha: result.commit?.sha || null,
      commitUrl: result.commit?.html_url || null,
      data: nextData
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          error?.message || "Unable to update app release metadata."
      },
      500
    );
  }
}
