let works = [];
let selectedId = null;
let mediaLibraryItems = [];
let backupItems = [];

const CMS_API_BASE = "https://portfolio-flame-seven-33.vercel.app";

const $ = (selector) => document.querySelector(selector);
function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const fields = {
  workId: $("#workId"),
  slug: $("#slug"),
  category: $("#category"),
  titleZh: $("#titleZh"),
  titleEn: $("#titleEn"),
  descZh: $("#descZh"),
  descEn: $("#descEn"),
  mediaType: $("#mediaType"),
  order: $("#order"),
  img: $("#img"),
  video: $("#video"),
  link: $("#link"),
  tags: $("#tags"),
  linkTextZh: $("#linkTextZh"),
  linkTextEn: $("#linkTextEn"),
  featured: $("#featured"),
  published: $("#published")
};

const listFilters = {
  search: $("#searchInput"),
  category: $("#categoryFilter"),
  status: $("#statusFilter")
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function resolveMediaUrl(path) {
  const value = String(path || "").trim();

  if (!value) return "";

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.startsWith("/")
  ) {
    return value;
  }

  return `../${value}`;
}

function createIdFromSlug(slug) {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function loadSavedAdminKey() {
  const savedKey = localStorage.getItem("portfolioCmsAdminKey") || "";
  const input = $("#adminKeyInput");

  if (input) {
    input.value = savedKey;
  }
}

function saveAdminKey() {
  const key = $("#adminKeyInput").value.trim();

  if (!key) {
    alert("请输入 Admin Key。");
    return;
  }

  localStorage.setItem("portfolioCmsAdminKey", key);
  alert("Admin Key 已保存到当前浏览器。");
}

function getCurrentAdminKey() {
  return $("#adminKeyInput").value.trim();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error("读取图片失败。"));
    };

    reader.readAsDataURL(file);
  });
}

function getUploadSlug() {
  const slug = createIdFromSlug(fields.slug.value);
  const title = createIdFromSlug(fields.titleEn.value || fields.titleZh.value);

  return slug || title || `work-cover-${Date.now()}`;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function getWorkDisplayName(work, index) {
  const title =
    normalizeText(work?.title?.zh) ||
    normalizeText(work?.title?.en) ||
    normalizeText(work?.slug) ||
    normalizeText(work?.id) ||
    `未命名作品 ${index + 1}`;

  return `#${index + 1} ${title}`;
}

function hasRealValue(value) {
  const text = normalizeText(value);

  return text !== "" && text !== "#";
}

function looksLikeValidMediaPath(path) {
  const value = normalizeText(path);

  if (!value) return false;

  return (
    value.startsWith("images/") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  );
}

function looksLikeValidLink(link) {
  const value = normalizeText(link);

  if (!value || value === "#") return true;

  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("mailto:")
  );
}

function getCurrentFormDraftForValidation() {
  const slug = createIdFromSlug(fields.slug.value);
  const currentId = fields.workId.value || slug;

  if (!slug && !fields.titleZh.value && !fields.titleEn.value) {
    return null;
  }

  return {
    id: currentId || slug,
    slug,
    category: fields.category.value,
    mediaType: fields.mediaType.value,
    order: Number(fields.order.value || 1),
    img: normalizeText(fields.img.value),
    video: normalizeText(fields.video.value),
    link: normalizeText(fields.link.value),
    tags: fields.tags.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    title: {
      zh: normalizeText(fields.titleZh.value),
      en: normalizeText(fields.titleEn.value)
    },
    desc: {
      zh: normalizeText(fields.descZh.value),
      en: normalizeText(fields.descEn.value)
    },
    linkText: {
      zh: normalizeText(fields.linkTextZh.value),
      en: normalizeText(fields.linkTextEn.value)
    },
    featured: fields.featured.checked,
    status: fields.published.checked ? "published" : "draft"
  };
}

function getWorksForValidation() {
  const draft = getCurrentFormDraftForValidation();

  if (!draft) {
    return works;
  }

  const draftId = createIdFromSlug(draft.id || draft.slug);

  if (!draftId) {
    return [...works, draft];
  }

  const exists = works.some((work) => {
    const workId = createIdFromSlug(work.id || work.slug);
    return workId === draftId;
  });

  if (!exists) {
    return [...works, draft];
  }

  return works.map((work) => {
    const workId = createIdFromSlug(work.id || work.slug);
    return workId === draftId ? draft : work;
  });
}

