#!/usr/bin/env python3
"""Install the source-bound, optional StemLab beat-timeline consumer on DanceMoves main.

Run --check first. Refuse changed contexts without touching files; preserve CRLF/LF.
Baseline: 3feb6ea8fce6aedd2910ed09bf4d1fdf92106950 (DanceMoves 3.3.0).
"""
from __future__ import annotations
import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
FILES = ROOT / 'new'

CHANGES: dict[str, list[tuple[str,str]]] = {}

def edit(path: str, before: str, after: str):
    CHANGES.setdefault(path, []).append((before, after))

# Shared browser configuration, no new mandatory dependency.
edit('src/config.mjs',
"import {validateBeatAlignment} from './beat-alignment.mjs';",
"import {validateBeatAlignment} from './beat-alignment.mjs';\nimport {validateBeatTimeline, tempoAtSeconds} from './beat-timeline.mjs';")
edit('src/config.mjs',
"  alignment: '_dance_moves_beat_alignment', alignmentAudio: '_dance_moves_beat_alignment_audio_id'",
"  alignment: '_dance_moves_beat_alignment', alignmentAudio: '_dance_moves_beat_alignment_audio_id',\n  beatTimeline: '_dance_moves_beat_timeline', useBeatTimeline: '_dance_moves_use_beat_timeline'")
edit('src/config.mjs',
"  const beatAlignment=validateBeatAlignment(input.beatAlignment);\n  const canonicalExplicit=explicit && !['fallback','analysis'].includes(input.bpmSource);\n  if (canonicalExplicit && beatAlignment && Math.abs(input.bpm-beatAlignment.bpm)>0.000500001) throw new RangeError('Stored BPM and selected beat alignment disagree; select a matching BPM basis');\n  const bpm = beatAlignment ? beatAlignment.bpm : explicit ? Math.round(finite(input.bpm, 'bpm', 20, 400) * 1000) / 1000 : 120;",
"  const beatAlignment=validateBeatAlignment(input.beatAlignment);\n  const beatTimeline=validateBeatTimeline(input.beatTimeline,{requireSourceUrl:true});\n  const canonicalExplicit=explicit && !['fallback','analysis'].includes(input.bpmSource);\n  if (canonicalExplicit && beatAlignment && !beatTimeline && Math.abs(input.bpm-beatAlignment.bpm)>0.000500001) throw new RangeError('Stored BPM and selected beat alignment disagree; select a matching BPM basis');\n  const derivedTempo=beatTimeline ? tempoAtSeconds(beatTimeline,beatTimeline.beats[0].frame/beatTimeline.source_audio.sample_rate) : null;\n  const nominalTempo=beatTimeline ? beatAlignment?.bpm ?? Math.min(400,Math.max(20,derivedTempo)) : null;\n  const bpm = beatTimeline ? (explicit ? Math.round(finite(input.bpm,'bpm',20,400)*1000)/1000 : nominalTempo)\n    : beatAlignment ? beatAlignment.bpm : explicit ? Math.round(finite(input.bpm, 'bpm', 20, 400) * 1000) / 1000 : 120;")
edit('src/config.mjs',
"    bpmSource: canonicalExplicit ? 'explicit' : beatAlignment ? 'analysis' : 'fallback', fallbackBpm: 120,\n    beatAlignment,",
"    bpmSource: canonicalExplicit ? 'explicit' : beatAlignment || beatTimeline ? 'analysis' : 'fallback', fallbackBpm: 120,\n    beatAlignment, beatTimeline,")
edit('src/config.mjs',
"  if (beatAlignment) beatAlignment={...beatAlignment,source_url:await resolve(PAGE_META_KEYS.alignmentAudio)};\n  return validatePageConfig({bpm, beatAlignment, lyricTimingUrl:",
"  if (beatAlignment) beatAlignment={...beatAlignment,source_url:await resolve(PAGE_META_KEYS.alignmentAudio)};\n  const enabled=[true,1,'1'].includes(meta[PAGE_META_KEYS.useBeatTimeline]);\n  let beatTimeline=enabled ? meta[PAGE_META_KEYS.beatTimeline] || null : null;\n  if (typeof beatTimeline==='string') {\n    if (beatTimeline.length > 16*1024*1024) throw new RangeError('Beat timeline exceeds 16 MiB');\n    beatTimeline=JSON.parse(beatTimeline);\n  }\n  if (beatTimeline) beatTimeline={...beatTimeline,source_url:await resolve(PAGE_META_KEYS.alignmentAudio)};\n  return validatePageConfig({bpm, beatAlignment, beatTimeline, lyricTimingUrl:")

