import { list } from "@vercel/blob";

function getAllowedOrigin() {
  return (
    String(process.env.ALLOWED_ORIGIN || "*").trim() ||
    "*"
  );
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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

    if (!isAllowedRequestOrigin(request)) {
      return rejectDisallowedOrigin(request);
    }

    requireEnv("BLOB_STORE_ID");

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
      source: "blob",
      count: items.length,
      items
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to list Blob media."
      },
      500
    );
  }
}