function validateWorksData(items = works) {
  const errors = [];
  const warnings = [];
  const seenIds = new Map();

  if (!Array.isArray(items)) {
    return {
      errors: ["works 数据必须是数组。"],
      warnings
    };
  }

  items.forEach((work, index) => {
    const name = getWorkDisplayName(work, index);
    const id = normalizeText(work.id || work.slug);
    const slug = normalizeText(work.slug || work.id);
    const canonicalId = createIdFromSlug(id || slug);
    const category = normalizeText(work.category);
    const mediaType = normalizeText(work.mediaType || "image");
    const status = normalizeText(work.status || "published");
    const isPublished = status !== "draft";
    const isFeatured = Boolean(work.featured);

    const titleZh = normalizeText(work.title?.zh);
    const titleEn = normalizeText(work.title?.en);
    const descZh = normalizeText(work.desc?.zh);
    const descEn = normalizeText(work.desc?.en);
    const img = normalizeText(work.img);
    const video = normalizeText(work.video);
    const link = normalizeText(work.link);
    const order = Number(work.order);

    if (!canonicalId) {
      errors.push(`${name}：缺少 Slug / ID。`);
    } else if (seenIds.has(canonicalId)) {
      errors.push(`${name}：Slug / ID 与 ${seenIds.get(canonicalId)} 重复：${canonicalId}`);
    } else {
      seenIds.set(canonicalId, name);
    }

    const allowedCategories = ["software", "tools", "uiux", "photo", "art", "motion"];

    if (!allowedCategories.includes(category)) {
      errors.push(`${name}：分类无效：${category || "空"}`);
    }

    if (!["image", "video"].includes(mediaType)) {
      errors.push(`${name}：媒体类型必须是 image 或 video。`);
    }

    if (isPublished) {
      if (!titleZh) {
        errors.push(`${name}：Published 作品缺少中文标题。`);
      }

      if (!titleEn) {
        errors.push(`${name}：Published 作品缺少英文标题。`);
      }

      if (mediaType === "image" && !hasRealValue(img)) {
        errors.push(`${name}：Published 图片作品缺少封面路径。`);
      }

      if (mediaType === "video" && !hasRealValue(video)) {
        errors.push(`${name}：Published 视频作品缺少视频路径。`);
      }
    }

    if (isFeatured && !isPublished) {
      warnings.push(`${name}：已设为 Featured，但未 Published。前台不会展示这个核心项目。`);
    }

    if (isPublished && !descZh) {
      warnings.push(`${name}：Published 作品缺少中文描述。`);
    }

    if (isPublished && !descEn) {
      warnings.push(`${name}：Published 作品缺少英文描述。`);
    }

    if (hasRealValue(img) && !looksLikeValidMediaPath(img)) {
      warnings.push(`${name}：封面路径看起来不规范：${img}`);
    }

    if (
      mediaType === "video" &&
      hasRealValue(video) &&
      !looksLikeValidMediaPath(video) &&
      !video.startsWith("videos/")
    ) {
      warnings.push(`${name}：视频路径看起来不规范：${video}`);
    }

    if (!Number.isFinite(order)) {
      warnings.push(`${name}：Order 不是有效数字。`);
    }

    if (!looksLikeValidLink(link)) {
      warnings.push(`${name}：链接格式可能不正确：${link}`);
    }

    if (isFeatured && isPublished && !hasRealValue(img)) {
      warnings.push(`${name}：Featured 作品建议设置封面图，否则核心项目区视觉表现会弱。`);
    }
  });

  return {
    errors,
    warnings
  };
}

function renderListItems(list, items, emptyText) {
  if (!list) return;

  if (!items.length) {
    list.innerHTML = `<li>${escapeHTML(emptyText)}</li>`;
    return;
  }

  list.innerHTML = items.map((item) => `<li>${escapeHTML(item)}</li>`).join("");
}

