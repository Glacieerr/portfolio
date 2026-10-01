import {
  del,
  issueSignedToken,
  list,
  presignUrl
} from "@vercel/blob";

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

  if (allowedOrigin === "*") {
    return true;
  }

  const requestOrigin = String(
    request.headers.get("origin") || ""
  ).trim();

  if (!requestOrigin) {
    return true;
  }

  return requestOrigin === allowedOrigin;
}

function rejectDisallowedOrigin(request) {
  const requestOrigin = String(
    request.headers.get("origin") || ""
  ).trim();

  return json(
    {
      ok: false,
      code: "ORIGIN_NOT_ALLOWED",
      error: "Request origin is not allowed.",
      requestOrigin: requestOrigin || null,
      allowedOrigin: getAllowedOrigin()
    },
    403
  );
}

function authorizeRequest(request) {
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

  if (!isAllowedRequestOrigin(request)) {
    return rejectDisallowedOrigin(request);
  }

  requireEnv("BLOB_STORE_ID");
  return null;
}

function sanitizeSegment(value, fallback = "media") {
  const clean = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return clean || fallback;
}

function sanitizeVersion(value) {
  return String(value || "")
    .trim()
    .replace(/[^0-9A-Za-z._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function createUniqueSuffix() {
  const randomPart =
    typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : Math.random().toString(36).slice(2, 12);

  return `${Date.now()}-${randomPart}`;
}

const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"]
]);

const VIDEO_TYPES = new Map([
  ["video/mp4", "mp4"],
  ["video/webm", "webm"]
]);

const APK_CONTENT_TYPE =
  "application/vnd.android.package-archive";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_APK_BYTES = 500 * 1024 * 1024;

function isApkFileName(fileName) {
  return /\.apk$/i.test(String(fileName || "").trim());
}

function getUploadRule({ kind, fileName, mimeType }) {
  if (kind === "cover" || kind === "screenshot") {
    const ext = IMAGE_TYPES.get(mimeType);

    if (!ext) {
      return null;
    }

    return {
      mediaType: "image",
      contentType: mimeType,
      ext,
      maxBytes: MAX_IMAGE_BYTES
    };
  }

  if (kind === "video") {
    const ext = VIDEO_TYPES.get(mimeType);

    if (!ext) {
      return null;
    }

    return {
      mediaType: "video",
      contentType: mimeType,
      ext,
      maxBytes: MAX_VIDEO_BYTES
    };
  }

  if (kind === "android-apk" && isApkFileName(fileName)) {
    const acceptedMimeTypes = new Set([
      "",
      "application/octet-stream",
      APK_CONTENT_TYPE
    ]);

    if (!acceptedMimeTypes.has(mimeType)) {
      return null;
    }

    return {
      mediaType: "apk",
      contentType: APK_CONTENT_TYPE,
      ext: "apk",
      maxBytes: MAX_APK_BYTES
    };
  }

  return null;
}

function buildUploadPath({
  kind,
  slug,
  version,
  fileName,
  ext
}) {
  const baseName = sanitizeSegment(fileName, kind);
  const uniqueName =
    `${baseName}-${createUniqueSuffix()}.${ext}`;

  if (kind === "android-apk") {
    const safeVersion = sanitizeVersion(version);

    if (!safeVersion) {
      return null;
    }

    return `apps/silnest/android/${safeVersion}/${uniqueName}`;
  }

  const safeSlug = sanitizeSegment(slug, "untitled-work");

  if (kind === "cover") {
    return `works/${safeSlug}/cover/${uniqueName}`;
  }

  if (kind === "screenshot") {
    return `works/${safeSlug}/screenshots/${uniqueName}`;
  }

  if (kind === "video") {
    return `works/${safeSlug}/video/${uniqueName}`;
  }

  return null;
}

function isAllowedBlobPath(pathname) {
  const value = String(pathname || "");

  return (
    value.startsWith("works/") ||
    value.startsWith("photo/") ||
    value.startsWith("art/") ||
    value.startsWith("motion/") ||
    value.startsWith("apps/silnest/android/")
  );
}

function classifyBlob(pathname, contentType = "") {
  const value = String(pathname || "");
  const type = String(contentType || "").toLowerCase();

  if (/\.apk$/i.test(value)) {
    const parts = value.split("/");
    return {
      mediaType: "apk",
      kind: "android-apk",
      slug: "silnest",
      version: parts[3] || ""
    };
  }

  if (
    type.startsWith("video/") ||
    /\.(mp4|webm)$/i.test(value)
  ) {
    return {
      mediaType: "video",
      kind: "video",
      slug: value.startsWith("works/")
        ? value.split("/")[1] || ""
        : "",
      version: ""
    };
  }

  if (
    type.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp|gif)$/i.test(value)
  ) {
    let kind = "image";

    if (value.includes("/cover/")) {
      kind = "cover";
    } else if (value.includes("/screenshots/")) {
      kind = "screenshot";
    }

    return {
      mediaType: "image",
      kind,
      slug: value.startsWith("works/")
        ? value.split("/")[1] || ""
        : "",
      version: ""
    };
  }

  return {
    mediaType: "other",
    kind: "other",
    slug: "",
    version: ""
  };
}

