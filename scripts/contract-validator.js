'use strict';

const fs = require('fs');
const path = require('path');
const contract = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'contract', 'runtime_contract.json'), 'utf8'),
);

const PLACEHOLDER = /^(?:暂无|待完善|待补充|无内容|TBD|TODO)$/i;
const STATUSES = ['completed', 'completed_with_limits', 'needs_input', 'needs_confirmation', 'failed'];
const STAGES = [
  'S1_SCOPE_CONFIRMATION',
  'S2_EVIDENCE_INVENTORY',
  'S3_PROFESSIONAL_DIAGNOSIS',
  'S4_SOLUTION_DESIGN',
  'S5_HUMAN_CONFIRMATION',
  'S6_FINAL_DELIVERY',
  'PAUSED',
  'FAILED',
];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isMissing(value) {
  return value === undefined
    || value === null
    || value === ''
    || (typeof value === 'string' && value.trim() === '')
    || (Array.isArray(value) && value.length === 0);
}

function isMeaningfulText(value) {
  return typeof value === 'string' && value.trim().length > 0 && !PLACEHOLDER.test(value.trim());
}

function err(code, message, field, severity = 'error', nextAction = '') {
  return { code, message, field, severity, next_action: nextAction };
}

function validateType(value, rule, field, errors) {
  if (value === undefined) return;
  const types = Array.isArray(rule.type) ? rule.type : [rule.type];
  if (!types.some((type) => {
    if (type === 'string') return typeof value === 'string';
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
    if (type === 'integer') return Number.isInteger(value);
    if (type === 'boolean') return typeof value === 'boolean';
    if (type === 'array') return Array.isArray(value);
    if (type === 'object') return isObject(value);
    return true;
  })) {
    errors.push(err('INPUT_INVALID', `字段类型应为${types.join('或')}`, field));
    return;
  }
  if ((rule.type === 'number' || rule.type === 'integer') && typeof value === 'number') {
    if (rule.minimum !== undefined && value < rule.minimum) {
      errors.push(err('INPUT_INVALID', `数值不得小于${rule.minimum}`, field));
    }
    if (rule.maximum !== undefined && value > rule.maximum) {
      errors.push(err('INPUT_INVALID', `数值不得大于${rule.maximum}`, field));
    }
  }
  if (rule.enum && !rule.enum.includes(value)) {
    errors.push(err('INPUT_INVALID', `字段值必须属于${rule.enum.join('/')}`, field));
  }
}

function validateAgentState(state, field = 'agent_state') {
  const errors = [];
  if (!isObject(state)) {
    errors.push(err('INPUT_INVALID', 'agent_state必须是对象', field));
    return errors;
  }
  const required = [
    'state_version',
    'product_id',
    'current_stage',
    'stage_status',
    'completed_stages',
    'confirmed_facts',
    'open_questions',
    'human_confirmation',
    'recovery_context',
    'change_log',
    'minimal_context',
  ];
  for (const key of required) {
    if (state[key] === undefined || state[key] === null) {
      errors.push(err('INPUT_INVALID', `agent_state缺少${key}`, `${field}.${key}`));
    }
  }
  if (state.state_version !== contract.contract_version) {
    errors.push(err('INPUT_INVALID', 'agent_state版本不匹配', `${field}.state_version`));
  }
  if (state.product_id !== contract.product_id) {
    errors.push(err('INPUT_INVALID', 'agent_state产品编号不匹配', `${field}.product_id`));
  }
  if (!STAGES.includes(state.current_stage)) {
    errors.push(err('INPUT_INVALID', '未知当前阶段', `${field}.current_stage`));
  }
  if (!['in_progress', 'paused', 'completed', 'failed'].includes(state.stage_status)) {
    errors.push(err('INPUT_INVALID', '无效阶段状态', `${field}.stage_status`));
  }
  if (!Array.isArray(state.completed_stages)) {
    errors.push(err('INPUT_INVALID', 'completed_stages必须为数组', `${field}.completed_stages`));
  }
  if (!Array.isArray(state.confirmed_facts)) {
    errors.push(err('INPUT_INVALID', 'confirmed_facts必须为数组', `${field}.confirmed_facts`));
  }
  if (!Array.isArray(state.open_questions)) {
    errors.push(err('INPUT_INVALID', 'open_questions必须为数组', `${field}.open_questions`));
  }
  if (!isObject(state.human_confirmation)
      || typeof state.human_confirmation.required !== 'boolean'
      || !['not_required', 'pending', 'confirmed', 'rejected'].includes(state.human_confirmation.status)) {
    errors.push(err('INPUT_INVALID', 'human_confirmation结构无效', `${field}.human_confirmation`));
  }
  if (!isObject(state.recovery_context)
      || !STAGES.includes(state.recovery_context.last_stable_stage)
      || !isMeaningfulText(state.recovery_context.resume_instruction)
      || !Array.isArray(state.recovery_context.affected_stages)
      || typeof state.recovery_context.can_resume !== 'boolean') {
    errors.push(err('INPUT_INVALID', 'recovery_context结构无效', `${field}.recovery_context`));
  }
  if (!Array.isArray(state.change_log)) {
    errors.push(err('INPUT_INVALID', 'change_log必须为数组', `${field}.change_log`));
  }
  if (!isObject(state.minimal_context)
      || !isMeaningfulText(state.minimal_context.user_goal)
      || !isMeaningfulText(state.minimal_context.scope)) {
    errors.push(err('INPUT_INVALID', 'minimal_context结构无效', `${field}.minimal_context`));
  }
  return errors;
}