function showValidationReport(report, options = {}) {
  const banner = $("#validationBanner");
  const title = $("#validationTitle");
  const summary = $("#validationSummary");
  const errorList = $("#validationErrors");
  const warningList = $("#validationWarnings");

  if (!banner || !title || !summary || !errorList || !warningList) return;

  const errorCount = report.errors.length;
  const warningCount = report.warnings.length;

  banner.hidden = false;
  banner.classList.remove("is-valid", "is-warning", "is-error");

  if (errorCount > 0) {
    banner.classList.add("is-error");
    title.textContent = "内容检查未通过";
    summary.textContent = `发现 ${errorCount} 个错误、${warningCount} 个警告。错误必须修复后才能发布。`;
  } else if (warningCount > 0) {
    banner.classList.add("is-warning");
    title.textContent = "内容检查有警告";
    summary.textContent = `没有阻塞错误，但有 ${warningCount} 个警告。你可以检查后再决定是否发布。`;
  } else {
    banner.classList.add("is-valid");
    title.textContent = "内容检查通过";
    summary.textContent = "没有发现错误或警告，可以安全发布。";
  }

  renderListItems(errorList, report.errors, "没有错误。");
  renderListItems(warningList, report.warnings, "没有警告。");

  if (options.scrollIntoView) {
    banner.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

function runContentValidation() {
  const report = validateWorksData(getWorksForValidation());

  showValidationReport(report, {
    scrollIntoView: true
  });

  return report;
}

function closeValidationBanner() {
  const banner = $("#validationBanner");

  if (banner) {
    banner.hidden = true;
  }
}

function getJsonText() {
  const sorted = [...works].sort((a, b) => {
    return Number(a.order || 999) - Number(b.order || 999);
  });

  return JSON.stringify(sorted, null, 2);
}

function updateJsonPreview() {
  $("#jsonPreview").textContent = getJsonText();
  updateStats();
}

function updateStats() {
  $("#statTotal").textContent = works.length;
  $("#statPublished").textContent = works.filter((work) => work.status !== "draft").length;
  $("#statDraft").textContent = works.filter((work) => work.status === "draft").length;
  $("#statFeatured").textContent = works.filter((work) => work.featured).length;
}

function updateMediaPreview() {
  const box = $("#mediaPreview");
  const title = fields.titleZh.value || fields.titleEn.value || "Media Preview";
  const imgPath = fields.img.value.trim();
  const videoPath = fields.video.value.trim();
  const mediaType = fields.mediaType.value;

  if (mediaType === "video" && videoPath) {
    const videoUrl = resolveMediaUrl(videoPath);
    const posterUrl = resolveMediaUrl(imgPath);

    box.innerHTML = `
      <video controls muted playsinline poster="${escapeHTML(posterUrl)}">
        <source src="${escapeHTML(videoUrl)}" type="video/mp4">
      </video>
      <div class="preview-caption">${escapeHTML(title)} · Video Preview</div>
    `;
    return;
  }

  if (imgPath) {
    const imgUrl = resolveMediaUrl(imgPath);

    box.innerHTML = `
      <img src="${escapeHTML(imgUrl)}" alt="${escapeHTML(title)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
      <div class="preview-empty" style="display:none;">
        <span>Preview unavailable</span>
        <p>没有找到图片：${escapeHTML(imgPath)}</p>
      </div>
      <div class="preview-caption">${escapeHTML(title)} · ${escapeHTML(imgPath)}</div>
    `;
    return;
  }

  box.innerHTML = `
    <div class="preview-empty">
      <span>Media Preview</span>
      <p>输入封面路径后会在这里显示预览。</p>
    </div>
  `;
}

async function loadWorks() {
  try {
    const response = await fetch("../data/works.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Failed to load works.json: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("works.json must be an array");
    }

    works = data;
  } catch (error) {
    console.warn(error);
    works = [];
  }

  selectedId = null;
  renderWorkList();
  resetForm();
  updateJsonPreview();
}

function renderWorkList() {
  const list = $("#workList");
  updateStats();

  if (works.length === 0) {
    list.innerHTML = `
      <div class="work-item">
        <b>暂无作品</b>
        <span>点击「新增作品」开始创建。</span>
      </div>
    `;
    return;
  }

  const keyword = listFilters.search.value.trim().toLowerCase();
  const category = listFilters.category.value;
  const status = listFilters.status.value;

  const sorted = [...works].sort((a, b) => {
    return Number(a.order || 999) - Number(b.order || 999);
  });

  const filtered = sorted.filter((work) => {
    const titleZh = work.title?.zh || "";
    const titleEn = work.title?.en || "";
    const slug = work.slug || work.id || "";
    const tags = Array.isArray(work.tags) ? work.tags.join(" ") : "";

    const haystack = `${titleZh} ${titleEn} ${slug} ${tags}`.toLowerCase();

    const matchesKeyword = !keyword || haystack.includes(keyword);
    const matchesCategory = category === "all" || work.category === category;

    let matchesStatus = true;

    if (status === "published") {
      matchesStatus = work.status !== "draft";
    } else if (status === "draft") {
      matchesStatus = work.status === "draft";
    } else if (status === "featured") {
      matchesStatus = Boolean(work.featured);
    }

    return matchesKeyword && matchesCategory && matchesStatus;
  });

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="work-item">
        <b>没有匹配结果</b>
        <span>请调整搜索关键词或筛选条件。</span>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered.map((work) => {
    const title = work.title?.zh || work.title?.en || work.slug || work.id;
    const statusText = work.status || "draft";
    const categoryText = work.category || "unknown";
    const featuredText = work.featured ? " · featured" : "";

    return `
      <button class="work-item ${work.id === selectedId ? "active" : ""}" data-id="${escapeHTML(work.id)}">
        <b>${escapeHTML(title)}</b>
        <span>${escapeHTML(categoryText)} · ${escapeHTML(statusText)} · order ${escapeHTML(work.order ?? "-")}${featuredText}</span>
      </button>
    `;
  }).join("");

  list.querySelectorAll(".work-item[data-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectWork(button.dataset.id);
    });
  });
}

