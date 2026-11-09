'use strict';
const fs = require('fs');
const path = require('path');
const { validateOutput } = require('./contract-validator');

const outputPath = process.argv[2];
if (!outputPath) {
  console.error('usage: node scripts/validate_output.js <output.json>');
  process.exit(2);
}
let output;
try {
  output = JSON.parse(fs.readFileSync(path.resolve(outputPath), 'utf8'));
} catch (error) {
  console.log(JSON.stringify({ valid: false, errors: [{ code: 'OUTPUT_INCOMPLETE', message: '输出不是有效JSON' }] }, null, 2));
  process.exit(2);
}
const result = validateOutput(output);
console.log(JSON.stringify(result, null, 2));
process.exit(result.valid ? 0 : 1);
