'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
for (const file of ['portal.html', 'order-search.html']) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'Public', file), 'utf8');
  const blocks = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  if (!blocks.length) throw Error(`No inline script found in Public/${file}`);
  new vm.Script(blocks[blocks.length - 1][1], { filename: `Public/${file} inline script` });
  console.log(`Public/${file} inline JavaScript syntax: OK`);
}