function validateInput(input) {
  const errors = [];
  const warnings = [];
  const missing = [];
  if (!isObject(input)) {
    return {
      status: 'INVALID_INPUT',
      missing: [],
      errors: [err('INPUT_INVALID', '输入顶层必须是JSON对象', '$')],
      warnings,
    };
  }
  const allowed = new Set(Object.keys(contract.input_properties));
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      errors.push(err('INPUT_INVALID', '存在未声明的输入字段', key));
    }
  }
  for (const key of contract.input_required) {
    if (isMissing(input[key])) missing.push(key);
  }
  for (const [key, rule] of Object.entries(contract.input_properties)) {
    if (input[key] !== undefined) validateType(input[key], rule, key, errors);
  }
  if (contract.agent) {
    const resumeMode = input.resume_mode || 'new';
    if (!['new', 'resume', 'target_change', 'stage_rollback'].includes(resumeMode)) {
      errors.push(err('INPUT_INVALID', 'resume_mode无效', 'resume_mode'));
    }
    if (resumeMode !== 'new' && input.agent_state === undefined) {
      missing.push('agent_state');
    }
    if (input.agent_state !== undefined) {
      errors.push(...validateAgentState(input.agent_state));
    }
  }
  if (input.contains_sensitive_data === true) {
    warnings.push(err(
      'SENSITIVE_DATA',
      '检测到敏感数据标记，请先脱敏并仅保留完成任务所需字段',
      'contains_sensitive_data',
      'warning',
      '脱敏后重新提交',
    ));
  }
  if (missing.length > 0) {
    return {
      status: 'NEEDS_INPUT',
      missing: [...new Set(missing)],
      errors,
      warnings,
    };
  }
  if (errors.length > 0) {
    return { status: 'INVALID_INPUT', missing: [], errors, warnings };
  }
  if (input.data_status !== 'confirmed') {
    return {
      status: 'NEEDS_CONFIRMATION',
      missing: [],
      errors: [err('INPUT_CONFLICT', '输入资料尚未确认，不能生成确定性成果', 'data_status', 'blocking', '确认数据口径后重试')],
      warnings,
    };
  }
  return {
    status: warnings.length > 0 ? 'READY_WITH_PRIVACY_WARNING' : 'READY_FOR_PROCESSING',
    missing: [],
    errors: [],
    warnings,
  };
}