function resetForm() {
  selectedId = null;
  $("#editorTitle").textContent = "新增作品";
  $("#deleteBtn").style.display = "none";
  $("#workForm").reset();

  fields.workId.value = "";
  fields.category.value = "software";
  fields.mediaType.value = "image";
  fields.order.value = works.length + 1;
  fields.link.value = "#";
  fields.linkTextZh.value = "查看项目";
  fields.linkTextEn.value = "View Project";
  fields.published.checked = true;
  fields.featured.checked = false;

  updateMediaPreview();
  renderWorkList();
}

function selectWork(id) {
  const work = works.find((item) => item.id === id);
  if (!work) return;

  selectedId = id;
  $("#editorTitle").textContent = "编辑作品";
  $("#deleteBtn").style.display = "inline-flex";

  fields.workId.value = work.id || "";
  fields.slug.value = work.slug || work.id || "";
  fields.category.value = work.category || "software";
  fields.titleZh.value = work.title?.zh || "";
  fields.titleEn.value = work.title?.en || "";
  fields.descZh.value = work.desc?.zh || "";
  fields.descEn.value = work.desc?.en || "";
  fields.mediaType.value = work.mediaType || "image";
  fields.order.value = work.order ?? 1;
  fields.img.value = work.img || work.coverUrl || "";
  fields.video.value = work.video || work.videoUrl || "";
  fields.link.value = work.link || work.links?.demo || "#";
  fields.tags.value = Array.isArray(work.tags) ? work.tags.join(", ") : "";
  fields.linkTextZh.value = work.linkText?.zh || "查看项目";
  fields.linkTextEn.value = work.linkText?.en || "View Project";
  fields.featured.checked = Boolean(work.featured);
  fields.published.checked = work.status !== "draft";

  updateMediaPreview();
  renderWorkList();
}

