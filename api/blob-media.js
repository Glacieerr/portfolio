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

function getExtensionFromMime(mimeType) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif"
  };

  return map[mimeType] || "";
}

function createUniqueSuffix() {
  const randomPart =
    typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : Math.random().toString(36).slice(2, 12);

  return `${Date.now()}-${randomPart}`;
}

function isAllowedBlobPath(pathname) {
  const value = String(pathname || "");

  return (
    value.startsWith("works/") ||
    value.startsWith("photo/") ||
    value.startsWith("art/") ||
    value.startsWith("motion/")
  );
}

function isImagePath(pathname) {
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(
    String(pathname || "")
  );
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
  const mimeType = String(body.mimeType || "");
  const fileSize = Number(body.fileSize || 0);
  const slug = sanitizeSegment(body.slug, "untitled-work");

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
  ];

  if (!allowedTypes.includes(mimeType)) {
    return json(
      {
        ok: false,
        code: "INVALID_MEDIA_TYPE",
        error:
          "Only JPG, PNG, WEBP and GIF images are allowed."
      },
      400
    );
  }

  const maxBytes = 20 * 1024 * 1024;

  if (
    !Number.isFinite(fileSize) ||
    fileSize <= 0 ||
    fileSize > maxBytes
  ) {
    return json(
      {
        ok: false,
        code: "INVALID_FILE_SIZE",
        error:
          "Image must be larger than 0 bytes and no more than 20MB.",
        maxBytes
      },
      400
    );
  }

  const ext = getExtensionFromMime(mimeType);
  const originalBase = sanitizeSegment(fileName, "cover");
  const pathname =
    `works/${slug}/cover/` +
    `${originalBase}-${createUniqueSuffix()}.${ext}`;

  const validUntil = Date.now() + 10 * 60 * 1000;

  const token = await issueSignedToken({
    pathname,
    operations: ["put"],
    allowedContentTypes: [mimeType],
    maximumSizeInBytes: fileSize,
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
    pathname,
    presignedUrl,
    validUntil,
    maxBytes
  });
}

async function listMedia() {
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

  const items = allBlobs
    .filter(
      (blob) =>
        isAllowedBlobPath(blob.pathname) &&
        isImagePath(blob.pathname)
    )
    .map((blob) => ({
      source: "blob",
      name: getFileName(blob.pathname),
      path: blob.pathname,
      pathname: blob.pathname,
      size: blob.size,
      url: blob.url,
      downloadUrl: blob.downloadUrl || blob.url,
      etag: blob.etag || null,
      uploadedAt: blob.uploadedAt || null
    }))
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

  if (
    !isAllowedBlobPath(pathname) ||
    !isImagePath(pathname)
  ) {
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
