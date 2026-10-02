(() => {
  const storageKey = "silnest-site-language";
  const html = document.documentElement;
  const buttons = [...document.querySelectorAll("[data-language]")];
  const navToggle = document.querySelector("[data-nav-toggle]");

  function applyLanguage(language) {
    const resolved = language === "en" ? "en" : "zh";
    html.dataset.siteLang = resolved;
    html.lang = resolved === "zh" ? "zh-CN" : "en";

    buttons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.language === resolved)
      );
    });

    try {
      localStorage.setItem(storageKey, resolved);
    } catch {}
  }

  let initialLanguage = "zh";
  try {
    const storedLanguage = localStorage.getItem(storageKey);
    if (storedLanguage === "zh" || storedLanguage === "en") {
      initialLanguage = storedLanguage;
    } else if (!navigator.language.toLowerCase().startsWith("zh")) {
      initialLanguage = "en";
    }
  } catch {}

  applyLanguage(initialLanguage);

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      applyLanguage(button.dataset.language);
    });
  });

  if (navToggle) {
    navToggle.addEventListener("click", () => {
      const open = document.body.classList.toggle("nav-open");
      navToggle.setAttribute("aria-expanded", String(open));
    });
  }



  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (!Number.isFinite(value) || value <= 0) return "";
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  async function loadAndroidRelease() {
    const status = document.querySelector("#androidReleaseStatus");
    const meta = document.querySelector("#androidReleaseMeta");
    const placeholder = document.querySelector("#androidDownloadPlaceholder");
    const button = document.querySelector("#androidDownloadButton");
    const descZh = document.querySelector("#androidReleaseDescriptionZh");
    const descEn = document.querySelector("#androidReleaseDescriptionEn");

    if (!status || !button || !placeholder) return;

    try {
      const response = await fetch("/data/apps/silnest.json", {
        cache: "no-store"
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const android = data?.android || {};

      if (!android.available || !android.url) {
        return;
      }

      status.innerHTML = `
        <span class="lang-zh">已开放</span>
        <span class="lang-en">Available</span>
      `;

      if (descZh) {
        descZh.textContent =
          "Android APK 已开放直接下载。安装前请确认版本与文件来源。";
      }

      if (descEn) {
        descEn.textContent =
          "The Android APK is available for direct download. Verify the version and source before installation.";
      }

      if (meta) {
        const parts = [];
        if (android.version) parts.push(`v${android.version}`);
        const size = formatBytes(android.size);
        if (size) parts.push(size);
        if (android.publishedAt) parts.push(android.publishedAt);
        meta.textContent = parts.join(" · ");
        meta.hidden = parts.length === 0;
      }

      placeholder.hidden = true;
      button.hidden = false;
      button.href = android.url;
    } catch (error) {
      console.warn("Unable to load Android release metadata:", error);
    }
  }

  loadAndroidRelease();

  document.querySelectorAll(".main-nav a").forEach((link) => {
    link.addEventListener("click", () => {
      document.body.classList.remove("nav-open");
      navToggle?.setAttribute("aria-expanded", "false");
    });
  });
})();