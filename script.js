(function () {
  const buttons = document.querySelectorAll(".nav-btn");
  const panels = document.querySelectorAll(".panel");
  const chips = document.querySelectorAll("[data-goto]");

  function show(id) {
    panels.forEach((p) => p.classList.toggle("active", p.id === "panel-" + id));
    buttons.forEach((b) => b.classList.toggle("active", b.dataset.panel === id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => show(btn.dataset.panel));
  });

  chips.forEach((chip) => {
    chip.addEventListener("click", () => show(chip.dataset.goto));
  });
})();