function validateDeliverableArray(name, value, errors) {
  if (!Array.isArray(value)) {
    errors.push(err('OUTPUT_INCOMPLETE', `${name}必须为数组`, `deliverables.${name}`));
    return;
  }
  if (value.length === 0) return;
  value.forEach((item, index) => {
    if (!isObject(item)) {
      errors.push(err('OUTPUT_INCOMPLETE', `${name}条目必须为对象`, `deliverables.${name}[${index}]`));
      return;
    }
    if (!isMeaningfulText(item.title)) {
      errors.push(err('OUTPUT_INCOMPLETE', `${name}条目标题不能为空或占位文本`, `deliverables.${name}[${index}].title`));
    }
    if (!isMeaningfulText(item.content)) {
      errors.push(err('OUTPUT_INCOMPLETE', `${name}条目内容不能为空或占位文本`, `deliverables.${name}[${index}].content`));
    }
  });
}

function validateStageResult(stageResult) {
  const errors = [];
  if (!isObject(stageResult)) {
    errors.push(err('OUTPUT_INCOMPLETE', 'stage_result必须为对象', 'stage_result'));
    return errors;
  }
  if (!STAGES.includes(stageResult.stage_id)) {
    errors.push(err('OUTPUT_INCOMPLETE', 'stage_result.stage_id无效', 'stage_result.stage_id'));
  }
  if (!['completed', 'paused', 'blocked', 'failed'].includes(stageResult.outcome)) {
    errors.push(err('OUTPUT_INCOMPLETE', 'stage_result.outcome无效', 'stage_result.outcome'));
  }
  if (!STAGES.includes(stageResult.next_stage)) {
    errors.push(err('OUTPUT_INCOMPLETE', 'stage_result.next_stage无效', 'stage_result.next_stage'));
  }
  if (typeof stageResult.recovery_required !== 'boolean') {
    errors.push(err('OUTPUT_INCOMPLETE', 'stage_result.recovery_required必须为布尔值', 'stage_result.recovery_required'));
  }
  return errors;
}

