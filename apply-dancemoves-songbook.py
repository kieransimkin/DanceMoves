#!/usr/bin/env python3
"""Apply the word-lyric + multi-song DanceMoves feature on a verified source checkout.

Use from OUTSIDE the checkout: python apply-dancemoves-songbook.py --repo PATH --check
The surrounding ZIP/payload is not part of the Git commit.
"""
from __future__ import annotations
import argparse
from pathlib import Path
import subprocess
import sys

PACKAGE = Path(__file__).resolve().parent
PAYLOAD = PACKAGE / 'payload'
BASELINE = '8c2057306089e7ae10330cf4d8d72c404e3f3683'


def require_once(text: str, needle: str, replacement: str, path: str) -> str:
    times = text.count(needle)
    if times != 1:
        raise ValueError(f'{path}: expected exactly one occurrence of {needle[:96]!r}, found {times}; please update the patch against latest main')
    return text.replace(needle, replacement, 1)


def edit_core(code: str, p: str) -> str:
    code = require_once(code, '  var lyricHandlers = new Map();', '  var lyricHandlers = new Map();\n  var wordHandlers = new Map();', p)
    code = require_once(code, '  var lyricList = [];', '  var lyricList = [];\n  var wordList = [];', p)
    before = '''  function dispatchLyric(entry, audio, index) {'''
    addition = '''  function onWord(handler, metadata) {
    if (typeof handler !== "function") throw new TypeError("DanceMoves word handler must be a function.");
    wordHandlers.set(handler, {callback:handler, id:diagnosticHandlerId(metadata, "word")});
    return function () {wordHandlers.delete(handler);};
  }

  function wordAtOrBefore(time) {
    var lo=0,hi=wordList.length;
    while(lo<hi) {var mid=(lo+hi)>>1;if(wordList[mid].start<=time+0.001)lo=mid+1;else hi=mid;}
    var found=lo-1;
    if(found>=0 && wordList[found].end!==null && time>wordList[found].end+0.001)return -1;
    return found;
  }
  function dispatchWord(entry, audio, index) {
    var detail={pageId:Number(rawConfig.pageId)||0,
      time:entry?entry.start:0, start:entry?entry.start:null, end:entry?entry.end:null,
      word:entry?entry.word:'',text:entry?entry.text:'',index:index,
      previousWord:index>0?wordList[index-1].word:null,
      nextWord:index>=0&&index+1<wordList.length?wordList[index+1].word:null,
      audio:audio||null};
    Array.from(wordHandlers.values()).forEach(function (registered) {
      try {if(diagnosticsSink)runDiagnosticSpan("word-handler",{handlerId:registered.id,wordIndex:index},function(){return registered.callback(detail);});
        else registered.callback(detail);}
      catch(error){if(window.console && window.console.error)window.console.error("DanceMoves word handler failed",error);}
    });
    document.dispatchEvent(new CustomEvent("dance-moves-word",{bubbles:true,detail:detail}));
    return detail;
  }
  function syncCurrentWord(time,audio,state) {
    if(!wordList.length)return;
    var index=wordAtOrBefore(time);
    if(index!==state.word) {state.word=index;dispatchWord(index>=0?wordList[index]:null,audio,index);}
  }

'''
    code = require_once(code,before,addition+before,p)
    code = require_once(code,'      lyric: -2,','      lyric: -2,\n      word: -2,',p)
    code = require_once(code,'        var lyricIndex = lyricAtOrBefore(now);','        syncCurrentWord(now,audio,state);\n        var lyricIndex = lyricAtOrBefore(now);',p)
    code = require_once(code,'''      state.lyric = -2;
      if (state.pendingCue)''','''      state.lyric = -2;
      state.word = -2;
      syncCurrentWord(state.last,audio,state);
      if (state.pendingCue)''',p)
    code = require_once(code,'state.last = 0; state.next = 0; state.lyric = -2;', 'state.last = 0; state.next = 0; state.lyric = -2; state.word = -2;',p)
    code = require_once(code,'''      state.lyric = -2;
      state.pendingCue = cueAtLanding(state.last);
      syncVariableTempo(audio);''','''      state.lyric = -2;
      state.word = -2;
      state.pendingCue = cueAtLanding(state.last);
      syncVariableTempo(audio);
      syncCurrentWord(state.last,audio,state);''',p)
    needle='''  function initialise() {'''
    addition='''  function loadWordFile() {
    var url=String(rawConfig.wordTimingUrl||'');
    if(!url)return Promise.resolve([]);
    return window.fetch(url,{credentials:"same-origin",cache:"no-cache"}).then(async function(response){
      if(!response.ok)throw new Error("Word timing HTTP "+response.status);
      if(Number(response.headers?.get('content-length'))>1048576)throw new RangeError('Word timing exceeds 1 MiB');
      var text='';
      if(response.body && response.body.getReader){
        var reader=response.body.getReader(),chunks=[],size=0;
        for(;;){var item=await reader.read();if(item.done)break;size+=item.value.byteLength;
          if(size>1048576){await reader.cancel();throw new RangeError('Word timing exceeds 1 MiB');}chunks.push(item.value);}
        var bytes=new Uint8Array(size),offset=0;
        chunks.forEach(function(chunk){bytes.set(chunk,offset);offset+=chunk.byteLength;});
        text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
      }else{text=await response.text();if(new TextEncoder().encode(text).length>1048576)throw new RangeError('Word timing exceeds 1 MiB');}
      wordList=parseWordTimingFile(text);
      return wordList;
    }).catch(function(error){wordList=[];
      document.documentElement.dataset.danceMovesWordStatus='unavailable';
      if(window.console && window.console.warn)window.console.warn('DanceMoves word file unavailable',error);
      return [];
    });
  }

'''
    code = require_once(code,needle,addition+needle,p)
    code = require_once(code,'Promise.all([loadCueFile(), loadLyricFile()]).then(function () {', 'Promise.all([loadCueFile(), loadLyricFile(), loadWordFile()]).then(function () {',p)
    code = require_once(code, '      document.documentElement.dataset.danceMovesLyricCount = String(lyricList.length);',
      '''      document.documentElement.dataset.danceMovesWordCount = String(wordList.length);
      document.documentElement.dataset.danceMovesWordStatus = wordList.length ? "ready" : "none";
      document.documentElement.dataset.danceMovesLyricCount = String(lyricList.length);''',p)
    code = require_once(code,'    onLyric: onLyric,','    onLyric: onLyric,\n    onWord: onWord,\n    parseWordTimingFile: parseWordTimingFile,',p)
    return code