# Wire format from wp_localize_script. All beat frame identities stay integers.
edit('src/wordpress-config.mjs',
"  for (const key of ['bpm','masterDurationMilliseconds','sharedControlTicks','lyricDisclosureTicks','pageId']) {",
"  if (out.beatTimeline) {\n    const t={...out.beatTimeline,source_audio:{...out.beatTimeline.source_audio}};\n    for (const key of ['pips_per_beat','origin_beat']) t[key]=Number(t[key]);\n    for (const key of ['sample_rate','num_frames','num_channels']) t.source_audio[key]=Number(t.source_audio[key]);\n    t.beats=t.beats.map(row=>({...row,beat:Number(row.beat),frame:Number(row.frame),\n      reference_frame:row.reference_frame===null||row.reference_frame===undefined?null:Number(row.reference_frame)}));\n    out.beatTimeline=t;\n  }\n  for (const key of ['bpm','masterDurationMilliseconds','sharedControlTicks','lyricDisclosureTicks','pageId']) {")
edit('src/index.mjs',
"export {validateBeatAlignment} from './beat-alignment.mjs';",
"export {validateBeatAlignment} from './beat-alignment.mjs';\nexport {validateBeatTimeline, phasePipsAtSeconds, tickAtSeconds, tempoAtSeconds} from './beat-timeline.mjs';")

# Core shared runtime: conditionally select source-bound full beat timeline.
edit('assets/dance-moves-core.js',
'''  function beatAlignmentState(audio) {
    var reading = rawConfig.beatAlignment;
    if (!reading) return { status: rawConfig.beatAlignmentStatus === "invalid" ? "invalid" : "unconfigured", applied: false };
    var source = playbackAudio(audio);
    var identity = source && (source.masterSourceUrl || source.masterId || source.currentSrc || source.src);
    try {
      if (!identity || new URL(String(identity), document.baseURI).href !== new URL(reading.source_url).href) {
        return { status: "source-mismatch", applied: false };
      }
    } catch (error) { return { status: "source-mismatch", applied: false }; }
    return { status: reading.phase_status, applied: true, firstBeatSeconds: reading.first_beat_seconds,
      offsetPips: reading.offset_pips, sourceSha256: reading.source_sha256, bpmStatus: reading.bpm_status };
  }

  function rhythmicTime(audio) {
    var source = playbackAudio(audio);
    var seconds = source && Number.isFinite(Number(source.currentTime)) ? Number(source.currentTime) : 0;
    var state = beatAlignmentState(source);
    return seconds - (state.applied ? state.firstBeatSeconds : 0);
  }

  function sourceTick(audio, bpmOverride) {
    return rhythmicTime(audio) * effectiveBpm(bpmOverride || bpm) * TICKS_PER_BEAT / 60;
  }
''',
'''  // Source time -> variable rhythmic phase is never an affine BPM approximation.
  // Inputs are validated by the shared config layer and bound to the selected master.
  var timelineOrigin=rawConfig.beatTimeline ? rawConfig.beatTimeline.beats.find(function(row){return row.beat===rawConfig.beatTimeline.origin_beat;}) : null;
  function matchesBeatMaster(source, reading) {
    var identity = source && (source.masterSourceUrl || source.masterId || source.currentSrc || source.src);
    try { return Boolean(identity && reading && new URL(String(identity), document.baseURI).href === new URL(reading.source_url).href); }
    catch (error) { return false; }
  }
  function timelineInterval(map, sourceSeconds) {
    var beats=map.beats, frame=sourceSeconds*map.source_audio.sample_rate;
    var low=0,high=beats.length-1;
    while(low<high){var mid=Math.floor((low+high)/2);if(beats[mid].frame<=frame)low=mid+1;else high=mid;}
    var i=Math.max(0,Math.min(beats.length-2,beats[low].frame<=frame?low:low-1));
    return {index:i,frame:frame,left:beats[i],right:beats[i+1]};
  }
  function timelinePips(map, seconds) {
    var s=timelineInterval(map,seconds);
    return 64*((s.left.beat-map.origin_beat)+(s.frame-s.left.frame)*(s.right.beat-s.left.beat)/(s.right.frame-s.left.frame));
  }
  function beatTimelineState(audio) {
    var reading=rawConfig.beatTimeline;
    if (!reading) return {status:rawConfig.beatTimelineStatus==='invalid'?'invalid':'unconfigured',applied:false,mode:'constant'};
    var source=playbackAudio(audio);
    if(!matchesBeatMaster(source,reading))return {status:'source-mismatch',applied:false,mode:'constant'};
    var origin=timelineOrigin;
    return {status:reading.review_status==='artist_confirmed'?'confirmed':'estimated',applied:true,mode:'variable',
      firstBeatSeconds:origin.frame/reading.source_audio.sample_rate,offsetPips:timelinePips(reading,0),
      sourceSha256:reading.source_audio.sha256,bpmStatus:reading.review_status};
  }
  function beatAlignmentState(audio) {
    var timeline=beatTimelineState(audio);
    if(timeline.applied)return timeline;
    var reading=rawConfig.beatAlignment;
    if (!reading) return { status: rawConfig.beatAlignmentStatus === 'invalid' ? 'invalid' : 'unconfigured', applied: false, mode:'constant' };
    var source=playbackAudio(audio);
    if (!matchesBeatMaster(source,reading)) return {status:'source-mismatch',applied:false,mode:'constant'};
    return {status:reading.phase_status,applied:true,mode:'constant',firstBeatSeconds:reading.first_beat_seconds,
      offsetPips:reading.offset_pips,sourceSha256:reading.source_sha256,bpmStatus:reading.bpm_status};
  }
  function rhythmicTime(audio) {
    var source=playbackAudio(audio);
    var seconds=source && Number.isFinite(Number(source.currentTime))?Number(source.currentTime):0;
    var state=beatAlignmentState(source);
    return seconds-(state.applied?state.firstBeatSeconds:0);
  }
  function tempoAt(audio, fallback) {
    var source=playbackAudio(audio),map=rawConfig.beatTimeline;
    if(map&&matchesBeatMaster(source,map)&&Number.isFinite(Number(source.currentTime))) {
      var s=timelineInterval(map,Number(source.currentTime));
      return 60*map.source_audio.sample_rate*(s.right.beat-s.left.beat)/(s.right.frame-s.left.frame);
    }
    return effectiveBpm(fallback||bpm);
  }
  function sourceTick(audio, bpmOverride) {
    var source=playbackAudio(audio),map=rawConfig.beatTimeline;
    if(map&&matchesBeatMaster(source,map)&&Number.isFinite(Number(source.currentTime)))
      return timelinePips(map,Number(source.currentTime))/4;
    return rhythmicTime(source)*effectiveBpm(bpmOverride||bpm)*TICKS_PER_BEAT/60;
  }
  function durationMillisecondsAt(audio, ticks) {
    return 3750*quantizeTicks(ticks)/tempoAt(audio);
  }
''')