function isSupportedBlob(pathname, contentType = "") {
  if (!isAllowedBlobPath(pathname)) {
    return false;
  }

  return classifyBlob(pathname, contentType).mediaType !== "other";
}

function getFileName(pathname) {
  const parts = String(pathname || "").split("/");
  return parts[parts.length - 1] || pathname || "blob";
}

function getAction(request) {
  return String(
    new URL(request.url).searchParams.get("action") || ""
  ).trim().toLowerCase();
}

async function createUploadUrl(request) {
  const body = await request.json();

  const fileName = String(body.fileName || "");
  const mimeType = String(body.mimeType || "").toLowerCase();
  const fileSize = Number(body.fileSize || 0);
  const kind = String(body.kind || "cover").trim().toLowerCase();
  const slug = String(body.slug || "");
  const version = String(body.version || "");

  const allowedKinds = new Set([
    "cover",
    "screenshot",
    "video",
    "android-apk"
  ]);

  if (!allowedKinds.has(kind)) {
    return json(
      {
        ok: false,
        code: "INVALID_MEDIA_KIND",
        error: "Unsupported media kind."
      },
      400
    );
  }

  const rule = getUploadRule({
    kind,
    fileName,
    mimeType
  });

  if (!rule) {
    return json(
      {
        ok: false,
        code: "INVALID_MEDIA_TYPE",
        error:
          kind === "android-apk"
            ? "Android releases must be .apk files."
            : kind === "video"
              ? "Only MP4 and WEBM videos are allowed."
              : "Only JPG, PNG, WEBP and GIF images are allowed."
      },
      400
    );
  }

  if (
    !Number.isFinite(fileSize) ||
    fileSize <= 0 ||
    fileSize > rule.maxBytes
  ) {
    return json(
      {
        ok: false,
        code: "INVALID_FILE_SIZE",
        error:
          `File must be larger than 0 bytes and no more than ` +
          `${Math.round(rule.maxBytes / 1024 / 1024)}MB.`,
        maxBytes: rule.maxBytes
      },
      400
    );
  }

  if (kind !== "android-apk" && !sanitizeSegment(slug, "")) {
    return json(
      {
        ok: false,
        code: "MISSING_SLUG",
        error: "A work slug is required for this upload."
      },
      400
    );
  }

  if (kind === "android-apk" && !sanitizeVersion(version)) {
    return json(
      {
        ok: false,
        code: "MISSING_VERSION",
        error: "An Android version is required for APK uploads."
      },
      400
    );
  }

  const pathname = buildUploadPath({
    kind,
    slug,
    version,
    fileName,
    ext: rule.ext
  });

  if (!pathname || !isAllowedBlobPath(pathname)) {
    return json(
      {
        ok: false,
        code: "PATH_NOT_ALLOWED",
        error: "Unable to create an allowed Blob pathname."
      },
      400
    );
  }

  const isLargeAsset =
    kind === "video" || kind === "android-apk";

  const validUntil =
    Date.now() + (isLargeAsset ? 60 : 10) * 60 * 1000;

  const token = await issueSignedToken({
    pathname,
    operations: ["put"],
    allowedContentTypes: [rule.contentType],
    maximumSizeInBytes: rule.maxBytes,
    validUntil
  });

  const { presignedUrl } = await presignUrl(token, {
    pathname,
    operation: "put",
    validUntil
  });

  return json({
    ok: true,
    action: "upload-url",
    kind,
    mediaType: rule.mediaType,
    contentType: rule.contentType,
    pathname,
    presignedUrl,
    validUntil,
    maxBytes: rule.maxBytes
  });
}