def edit_php(code: str, p: str) -> str:
    code = require_once(code, "require_once __DIR__ . '/dance-moves-beat-timeline.php';", "require_once __DIR__ . '/dance-moves-beat-timeline.php';\nrequire_once __DIR__ . '/dance-moves-song-collection.php';",p)
    code = require_once(code,
      "        'lyricTimingUrl' => dance_moves_attachment_url(get_post_meta($page_id, DANCE_MOVES_META_LYRIC_TIMING, true)),",
      "        'lyricTimingUrl' => dance_moves_attachment_url(get_post_meta($page_id, DANCE_MOVES_META_LYRIC_TIMING, true)),\n        'wordTimingUrl' => dance_moves_attachment_url(get_post_meta($page_id, DANCE_MOVES_META_WORD_TIMING, true)),",p)
    code = require_once(code, "        'cueTimingUrl' => dance_moves_attachment_url(get_post_meta($page_id, DANCE_MOVES_META_CUE_TIMING, true)),",
      "        'cueTimingUrl' => dance_moves_attachment_url(get_post_meta($page_id, DANCE_MOVES_META_CUE_TIMING, true)),\n        'songCollectionEnabled' => get_post_meta($page_id,DANCE_MOVES_META_SONG_PAGE_TYPE,true)==='collection',\n        'songs' => (function($report){return is_array($report)?$report['songs']:array();})(dance_moves_song_collection_config($page_id)),",p)
    code = require_once(code,
      "    dance_moves_file_field($post->ID, 'Cue Timing File', 'dance_moves_cue_timing_id', DANCE_MOVES_META_CUE_TIMING, array('lrc', 'cue'));",
      "    dance_moves_file_field($post->ID, 'Cue Timing File', 'dance_moves_cue_timing_id', DANCE_MOVES_META_CUE_TIMING, array('lrc', 'cue'));\n    dance_moves_file_field($post->ID, 'Per-word Lyric Timing File', 'dance_moves_word_timing_id', DANCE_MOVES_META_WORD_TIMING, array('lrc','tsv','json'));",p)
    # Validate before any other EPK timing writes; the ordinary lyric/cue flow is unchanged.
    code = require_once(code,
      "    $raw_bpm = isset($_POST['dance_moves_bpm']) ? trim((string) wp_unslash($_POST['dance_moves_bpm'])) : '';",
      "    if (isset($_POST['dance_moves_word_timing_id'])) {\n        $word_check=dance_moves_validate_word_timing_attachment(absint($_POST['dance_moves_word_timing_id']));\n        if (is_wp_error($word_check)) {dance_moves_queue_admin_error($word_check->get_error_message().' Previous EPK timing metadata was preserved.');return;}\n    }\n    $raw_bpm = isset($_POST['dance_moves_bpm']) ? trim((string) wp_unslash($_POST['dance_moves_bpm'])) : '';",p)
    code = require_once(code,
      "        'dance_moves_cue_timing_id' => array(DANCE_MOVES_META_CUE_TIMING, 'cue'),",
      "        'dance_moves_cue_timing_id' => array(DANCE_MOVES_META_CUE_TIMING, 'cue'),\n        'dance_moves_word_timing_id' => array(DANCE_MOVES_META_WORD_TIMING, 'word'),",p)
    code = require_once(code,"        $valid = dance_moves_validate_timing_attachment($attachment_id, $definition[1]);",
      "        $valid = $definition[1] === 'word' ? dance_moves_validate_word_timing_attachment($attachment_id) : dance_moves_validate_timing_attachment($attachment_id, $definition[1]);",p)
    return code


