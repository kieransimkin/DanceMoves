'use strict';
// A deliberately small WordPress page-config simulator, NOT a replacement for WordPress.
const KEYS = Object.freeze(['_dance_moves_bpm','_dance_moves_lyric_timing_id','_dance_moves_cue_timing_id','_dance_moves_lyric_popups_enabled','_dance_moves_master_duration_ms','_dance_moves_effect']);
function validBpm(v) { return v !== '' && v !== null && Number.isFinite(Number(v)) && Number(v) >= 20 && Number(v) <= 400; }
function config(feature, meta) {
  const explicit = validBpm(meta._dance_moves_bpm);
  return { pageId: feature.pageId, version: '3.1.8', bpm: explicit ? Number(meta._dance_moves_bpm) : 120,
    bpmSource: explicit ? 'explicit' : 'fallback', fallbackBpm: 120,
    lyricTimingUrl: meta._dance_moves_lyric_timing_id === 9001 ? '/examples/wordpress/media/canonical-lyric-timing.lrc' : '',
    cueTimingUrl: meta._dance_moves_cue_timing_id === 9002 ? '/examples/wordpress/media/sections.cue' : '',
    lyricPopupsEnabled: meta._dance_moves_lyric_popups_enabled === true,
    masterDurationMilliseconds: meta._dance_moves_master_duration_ms || 0,
    effect: meta._dance_moves_effect === 'paper-planes' ? 'paper-planes' : '',
    tickDefinition: 'sixteenth-of-beat', ticksPerBeat: 16, longDurationQuantumTicks: 16,
    sharedControlTicks: feature.pageId === 260 ? 8 : 0, lyricDisclosureTicks: 6,
    // Harness-only. The production PHP does not emit diagnostics.
    diagnostics: feature.diagnostics === true };
}
if (typeof module !== 'undefined') module.exports = { KEYS, config, validBpm };
if (typeof window !== 'undefined') window.DemoMetadataModel = { KEYS, config, validBpm };
