(() => {
  "use strict";

  class SimulatedDeviceOrientationEvent extends Event {
    constructor(type, init = {}) {
      super(type, { bubbles: false, cancelable: false, composed: false });
      Object.defineProperties(this, {
        alpha: { enumerable: true, value: init.alpha ?? null },
        beta: { enumerable: true, value: init.beta ?? null },
        gamma: { enumerable: true, value: init.gamma ?? null },
        absolute: { enumerable: true, value: Boolean(init.absolute) },
      });
    }
  }

  window.KSSimulatedDeviceOrientationEvent = SimulatedDeviceOrientationEvent;
})();