function readForm() {
  const slug = createIdFromSlug(fields.slug.value);
  const existing = works.find((item) => item.id === selectedId);

  if (!slug) {
    throw new Error("Slug / ID 不能为空");
  }

  const tags = fields.tags.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const now = today();

  return {
    id: existing?.id || slug,
    slug,
    status: fields.published.checked ? "published" : "draft",
    featured: fields.featured.checked,
    order: Number(fields.order.value || 1),
    category: fields.category.value,
    mediaType: fields.mediaType.value,
    img: fields.img.value.trim(),
    video: fields.video.value.trim(),
    title: {
      zh: fields.titleZh.value.trim(),
      en: fields.titleEn.value.trim()
    },
    desc: {
      zh: fields.descZh.value.trim(),
      en: fields.descEn.value.trim()
    },
    link: fields.link.value.trim() || "#",
    linkText: {
      zh: fields.linkTextZh.value.trim() || "查看项目",
      en: fields.linkTextEn.value.trim() || "View Project"
    },
    tags,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function saveWork(event) {
  event.preventDefault();

  try {
    const work = readForm();
    const index = works.findIndex((item) => item.id === selectedId);

    if (index >= 0) {
      works[index] = work;
    } else {
      const duplicated = works.some((item) => item.id === work.id);

      if (duplicated) {
        alert("这个 Slug / ID 已经存在，请换一个。");
        return;
      }

      works.push(work);
    }

    selectedId = work.id;
    renderWorkList();
    selectWork(work.id);
    updateJsonPreview();

    alert("已保存到本地列表。记得导出 works.json 并替换 data/works.json。");
  } catch (error) {
    alert(error.message);
  }
}

function deleteSelectedWork() {
  if (!selectedId) return;

  const work = works.find((item) => item.id === selectedId);
  const title = work?.title?.zh || work?.title?.en || selectedId;

  const confirmed = confirm(`确定删除「${title}」吗？`);
  if (!confirmed) return;

  works = works.filter((item) => item.id !== selectedId);
  selectedId = null;

  resetForm();
  renderWorkList();
  updateJsonPreview();
}

function downloadJson() {
  const blob = new Blob([getJsonText()], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "works.json";
  link.click();

  URL.revokeObjectURL(url);
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(getJsonText());
    alert("JSON 已复制。");
  } catch {
    alert("复制失败，请手动复制 JSON 预览内容。");
  }
}

async function uploadCoverImage() {
  const adminKey = getCurrentAdminKey();

  if (!adminKey) {
    alert("请输入 Admin Key。");
    return;
  }

  const fileInput = $("#coverFileInput");
  const file = fileInput.files?.[0];

  if (!file) {
    alert("请先选择一张封面图片。");
    return;
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  if (!allowedTypes.includes(file.type)) {
    alert("只支持 JPG、PNG、WEBP、GIF 图片。");
    return;
  }

  const maxBytes = 4 * 1024 * 1024;

  if (file.size > maxBytes) {
    alert("图片太大，请控制在 4MB 以内。");
    return;
  }

  const uploadBtn = $("#uploadCoverBtn");
  const originalText = uploadBtn.textContent;

  uploadBtn.disabled = true;
  uploadBtn.textContent = "上传中...";

  try {
    const contentBase64 = await fileToBase64(file);
    const slug = getUploadSlug();

    const response = await fetch(`${CMS_API_BASE}/api/upload-media`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey
      },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        contentBase64,
        slug
      })
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "上传失败");
    }

    fields.img.value = result.path;
    fields.mediaType.value = "image";
    updateMediaPreview();

    alert(
      `封面上传成功！\n\nPath: ${result.path}\nCommit: ${
        result.commitSha ? result.commitSha.slice(0, 7) : "unknown"
      }\n\n请点击「保存到本地列表」，然后再点击「发布到 GitHub」保存作品数据。`
    );
  } catch (error) {
    console.error(error);
    alert(`封面上传失败：${error.message}`);
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = originalText;
  }
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function renderMediaLibrary(items = mediaLibraryItems) {
  const grid = $("#mediaLibraryGrid");
  const status = $("#mediaLibraryStatus");

  if (!grid || !status) return;

  if (!items.length) {
    status.textContent = "媒体库为空。上传封面后，图片会出现在这里。";
    grid.innerHTML = "";
    return;
  }

  status.textContent = `已读取 ${items.length} 张图片。点击「设为封面」即可填入当前作品。`;

  grid.innerHTML = items.map((item) => `
    <article class="media-item">
      <div class="media-item-preview">
        <img src="${escapeHTML(item.downloadUrl || "")}" alt="${escapeHTML(item.name)}" loading="lazy" />
      </div>

      <div class="media-item-body">
        <span class="media-item-name">${escapeHTML(item.name)}</span>
        <span class="media-item-path">${escapeHTML(item.path)} · ${escapeHTML(formatFileSize(item.size))}</span>

        <div class="media-item-actions">
          <button class="btn small ghost" type="button" data-media-path="${escapeHTML(item.path)}">
            设为封面
          </button>
        </div>
      </div>
    </article>
  `).join("");

  grid.querySelectorAll("[data-media-path]").forEach((button) => {
    button.addEventListener("click", () => {
      const path = button.dataset.mediaPath;

      fields.img.value = path;
      fields.mediaType.value = "image";
      updateMediaPreview();
      activatePanel("worksPanel");

      alert(`已设置当前封面：\n${path}\n\n记得点击「保存到本地列表」，然后再「发布到 GitHub」。`);
    });
  });
}

async function loadMediaLibrary() {
  const adminKey = getCurrentAdminKey();

  if (!adminKey) {
    alert("请输入 Admin Key。");
    return;
  }

  const refreshBtn = $("#refreshMediaBtn");
  const status = $("#mediaLibraryStatus");
  const originalText = refreshBtn.textContent;

  refreshBtn.disabled = true;
  refreshBtn.textContent = "读取中...";

  if (status) {
    status.textContent = "正在从 GitHub 读取 images/works/ ...";
  }

  try {
    const response = await fetch(`${CMS_API_BASE}/api/list-media`, {
      method: "GET",
      headers: {
        "x-admin-key": adminKey
      }
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "读取媒体库失败");
    }

    mediaLibraryItems = Array.isArray(result.items) ? result.items : [];
    renderMediaLibrary(mediaLibraryItems);
  } catch (error) {
    console.error(error);

    if (status) {
      status.textContent = `媒体库读取失败：${error.message}`;
    }

    alert(`媒体库读取失败：${error.message}`);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = originalText;
  }
}

