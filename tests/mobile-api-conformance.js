(() => {
  "use strict";

  const Core = window.KSEpkOrientationCore;
  const SimulatedEvent = window.KSSimulatedDeviceOrientationEvent;
  const Policy = window.KSMotionCapturePolicy;
  const NativeEvent = window.DeviceOrientationEvent;
  const targetDuration = Policy.CAPTURE_DURATION_MS;
  const storageInterval = Policy.STORAGE_INTERVAL_MS;
  const nativeMapper = Core.createRollingMapper(2000, 1.5);
  const simulatedMapper = Core.createRollingMapper(2000, 1.5);
  const failures = [];
  let sampler = Policy.createSampler();
  let pairs = 0;
  let failureCount = 0;
  let startedAt = 0;
  let timeout = 0;
  let lastComparison = null;
  let completedPayload = null;

  const $ = id => document.getElementById(id);
  const setResult = (id, text, kind = "") => {
    const node = $(id);
    node.textContent = text;
    node.className = kind;
  };
  const closeEnough = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance;
  const sameNullableNumber = (a, b) => (a === null && b === null) || (Number.isFinite(a) && Number.isFinite(b) && closeEnough(a, b));

  setResult("secure-result", window.isSecureContext ? "Pass" : "Fail — HTTPS required", window.isSecureContext ? "pass" : "fail");
  setResult("api-result", typeof NativeEvent === "function" ? "Detected" : "Unavailable", typeof NativeEvent === "function" ? "pass" : "fail");

  function compareMapper(nativeOutput, simulatedOutput) {
    return ["x", "y", "meanX", "meanY", "minX", "maxX", "minY", "maxY", "sampleCount"]
      .every(key => closeEnough(nativeOutput[key], simulatedOutput[key]));
  }

  function addFailure(failure) {
    failureCount += 1;
    if (failures.length < 100) failures.push(failure);
  }

  function finish() {
    if (!startedAt) return;
    window.removeEventListener("deviceorientation", onOrientation);
    window.clearTimeout(timeout);
    const captureDuration = performance.now() - startedAt;
    if (lastComparison) sampler.push(lastComparison, lastComparison.milliseconds, true);
    const recording = sampler.samples();
    const sampledDuration = recording.length > 1
      ? recording.at(-1).milliseconds - recording[0].milliseconds
      : 0;
    const fullWindowObserved = sampledDuration >= 2000;
    const passed = failureCount === 0 && pairs >= 30 && sampledDuration >= 29000;
    setResult("overall-result", passed ? "Pass — simulator matches the captured native API path" : `Fail — ${failureCount} mismatch(es)`, passed ? "pass" : "fail");
    setResult("status", passed ? "30-second comparison complete. You can download the genuine recording." : "Comparison ended without a complete 30-second conforming sample.", passed ? "pass" : "fail");
    $("start-test").disabled = false;

    const payload = {
      schema: "ks-epk-motion-recording/v1",
      capturedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      screenAngle: Core.screenAngle(window),
      targetDurationMilliseconds: targetDuration,
      captureDurationMilliseconds: Number(captureDuration.toFixed(2)),
      sampledDurationMilliseconds: Number(sampledDuration.toFixed(2)),
      processedPairCount: pairs,
      storedSampleCount: recording.length,
      storageIntervalMilliseconds: storageInterval,
      sampleStrategy: "time-decimated",
      fullWindowObserved,
      expectedDifference: "Native Event.isTrusted is true; scripted Event.isTrusted is always false.",
      passed,
      failureCount,
      failures,
      samples: recording,
    };
    startedAt = 0;
    completedPayload = payload;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = $("download-recording");
    link.href = URL.createObjectURL(blob);
    link.download = `epk-genuine-motion-${Date.now()}.json`;
    link.hidden = false;
    $("upload-recording").hidden = false;
    $("comparison-log").textContent = JSON.stringify(payload, null, 2);
  }

  async function uploadRecording() {
    const config = window.ksMotionCaptureConfig || {};
    if (!completedPayload || !config.endpoint || !config.token) {
      setResult("upload-status", "No completed recording is ready to upload.", "fail");
      return;
    }
    const button = $("upload-recording");
    button.disabled = true;
    setResult("upload-status", "Uploading private capture…", "warn");
    try {
      const response = await fetch(config.endpoint, {
        method: "POST",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
          "X-KS-Motion-Token": config.token,
        },
        body: JSON.stringify(completedPayload),
      });
      const result = await response.json();
      if (!response.ok || !result.captureId) throw new Error(result.message || `HTTP ${response.status}`);
      setResult("upload-status", `Saved privately in WordPress as Motion Capture #${result.captureId}.`, "pass");
      button.textContent = "Uploaded privately";
    } catch (error) {
      setResult("upload-status", `Upload failed: ${error.message}`, "fail");
      button.disabled = false;
    }
  }

  function onOrientation(nativeEvent) {
    if (nativeEvent instanceof SimulatedEvent || !Core.hasMotionData(nativeEvent)) return;
    const elapsed = performance.now() - startedAt;
    const simulatedEvent = new SimulatedEvent("deviceorientation", {
      alpha: nativeEvent.alpha,
      beta: nativeEvent.beta,
      gamma: nativeEvent.gamma,
      absolute: nativeEvent.absolute,
    });

    let dispatched = false;
    const observeSynthetic = event => {
      if (event === simulatedEvent) dispatched = event.target === window && event.type === nativeEvent.type;
    };
    window.addEventListener("deviceorientation", observeSynthetic, { once: true });
    window.dispatchEvent(simulatedEvent);

    const fieldParity = sameNullableNumber(nativeEvent.alpha, simulatedEvent.alpha)
      && sameNullableNumber(nativeEvent.beta, simulatedEvent.beta)
      && sameNullableNumber(nativeEvent.gamma, simulatedEvent.gamma)
      && Boolean(nativeEvent.absolute) === simulatedEvent.absolute
      && nativeEvent.bubbles === simulatedEvent.bubbles
      && nativeEvent.cancelable === simulatedEvent.cancelable
      && nativeEvent.composed === simulatedEvent.composed;

    const angle = Core.screenAngle(window);
    const nativeAligned = Core.screenAligned(nativeEvent, angle);
    const simulatedAligned = Core.screenAligned(simulatedEvent, angle);
    const now = performance.now();
    const nativeOutput = nativeMapper.push(nativeAligned, now);
    const simulatedOutput = simulatedMapper.push(simulatedAligned, now);
    const mapperParity = compareMapper(nativeOutput, simulatedOutput);

    if (!fieldParity) addFailure({ sample: pairs, type: "field-parity" });
    if (!dispatched) addFailure({ sample: pairs, type: "dispatch-parity" });
    if (!mapperParity) addFailure({ sample: pairs, type: "mapper-parity" });

    lastComparison = {
      milliseconds: Number(elapsed.toFixed(2)),
      alpha: nativeEvent.alpha,
      beta: nativeEvent.beta,
      gamma: nativeEvent.gamma,
      absolute: Boolean(nativeEvent.absolute),
      screenAngle: angle,
      nativeTrusted: nativeEvent.isTrusted,
      simulatedTrusted: simulatedEvent.isTrusted,
      fieldParity,
      dispatchParity: dispatched,
      mapperParity,
      mapped: simulatedOutput,
    };
    sampler.push(lastComparison, elapsed);
    pairs += 1;
    $("progress").value = Math.min(elapsed / 1000, 30);
    setResult("pairs-result", `${pairs} processed · ${sampler.size()} stored`);
    setResult("field-result", fieldParity ? "Pass" : "Fail", fieldParity ? "pass" : "fail");
    setResult("dispatch-result", dispatched ? "Pass" : "Fail", dispatched ? "pass" : "fail");
    setResult("mapper-result", mapperParity ? "Pass" : "Fail", mapperParity ? "pass" : "fail");
    $("comparison-log").textContent = JSON.stringify(lastComparison, null, 2);
  }

  async function start() {
    if (!window.isSecureContext || typeof NativeEvent !== "function") {
      setResult("status", "This phone does not expose the motion API in the current context.", "fail");
      return;
    }
    $("start-test").disabled = true;
    $("download-recording").hidden = true;
    $("upload-recording").hidden = true;
    $("upload-recording").disabled = false;
    $("upload-recording").textContent = "Upload recording privately to WordPress";
    setResult("upload-status", "");
    completedPayload = null;
    sampler = Policy.createSampler();
    failures.length = 0;
    pairs = 0;
    failureCount = 0;
    lastComparison = null;
    nativeMapper.reset();
    simulatedMapper.reset();
    $("progress").value = 0;
    try {
      if (typeof NativeEvent.requestPermission === "function") {
        const permission = await NativeEvent.requestPermission();
        if (permission !== "granted") {
          setResult("status", "Motion permission was not granted.", "fail");
          $("start-test").disabled = false;
          return;
        }
      }
      startedAt = performance.now();
      window.addEventListener("deviceorientation", onOrientation, { passive: true });
      setResult("status", "Move the phone gently for the full 30-second comparison…", "warn");
      timeout = window.setTimeout(finish, targetDuration);
    } catch (error) {
      setResult("status", `Motion API error: ${error.message}`, "fail");
      $("start-test").disabled = false;
    }
  }

  $("start-test").addEventListener("click", start);
  $("upload-recording").addEventListener("click", uploadRecording);
})();
