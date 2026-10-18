// Builds dist/index.html for publishing as a claude.ai Artifact.
// The Artifact host wraps the page in its own <!doctype>/<html>/<head>/<body> skeleton,
// so this strips those tags from index.html and keeps everything else (title, metas,
// font link, css/js references). CSS and JS files are published alongside unchanged.
// Usage: node tools/build-artifact.js
var fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..');
var src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

var out = src
  .replace(/<!doctype[^>]*>\s*/i, '')
  .replace(/<\/?html(\s[^>]*)?>\s*/gi, '')
  .replace(/<\/?head(\s[^>]*)?>\s*/gi, '')   // not <header>
  .replace(/<\/?body(\s[^>]*)?>\s*/gi, '')
  // the skeleton already provides charset + viewport metas
  .replace(/<meta\s+charset[^>]*>\s*/i, '')
  .replace(/<meta\s+name="viewport"[^>]*>\s*/i, '');

// <title> must sit in the first 8KB; move it to the very top.
var title = out.match(/<title>[\s\S]*?<\/title>/i);
if (title) out = title[0] + '\n' + out.replace(title[0], '').replace(/^\s+/, '');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), out.trim() + '\n');

// publish every stylesheet and script the page references, in page order
var files = [];
src.replace(/<link[^>]+href="(css\/[^"]+)"/g, function (_, f) { files.push(f); return _; });
src.replace(/<script[^>]+src="([^"]+)"/g, function (_, f) { files.push(f); return _; });
files.forEach(function (f) {
  if (!fs.existsSync(path.join(root, f))) throw new Error('missing ' + f);
});
console.log('Wrote dist/index.html (' + out.length + ' bytes); publish it with these files:\n  ' + files.join('\n  '));
