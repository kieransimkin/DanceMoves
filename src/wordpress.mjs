/** The only WordPress frontend adapter. Every effect is imported from the shared library. */
import {createDanceMoves} from './index.mjs';
import {readWordPressConfig} from './wordpress-config.mjs';
export function mountWordPress(host = window) {
  if (host.__danceMovesMount && !host.__danceMovesMount.destroyed) return host.__danceMovesMount;
  const config=readWordPressConfig(host.danceMovesConfig || {});
  const adapter=config.orientationAdapter || host.ksEpkOrientationConfig?.adapter;
  const fallback={130:'.dfad-motion-stage',137:'.birth-stories-page',140:'#light-will-win-top',150:'.mog-epk',298:'.dmt-epk',397:'.sft-epk',399:'.entry-content'};
  const root=host.document.querySelector('.ks-epk') || host.document.querySelector(fallback[config.pageId] || '[data-dancemoves-root]') || host.document.querySelector('.entry-content');
  if (!root) return null;
  const runtime=createDanceMoves({...config,root,legacyGlobals:true,catalogue:true,
    clay:config.clayEnabled===true,
    orientation:adapter?{adapter,transitionTargetTicks:2,harness:host.ksEpkOrientationConfig?.harness===true}:undefined,
    paperPlanes:{...host.danceMovesPaperDreamsConfig,atlasUrl:config.atlasUrl,planeCount:12,compactPlaneCount:5}});
  host.__danceMovesMount=runtime;
  return runtime;
}
if (typeof window!=='undefined') {
  const start=()=>mountWordPress(window);
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
