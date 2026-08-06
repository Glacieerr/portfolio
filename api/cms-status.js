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

async function requestGitHubJson(url, token) {
  const response = await fetch(url, {
    method: "GET",
    headers: githubHeaders(token)
  });

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      message: text || "GitHub returned a non-JSON response."
    };
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

function decodeBase64Text(contentBase64) {
  return Buffer.from(
    String(contentBase64 || "").replace(/\n/g, ""),
    "base64"
  ).toString("utf8");
}

function createCheck({
  key,
  label,
  state,
  detail,
  blocking = false
}) {
  return {
    key,
    label,
    state,
    detail,
    blocking
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

    const branch =
      process.env.GITHUB_BRANCH || "cms-v1";

    const safeBranch =
      process.env.CMS_SAFE_BRANCH || "cms-v1";

    const filePath =
      process.env.GITHUB_FILE_PATH || "data/works.json";

    const allowedOrigin =
      process.env.ALLOWED_ORIGIN || "*";

    const repoUrl =
      `https://api.github.com/repos/` +
      `${encodeURIComponent(owner)}/` +
      `${encodeURIComponent(repo)}`;

    const branchUrl =
      `${repoUrl}/branches/${encodeURIComponent(branch)}`;

    const fileUrl =
      `${repoUrl}/contents/${filePath}` +
      `?ref=${encodeURIComponent(branch)}`;

    const repoResult = await requestGitHubJson(
      repoUrl,
      token
    );

    const branchResult = await requestGitHubJson(
      branchUrl,
      token
    );

    const fileResult = await requestGitHubJson(
      fileUrl,
      token
    );

    let works = null;
    let worksCount = null;
    let worksFileValid = false;
    let worksParseError = "";

    if (fileResult.ok) {
      try {
        const text = decodeBase64Text(
          fileResult.data?.content
        );

        works = JSON.parse(text);

        if (!Array.isArray(works)) {
          throw new Error(
            "data/works.json must contain a JSON array."
          );
        }

        worksCount = works.length;
        worksFileValid = true;
      } catch (error) {
        worksParseError =
          error.message || "Unable to parse works.json.";
      }
    }

    const branchSafe = branch === safeBranch;

    const pushPermission =
      repoResult.data?.permissions?.push;

    const tokenWriteAllowed =
      pushPermission !== false;

    const repositoryReady = repoResult.ok;
    const branchReady = branchResult.ok;
    const fileReady =
      fileResult.ok && worksFileValid;

    const originRestricted =
      allowedOrigin !== "*";

    const writeReady =
      repositoryReady &&
      branchReady &&
      fileReady &&
      branchSafe &&
      tokenWriteAllowed;

    const checks = [
      createCheck({
        key: "api",
        label: "CMS 状态 API",
        state: "ok",
        detail: "状态 API 已正常响应。"
      }),

      createCheck({
        key: "repository",
        label: "GitHub 仓库",
        state: repositoryReady ? "ok" : "error",
        detail: repositoryReady
          ? `${owner}/${repo} 可以访问。`
          : `GitHub 返回 HTTP ${repoResult.status}。`,
        blocking: !repositoryReady
      }),

      createCheck({
        key: "branch",
        label: "目标分支",
        state: branchReady ? "ok" : "error",
        detail: branchReady
          ? `分支 ${branch} 存在并且可以读取。`
          : `无法读取分支 ${branch}，HTTP ${branchResult.status}。`,
        blocking: !branchReady
      }),

      createCheck({
        key: "works-file",
        label: "作品数据文件",
        state: fileReady ? "ok" : "error",
        detail: fileReady
          ? `${filePath} 可以读取，共 ${worksCount} 个作品。`
          : (
              worksParseError ||
              `无法读取 ${filePath}，HTTP ${fileResult.status}。`
            ),
        blocking: !fileReady
      }),

      createCheck({
        key: "branch-safety",
        label: "分支写入安全",
        state: branchSafe ? "ok" : "error",
        detail: branchSafe
          ? `当前分支 ${branch} 与安全分支一致。`
          : (
              `当前分支是 ${branch}，` +
              `但只允许写入 ${safeBranch}。`
            ),
        blocking: !branchSafe
      }),

      createCheck({
        key: "token-permission",
        label: "GitHub Token 写入权限",
        state:
          pushPermission === true
            ? "ok"
            : pushPermission === false
              ? "error"
              : "warning",
        detail:
          pushPermission === true
            ? "GitHub 报告当前凭据具有 push 权限。"
            : pushPermission === false
              ? "GitHub 报告当前凭据没有 push 权限。"
              : (
                  "GitHub 没有返回明确的 push 权限字段。" +
                  "实际写入能力仍需通过发布操作验证。"
                ),
        blocking: pushPermission === false
      }),

      createCheck({
        key: "cors",
        label: "API 来源限制",
        state: originRestricted ? "ok" : "warning",
        detail: originRestricted
          ? `ALLOWED_ORIGIN 已限制为 ${allowedOrigin}。`
          : (
              "ALLOWED_ORIGIN 当前为 *。" +
              "这不会阻止本阶段运行，Phase 14 将进一步收紧。"
            )
      }),

      createCheck({
        key: "write-ready",
        label: "CMS 写入状态",
        state: writeReady ? "ok" : "error",
        detail: writeReady
          ? "当前环境允许发布、媒体上传和备份回滚。"
          : "当前环境不满足安全写入条件。",
        blocking: !writeReady
      })
    ];

    const blockingReasons = checks
      .filter((item) => item.blocking)
      .map((item) => item.detail);

    return json({
      ok: true,
      writeReady,
      blockingReasons,
      environment: {
        owner,
        repo,
        branch,
        safeBranch,
        filePath,
        allowedOrigin
      },
      repository: {
        private: Boolean(repoResult.data?.private),
        defaultBranch:
          repoResult.data?.default_branch || null,
        pushPermission:
          typeof pushPermission === "boolean"
            ? pushPermission
            : null
      },
      worksFile: {
        sha: fileResult.data?.sha || null,
        size: fileResult.data?.size || 0,
        count: worksCount,
        valid: worksFileValid
      },
      checks,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          error.message ||
          "Unable to inspect CMS environment."
      },
      500
    );
  }
}