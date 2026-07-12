// Homepage premium — scroll reveals + section polish
(function () {
  let observer = null;

  function createObserver() {
    return new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('lux-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
  }

  function observeLuxReveal(root) {
    const scope = root || document;
    if (!observer) observer = createObserver();
    scope.querySelectorAll('.lux-reveal:not(.lux-visible)').forEach(el => observer.observe(el));
  }

  window.montanaInitLuxReveal = observeLuxReveal;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    document.querySelectorAll('.lux-reveal').forEach(el => el.classList.add('lux-visible'));
    return;
  }

  observeLuxReveal();
})();
