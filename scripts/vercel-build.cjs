'use strict';

const fs = require('fs');
const path = require('path');

const required = ['index.html', 'shop.html', 'admin/index.html'];
for (var i = 0; i < required.length; i++) {
  if (!fs.existsSync(path.join(__dirname, '..', required[i]))) {
    console.error('[vercel-build] missing:', required[i]);
    process.exit(1);
  }
}

console.log('[vercel-build] static files ok');
