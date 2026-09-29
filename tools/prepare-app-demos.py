#!/usr/bin/env python3
"""Reuse the existing hash-pinned Arcadians demo; never synthesize substitute music."""
import argparse,importlib.util,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--stemlab-root',type=Path);args=p.parse_args()
 spec=importlib.util.spec_from_file_location('prepare_arcadians',ROOT/'tools/prepare-wordpress-examples.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 for message in module.prepare(args.stemlab_root):print(message)
 public=ROOT/'examples/next/public';(public/'media').mkdir(parents=True,exist_ok=True);(public/'dancemoves-assets').mkdir(exist_ok=True)
 for name in ['arcadians.mp3','cover.jpg','canonical-lyric-timing.lrc','sections.cue','sections.json']:
  shutil.copyfile(ROOT/'examples/wordpress/media'/name,public/'media'/name)
 shutil.copyfile(ROOT/'lib/assets/paper-dreams-plane-atlas.png',public/'dancemoves-assets/paper-dreams-plane-atlas.png')
 print('Arcadians is ready for both React and Next.js. Generated public media is gitignored.')
if __name__=='__main__':main()
