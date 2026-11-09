'use strict';
const fs = require('fs');
const path = require('path');
const { contract, validateInput } = require('./contract-validator');

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('usage: node scripts/prepare_result.js <input.json>');
  process.exit(2);
}
let input;
try {
  input = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
} catch (error) {
  console.log(JSON.stringify({
    status: 'needs_input',
    status_reason: '输入文件不是有效JSON',
    errors: [{ code: 'INPUT_INVALID', message: error.message, severity: 'blocking' }],
    next_action: '修正JSON格式后重试',
  }, null, 2));
  process.exit(2);
}
const validation = validateInput(input);
if (['INVALID_INPUT', 'NEEDS_INPUT'].includes(validation.status)) {
  console.log(JSON.stringify({
    status: 'needs_input',
    status_reason: '输入校验未通过',
    errors: validation.errors,
    open_questions: validation.missing.map((field) => `请补充${field}`),
    next_action: '补齐缺失或非法字段后重试',
  }, null, 2));
  process.exit(2);
}
if (validation.status === 'NEEDS_CONFIRMATION') {
  console.log(JSON.stringify({
    status: 'needs_confirmation',
    status_reason: '输入资料尚未确认',
    errors: validation.errors,
    open_questions: ['请确认资料版本和数据口径'],
    human_review: { required: true, review_points: ['数据口径'], confirmed: false },
    next_action: '确认资料后重试',
  }, null, 2));
  process.exit(2);
}
console.log(JSON.stringify({
  status: 'ready_for_professional_analysis',
  contract_version: contract.contract_version,
  product_id: contract.product_id,
  core_outputs: contract.core_outputs,
  all_outputs: contract.all_outputs,
  warnings: validation.warnings,
  next_action: '调用专业规则完成分析，并用scripts/validate_output.js校验最终结果',
}, null, 2));
