const fs = require('fs');
const path = require('path');
const inputPath = process.argv[2];
if (!inputPath) { console.error('usage: node scripts/validate_input.js <input.json>'); process.exit(2); }
const { validateInput } = require('./contract-validator');
const input = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
console.log(JSON.stringify(validateInput(input), null, 2));
