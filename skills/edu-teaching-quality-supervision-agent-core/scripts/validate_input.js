'use strict';
const fs = require('fs');
const path = require('path');
const { validateInput } = require('../../../scripts/contract-validator');
const inputPath = process.argv[2];
if (!inputPath) process.exit(2);
let input;
try {
  input = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
} catch (error) {
  console.log(JSON.stringify({ status: 'INVALID_JSON', message: error.message }, null, 2));
  process.exit(2);
}
const result = validateInput(input);
console.log(JSON.stringify(result, null, 2));
process.exit(['INVALID_INPUT', 'NEEDS_INPUT'].includes(result.status) ? 2 : 0);