# Adopted catalogue CSS can track a custom quantized tick interval.
edit('assets/dance-moves-core.js',
    '  var bpm = effectiveBpm(rawConfig.bpm);',
    '''  var bpm = effectiveBpm(rawConfig.bpm);
  var adoptedTicks=[];
  function beatDurationVariable(ticks) {
    var count=Math.round(Number(ticks));
    if(!Number.isSafeInteger(count)||count<1||count>65536)throw new RangeError('CSS tempo ticks must be 1..65536');
    if(adoptedTicks.indexOf(count)<0)adoptedTicks.push(count);
    var key='--dance-moves-adopted-'+count+'t';
    document.documentElement.style.setProperty(key,(3750*count/(displayedTempo||bpm)).toFixed(6)+'ms');
    return key;
  }''')

# Updating CSS timing values only when a real variable-tempo master is active.
edit('assets/dance-moves-core.js',
"  function setTimingProperties() {\n    var style = document.documentElement.style;",
"  function setTimingProperties(localTempo) {\n    var style = document.documentElement.style;\n    var timingBpm = Number.isFinite(Number(localTempo)) && Number(localTempo)>0 ? Number(localTempo) : bpm;\n    var localDuration = function(ticks){return 3750*quantizeTicks(ticks)/timingBpm;};")
edit('assets/dance-moves-core.js',
'''    style.setProperty("--dance-moves-beat", (60000 / bpm).toFixed(6) + "ms");
    style.setProperty("--dance-moves-tick", (3750 / bpm).toFixed(6) + "ms");
    CSS_TICKS.forEach(function (ticks) {
      style.setProperty("--dance-moves-" + ticks + "t", durationMilliseconds(ticks).toFixed(6) + "ms");
    });
    style.setProperty("--dance-moves-neg-64t", (-durationMilliseconds(64)).toFixed(6) + "ms");
    style.setProperty("--dance-moves-lyric-disclosure-duration", durationMilliseconds(lyricDisclosureTicks).toFixed(6) + "ms");''',
'''    style.setProperty("--dance-moves-beat", (60000 / timingBpm).toFixed(6) + "ms");
    style.setProperty("--dance-moves-tick", (3750 / timingBpm).toFixed(6) + "ms");
    CSS_TICKS.forEach(function (ticks) {
      style.setProperty("--dance-moves-" + ticks + "t", localDuration(ticks).toFixed(6) + "ms");
    });
    style.setProperty("--dance-moves-neg-64t", (-localDuration(64)).toFixed(6) + "ms");
    style.setProperty("--dance-moves-lyric-disclosure-duration", localDuration(lyricDisclosureTicks).toFixed(6) + "ms");
    adoptedTicks.forEach(function(ticks){style.setProperty('--dance-moves-adopted-'+ticks+'t',(3750*ticks/timingBpm).toFixed(6)+'ms');});''')
