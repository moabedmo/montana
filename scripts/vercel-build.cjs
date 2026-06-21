'use strict';

const fs = require('fs');
const path = require('path');

var root = path.join(__dirname, '..');
var dist = path.join(root, 'dist');
var output = path.join(root, '.vercel', 'output');

function rmDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(function (name) {
    var p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) rmDir(p);
    else fs.unlinkSync(p);
  });
  fs.rmdirSync(dir);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src).forEach(function (name) {
    var from = path.join(src, name);
    var to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  });
}

var htmlFiles = [
  'index.html',
  'shop.html',
  'cart.html',
  'checkout.html',
  'product.html',
  'ingredients.html',
  'privacy.html',
  'privacy-policy.html',
  'order-success.html',
  'contact.html',
  'robots.txt',
  'sitemap.xml'
];

rmDir(dist);
fs.mkdirSync(dist, { recursive: true });

htmlFiles.forEach(function (file) {
  var from = path.join(root, file);
  if (!fs.existsSync(from)) {
    console.error('[vercel-build] missing:', file);
    process.exit(1);
  }
  fs.copyFileSync(from, path.join(dist, file));
});

['css', 'js', 'assets', 'public'].forEach(function (dir) {
  var from = path.join(root, dir);
  if (fs.existsSync(from)) copyDir(from, path.join(dist, dir));
});

if (fs.existsSync(path.join(root, 'admin'))) {
  copyDir(path.join(root, 'admin'), path.join(dist, 'admin'));
}

var distIndex = path.join(dist, 'index.html');
if (!fs.existsSync(distIndex)) {
  console.error('[vercel-build] dist/index.html missing after build');
  process.exit(1);
}

/* Build Output API v3 — static + /api serverless on Vercel */
rmDir(output);
var staticDir = path.join(output, 'static');
copyDir(dist, staticDir);

var funcDir = path.join(output, 'functions', 'api', '[...path].func');
fs.mkdirSync(funcDir, { recursive: true });

var apiSrc = fs.readFileSync(path.join(root, 'api', '[...path].js'), 'utf8');
var apiOut = apiSrc.replace(/require\('\.\.\/handlers\//g, "require('./handlers/");
fs.writeFileSync(path.join(funcDir, 'index.js'), apiOut, 'utf8');
copyDir(path.join(root, 'handlers'), path.join(funcDir, 'handlers'));
copyDir(path.join(root, 'lib'), path.join(funcDir, 'lib'));

fs.writeFileSync(path.join(funcDir, '.vc-config.json'), JSON.stringify({
  runtime: 'nodejs20.x',
  handler: 'index.js',
  launcherType: 'Nodejs',
  maxDuration: 30,
  memory: 1024
}, null, 2), 'utf8');

var routes = [
  { src: '/api/(.*)', dest: '/api/[...path]' },
  { src: '/admin', dest: '/admin/index.html' },
  { src: '/shop', dest: '/shop.html' },
  { src: '/cart', dest: '/cart.html' },
  { src: '/checkout', dest: '/checkout.html' },
  { src: '/product', dest: '/product.html' },
  { src: '/ingredients', dest: '/ingredients.html' },
  { src: '/privacy', dest: '/privacy.html' },
  { src: '/privacy-policy', dest: '/privacy-policy.html' },
  { src: '/order-success', dest: '/order-success.html' },
  { src: '/contact', dest: '/contact.html' },
  { handle: 'filesystem' }
];

fs.writeFileSync(path.join(output, 'config.json'), JSON.stringify({
  version: 3,
  routes: routes
}, null, 2), 'utf8');

var fileCount = 0;
(function count(dir) {
  fs.readdirSync(dir).forEach(function (name) {
    var p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) count(p);
    else fileCount++;
  });
})(dist);

console.log('[vercel-build] dist ready:', dist, '(' + fileCount + ' files)');
console.log('[vercel-build] output ready:', output);
