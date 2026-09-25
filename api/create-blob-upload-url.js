import {
  issueSignedToken,
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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
          error: "Image must be larger than 0 bytes and no more than 20MB.",
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
      pathname,
      presignedUrl,
      validUntil,
      maxBytes
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to create a Blob upload URL."
      },
      500
    );
  }
}