async function listAllBlobs() {
  const allBlobs = [];
  let cursor;

  do {
    const result = await list({
      limit: 1000,
      ...(cursor ? { cursor } : {})
    });

    allBlobs.push(...result.blobs);
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  return allBlobs;
}

async function listMedia() {
  const allBlobs = await listAllBlobs();

  const items = allBlobs
    .filter((blob) =>
      isSupportedBlob(blob.pathname, blob.contentType)
    )
    .map((blob) => {
      const meta = classifyBlob(
        blob.pathname,
        blob.contentType
      );

      return {
        source: "blob",
        name: getFileName(blob.pathname),
        path: blob.pathname,
        pathname: blob.pathname,
        size: blob.size,
        url: blob.url,
        downloadUrl: blob.downloadUrl || blob.url,
        etag: blob.etag || null,
        uploadedAt: blob.uploadedAt || null,
        contentType: blob.contentType || "",
        mediaType: meta.mediaType,
        kind: meta.kind,
        slug: meta.slug,
        version: meta.version
      };
    })
    .sort((a, b) => {
      const aTime = new Date(a.uploadedAt || 0).getTime();
      const bTime = new Date(b.uploadedAt || 0).getTime();
      return bTime - aTime;
    });

  return json({
    ok: true,
    action: "list",
    source: "blob",
    count: items.length,
    items
  });
}

function githubHeaders(token) {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

async function readGitHubJsonFile(filePath) {
  const token = requireEnv("GITHUB_TOKEN");
  const owner = requireEnv("GITHUB_OWNER");
  const repo = requireEnv("GITHUB_REPO");
  const branch = process.env.GITHUB_BRANCH || "cms-v1";

  const url =
    `https://api.github.com/repos/${encodeURIComponent(owner)}/` +
    `${encodeURIComponent(repo)}/contents/${filePath}` +
    `?ref=${encodeURIComponent(branch)}`;

  const response = await fetch(url, {
    headers: githubHeaders(token)
  });

  if (response.status === 404) {
    return {
      exists: false,
      data: null
    };
  }

  if (!response.ok) {
    throw new Error(
      `Unable to inspect ${filePath} before Blob deletion ` +
      `(GitHub HTTP ${response.status}).`
    );
  }

  const payload = await response.json();
  const text = Buffer.from(
    String(payload.content || "").replace(/\n/g, ""),
    "base64"
  ).toString("utf8");

  return {
    exists: true,
    data: JSON.parse(text)
  };
}

function collectExactReferences(
  value,
  targets,
  source,
  jsonPath = "$",
  output = []
) {
  if (typeof value === "string") {
    if (targets.has(value.trim())) {
      output.push({
        source,
        jsonPath,
        value
      });
    }
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectExactReferences(
        item,
        targets,
        source,
        `${jsonPath}[${index}]`,
        output
      );
    });
    return output;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      collectExactReferences(
        item,
        targets,
        source,
        `${jsonPath}.${key}`,
        output
      );
    });
  }

  return output;
}

async function findCurrentReferences(pathname) {
  const blobs = await list({
    prefix: pathname,
    limit: 100
  });

  const exactBlob = blobs.blobs.find(
    (blob) => blob.pathname === pathname
  );

  const targets = new Set([
    pathname,
    exactBlob?.url,
    exactBlob?.downloadUrl
  ].filter(Boolean));

  const references = [];
  const worksPath =
    process.env.GITHUB_FILE_PATH || "data/works.json";

  const worksFile = await readGitHubJsonFile(worksPath);

  if (worksFile.exists) {
    collectExactReferences(
      worksFile.data,
      targets,
      worksPath,
      "$",
      references
    );
  }

  const appReleasePath = "data/apps/silnest.json";
  const appRelease = await readGitHubJsonFile(appReleasePath);

  if (appRelease.exists) {
    collectExactReferences(
      appRelease.data,
      targets,
      appReleasePath,
      "$",
      references
    );
  }

  return {
    references,
    blob: exactBlob || null
  };
}

async function deleteMedia(request) {
  const body = await request.json();
  const pathname = String(body.pathname || "").trim();

  if (!pathname) {
    return json(
      {
        ok: false,
        code: "MISSING_PATHNAME",
        error: "Missing Blob pathname."
      },
      400
    );
  }

  if (!isAllowedBlobPath(pathname)) {
    return json(
      {
        ok: false,
        code: "PATH_NOT_ALLOWED",
        error:
          "This Blob pathname is not allowed to be deleted."
      },
      400
    );
  }

  const referenceResult =
    await findCurrentReferences(pathname);

  if (referenceResult.references.length) {
    return json(
      {
        ok: false,
        code: "BLOB_REFERENCED",
        error:
          "This Blob is still referenced by current published data.",
        pathname,
        references: referenceResult.references
      },
      409
    );
  }

  await del(pathname);

  return json({
    ok: true,
    action: "delete",
    message: "Blob deleted.",
    pathname
  });
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

    const action = getAction(request);

    if (action !== "list") {
      return json(
        {
          ok: false,
          code: "INVALID_ACTION",
          error: "GET only supports action=list."
        },
        400
      );
    }

    return await listMedia();
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to process Blob media request."
      },
      500
    );
  }
}

export async function POST(request) {
  try {
    const authError = authorizeRequest(request);
    if (authError) return authError;

    const action = getAction(request);

    if (action === "upload-url") {
      return await createUploadUrl(request);
    }

    if (action === "delete") {
      return await deleteMedia(request);
    }

    return json(
      {
        ok: false,
        code: "INVALID_ACTION",
        error:
          "POST supports action=upload-url or action=delete."
      },
      400
    );
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to process Blob media request."
      },
      500
    );
  }
}