"""Synthetic packaging fixtures only; these do not replace an actual shared-library build."""
import hashlib,json,shutil,subprocess,sys,tempfile,unittest,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
class PackageTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
  (self.root/'tools').mkdir()
  for name in ['package-wordpress.py','package-web.py']:shutil.copyfile(ROOT/'tools'/name,self.root/'tools'/name)
  (self.root/'package.json').write_text(json.dumps({'name':'@kieransimkin/dancemoves','version':'3.0.0'}))
  self.stage=self.root/'.build/wordpress';self.stage.mkdir(parents=True)
  php="<?php\n/**\n * Version: 3.0.0\n */\ndefine('DANCE_MOVES_VERSION', '3.0.0');\n"
  for name,content in [('kieran-epk-device-orientation.php',php),('dance-moves-rudiments.php','<?php // test fixture\n')]:
   (self.root/name).write_text(content);(self.stage/name).write_text(content)
  (self.root/'LICENSE').write_text('Test fixture, not a distributed library')
  self.front=[]
  for name in ['wordpress.js','admin.min.js','styles/dance-moves-core.css','assets/paper-dreams-plane-atlas.png']:
   data=('synthetic '+name).encode()
   for parent in [self.root/'lib',self.stage/'lib']:
    p=parent/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
   self.front.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
  (self.stage/'library-manifest.json').write_text(json.dumps({'name':'@kieransimkin/dancemoves','version':'3.0.0','frontend':self.front}))
 def tearDown(self):self.temp.cleanup()
 def run_builder(self):return subprocess.run([sys.executable,str(self.root/'tools/package-wordpress.py')],text=True,capture_output=True)
 def test_deterministic_slug_and_hash(self):
  a=self.run_builder();self.assertEqual(a.returncode,0,a.stderr)
  p=self.root/'dist/DanceMoves-wordpress-3.0.0.zip';data=p.read_bytes();self.assertEqual(self.run_builder().returncode,0);self.assertEqual(p.read_bytes(),data)
  with zipfile.ZipFile(p) as z:self.assertTrue(all(n.startswith('kieran-epk-device-orientation/') for n in z.namelist()))
  m=json.loads((self.root/'dist/DanceMoves-wordpress-3.0.0-manifest.json').read_text());self.assertEqual(m['zip_sha256'],hashlib.sha256(data).hexdigest().upper())
 def test_no_duplicate_engine(self):
  (self.stage/'lib/second-engine.js').write_text('duplicate');self.assertNotEqual(self.run_builder().returncode,0)
 def test_admin_also_must_equal_library(self):
  (self.stage/'lib/admin.min.js').write_text('changed');self.assertNotEqual(self.run_builder().returncode,0)
 def test_style_also_must_equal_library(self):
  (self.root/'lib/styles/dance-moves-core.css').write_text('changed');self.assertNotEqual(self.run_builder().returncode,0)
 def test_php_cannot_change_after_build(self):
  with (self.root/'kieran-epk-device-orientation.php').open('a') as f:f.write('// new source')
  self.assertNotEqual(self.run_builder().returncode,0)
 def test_manifest_cannot_forge_frontend_inventory(self):
  self.front.pop();(self.stage/'library-manifest.json').write_text(json.dumps({'name':'@kieransimkin/dancemoves','version':'3.0.0','frontend':self.front}))
  self.assertNotEqual(self.run_builder().returncode,0)
if __name__=='__main__':unittest.main()
