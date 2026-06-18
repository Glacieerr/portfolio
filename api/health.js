export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  return res.status(200).json({
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