edit('assets/dance-moves-core.js',
'      style.setProperty("--dance-moves-shared-control-duration", durationMilliseconds(sharedControlTicks).toFixed(6) + "ms");',
'      style.setProperty("--dance-moves-shared-control-duration", localDuration(sharedControlTicks).toFixed(6) + "ms");')
edit('assets/dance-moves-core.js',
'    document.documentElement.dataset.danceMovesBpm = String(bpm);',
'    document.documentElement.dataset.danceMovesBpm = String(bpm);\n    style.setProperty("--dance-moves-local-bpm", String(timingBpm));')
edit('assets/dance-moves-core.js',
'''  function registerAnimationScope(root, selectors) {''',
'''  var displayedTempo=null;
  function syncVariableTempo(audio) {
    // Audio effects use sourceTick (exact phase). These CSS variables cover
    // BPM-length timing on owned page styles without touching unrelated pages.
    if (!rawConfig.beatTimeline) return;
    var state=beatTimelineState(audio),local=state.applied?tempoAt(audio):bpm;
    if (displayedTempo===null || Math.abs(local-displayedTempo)>1e-7) {
      displayedTempo=local;setTimingProperties(local);
    }
    if (state.applied) {
      var ticks=sourceTick(audio),style=document.documentElement.style;
      style.setProperty('--dance-moves-rhythmic-ticks',String(ticks));
      style.setProperty('--dance-moves-rhythmic-pips',String(ticks*4));
      style.setProperty('--dance-moves-beat-phase',String(((ticks/16)%1+1)%1));
    }
  }

  function registerAnimationScope(root, selectors) {''')
edit('assets/dance-moves-core.js',
'''        now = positiveNumber(audio.currentTime);
        if (now + 0.001 < state.last)''',
'''        now = positiveNumber(audio.currentTime);
        syncVariableTempo(audio);
        if (now + 0.001 < state.last)''')
edit('assets/dance-moves-core.js',
'''      setOwnedPlaybackRate(audio.playbackRate);
      state.frame = window.requestAnimationFrame(tick);''',
'''      setOwnedPlaybackRate(audio.playbackRate);
      syncVariableTempo(audio);
      state.frame = window.requestAnimationFrame(tick);''')
edit('assets/dance-moves-core.js',
'''      state.pendingCue = cueAtLanding(state.last);
      playbackBindings.set(audio,''',
'''      state.pendingCue = cueAtLanding(state.last);
      syncVariableTempo(audio);
      playbackBindings.set(audio,''')
edit('assets/dance-moves-core.js',
'''    durationMilliseconds: durationMilliseconds,
    currentTick: currentTick,''',
'''    durationMilliseconds: durationMilliseconds,
    durationMillisecondsAt: durationMillisecondsAt,
    tempoAt: tempoAt,
    beatDurationVariable: beatDurationVariable,
    beatTimelineState: beatTimelineState,
    currentTick: currentTick,''')

# Phase-driven effects, rather than fixed-BPM time modulo.
edit('assets/dance-moves-effects.js',
'''      var duration = motion.durationMilliseconds(ticks) / 1000 / rate;
      var rhythmicSeconds = motion.rhythmicTime ? motion.rhythmicTime(audio) : finite(audio.currentTime, 0);
      var phase = -(((rhythmicSeconds / rate) % duration + duration) % duration);''',
'''      var duration = (motion.durationMillisecondsAt ? motion.durationMillisecondsAt(audio,ticks) : motion.durationMilliseconds(ticks)) / 1000 / rate;
      var nowTick = motion.sourceTick ? motion.sourceTick(audio) : finite(audio.currentTime, 0) * motion.bpm * 16 / 60;
      var progress = ((nowTick % ticks) + ticks) % ticks / ticks;
      var phase = -progress * duration;''')
edit('assets/dance-moves-effects.js',
'''      var cycleSeconds = Math.max(.001, finite(motion.durationMilliseconds(cycleTicks), 1) / 1000);
      var time = Math.max(0, finite(audio.currentTime, 0));
      var rhythmicSeconds = motion.rhythmicTime ? motion.rhythmicTime(audio) : time;
      var phase = ((rhythmicSeconds - phaseOffsetSeconds) % cycleSeconds + cycleSeconds) % cycleSeconds / cycleSeconds;''',
'''      var cycleSeconds = Math.max(.001, finite(motion.durationMillisecondsAt ? motion.durationMillisecondsAt(audio,cycleTicks) : motion.durationMilliseconds(cycleTicks), 1) / 1000);
      var time = Math.max(0, finite(audio.currentTime, 0));
      var localBpm = motion.tempoAt ? motion.tempoAt(audio) : motion.bpm;
      var currentTicks = motion.sourceTick ? motion.sourceTick(audio) : time * motion.bpm * 16 / 60;
      var secondsOffsetTicks = phaseOffsetSeconds * localBpm * 16 / 60;
      var phase = ((currentTicks - secondsOffsetTicks) % cycleTicks + cycleTicks) % cycleTicks / cycleTicks;''')