def edited(root:Path) -> dict[str,bytes]:
    target={}
    def open_text(p):
      src=root/p
      if not src.is_file():raise ValueError(f'Missing source file {p}')
      raw=src.read_bytes();return raw.decode('utf-8').replace('\r\n','\n'),b'\r\n' in raw
    def modify(p,fn):
      s,crlf=open_text(p);out=fn(s,p)
      if out==s:raise ValueError(f'{p}: no change')
      target[p]=(out.replace('\n','\r\n') if crlf else out).encode('utf-8')
    modify('assets/dance-moves-core.js',edit_core)
    modify('kieran-epk-device-orientation.php',edit_php)
    def word_module(source,p):
      source=require_once(source,
        "source = once(source,'Promise.all([loadCueFile(), loadLyricFile()]).then(function () {','api.ready = Promise.all([loadCueFile(), loadLyricFile()]).then(function () {',relative);",
        "source = once(source,'Promise.all([loadCueFile(), loadLyricFile(), loadWordFile()]).then(function () {','api.ready = Promise.all([loadCueFile(), loadLyricFile(), loadWordFile()]).then(function () {',relative);",p)
      needle="    const code = transformOwnedOperations(source,relative);"
      repl="""    let code = transformOwnedOperations(source,relative);
    if (name === 'core') {
      // One canonical word parser serves the public ESM helper and core browser runtime.
      const words = fs.readFileSync(path.join(root,'src/word-timing.mjs'),'utf8')
        .replace(/^export /gm,'');
      code = words + '\\n' + code;
    }"""
      return require_once(source,needle,repl,p)
    modify('tools/build-modules.mjs',word_module)
    def config(s,p):
      s=require_once(s,"  bpm: '_dance_moves_bpm', lyric: '_dance_moves_lyric_timing_id', cue: '_dance_moves_cue_timing_id',",
        "  bpm: '_dance_moves_bpm', lyric: '_dance_moves_lyric_timing_id', word: '_dance_moves_word_timing_id', cue: '_dance_moves_cue_timing_id',",p)
      s=require_once(s,"    cueTimingUrl: url(input.cueTimingUrl, 'cueTimingUrl'), lyricTimingUrl: url(input.lyricTimingUrl, 'lyricTimingUrl'),",
        "    cueTimingUrl: url(input.cueTimingUrl, 'cueTimingUrl'), lyricTimingUrl: url(input.lyricTimingUrl, 'lyricTimingUrl'),\n    wordTimingUrl: url(input.wordTimingUrl,'wordTimingUrl'),",p)
      s=require_once(s,"return validatePageConfig({bpm, beatAlignment, beatTimeline, lyricTimingUrl: await resolve(PAGE_META_KEYS.lyric), cueTimingUrl: await resolve(PAGE_META_KEYS.cue),",
        "return validatePageConfig({bpm, beatAlignment, beatTimeline, lyricTimingUrl: await resolve(PAGE_META_KEYS.lyric), wordTimingUrl: await resolve(PAGE_META_KEYS.word), cueTimingUrl: await resolve(PAGE_META_KEYS.cue),",p)
      return s
    modify('src/config.mjs',config)
    def word_index(s,p):
      return require_once(s,"export {validateBeatAlignment} from './beat-alignment.mjs';",
        "export {validateBeatAlignment} from './beat-alignment.mjs';\nexport {parseWordTimingFile} from './word-timing.mjs';\nexport {validateSongCollection,createSongCollection} from './song-collection.mjs';",p)
    modify('src/index.mjs',word_index)
    def wordpress(s,p):
      s=require_once(s,"import {readWordPressConfig} from './wordpress-config.mjs';",
        "import {readWordPressConfig} from './wordpress-config.mjs';\nimport {createSongCollection} from './song-collection.mjs';",p)
      s=require_once(s,"  const adapter=config.orientationAdapter || host.ksEpkOrientationConfig?.adapter;",
        """  if (config.songCollectionEnabled === true) {
    const collectionRoot=host.document.querySelector('[data-dance-moves-song-collection]');
    if (!collectionRoot || !Array.isArray(config.songs) || !config.songs.length) return null;
    const collection=createSongCollection({root:collectionRoot,songs:config.songs.map(song=>({...song,pageId:config.pageId})),mount:createDanceMoves,host});
    host.__danceMovesMount=collection;
    return collection;
  }
  const adapter=config.orientationAdapter || host.ksEpkOrientationConfig?.adapter;""",p)
      return s
    modify('src/wordpress.mjs',wordpress)
    def wp_config(s,p):
      needle="  for (const key of ['bpm','masterDurationMilliseconds','sharedControlTicks','lyricDisclosureTicks','pageId']) {"
      repl="""  // WordPress scalar localization can stringify numbers inside nested song maps too.
  if (Array.isArray(out.songs)) {
    out.songs=out.songs.map(song=>{
      const row={...song};
      for(const field of ['bpm','pageId','masterDurationMilliseconds'])if(row[field]!==undefined&&row[field]!==null)row[field]=Number(row[field]);
      for(const field of ['beatAlignment','beatTimeline'])if(row[field]){
        const nested=readWordPressConfig({[field]:row[field]});
        row[field]=nested[field];
      }
      return row;
    });
  }
  out.songCollectionEnabled=out.songCollectionEnabled===true||out.songCollectionEnabled===1||out.songCollectionEnabled==='1';
  for (const key of ['bpm','masterDurationMilliseconds','sharedControlTicks','lyricDisclosureTicks','pageId']) {"""
      return require_once(s,needle,repl,p)
    modify('src/wordpress-config.mjs',wp_config)
    def build(s,p):
      return require_once(s,"'dance-moves-beat-alignment.php','dance-moves-beat-timeline.php','LICENSE'",
        "'dance-moves-beat-alignment.php','dance-moves-beat-timeline.php','dance-moves-song-collection.php','LICENSE'",p)
    modify('tools/build-shared.mjs',build)
    def admin(s,p):return s+'\n'+(PAYLOAD/'assets/song-collection-admin.js').read_text()
    modify('assets/dance-moves-admin.js',admin)
    def css(s,p):return s+'\n'+(PAYLOAD/'assets/song-collection.css').read_text()
    modify('assets/dance-moves-core.css',css)
    def types(s,p):
      s=require_once(s,"export interface PageConfig {", "export interface WordTimingEvent {index:number;time:number;start:number;end:number|null;word:string;text:string}\nexport interface SongCollectionEntry extends PageConfig {id:string;title:string;audioSrc:string}\nexport interface SongCollectionController {readonly destroyed:boolean;readonly current:string|null;readonly runtime:DanceMoves|null;readonly songs:readonly SongCollectionEntry[];readonly ready:Promise<DanceMoves>;select(id:string):DanceMoves;destroy():void}\nexport interface PageConfig {",p)
      s=require_once(s,"pageId?:number;bpm?:number|null;bpmSource?:'explicit'|'fallback'|'analysis';beatAlignment?:BeatAlignment|null;beatTimeline?:BeatTimeline|null;lyricTimingUrl?:string;cueTimingUrl?:string;",
        "pageId?:number;bpm?:number|null;bpmSource?:'explicit'|'fallback'|'analysis';beatAlignment?:BeatAlignment|null;beatTimeline?:BeatTimeline|null;lyricTimingUrl?:string;wordTimingUrl?:string;cueTimingUrl?:string;",p)
      s=require_once(s," onCue(name:string,callback:(cue:Cue)=>void,metadata?:Metadata):Remove;onLyric(callback:(lyric:Lyric)=>void,metadata?:Metadata):Remove;",
        " onCue(name:string,callback:(cue:Cue)=>void,metadata?:Metadata):Remove;onLyric(callback:(lyric:Lyric)=>void,metadata?:Metadata):Remove;\n onWord(callback:(word:WordTimingEvent & {audio?:PlaybackMedia|null;previousWord?:string|null;nextWord?:string|null})=>void,metadata?:Metadata):Remove;parseWordTimingFile(text:string):readonly WordTimingEvent[];",p)
      s=require_once(s,"export function createDanceMoves(options:Options):DanceMoves;",
        "export function createDanceMoves(options:Options):DanceMoves;\nexport function parseWordTimingFile(text:string,options?:{format?:'auto'|'json'|'tsv'|'lrc'}):readonly WordTimingEvent[];\nexport function validateSongCollection(input:readonly SongCollectionEntry[]|{schema:'dancemoves.song-collection.v1';songs:SongCollectionEntry[]}):readonly SongCollectionEntry[];\nexport function createSongCollection(options:{root:HTMLElement;songs:readonly SongCollectionEntry[];mount:(config:Options)=>DanceMoves;host?:Window}):SongCollectionController;",p)
      s=require_once(s,"alignment:string;alignmentAudio:string", "alignment:string;alignmentAudio:string;word:string",p)
      return s
    modify('types/index.d.ts',types)
    for p in ['README.md','AGENTS.md']:
      def append(src,name):
        fragment=(PAYLOAD/'docs/README-append.md').read_text() if name=='README.md' else (PAYLOAD/'docs/AGENTS-append.md').read_text()
        if fragment.strip() in src:raise ValueError(f'{name}: documentation already updated')
        return src.rstrip()+'\n\n'+fragment.rstrip()+'\n'
      modify(p,append)
    for path in ['src/word-timing.mjs','src/song-collection.mjs','dance-moves-song-collection.php',
                 'docs/word-and-multi-song.md','tests/shared/word-timing.test.mjs','tests/shared/song-collection.test.mjs','tests/shared/song-collection.php']:
      source=PAYLOAD/path
      if not source.is_file():raise ValueError(f'Missing installer payload {path}')
      if (root/path).exists():raise ValueError(f'{path}: output already exists; do not reapply')
      target[path]=source.read_bytes()
    return target


