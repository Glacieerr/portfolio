function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-key"
    }
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-key"
    }
  });
}

export function GET() {
  return json({
    ok: true,
    service: "Portfolio CMS API",
    github: {
      owner: process.env.GITHUB_OWNER || null,
      repo: process.env.GITHUB_REPO || null,
      branch: process.env.GITHUB_BRANCH || null,
      filePath: process.env.GITHUB_FILE_PATH || "data/works.json",
      hasToken: Boolean(process.env.GITHUB_TOKEN)
    },
    auth: {
      hasAdminKey: Boolean(process.env.ADMIN_KEY)
    }
  });
}