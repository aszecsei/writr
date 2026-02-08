(() => {
  const t = localStorage.getItem("writr-theme");
  if (
    t === "dark" ||
    (!t && matchMedia("(prefers-color-scheme:dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  }

  // Restore cached primary color variables
  try {
    const pv = localStorage.getItem("writr-primary-vars");
    if (pv) {
      const vars = JSON.parse(pv);
      const s = document.documentElement.style;
      for (const k in vars) s.setProperty(k, vars[k]);
    }
  } catch {}

  // Restore cached neutral color variables
  try {
    const nv = localStorage.getItem("writr-neutral-vars");
    if (nv) {
      const vars = JSON.parse(nv);
      const s = document.documentElement.style;
      for (const k in vars) s.setProperty(k, vars[k]);
    }
  } catch {}

  // Restore editor width
  const ew = localStorage.getItem("writr-editor-width");
  if (ew) {
    const map = {
      narrow: "720px",
      medium: "900px",
      wide: "1200px",
    };
    const css = map[ew];
    if (css)
      document.documentElement.style.setProperty("--editor-content-width", css);
  }

  // Restore UI density
  const d = localStorage.getItem("writr-density");
  if (d === "compact" || d === "comfortable") {
    document.documentElement.setAttribute("data-density", d);
  }
})();
