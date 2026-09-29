/** Compile the existing canonical browser sources into isolated, SSR-safe factories.
 * No eval(), Function(), script injection, source downloads or copied movement implementations.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MODULES = Object.freeze({
  core: 'assets/dance-moves-core.js', effects: 'assets/dance-moves-effects.js',
  catalogue: 'assets/dance-moves-catalogue-timing.js', orientationCore: 'assets/ks-epk-device-orientation-core.js',
  orientation: 'assets/ks-epk-device-orientation.js', clay: 'assets/clay-stars-effects.js',
  planes: 'assets/paper-dreams-flight.js', native: 'assets/vendor/dancerudiments/dancerudiments-native.js',
  rudiments: 'assets/dance-moves-rudiments.js', clayRudiments: 'assets/clay-stars-rudiments.js'
});
const f = ts.factory;
const scopeCall = (name, args) => f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('__dmScope'),name),undefined,args);
function prop(node, name) {return ts.isPropertyAccessExpression(node) && node.name.text === name;}
const literal = value => f.createStringLiteral(value);
export function transformOwnedOperations(source, filename) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  if (file.parseDiagnostics.length) throw new Error(`Parse failure in ${filename}: ${file.parseDiagnostics[0].messageText}`);
  const result = ts.transform(file, [context => node => {
    const visit = node => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const {expression: target, name} = node.expression;
        const args = node.arguments.map(x => ts.visitNode(x,visit));
        const object = ts.visitNode(target,visit);
        const methods = {addEventListener:'listen',removeEventListener:'unlisten',addListener:'addMediaListener',removeListener:'removeMediaListener',setAttribute:'setAttribute',removeAttribute:'removeAttribute'};
        if (methods[name.text]) return scopeCall(methods[name.text],[object,...args]);
        if (name.text === 'setProperty') return scopeCall('setStyle',[object,...args]);
        if (name.text === 'removeProperty') return scopeCall('removeStyle',[object,...args]);
        if (prop(target,'classList') && ['add','remove','toggle','replace'].includes(name.text)) return scopeCall('classes',[ts.visitNode(target.expression,visit),literal(name.text),...args]);
        if (['then','catch','finally'].includes(name.text)) return scopeCall('chain',[object,literal(name.text),...args]);
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left)) {
        const lhs = node.left;
        if (prop(lhs.expression,'style')) return scopeCall('setStyle',[ts.visitNode(lhs.expression,visit),literal(lhs.name.text),ts.visitNode(node.right,visit)]);
        if (prop(lhs.expression,'dataset')) return scopeCall('dataset',[ts.visitNode(lhs.expression.expression,visit),literal(lhs.name.text),ts.visitNode(node.right,visit)]);
      }
      if (ts.isDeleteExpression(node) && ts.isPropertyAccessExpression(node.expression) && prop(node.expression.expression,'dataset'))
        return scopeCall('dataset',[ts.visitNode(node.expression.expression.expression,visit),literal(node.expression.name.text),f.createNull()]);
      return ts.visitEachChild(node,visit,context);
    };
    return ts.visitNode(node,visit);
  }]);
  try {return ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(result.transformed[0]);}
  finally {result.dispose();}
}
function once(source, from, to, filename) {
  if (source.split(from).length !== 2) throw new Error(`${filename}: source contract changed at ${from.slice(0,80)}; review the module adapter`);
  return source.replace(from,to);
}
export function buildModules({root=ROOT, out=path.join(root,'.build/modules')}={}) {
  fs.rmSync(out,{recursive:true,force:true}); fs.mkdirSync(path.join(out,'runtime'),{recursive:true});
  for (const name of fs.readdirSync(path.join(root,'src'))) if (name.endsWith('.mjs')) fs.copyFileSync(path.join(root,'src',name),path.join(out,name));
  const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  fs.writeFileSync(path.join(out,'version.mjs'),`export const VERSION = ${JSON.stringify(pkg.version)};\n`);
  const imports = [];
  for (const [name,relative] of Object.entries(MODULES)) {
    const filename = path.join(root,relative);
    if (!fs.existsSync(filename)) throw new Error(`Missing canonical module: ${relative}. Apply this patch to a complete DanceMoves checkout.`);
    let source = fs.readFileSync(filename,'utf8');
    // Only mounting/lifetime integration changes; musical definitions remain in their canonical sources.
    if (name === 'core') {
      source = once(source,'Promise.all([loadCueFile(), loadLyricFile()]).then(function () {','api.ready = Promise.all([loadCueFile(), loadLyricFile()]).then(function () {',relative);
    }
    if (name === 'rudiments') source = once(source,'const token = String(++serial);', 'const token = __dmScope.id + "-" + String(++serial);',relative);
    if (name === 'catalogue') {
      source = once(source,'String(pseudoElementCounter)', '__dmScope.id + "-" + String(pseudoElementCounter)',relative);
      source = once(source,'pseudoStyle.id = "dance-moves-catalogue-pseudo-timing";', 'pseudoStyle.id = "dance-moves-catalogue-pseudo-timing-" + __dmScope.id;',relative);
    }
    const code = transformOwnedOperations(source,relative);
    const header = `// GENERATED from ${relative}; do not edit.\nexport default function install(__dmScope) {\nconst window = __dmScope.window, document = __dmScope.document;\nconst module = undefined;\nconst {CustomEvent, MutationObserver, ResizeObserver, IntersectionObserver, getComputedStyle, matchMedia, performance, setTimeout, clearTimeout, requestAnimationFrame, cancelAnimationFrame} = window;\n`;
    fs.writeFileSync(path.join(out,'runtime',`${name}.mjs`),header + code + '\n}\n');
    imports.push(`import ${name} from './${name}.mjs';`);
  }
  fs.writeFileSync(path.join(out,'runtime','index.mjs'), imports.join('\n') + `\nexport default {${Object.keys(MODULES).join(',')}};\n`);
  console.log(`Compiled ${Object.keys(MODULES).length} canonical frontend modules into scoped factories`);
  return out;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildModules();