edit('assets/dance-moves-effects.js',
'''if (typeof options.render === "function") options.render({ root: state.root, detail: detail, count: count, durationMilliseconds: motion.durationMilliseconds(durationTicks) });
      timer = window.setTimeout(function () { clear("complete"); }, motion.durationMilliseconds(durationTicks));''',
'''if (typeof options.render === "function") options.render({ root: state.root, detail: detail, count: count, durationMilliseconds: motion.durationMillisecondsAt ? motion.durationMillisecondsAt(detail?.audio,durationTicks) : motion.durationMilliseconds(durationTicks) });
      timer = window.setTimeout(function () { clear("complete"); }, motion.durationMillisecondsAt ? motion.durationMillisecondsAt(detail?.audio,durationTicks) : motion.durationMilliseconds(durationTicks));''')

edit('assets/dance-moves-catalogue-timing.js',
'''      return quantized.milliseconds.toFixed(6) + "ms";''',
'''      if(config.beatTimeline && motion.beatDurationVariable) {
        var token='var('+motion.beatDurationVariable(Math.abs(quantized.ticks))+')';
        return quantized.ticks<0 ? 'calc(-1 * '+token+')' : token;
      }
      return quantized.milliseconds.toFixed(6) + "ms";''')

# Rudiment consumers already use sourceTick. The displayed BPM/duration now follow
# the current local beat interval, without changing the original sourceBeats clock.
edit('assets/dance-moves-rudiments.js',
'''      const tempo = bpm();
      const sourceBeats = useAudio ? Math.max(0, Number.isFinite(audio.currentTime) ? audio.currentTime : 0) * tempo / 60
        : motion.currentTick({ clock: 'page' }) / 16;
      const beats = useAudio && motion.sourceTick ? motion.sourceTick(audio) / 16 : sourceBeats;''',
'''      const baseTempo = bpm();
      const tempo = useAudio && motion.tempoAt ? motion.tempoAt(audio,baseTempo) : baseTempo;
      const sourceBeats = useAudio ? Math.max(0, Number.isFinite(audio.currentTime) ? audio.currentTime : 0) * baseTempo / 60
        : motion.currentTick({ clock: 'page' }) / 16;
      const beats = useAudio && motion.sourceTick ? motion.sourceTick(audio) / 16 : sourceBeats;''')

edit('assets/clay-stars-effects.js',
'''  var durationMilliseconds = function (ticks) {
    return motion && typeof motion.durationMilliseconds === "function"
      ? motion.durationMilliseconds(ticks)
      : ticks * (3750 / 90);
  };''',
'''  var durationMilliseconds = function (ticks) {
    var audio=root.querySelector('audio');
    if(audio && motion && motion.beatTimelineState && motion.beatTimelineState(audio).applied && motion.durationMillisecondsAt)
      return motion.durationMillisecondsAt(audio,ticks);
    return motion && typeof motion.durationMilliseconds === "function"
      ? motion.durationMilliseconds(ticks)
      : ticks * (3750 / 90);
  };''')

# WordPress: separate opt-in field; use existing verified master association.
edit('kieran-epk-device-orientation.php',
"require_once __DIR__ . '/dance-moves-beat-alignment.php';",
"require_once __DIR__ . '/dance-moves-beat-alignment.php';\nrequire_once __DIR__ . '/dance-moves-beat-timeline.php';")
edit('kieran-epk-device-orientation.php',
'''    $master_duration = get_post_meta($page_id, DANCE_MOVES_META_MASTER_DURATION, true);''',
'''    $timeline_enabled = '1' === (string)get_post_meta($page_id,DANCE_MOVES_META_USE_BEAT_TIMELINE,true);
    $timeline = $timeline_enabled ? dance_moves_resolve_beat_timeline(
        (string)get_post_meta($page_id,DANCE_MOVES_META_BEAT_TIMELINE,true),
        get_post_meta($page_id,DANCE_MOVES_META_ALIGNMENT_AUDIO,true)) : null;
    $timeline_status = !$timeline_enabled ? 'disabled' : (is_wp_error($timeline) || !$timeline ? 'invalid' : $timeline['review_status']);
    if (is_wp_error($timeline)) { $timeline=null; }
    if ($timeline && $source !== 'explicit' && !$alignment) {
        // A variable map has no single canonical BPM. This is only the initial
        // *nominal* UI value; audio-driven effects use its actual local tempo.
        $anchors=$timeline['beats'];
        $first=$anchors[0];$second=$anchors[1];
        $initial=60.0*$timeline['source_audio']['sample_rate']*($second['beat']-$first['beat'])/($second['frame']-$first['frame']);
        $bpm=max(20.0,min(400.0,$initial));$source='analysis';
    }

    $master_duration = get_post_meta($page_id, DANCE_MOVES_META_MASTER_DURATION, true);''')
