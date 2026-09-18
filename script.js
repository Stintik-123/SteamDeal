(function () {
  const reveals = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("visible"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  reveals.forEach((el) => io.observe(el));

  // soft count-up for first stat if present
  const counter = document.querySelector("[data-count]");
  if (counter) {
    const target = parseInt(counter.getAttribute("data-count"), 10) || 0;
    let started = false;
    const cio = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting || started) return;
      started = true;
      const start = performance.now();
      const dur = 900;
      function tick(t) {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        counter.textContent = Math.round(target * eased);
        if (p < 1) requestAnimationFrame(tick);
        else counter.textContent = target + "+";
      }
      requestAnimationFrame(tick);
      cio.disconnect();
    });
    cio.observe(counter);
  }
})();