function validateOutput(output) {
  const errors = [];
  if (!isObject(output)) {
    return { valid: false, errors: [err('OUTPUT_INCOMPLETE', '输出必须是对象', '$')] };
  }
  if (output.contract_version !== contract.contract_version) {
    errors.push(err('OUTPUT_INCOMPLETE', '输出契约版本不匹配', 'contract_version'));
  }
  if (output.product_id !== contract.product_id) {
    errors.push(err('OUTPUT_INCOMPLETE', '输出产品编号不匹配', 'product_id'));
  }
  if (!STATUSES.includes(output.status)) {
    errors.push(err('OUTPUT_INCOMPLETE', '输出状态无效', 'status'));
  }
  if (!isMeaningfulText(output.status_reason)) {
    errors.push(err('OUTPUT_INCOMPLETE', '必须提供实质状态原因', 'status_reason'));
  }
  if (!isMeaningfulText(output.summary)) {
    errors.push(err('OUTPUT_INCOMPLETE', 'summary不能为空', 'summary'));
  }
  const deliverables = isObject(output.deliverables) ? output.deliverables : {};
  for (const [name, value] of Object.entries(deliverables)) {
    if (!contract.all_outputs.includes(name)) {
      errors.push(err('OUTPUT_INCOMPLETE', '存在未声明的输出字段', `deliverables.${name}`));
    }
    validateDeliverableArray(name, value, errors);
  }
  const hasNonEmptyDeliverable = Object.values(deliverables).some(
    (value) => Array.isArray(value) && value.length > 0,
  );
  const errorList = Array.isArray(output.errors) ? output.errors : [];
  if (output.errors !== undefined && !Array.isArray(output.errors)) {
    errors.push(err('OUTPUT_INCOMPLETE', 'errors必须为数组', 'errors'));
  }
  const humanReview = isObject(output.human_review) ? output.human_review : null;
  const hasTextArray = (value) => Array.isArray(value) && value.some(isMeaningfulText);

  if (output.status === 'completed') {
    for (const field of contract.core_outputs) {
      if (!Array.isArray(deliverables[field]) || deliverables[field].length === 0) {
        errors.push(err('OUTPUT_INCOMPLETE', `完成状态缺少核心成果：${field}`, `deliverables.${field}`));
      }
    }
    if (errorList.length > 0) {
      errors.push(err('OUTPUT_INCOMPLETE', 'completed状态不得包含错误列表', 'errors'));
    }
    if (!['evidence', 'assumptions', 'open_questions', 'human_review', 'next_action'].every((key) => output[key] !== undefined)) {
      errors.push(err('OUTPUT_INCOMPLETE', 'completed缺少必要依据、复核或下一步', '$'));
    }
    if (contract.high_risk && (!humanReview || humanReview.required !== true || humanReview.confirmed !== true || !hasTextArray(humanReview.review_points))) {
      errors.push(err('HUMAN_REVIEW_REQUIRED', '高风险产品完成前必须完成人工复核', 'human_review'));
    }
  } else if (output.status === 'completed_with_limits') {
    if (!hasNonEmptyDeliverable) {
      errors.push(err('OUTPUT_INCOMPLETE', '有限完成必须至少包含一项实质成果', 'deliverables'));
    }
    if (!isMeaningfulText(output.limitation_reason)) {
      errors.push(err('OUTPUT_INCOMPLETE', '有限完成必须说明受限原因', 'limitation_reason'));
    }
    if (!hasTextArray(output.completed_scope)) {
      errors.push(err('OUTPUT_INCOMPLETE', '有限完成必须说明已完成范围', 'completed_scope'));
    }
    if (!hasTextArray(output.blocked_scope)) {
      errors.push(err('OUTPUT_INCOMPLETE', '有限完成必须说明受阻范围', 'blocked_scope'));
    }
    if (errorList.length === 0) {
      errors.push(err('OUTPUT_INCOMPLETE', '有限完成必须至少记录一个限制或错误', 'errors'));
    }
    if (!hasTextArray(output.open_questions)) {
      errors.push(err('OUTPUT_INCOMPLETE', '有限完成必须列出待确认事项', 'open_questions'));
    }
  } else if (output.status === 'needs_input') {
    if (errorList.length === 0) {
      errors.push(err('OUTPUT_INCOMPLETE', '待输入必须说明具体错误或缺失', 'errors'));
    }
    if (!hasTextArray(output.open_questions)) {
      errors.push(err('OUTPUT_INCOMPLETE', '待输入必须列出待补充问题', 'open_questions'));
    }
    if (!isMeaningfulText(output.next_action)) {
      errors.push(err('OUTPUT_INCOMPLETE', '待输入必须提供下一步操作', 'next_action'));
    }
  } else if (output.status === 'needs_confirmation') {
    if (errorList.length === 0 || !hasTextArray(output.open_questions)) {
      errors.push(err('OUTPUT_INCOMPLETE', '待确认必须说明冲突与待确认事项', '$'));
    }
    if (!humanReview || humanReview.required !== true || humanReview.confirmed !== false || !hasTextArray(humanReview.review_points)) {
      errors.push(err('HUMAN_REVIEW_REQUIRED', '待确认状态必须保留未完成的人工复核', 'human_review'));
    }
    if (!isMeaningfulText(output.next_action)) {
      errors.push(err('OUTPUT_INCOMPLETE', '待确认必须提供下一步操作', 'next_action'));
    }
  } else if (output.status === 'failed') {
    if (errorList.length === 0) {
      errors.push(err('OUTPUT_INCOMPLETE', '失败状态必须说明错误', 'errors'));
    }
    if (!isMeaningfulText(output.next_action)) {
      errors.push(err('OUTPUT_INCOMPLETE', '失败状态必须提供恢复动作', 'next_action'));
    }
  }

  if (contract.agent) {
    if (output.agent_state === undefined) {
      errors.push(err('OUTPUT_INCOMPLETE', 'Agent输出缺少agent_state', 'agent_state'));
    } else {
      errors.push(...validateAgentState(output.agent_state));
    }
    if (output.stage_result === undefined) {
      errors.push(err('OUTPUT_INCOMPLETE', 'Agent输出缺少stage_result', 'stage_result'));
    } else {
      errors.push(...validateStageResult(output.stage_result));
    }
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  contract,
  PLACEHOLDER,
  STATUSES,
  STAGES,
  isMeaningfulText,
  validateAgentState,
  validateInput,
  validateOutput,
};