edit('kieran-epk-device-orientation.php',
'''        'beatAlignmentStatus' => $alignment_status,
        'fallbackBpm' => 120,''',
'''        'beatAlignmentStatus' => $alignment_status,
        'beatTimeline' => $timeline,
        'beatTimelineStatus' => $timeline_status,
        'fallbackBpm' => 120,''')
edit('kieran-epk-device-orientation.php',
'''function dance_moves_register_page_meta() {
    register_post_meta('page', DANCE_MOVES_META_BEAT_ALIGNMENT, array(''',
'''function dance_moves_register_page_meta() {
    register_post_meta('page', DANCE_MOVES_META_BEAT_TIMELINE, array(
        'type'=>'string','single'=>true,'default'=>'',
        'sanitize_callback'=>'dance_moves_sanitize_beat_timeline','auth_callback'=>'dance_moves_meta_auth',
        'show_in_rest'=>true,'revisions_enabled'=>true,
    ));
    register_post_meta('page', DANCE_MOVES_META_USE_BEAT_TIMELINE, array(
        'type'=>'boolean','single'=>true,'default'=>false,
        'sanitize_callback'=>'rest_sanitize_boolean','auth_callback'=>'dance_moves_meta_auth',
        'show_in_rest'=>true,'revisions_enabled'=>true,
    ));
    register_post_meta('page', DANCE_MOVES_META_BEAT_ALIGNMENT, array(''')
edit('kieran-epk-device-orientation.php',
'''        DANCE_MOVES_META_BEAT_ALIGNMENT,
        DANCE_MOVES_META_ALIGNMENT_AUDIO,''',
'''        DANCE_MOVES_META_BEAT_ALIGNMENT,
        DANCE_MOVES_META_BEAT_TIMELINE,
        DANCE_MOVES_META_USE_BEAT_TIMELINE,
        DANCE_MOVES_META_ALIGNMENT_AUDIO,''')
edit('kieran-epk-device-orientation.php',
'''    $reading = $clock_config['beatAlignment'];''',
'''    $timeline_json=(string)get_post_meta($post->ID,DANCE_MOVES_META_BEAT_TIMELINE,true);
    $timeline_enabled='1'===(string)get_post_meta($post->ID,DANCE_MOVES_META_USE_BEAT_TIMELINE,true);
    ?>
    <p><label><input type="checkbox" name="dance_moves_use_beat_timeline" value="1"<?php checked($timeline_enabled); ?>>
      <strong>Use corrected variable-tempo beat map (optional)</strong></label>
      <span class="description">Overrides fixed-BPM motion timing only for the matching verified master. Leave unchecked for the existing BPM/offset behaviour.</span></p>
    <p><label for="dance_moves_beat_timeline"><strong>StemLab full beat timeline JSON</strong></label>
      <textarea class="widefat" rows="7" id="dance_moves_beat_timeline" name="dance_moves_beat_timeline" aria-describedby="dance-moves-timeline-help"><?php echo esc_textarea($timeline_json); ?></textarea>
      <span class="description" id="dance-moves-timeline-help">Paste the complete beat-timeline.v1 JSON from StemLab. Uses the same Analysed Master Audio attachment; validates its SHA-256. Beat 1, variable BPM and sync phase are reconstructed from precise source frames. Uncheck to use the original fixed BPM and offset.</span></p>
    <?php
    if ($clock_config['beatTimelineStatus']==='invalid') {
        echo '<p class="description">The selected variable-tempo map is invalid; it will not be applied. Fixed BPM timing remains available.</p>';
    } elseif ($clock_config['beatTimeline']) {
        $map=$clock_config['beatTimeline'];
        echo '<p class="description">Variable tempo active: '.esc_html((string)count($map['beats'])).
            ' beat anchors; Beat 1 #'.esc_html((string)$map['origin_beat']).'; '.
            esc_html($map['review_status']).'. Original fixed-BPM reading retained.</p>';
    }
    $reading = $clock_config['beatAlignment'];''')
