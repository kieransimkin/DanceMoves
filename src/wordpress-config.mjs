/** Normalize wp_localize_script's scalar-string wire format; no effect logic. */
export function readWordPressConfig(input = {}) {
  const out = {...input};
  for (const key of ['bpm','masterDurationMilliseconds','sharedControlTicks','lyricDisclosureTicks','pageId']) {
    if (out[key] !== undefined && out[key] !== '') out[key] = Number(out[key]);
  }
  for (const key of ['lyricPopupsEnabled','diagnostics','clayEnabled']) {
    out[key] = out[key] === true || out[key] === 1 || out[key] === '1';
  }
  return out;
}
