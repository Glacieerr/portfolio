let works = [];
let selectedId = null;

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
      `发布成功！\n\nBranch: ${result.branch}\nFile: ${result.filePath}\nCommit: ${
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

function bindPanels() {
  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));

      button.classList.add("active");
      $(`#${button.dataset.panel}`).classList.add("active");

      updateJsonPreview();
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