def main():
  parser=argparse.ArgumentParser(description=__doc__)
  parser.add_argument('--repo',type=Path,required=True,help='Full or relative DanceMoves checkout path')
  parser.add_argument('--check',action='store_true',help='Check all application locations without changing files')
  args=parser.parse_args()
  repo=args.repo.expanduser().resolve()
  if not (repo/'package.json').is_file() or not (repo/'dance-moves-beat-timeline.php').is_file():
    parser.error('--repo must point to DanceMoves with the variable-tempo feature already applied')
  # Modified repositories are allowed only when all exact feature baselines match.
  try:files=edited(repo)
  except (ValueError,OSError,UnicodeError) as exc:
    print('Cannot apply:',exc,file=sys.stderr);return 1
  if args.check:
    print(f'CHECK OK: {len(files)} paths ready; no files changed. Expected baseline: {BASELINE}')
    return 0
  # Stage every changed file before touching the live checkout.
  import tempfile
  with tempfile.TemporaryDirectory(prefix='dancemoves-song-patch-',dir=repo.parent) as temp:
    stage=Path(temp)
    for path,data in files.items():
      dest=stage/path;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
    for path in files:
      original=repo/path;dest=stage/path
      original.parent.mkdir(parents=True,exist_ok=True)
      dest.replace(original)
  print(f'Applied {len(files)} source/document/test paths. No Git operation performed.')
  print('Next: npm ci; npm test; npm run build; php -l dance-moves-song-collection.php')
  print('Commit ONLY changed DanceMoves source/docs/tests, not this ZIP or installer.')
  return 0
if __name__=='__main__':sys.exit(main())
