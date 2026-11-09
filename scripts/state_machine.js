'use strict';

const contract = require('./contract-validator').contract;
const { STAGES } = require('./contract-validator');

const COMPLETED_STAGES = STAGES.slice(0, 6);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createState({ userGoal, scope, constraints = [] }) {
  return {
    state_version: contract.contract_version,
    product_id: contract.product_id,
    current_stage: 'S1_SCOPE_CONFIRMATION',
    stage_status: 'in_progress',
    completed_stages: [],
    confirmed_facts: [],
    open_questions: [],
    human_confirmation: { required: false, status: 'not_required' },
    recovery_context: {
      last_stable_stage: 'S1_SCOPE_CONFIRMATION',
      resume_instruction: '从任务确认继续',
      affected_stages: [],
      can_resume: true,
    },
    change_log: [],
    minimal_context: {
      user_goal: userGoal,
      scope,
      constraints,
      last_user_instruction: '开始任务',
    },
  };
}

function validateIdentity(state) {
  if (!state || state.product_id !== contract.product_id || state.state_version !== contract.contract_version) {
    throw new Error('AGENT_STATE_IDENTITY_MISMATCH');
  }
  if (!STAGES.includes(state.current_stage)) throw new Error('AGENT_STATE_UNKNOWN_STAGE');
  return true;
}

function resume(state) {
  validateIdentity(state);
  const next = clone(state);
  next.stage_status = 'in_progress';
  next.change_log.push({
    event_type: 'resume',
    reason: '用户恢复任务',
    from_stage: 'PAUSED',
    to_stage: next.current_stage === 'PAUSED' ? next.recovery_context.last_stable_stage : next.current_stage,
    affected_stages: [],
    occurred_at: new Date().toISOString(),
  });
  if (next.current_stage === 'PAUSED') next.current_stage = next.recovery_context.last_stable_stage;
  next.recovery_context.can_resume = true;
  return next;
}

function pause(state, reason) {
  validateIdentity(state);
  const next = clone(state);
  next.recovery_context.last_stable_stage = next.current_stage;
  next.current_stage = 'PAUSED';
  next.stage_status = 'paused';
  next.recovery_context.can_resume = true;
  next.recovery_context.resume_instruction = `恢复后从${next.recovery_context.last_stable_stage}继续`;
  next.change_log.push({
    event_type: 'interruption',
    reason,
    from_stage: next.recovery_context.last_stable_stage,
    to_stage: 'PAUSED',
    affected_stages: [],
    occurred_at: new Date().toISOString(),
  });
  return next;
}

function changeTarget(state, targetStage, reason, affectedStages) {
  validateIdentity(state);
  if (!COMPLETED_STAGES.includes(targetStage)) throw new Error('INVALID_TARGET_STAGE');
  const next = clone(state);
  const previous = next.current_stage;
  next.current_stage = targetStage;
  next.stage_status = 'in_progress';
  next.completed_stages = next.completed_stages.filter(
    (stage) => COMPLETED_STAGES.indexOf(stage) < COMPLETED_STAGES.indexOf(targetStage),
  );
  next.human_confirmation = { required: false, status: 'not_required' };
  next.recovery_context.last_stable_stage = targetStage;
  next.recovery_context.affected_stages = [...new Set(affectedStages)];
  next.recovery_context.can_resume = true;
  next.recovery_context.resume_instruction = `按变更后的目标从${targetStage}重新执行受影响阶段`;
  next.change_log.push({
    event_type: 'target_change',
    reason,
    from_stage: previous,
    to_stage: targetStage,
    affected_stages: [...new Set(affectedStages)],
    occurred_at: new Date().toISOString(),
  });
  return next;
}

function rollback(state, targetStage, reason) {
  validateIdentity(state);
  if (!COMPLETED_STAGES.includes(targetStage)) throw new Error('INVALID_ROLLBACK_STAGE');
  const next = clone(state);
  const previous = next.current_stage;
  const targetIndex = COMPLETED_STAGES.indexOf(targetStage);
  next.current_stage = targetStage;
  next.stage_status = 'in_progress';
  next.completed_stages = next.completed_stages.filter(
    (stage) => COMPLETED_STAGES.indexOf(stage) < targetIndex,
  );
  next.human_confirmation = { required: false, status: 'not_required' };
  next.recovery_context.last_stable_stage = targetStage;
  next.recovery_context.affected_stages = COMPLETED_STAGES.slice(targetIndex);
  next.recovery_context.can_resume = true;
  next.recovery_context.resume_instruction = `回退到${targetStage}，从上游重新核验`;
  next.change_log.push({
    event_type: 'stage_rollback',
    reason,
    from_stage: previous,
    to_stage: targetStage,
    affected_stages: COMPLETED_STAGES.slice(targetIndex),
    occurred_at: new Date().toISOString(),
  });
  return next;
}

function completeStage(state, stage, nextStage) {
  validateIdentity(state);
  const next = clone(state);
  if (!next.completed_stages.includes(stage)) next.completed_stages.push(stage);
  next.current_stage = nextStage;
  next.stage_status = nextStage === 'S6_FINAL_DELIVERY' ? 'completed' : 'in_progress';
  next.recovery_context.last_stable_stage = stage;
  return next;
}

function serialize(state) {
  validateIdentity(state);
  return JSON.stringify(state);
}

function parse(serialized) {
  const state = JSON.parse(serialized);
  validateIdentity(state);
  return state;
}

module.exports = {
  COMPLETED_STAGES,
  createState,
  validateIdentity,
  resume,
  pause,
  changeTarget,
  rollback,
  completeStage,
  serialize,
  parse,
};
