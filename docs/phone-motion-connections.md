# Connect existing spatial effects to phone input

`runtime.connectPhoneMotion()` composes the shared permission-aware orientation controller with existing pointer handles and a narrow appearance callback. It does not select choreography or add artwork. Call it after the mount's `ready` promise so the page's pointer handles exist. Use one connection per page, listing all suitable spatial consumers.

```js
await runtime.ready;
const connection = runtime.connectPhoneMotion({
  pointers: ['release:hero-depth', 'release:artwork-depth'],
  enabled: () => root.dataset.motion !== 'off' && root.dataset.quality !== 'static',
  watchAttributes: ['class', 'data-motion', 'data-quality'],
  render: ({x, y}) => {
    root.style.setProperty('--release-light-x', String(x));
    root.style.setProperty('--release-light-y', String(y));
  }
});
```

Pointer IDs are resolved for every sample, so a motion switch can replace a pointer without leaving a stale sensor attachment. The render callback may map the same normalized coordinates to other release-owned CSS properties. Keep targets bounded and callbacks nonthrowing. The connection clamps both axes to [-1, 1] and sends zero/reset when suspended. Leave ordinary interactive button hover/focus and scroll controls independent.

Options: `pointers` (string array), `render` (callback), `enabled` (predicate), `watchAttributes` (attributes on the mount root that require reconciliation), `controlParent` (default document body) and `windowMilliseconds` (default 10000). Attribute observation deliberately excludes style writes by default. Call `reconcile()` after an application-owned state change that is not represented by the watched attributes.

On supported secure mobile/touch devices, browsers requiring permission receive a single **Use phone motion** button. Only its click or an explicit gesture calling `enable()` requests permission. Browsers without that method listen directly unless the visitor previously disabled input. A stored enabled choice restores listening without requesting permission. Finite delivered samples establish `sensorActive` and remove the button. With no readings, the 3.5-second check retains **Use phone motion** for permission browsers or shows **Phone motion unavailable** for a direct-listener browser. Permission denial displays **Phone motion blocked**. These states do not certify hardware or browser permission.

If the mount already owns a legacy orientation provider, the connection subscribes to that provider instead of starting a second sensor listener or permission control. That provider retains its existing calibration/window and appearance. Its `subscribe(callback)` returns an unsubscribe function and forwards committed normalized samples plus reset/teardown. `suspend(boolean)` temporarily stops input and controls without changing the visitor's stored choice. No release selectors or identifiers are added to the shared connection.

Reduced motion, forced colours, page hiding, pagehide/pageshow, screen rotation, explicit application enable predicates and mount teardown remain authoritative. Generic orientation controllers also expose `setActive(boolean)` for temporary suspension; `disable()` is a persistent opt-out. The connection returns `enable()`, `reconcile()`, `snapshot()` and `destroy()`. Destroying it removes its control/listeners/observer and resets its consumers; an existing shared provider remains owned by the runtime.

Desktop or unsupported connections create no sensor listener, UI or appearance writes. Existing desktop pointer controllers remain independent. The connection does not create a new quality monitor; use the page's existing quality predicate. Tests must verify all mapped consumers, permission/no-data paths, preference changes and lifecycle cancellation. Physical iPhone/Safari delivery and full-stack frame-rate acceptance require physical evidence, separately from synthetic browser tests.
