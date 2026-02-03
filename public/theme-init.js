(() => {
  const t = localStorage.getItem("writr-theme");
  if (
    t === "dark" ||
    (!t && matchMedia("(prefers-color-scheme:dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  }
})();
