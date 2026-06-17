'use strict';

const fs = require('fs');
const path = require('path');

var root = path.join(__dirname, '..');
var dist = path.join(root, 'dist');

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

var fileCount = 0;
(function count(dir) {
  fs.readdirSync(dir).forEach(function (name) {
    var p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) count(p);
    else fileCount++;
  });
})(dist);

console.log('[vercel-build] dist ready:', dist, '(' + fileCount + ' files)');
