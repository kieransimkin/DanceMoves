# DanceMoves 2.3.6

Fixes automatic fallback that could disable ambient effects permanently after a slow page load. Performance sampling now waits for loading to settle, requires sustained slowdown, continues in the lowest tier, and tests recovery one level at a time with backoff after failed trials.

Frame-rate thresholds now follow the fastest stable cadence observed in the session. Smooth 30 FPS on a 30 Hz monitor retains full effects instead of failing fixed 45–55 FPS thresholds. Hidden-tab sampling and reduced-motion behaviour remain guarded.

Validation: full Unit suite passed, including 30 Hz full-quality, overload/recovery, failed-probe cooldown, lifecycle and existing timing/cue contracts. Local browser held full quality at approximately 30 FPS with 18 animations, one player, five chapters and no horizontal scrollbar. Physical 60/120 Hz device measurements remain pending. Existing California full-page audit warnings concern page-owned effects outside this patch.

WordPress package SHA-256: `93F8A127F498935CC30ED8756EF1DD31C9705077323A148BDF8D33F81E9659D3`.