edit('kieran-epk-device-orientation.php',
'''    $raw_bpm = isset($_POST['dance_moves_bpm']) ? trim((string) wp_unslash($_POST['dance_moves_bpm'])) : '';
    if (isset($_POST['dance_moves_beat_alignment'])) {''',
'''    $raw_bpm = isset($_POST['dance_moves_bpm']) ? trim((string) wp_unslash($_POST['dance_moves_bpm'])) : '';
    $timeline_enabled=isset($_POST['dance_moves_use_beat_timeline']);
    $timeline_json=isset($_POST['dance_moves_beat_timeline']) ? (string)wp_unslash($_POST['dance_moves_beat_timeline'])
        : (string)get_post_meta($post_id,DANCE_MOVES_META_BEAT_TIMELINE,true);
    $timeline_audio=isset($_POST['dance_moves_alignment_audio_id']) ? absint($_POST['dance_moves_alignment_audio_id'])
        : absint(get_post_meta($post_id,DANCE_MOVES_META_ALIGNMENT_AUDIO,true));
    // Verify BEFORE modifying any page timing metadata; errors preserve prior state.
    $timeline_check=dance_moves_resolve_beat_timeline($timeline_json,$timeline_audio);
    // Disabled maps are not active: permit disabling a stale/invalid map.
    if (!$timeline_enabled && is_wp_error($timeline_check)) { $timeline_check=null; $timeline_json=''; }
    if (is_wp_error($timeline_check) || ($timeline_enabled && !$timeline_check)) {
        $message=is_wp_error($timeline_check) ? $timeline_check->get_error_message() : 'Enable variable tempo only with a valid map.';
        dance_moves_queue_admin_error($message . ' Previous EPK timing metadata was preserved.');
        return;
    }
    if (isset($_POST['dance_moves_beat_alignment'])) {''')
edit('kieran-epk-device-orientation.php',
'''    if ($raw_bpm === '') {
        delete_post_meta($post_id, DANCE_MOVES_META_BPM);''',
'''    // Save the opt-in map separately; never overwrite the v1 constant-tempo reading.
    if ($timeline_check) {
        update_post_meta($post_id,DANCE_MOVES_META_BEAT_TIMELINE,dance_moves_sanitize_beat_timeline($timeline_json));
        update_post_meta($post_id,DANCE_MOVES_META_ALIGNMENT_AUDIO,$timeline_audio);
    } else {
        delete_post_meta($post_id,DANCE_MOVES_META_BEAT_TIMELINE);
    }
    update_post_meta($post_id,DANCE_MOVES_META_USE_BEAT_TIMELINE,$timeline_enabled ? '1' : '0');
    if ($raw_bpm === '') {
        delete_post_meta($post_id, DANCE_MOVES_META_BPM);''')
edit('tools/build-shared.mjs',
"'dance-moves-beat-alignment.php','LICENSE'",
"'dance-moves-beat-alignment.php','dance-moves-beat-timeline.php','LICENSE'")

edit('kieran-epk-device-orientation.php',
'''        $alignment = dance_moves_resolve_beat_alignment($alignment_json, $alignment_audio, $raw_bpm);''',
'''        $alignment = dance_moves_resolve_beat_alignment($alignment_json, $alignment_audio,
            $timeline_enabled && $timeline_check ? '' : $raw_bpm);''')

# NPM type contract: opt-in, same source identity, variable audio clock.
edit('types/index.d.ts',
'''export interface PageConfig {
 pageId?:number;bpm?:number|null;bpmSource?:'explicit'|'fallback'|'analysis';beatAlignment?:BeatAlignment|null;lyricTimingUrl?:string;cueTimingUrl?:string;''',
'''export interface BeatTimelineAnchor {beat:number;frame:number;source:'consensus'|'corrected'|'manual';reference_frame:number|null}
export interface BeatTimeline {
 schema:'stemlab.beat-timeline.v1';pips_per_beat:64;consensus_sha256:string;origin_beat:number;
 review_status:'estimated'|'artist_confirmed';source_url?:string;
 source_audio:{sha256:string;sample_rate:number;num_frames:number;num_channels:number;duration_seconds?:number};
 beats:BeatTimelineAnchor[];
 sync?:{beat_1_index:number;beat_1_source_frame:number;beat_1_start_seconds:number;beat_1_start_pips:number;sync_phase_offset_pips:number;exact_phase_offset_pips:string;pips_per_beat:64;canonical_first_beat_pip:0};
 beat_timeline?:Array<{beat:number;source_frame:number;pip:number;time_seconds:number;consensus_reference_frame:number|null}>;
 tempo_segments?:Array<{start_frame:number;end_frame:number;bpm:number}>;
}
export interface PageConfig {
 pageId?:number;bpm?:number|null;bpmSource?:'explicit'|'fallback'|'analysis';beatAlignment?:BeatAlignment|null;beatTimeline?:BeatTimeline|null;lyricTimingUrl?:string;cueTimingUrl?:string;''')
