// Pause GPU work when the canvas leaves the screen or the browser is hidden.
export function startVisibleRenderLoop(element, render) {
  let frame = 0;
  let visible = false;
  let stopped = false;
  const tick = () => {
    frame = 0;
    if (stopped || !visible || document.hidden) return;
    render();
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (!stopped && visible && !document.hidden) tick();
  };
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
  observer.observe(element);
  document.addEventListener('visibilitychange', sync);
  return () => { stopped = true; cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', sync); };
}
