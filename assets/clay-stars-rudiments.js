/* Clay art direction stays here; all translated positions come from DanceRudiments. */
(function (window, document) {
  'use strict';
  const root = document.querySelector('.ks-epk.ks-clay-stars-v2');
  const clay = window.DanceMovesClayStars;
  const rudiments = window.DanceMovesRudiments;
  if (!root || !clay || clay.root !== root || !rudiments || window.DanceMovesClayRudiment) return;
  const atmosphere = root.querySelector('.epk-atmosphere');
  // Preserve the original CSS when required pseudo-element capabilities are absent.
  if (!atmosphere || typeof atmosphere.getAnimations !== 'function' ||
      !window.CSS || !window.CSS.supports('translate', '1px 1px')) return;
  const audio = root.querySelector('audio');
  let controller = null, accents = null, destroyed = false, loaded = false, error = null;
  let status = 'loading';
  const id = 'clay-stars:background-rudiment';
  const marker = 'data-dance-moves-rudiment-clay';
  function allowed() {
    const state = clay.snapshot();
    return !state.destroyed && state.settings.enabled && state.performance.profile === 'full';
  }
  function draw(detail) {
    if (!loaded || detail.pip === null || !allowed() || root.getAttribute(marker) !== 'active') return;
    // The original rotation/scale/opacity choreography is paused and scrubbed
    // with the SAME phase as the native position, not a second animation clock.
    if (!accents || accents.playState === 'idle') {
      accents = atmosphere.getAnimations({ subtree: true }).find(animation =>
        animation.animationName === 'ks-clay-rudiment-treatment') || null;
    }
    if (accents) {
      // CSS animation-play-state is paused. Core cue resets therefore do not
      // independently advance this art-direction animation.
      accents.currentTime = detail.loopProgress * detail.durationMilliseconds;
    }
  }
  function reconcile() {
    if (destroyed) return;
    if (root.isConnected === false || clay.snapshot().destroyed) return teardown();
    if (!loaded) return;
    accents = null;
    status = allowed() ? 'active' : 'suspended';
    root.setAttribute(marker, status);
    controller.setEnabled(status === 'active');
    controller.refresh();
  }
  function fallback(failure) {
    if (destroyed) return;
    error = String(failure && failure.message || failure);
    status = 'fallback'; loaded = false; accents = null;
    root.setAttribute(marker, 'fallback'); // no overriding CSS selector: legacy animation survives
    if (controller) controller.destroy();
  }
  function onError(event) {
    if (event.detail && event.detail.id === id) fallback(event.detail.message);
  }
  const observer = window.MutationObserver ? new window.MutationObserver(reconcile) : null;
  if (observer) {
    observer.observe(root, { attributes: true, attributeFilter: ['data-dance-moves-performance', 'data-dance-moves-clay-runtime', 'style'] });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  document.addEventListener('dance-moves-rudiments-error', onError);
  function teardown() {
    if (destroyed) return;
    destroyed = true; status = 'destroyed'; accents = null;
    if (observer) observer.disconnect();
    document.removeEventListener('dance-moves-rudiments-error', onError);
    if (controller) controller.destroy();
    root.removeAttribute(marker);
  }
  window.DanceMovesClayRudiment = Object.freeze({
    root, teardown,
    snapshot: () => ({ status, error, destroyed, loaded, rudiment: 'clay_background',
      cycleBeats: 8, rate: 0.5, controller: controller ? controller.snapshot() : null })
  });
  try {
    controller = rudiments.animate({
      id, root, target: atmosphere, rudiment: 'clay_background',
      clock: audio ? 'auto' : 'page', audio,
      rate: 0.5, amplitude: { x: 14, y: 10, z: 0 },
      cssPrefix: '--ks-clay-rudiment', renderEveryFrame: true, resetOnCue: true,
      render: draw
    });
    controller.ready.then(() => {
      if (destroyed || controller.snapshot().destroyed) return;
      loaded = true; reconcile();
    }).catch(fallback);
  } catch (failure) { fallback(failure); }
}(window, document));
