# Butterchurn feedback

An existing DanceMoves playback owner can drive the opt-in Butterchurn 2.6.7 renderer. The browser and WordPress distributions ship its pinned engine as a lazy asset. The browser requests that asset when a page creates a view. For npm consumers the pinned dependency is loaded by a dynamic import.

Create a view on a canvas inside the current DanceMoves root. WordPress single-song pages expose that runtime as `window.DanceMoves` once `dance-moves-ready` fires. Use the native playback source in the current mount.

```js
const view = await runtime.butterchurn.create({
  id: 'feedback-example',
  target: canvas,
  maxDimension: 720,
  preset: {
    baseVals: { decay: .98, gammaadj: 1, rot: .024, wave_a: 0 },
    init_eqs: state => state,
    frame_eqs: state => state,
    pixel_eqs: state => state,
    shapes: [],
    waves: [],
    warp: '',
    comp: '',
  },
});

// In the existing playback render callback.
view.render({ time: state.time, source: transparentCanvas, opacity: .4 });
```

Use an origin-clean image or canvas with alpha for the optional input. Pixels enter the retained framebuffer before Butterchurn warps it. After input stops, a preset can continue warping and decaying the previous pixels. A canvas sized to the backing buffer reduces upload cost.

Pass current media seconds on each animation frame while playback advances. The view starts no playback, audio graph or frame loop. A render call returns false under reduced motion, forced colours, document hiding, context loss or teardown. Call `reset()` when seeking or switching sources, and `resize(width, height)` after layout changes. Resizing is bounded by `maxDimension` and clears history. The owning runtime releases its views on teardown. `snapshot()` exposes the state, size, source seconds and rendered frame count.

`npm run test:butterchurn:browser` exercises pixel orientation, retained input, seek reset, preferences, explicit cleanup and lazy engine loading. Add `-- --wordpress` to exercise the WordPress bundle. The test can capture the actual rendered fixture via `DANCEMOVES_BUTTERCHURN_EVIDENCE`.

![Actual feedback from the controlled browser fixture](https://raw.githubusercontent.com/kieransimkin/DanceMoves/v3.7.0/docs/media/butterchurn-feedback.png)
