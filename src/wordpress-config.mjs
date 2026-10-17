/** Normalize wp_localize_script's scalar-string wire format; no effect logic. */
export function readWordPressConfig(input = {}) {
  const out = {...input};
  if (out.beatAlignment) {
    out.beatAlignment={...out.beatAlignment};
    for (const key of ['bpm','first_beat_seconds','offset_pips','pips_per_beat','canonical_first_beat_pip']) out.beatAlignment[key]=Number(out.beatAlignment[key]);
    out.beatAlignment.source_audio_verified=[true,1,'1'].includes(out.beatAlignment.source_audio_verified);
    out.beatAlignment.source_audio={...out.beatAlignment.source_audio};
    for (const key of ['num_frames','sample_rate','num_channels','duration_seconds']) if (out.beatAlignment.source_audio[key]!==undefined) out.beatAlignment.source_audio[key]=Number(out.beatAlignment.source_audio[key]);
  }
  if (out.beatTimeline) {
    const t={...out.beatTimeline,source_audio:{...out.beatTimeline.source_audio}};
    for (const key of ['pips_per_beat','origin_beat']) t[key]=Number(t[key]);
    for (const key of ['sample_rate','num_frames','num_channels']) t.source_audio[key]=Number(t.source_audio[key]);
    t.beats=t.beats.map(row=>({...row,beat:Number(row.beat),frame:Number(row.frame),
      reference_frame:row.reference_frame===null||row.reference_frame===undefined?null:Number(row.reference_frame)}));
    out.beatTimeline=t;
  }
  for (const key of ['bpm','masterDurationMilliseconds','sharedControlTicks','lyricDisclosureTicks','pageId']) {
    if (out[key] !== undefined && out[key] !== '') out[key] = Number(out[key]);
  }
  for (const key of ['lyricPopupsEnabled','diagnostics','clayEnabled']) {
    out[key] = out[key] === true || out[key] === 1 || out[key] === '1';
  }
  return out;
}
