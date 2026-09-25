import { del } from "@vercel/blob";

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
      message: "Blob deleted.",
      pathname
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to delete Blob media."
      },
      500
    );
  }
}
