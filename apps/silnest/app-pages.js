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

  document.querySelectorAll(".main-nav a").forEach((link) => {
    link.addEventListener("click", () => {
      document.body.classList.remove("nav-open");
      navToggle?.setAttribute("aria-expanded", "false");
    });
  });
})();
