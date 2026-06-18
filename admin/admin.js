let works = [];
let selectedId = null;

const $ = (selector) => document.querySelector(selector);

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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function createIdFromSlug(slug) {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getJsonText() {
  const sorted = [...works].sort((a, b) => {
    return Number(a.order || 999) - Number(b.order || 999);
  });

  return JSON.stringify(sorted, null, 2);
}

function updateJsonPreview() {
  $("#jsonPreview").textContent = getJsonText();
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

  if (works.length === 0) {
    list.innerHTML = `
      <div class="work-item">
        <b>暂无作品</b>
        <span>点击「新增作品」开始创建。</span>
      </div>
    `;
    return;
  }

  const sorted = [...works].sort((a, b) => {
    return Number(a.order || 999) - Number(b.order || 999);
  });

  list.innerHTML = sorted.map((work) => {
    const title = work.title?.zh || work.title?.en || work.slug || work.id;
    const status = work.status || "draft";
    const category = work.category || "unknown";

    return `
      <button class="work-item ${work.id === selectedId ? "active" : ""}" data-id="${work.id}">
        <b>${title}</b>
        <span>${category} · ${status} · order ${work.order ?? "-"}</span>
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
}

bindPanels();
bindEvents();
loadWorks();