function openMediaLibrary() {
  activatePanel("mediaPanel");

  if (!mediaLibraryItems.length) {
    loadMediaLibrary();
  }
}

function formatBackupName(name) {
  return String(name || "")
    .replace(/^works-/, "")
    .replace(/\.json$/i, "")
    .replace("T", " ")
    .replace("Z", " UTC");
}

function getBackupTypeInfo(path) {
  if (String(path || "").includes("/works-before-restore-")) {
    return {
      key: "before-restore",
      label: "回滚前安全备份",
      description: "这是执行回滚之前保存的当前版本。通常用于撤销一次错误回滚。"
    };
  }

  return {
    key: "before-publish",
    label: "发布前备份",
    description: "这是发布 works.json 之前保存的旧版本。通常是最常用的回滚目标。"
  };
}

function closeBackupPreview() {
  const panel = $("#backupPreview");

  if (panel) {
    panel.hidden = true;
  }
}

function renderBackupPreview(result) {
  const panel = $("#backupPreview");
  const title = $("#backupPreviewTitle");
  const meta = $("#backupPreviewMeta");
  const note = $("#backupPreviewNote");
  const list = $("#backupPreviewList");

  if (!panel || !title || !meta || !note || !list) return;

  const summary = result.summary || {};
  const type = result.backupType || getBackupTypeInfo(result.path);

  panel.hidden = false;

  title.textContent = result.name || "备份摘要";
  meta.textContent = `${result.path} · ${formatFileSize(result.size)} · ${type.label}`;
  note.textContent = type.description || "";

  $("#backupSummaryTotal").textContent = summary.total ?? 0;
  $("#backupSummaryPublished").textContent = summary.published ?? 0;
  $("#backupSummaryDraft").textContent = summary.draft ?? 0;
  $("#backupSummaryFeatured").textContent = summary.featured ?? 0;

  const previewItems = Array.isArray(summary.previewItems) ? summary.previewItems : [];

  if (!previewItems.length) {
    list.innerHTML = `
      <div class="backup-preview-work">
        <strong>这个备份里没有作品。</strong>
        <span>works.json 为空数组。</span>
      </div>
    `;
  } else {
    list.innerHTML = previewItems.map((work) => `
      <div class="backup-preview-work">
        <strong>#${escapeHTML(work.index)} · ${escapeHTML(work.title)}</strong>
        <span>
          ${escapeHTML(work.category || "unknown")}
          · ${escapeHTML(work.status || "published")}
          · ${work.featured ? "Featured" : "Not Featured"}
          · ${escapeHTML(work.slug || work.id || "")}
        </span>
      </div>
    `).join("");
  }

  panel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function previewBackup(backupPath) {
  const adminKey = getCurrentAdminKey();

  if (!adminKey) {
    alert("请输入 Admin Key。");
    return;
  }

  if (!backupPath) {
    alert("备份路径无效。");
    return;
  }

  try {
    const response = await fetch(`${CMS_API_BASE}/api/get-backup?path=${encodeURIComponent(backupPath)}`, {
      method: "GET",
      headers: {
        "x-admin-key": adminKey
      }
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "读取备份摘要失败");
    }

    renderBackupPreview(result);
  } catch (error) {
    console.error(error);
    alert(`读取备份摘要失败：${error.message}`);
  }
}

function renderBackupList(items = backupItems) {
  const list = $("#backupList");
  const status = $("#backupLibraryStatus");

  if (!list || !status) return;

  if (!items.length) {
    status.textContent = "暂时没有备份。下一次发布 works.json 前，系统会自动创建备份。";
    list.innerHTML = "";
    return;
  }

  status.textContent = `已读取 ${items.length} 个备份。建议先预览摘要，再选择是否回滚。`;

  list.innerHTML = items.map((item) => {
    const type = getBackupTypeInfo(item.path);

    return `
      <article class="backup-item">
        <div>
          <span class="backup-type ${escapeHTML(type.key)}">${escapeHTML(type.label)}</span>
          <strong>${escapeHTML(formatBackupName(item.name))}</strong>
          <span>${escapeHTML(item.path)} · ${escapeHTML(formatFileSize(item.size))}</span>
          <span>${escapeHTML(type.description)}</span>
        </div>

        <div class="backup-actions">
          <button
            class="btn small ghost"
            type="button"
            data-preview-backup-path="${escapeHTML(item.path)}"
          >
            预览摘要
          </button>

          <a class="btn small ghost" href="${escapeHTML(item.downloadUrl || "#")}" target="_blank" rel="noopener noreferrer">
            查看 JSON
          </a>

          <a class="btn small ghost" href="${escapeHTML(item.htmlUrl || "#")}" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>

          <button
            class="btn small danger"
            type="button"
            data-restore-backup-path="${escapeHTML(item.path)}"
          >
            回滚到此版本
          </button>
        </div>
      </article>
    `;
  }).join("");

  list.querySelectorAll("[data-preview-backup-path]").forEach((button) => {
    button.addEventListener("click", () => {
      previewBackup(button.dataset.previewBackupPath);
    });
  });

  list.querySelectorAll("[data-restore-backup-path]").forEach((button) => {
    button.addEventListener("click", () => {
      restoreBackup(button.dataset.restoreBackupPath);
    });
  });
}

async function loadBackups() {
  const adminKey = getCurrentAdminKey();

  if (!adminKey) {
    alert("请输入 Admin Key。");
    return;
  }

  const refreshBtn = $("#refreshBackupsBtn");
  const status = $("#backupLibraryStatus");
  const originalText = refreshBtn.textContent;

  refreshBtn.disabled = true;
  refreshBtn.textContent = "读取中...";

  if (status) {
    status.textContent = "正在从 GitHub 读取 data/backups/ ...";
  }

  try {
    const response = await fetch(`${CMS_API_BASE}/api/list-backups`, {
      method: "GET",
      headers: {
        "x-admin-key": adminKey
      }
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "读取备份失败");
    }

    backupItems = Array.isArray(result.items) ? result.items : [];
    renderBackupList(backupItems);
  } catch (error) {
    console.error(error);

    if (status) {
      status.textContent = `备份读取失败：${error.message}`;
    }

    alert(`备份读取失败：${error.message}`);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = originalText;
  }
}

async function restoreBackup(backupPath) {
  const adminKey = getCurrentAdminKey();

  if (!adminKey) {
    alert("请输入 Admin Key.");
    return;
  }

  if (!backupPath) {
    alert("备份路径无效。");
    return;
  }

  const backupType = getBackupTypeInfo(backupPath);

const firstConfirm = confirm(
  `确定要回滚到这个备份吗？\n\n${backupPath}\n\n类型：${backupType.label}\n${backupType.description}\n\n这会覆盖当前 data/works.json。系统会先自动备份当前版本。`
);

  if (!firstConfirm) return;

  const secondConfirm = confirm(
    "二次确认：回滚会改变线上作品数据。\n\n确认继续吗？"
  );

  if (!secondConfirm) return;

  const button = document.querySelector(`[data-restore-backup-path="${CSS.escape(backupPath)}"]`);
  const originalText = button ? button.textContent : "";

  if (button) {
    button.disabled = true;
    button.textContent = "回滚中...";
  }

  try {
    const response = await fetch(`${CMS_API_BASE}/api/restore-backup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey
      },
      body: JSON.stringify({
        backupPath
      })
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "回滚失败");
    }

    alert(
      `回滚成功！\n\nRestored from: ${result.backupPath}\nSafety backup: ${
        result.safetyBackupPath || "unknown"
      }\nRestored works: ${result.restoredCount}\nCommit: ${
        result.commitSha ? result.commitSha.slice(0, 7) : "unknown"
      }\n\n请等待 Vercel 自动部署完成，然后刷新前台页面。`
    );

    await loadWorks();
    await loadBackups();
  } catch (error) {
    console.error(error);
    alert(`回滚失败：${error.message}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

async function publishToGitHub() {
  const adminKey = $("#adminKeyInput").value.trim();

  if (!adminKey) {
    alert("请输入 Admin Key。");
    return;
  }

  if (!Array.isArray(works)) {
    alert("当前 works 数据异常，无法发布。");
    return;
  }

  const validationReport = validateWorksData(getWorksForValidation());

showValidationReport(validationReport, {
  scrollIntoView: true
});

if (validationReport.errors.length > 0) {
  alert("发布已阻止：当前内容存在错误。请先修复错误后再发布。");
  return;
}

if (validationReport.warnings.length > 0) {
  const continuePublish = confirm(
    `当前内容有 ${validationReport.warnings.length} 个警告。\n\n这些警告不会阻止发布，但建议你先检查。\n\n是否仍然继续发布？`
  );

  if (!continuePublish) return;
}

  const confirmed = confirm(
    "确定发布到 GitHub 吗？\n\n当前 CMS 中的 works 列表会写入 GitHub 仓库的 data/works.json。"
  );

  if (!confirmed) return;

  const publishBtn = $("#publishBtn");
  const originalText = publishBtn.textContent;

  publishBtn.disabled = true;
  publishBtn.textContent = "发布中...";

  try {
    const response = await fetch(`${CMS_API_BASE}/api/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey
      },
      body: JSON.stringify({
        works,
        message: `cms: update works ${new Date().toISOString()}`
      })
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "发布失败");
    }

    alert(
      `发布成功！\n\nBranch: ${result.branch}\nFile: ${result.filePath}\nBackup: ${
        result.backupPath || "not created"
      }\nCommit: ${
        result.commitSha ? result.commitSha.slice(0, 7) : "unknown"
      }`
    );
  } catch (error) {
    console.error(error);
    alert(`发布失败：${error.message}`);
  } finally {
    publishBtn.disabled = false;
    publishBtn.textContent = originalText;
  }
}

async function importJsonFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!Array.isArray(data)) {
      throw new Error("导入失败：JSON 根结构必须是数组。");
    }

    const seen = new Set();

    works = data.map((work, index) => {
      const baseId = createIdFromSlug(work.id || work.slug || `work-${index + 1}`) || `work-${index + 1}`;
      let id = baseId;
      let count = 2;

      while (seen.has(id)) {
        id = `${baseId}-${count}`;
        count += 1;
      }

      seen.add(id);

      return {
        ...work,
        id,
        slug: work.slug || id,
        order: Number(work.order || index + 1),
        status: work.status || "published",
        featured: Boolean(work.featured)
      };
    });

    selectedId = null;
    resetForm();
    renderWorkList();
    updateJsonPreview();

    alert(`导入成功，共 ${works.length} 条作品。`);
  } catch (error) {
    alert(error.message || "导入失败，请检查 JSON 格式。");
  } finally {
    event.target.value = "";
  }
}

function activatePanel(panelId) {
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });

  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.panel === panelId);
  });
}

function bindPanels() {
  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => {
      activatePanel(button.dataset.panel);
    });
  });
}

function bindEvents() {
  $("#workForm").addEventListener("submit", saveWork);
  $("#newWorkBtn").addEventListener("click", resetForm);
  $("#resetBtn").addEventListener("click", resetForm);
  $("#deleteBtn").addEventListener("click", deleteSelectedWork);
  $("#reloadBtn").addEventListener("click", loadWorks);
  $("#exportBtn").addEventListener("click", downloadJson);
  $("#downloadJsonBtn").addEventListener("click", downloadJson);
  $("#copyJsonBtn").addEventListener("click", copyJson);
  $("#importJsonInput").addEventListener("change", importJsonFile);
  $("#saveAdminKeyBtn").addEventListener("click", saveAdminKey);
  $("#publishBtn").addEventListener("click", publishToGitHub);
  $("#uploadCoverBtn").addEventListener("click", uploadCoverImage);
  $("#openMediaLibraryBtn").addEventListener("click", openMediaLibrary);
  $("#refreshMediaBtn").addEventListener("click", loadMediaLibrary);
  $("#refreshBackupsBtn").addEventListener("click", loadBackups);
  $("#closeBackupPreviewBtn").addEventListener("click", closeBackupPreview);
  $("#validateBtn").addEventListener("click", runContentValidation);
  $("#closeValidationBtn").addEventListener("click", closeValidationBanner);

  listFilters.search.addEventListener("input", renderWorkList);
  listFilters.category.addEventListener("change", renderWorkList);
  listFilters.status.addEventListener("change", renderWorkList);

  [
    fields.img,
    fields.video,
    fields.mediaType,
    fields.titleZh,
    fields.titleEn
  ].forEach((field) => {
    field.addEventListener("input", updateMediaPreview);
    field.addEventListener("change", updateMediaPreview);
  });
}

bindPanels();
bindEvents();
loadSavedAdminKey();
loadWorks();