edit('types/index.d.ts',
''' sourceTick(audio:PlaybackMedia,bpmOverride?:number):number;rhythmicTime(audio:PlaybackMedia):number;
 beatAlignmentState(audio:PlaybackMedia):Readonly<{status:string;applied:boolean;firstBeatSeconds?:number;offsetPips?:number;sourceSha256?:string;bpmStatus?:string}>;''',
''' sourceTick(audio:PlaybackMedia,bpmOverride?:number):number;rhythmicTime(audio:PlaybackMedia):number;
 tempoAt(audio:PlaybackMedia,bpmOverride?:number):number;durationMillisecondsAt(audio:PlaybackMedia,ticks:number):number;
 beatTimelineState(audio:PlaybackMedia):Readonly<{status:string;applied:boolean;mode:'constant'|'variable';firstBeatSeconds?:number;offsetPips?:number;sourceSha256?:string}>;
 beatAlignmentState(audio:PlaybackMedia):Readonly<{status:string;applied:boolean;mode?:'constant'|'variable';firstBeatSeconds?:number;offsetPips?:number;sourceSha256?:string;bpmStatus?:string}>;''')
edit('types/index.d.ts',
'''export const PAGE_META_KEYS:Readonly<{bpm:string;lyric:string;cue:string;popups:string;duration:string;effect:string;alignment:string;alignmentAudio:string}>;
export function validateBeatAlignment(input?:BeatAlignment|null):Readonly<BeatAlignment>|null;''',
'''export const PAGE_META_KEYS:Readonly<{bpm:string;lyric:string;cue:string;popups:string;duration:string;effect:string;alignment:string;alignmentAudio:string;beatTimeline:string;useBeatTimeline:string}>;
export function validateBeatAlignment(input?:BeatAlignment|null):Readonly<BeatAlignment>|null;
export function validateBeatTimeline(input?:BeatTimeline|null,options?:{requireSourceUrl?:boolean}):Readonly<BeatTimeline>|null;
export function phasePipsAtSeconds(map:BeatTimeline,sourceSeconds:number):number;
export function tempoAtSeconds(map:BeatTimeline,sourceSeconds:number):number;
export function tickAtSeconds(map:BeatTimeline,sourceSeconds:number):number;''')

# README, policy and guide additions: do not rewrite existing content.
APPENDS = {
    'README.md': FILES/'README-append.md',
    'docs/beat-alignment.md': FILES/'docs/beat-alignment-append.md',
    'docs/wordpress-shared-runtime.md': FILES/'docs/wordpress-append.md',
    'AGENTS.md': FILES/'AGENTS-append.md',
}
NEW_FILES = [
    'src/beat-timeline.mjs','tests/shared/beat-timeline.test.mjs',
    'tests/shared/variable-tempo.test.mjs','dance-moves-beat-timeline.php',
    'tests/shared/beat-timeline.php','docs/variable-tempo.md',
]

def process(root: Path, check: bool):
    output: dict[Path,bytes] = {}
    errors=[]
    for name,replacements in CHANGES.items():
        p=root/name
        if not p.is_file():errors.append('Missing '+name);continue
        before=p.read_bytes()
        newline=b'\r\n' if b'\r\n' in before else b'\n'
        text=before.decode('utf-8').replace('\r\n','\n')
        for old,new in replacements:
            if text.count(old)!=1:
                errors.append(f'{name}: expected one matching context, found {text.count(old)}: {old[:78]!r}')
            else:text=text.replace(old,new,1)
        output[p]=text.replace('\n','\r\n').encode('utf-8') if newline==b'\r\n' else text.encode('utf-8')
    for name,template in APPENDS.items():
        p=root/name
        if not p.is_file():errors.append('Missing '+name);continue
        original=output.get(p,p.read_bytes())
        newline='\r\n' if b'\r\n' in original else '\n'
        fragment=template.read_text(encoding='utf-8').strip()
        if fragment in original.decode('utf-8').replace('\r\n','\n'):
            errors.append(f'{name}: already contains appended feature documentation')
        else:output[p]=original.rstrip(b'\r\n') + ('\n\n'+fragment+'\n').replace('\n',newline).encode('utf-8')
    for name in NEW_FILES:
        p=root/name
        if p.exists(): errors.append('New file already exists: '+name)
        source=FILES/name
        if not source.is_file(): errors.append('Installer is missing '+str(source))
        else: output[p]=source.read_bytes()
    if errors:
        for item in errors: print('ERROR:',item,file=sys.stderr)
        return 1
    if check:
        print(f'All {len(output)} target files pass source preflight; no files changed.')
    else:
        for p,data in output.items():
            p.parent.mkdir(parents=True,exist_ok=True)
            p.write_bytes(data)
        print(f'Updated {len(output)} source/tests/doc files; no generated build outputs touched.')
    return 0

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true',help='Validate every edit without writing files')
    parser.add_argument('--project',type=Path,default=ROOT,help='Destination DanceMoves checkout')
    args=parser.parse_args()
    sys.exit(process(args.project.resolve(),args.check))
