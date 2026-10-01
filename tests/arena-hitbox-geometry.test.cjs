const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'dance-moves-effects.js'), 'utf8');
const block = source.match(/    function hitShape\(item\) \{[\s\S]*?(?=    function chooseShipSpawn\()/);
assert.ok(block, 'extract the actual arena geometry helpers');
const { touching, shotTouches } = vm.runInNewContext(`(() => { ${block[0]} return { touching, shotTouches }; })()`);
const box = (x, y, angle = 0, scale = .76, w = 80, h = 100) => ({ x, y, angle, hitboxScale: scale, w, h });

assert.equal(touching(box(0, 0), box(75, 0)), false, 'transparent edge margin does not collide');
assert.equal(touching(box(0, 0), box(50, 0)), true, 'actual hull contact still collides');
assert.equal(touching(box(0, 0, 45), box(70, 70, 45)), false, 'rotated AABB corner overlap is not a hit');
assert.equal(touching(box(0, 0, 45), box(30, 30, 45)), true, 'rotated hull overlap is a hit');

const tablet = box(0, 0, 0, .8, 70, 90);
const shot = box(30, 0, 0, 1, 4, 24);
assert.equal(shotTouches(shot, tablet), false, 'bullet outside the tablet hull misses');
shot.x = 29;
assert.equal(shotTouches(shot, tablet), true, 'bullet touching the tablet hull hits');

console.log('DanceMoves oriented arena hitbox geometry passed.');
