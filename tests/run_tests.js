'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const contract = require('../contract/runtime_contract.json');
const { validateInput, validateOutput } = require('../scripts/contract-validator');

const repo = path.resolve(__dirname, '..');
const checks = [];
const failures = [];
const scenarioResults = [];
const calculatorEvidence = [];

function check(layer, name, fn) {
  try {
    const detail = fn();
    checks.push({ layer, name, status: 'PASS', detail: detail || 'ok' });
  } catch (error) {
    const message = error && error.stack ? error.stack : String(error);
    checks.push({ layer, name, status: 'FAIL', detail: message });
    failures.push(`${layer}/${name}: ${message}`);
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(repo, file), 'utf8'));
}

function expectedFiles() {
  const common = [
    'README.md',
    'PRODUCT_SPEC.md',
    'USAGE.md',
    'USER_EXPERIENCE.md',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'VERSION',
    'contract/input.schema.json',
    'contract/output.schema.json',
    'contract/runtime_contract.json',
    'templates/OUTPUT_TEMPLATE.md',
    'references/DOMAIN_GUIDE.md',
    'references/PROFESSIONAL_PLAYBOOK.md',
    'references/EXAMPLES.md',
    'scripts/contract-validator.js',
    'scripts/validate_input.js',
    'scripts/validate_output.js',
    'scripts/prepare_result.js',
    `dist/${contract.repository_name}-v${contract.product_version}.zip`,
  ];
  if (contract.product_type === 'Agent') {
    return common.concat([
      '.codebuddy-plugin/plugin.json',
      `agents/${contract.repository_name}.md`,
      `skills/${contract.repository_name}-core/SKILL.md`,
      `skills/${contract.repository_name}-core/scripts/validate_input.js`,
      'avatars/expert.png',
      'scripts/state_machine.js',
    ]);
  }
  return common.concat(['SKILL.md']);
}

for (const file of expectedFiles()) {
  check('T1_FILE_STRUCTURE', `exists:${file}`, () => {
    assert.ok(fs.existsSync(path.join(repo, file)), `${file} missing`);
    return 'exists';
  });
}

const version = fs.readFileSync(path.join(repo, 'VERSION'), 'utf8').trim();
check('T2_METADATA_CONTRACT', 'version', () => {
  assert.strictEqual(version, '1.0.1');
  assert.strictEqual(contract.product_version, version);
  return version;
});
check('T2_METADATA_CONTRACT', 'contract_version', () => {
  assert.strictEqual(contract.contract_version, '1.2.0');
  return contract.contract_version;
});
check('T2_METADATA_CONTRACT', 'core_outputs', () => {
  assert.ok(contract.core_outputs.length >= 1);
  return contract.core_outputs.join('、');
});

const inputCases = readJson('tests/fixtures/input_cases.json');
for (const item of inputCases.cases) {
  check('T3_INPUT_CONTRACT', `input:${item.case_id}`, () => {
    const result = validateInput(item.instance);
    assert.strictEqual(result.status, item.expected_status);
    return result.status;
  });
}

const outputCases = readJson('tests/fixtures/output_cases.json');
for (const item of outputCases.cases) {
  check('T4_OUTPUT_CONTRACT', `output:${item.case_id}`, () => {
    const result = validateOutput(item.instance);
    assert.strictEqual(result.valid, item.expected_valid, JSON.stringify(result.errors));
    return item.expected_valid ? 'accepted' : `rejected:${result.errors.length}`;
  });
}

if (contract.agent) {
  const stateMachine = require('../scripts/state_machine');
  const agentCases = readJson('tests/fixtures/agent_cases.json');
  for (const item of agentCases) {
    check('T5_AGENT_STATE', `state:${item.case_id}`, () => {
      const state = item.state;
      if (!state) return 'no-state';
      const serialized = stateMachine.serialize(state);
      const parsed = stateMachine.parse(serialized);
      assert.deepStrictEqual(parsed, state);
      if (item.case_id === 'target_change') {
        const changed = stateMachine.changeTarget(
          state,
          'S3_PROFESSIONAL_DIAGNOSIS',
          '目标变化',
          ['S3_PROFESSIONAL_DIAGNOSIS', 'S4_SOLUTION_DESIGN', 'S5_HUMAN_CONFIRMATION', 'S6_FINAL_DELIVERY'],
        );
        assert.ok(changed.confirmed_facts.length > 0);
        assert.strictEqual(changed.change_log.at(-1).event_type, 'target_change');
      }
      if (item.case_id === 'rollback') {
        const rolled = stateMachine.rollback(state, 'S2_EVIDENCE_INVENTORY', '上游证据重做');
        assert.strictEqual(rolled.current_stage, 'S2_EVIDENCE_INVENTORY');
        assert.strictEqual(rolled.human_confirmation.status, 'not_required');
      }
      if (item.case_id === 'pause_resume') {
        const paused = stateMachine.pause(state, '等待输入');
        assert.strictEqual(paused.stage_status, 'paused');
        const resumed = stateMachine.resume(paused);
        assert.strictEqual(resumed.stage_status, 'in_progress');
      }
      return 'roundtrip-and-transition-pass';
    });
  }
}

if (contract.deterministic) {
  const calculator = require('../scripts/calculate');
  const cases = readJson('tests/fixtures/calculator_cases.json');
  for (const item of cases) {
    check('T6_DETERMINISTIC', `calc:${item.case_id}`, () => {
      const actual = calculator.calculate(item.input);
      const evidence = {
        case_id: item.case_id,
        input: item.input,
        expected: item.expected_error ? { error: item.expected_error } : item.expected,
        actual,
        exit_status: actual.ok ? 0 : 2,
        assertion_result: 'FAIL',
      };
      try {
        if (item.expected_error) {
          assert.strictEqual(actual.ok, false);
          assert.strictEqual(actual.error.code, item.expected_error);
        } else {
          assert.strictEqual(actual.ok, true, JSON.stringify(actual));
          for (const [key, expected] of Object.entries(item.expected)) {
            if (typeof expected === 'number' && !Number.isInteger(expected)) {
              assert.ok(Math.abs(actual.result[key] - expected) < 0.01, `${key}: ${actual.result[key]} != ${expected}`);
            } else {
              assert.deepStrictEqual(actual.result[key], expected);
            }
          }
        }
        evidence.exit_status = 0;
        evidence.assertion_result = 'PASS';
        return item.expected_error || 'calculated';
      } catch (error) {
        evidence.exit_status = 1;
        throw error;
      } finally {
        calculatorEvidence.push(evidence);
      }
    });
  }
}

const scenarios = readJson('tests/fixtures/design_scenarios.json');
check('T7_SCENARIO_MAPPING', 'scenario-count', () => {
  assert.strictEqual(scenarios.length, contract.expected_scenario_count);
  return String(scenarios.length);
});
for (const scenario of scenarios) {
  const category = String(scenario.scenario_category || '');
  let automatedPath = 'OUTPUT_SCHEMA_AND_PROMPT_BOUNDARY';
  if (category.includes('缺失') || category.includes('输入')) automatedPath = 'INPUT_VALIDATION';
  else if (category.includes('冲突') || category.includes('确认')) automatedPath = 'CONFIRMATION_CONTRACT';
  else if (category.includes('敏感') || category.includes('隐私')) automatedPath = 'PRIVACY_WARNING_CONTRACT';
  else if (category.includes('Agent') || category.includes('阶段') || category.includes('恢复')) automatedPath = 'AGENT_STATE_CONTRACT';
  else if (category.includes('计算') || category.includes('边界')) automatedPath = 'DETERMINISTIC_CONTRACT';
  else if (category.includes('安装') || category.includes('内部') || category.includes('工具')) automatedPath = 'PACKAGE_AND_SECURITY_CONTRACT';
  scenarioResults.push({
    test_id: scenario.test_id,
    scenario_category: category,
    automated_contract_path: automatedPath,
    contract_mapping_status: 'MAPPED_TO_EXECUTED_CONTRACT_SUITE',
    contract_test_status: 'NOT_INDIVIDUALLY_EXECUTED',
    model_runtime_status: 'MODEL_RUNTIME_NOT_VERIFIED',
  });
}

check('T8_SECURITY', 'no-paid-api', () => {
  const files = fs.readdirSync(path.join(repo, 'scripts')).filter((name) => name.endsWith('.js'));
  const text = files.map((name) => fs.readFileSync(path.join(repo, 'scripts', name), 'utf8')).join('\n');
  assert.ok(!/api\.openai\.com|api\.deepseek\.com|OPENAI_API_KEY|DEEPSEEK_API_KEY/i.test(text));
  return 'no external paid API';
});
check('T8_SECURITY', 'no-brand-in-prompt', () => {
  const promptPath = contract.product_type === 'Skill'
    ? path.join(repo, 'SKILL.md')
    : path.join(repo, 'agents', `${contract.repository_name}.md`);
  const text = fs.readFileSync(promptPath, 'utf8');
  assert.ok(!text.includes('广州金励泽科技服务有限公司'));
  return 'customer-visible prompt has no company promotion';
});
check('T8_SECURITY', 'independent', () => {
  const otherProductIds = fs.readdirSync(path.join(repo, 'contract'))
    .filter((name) => name.endsWith('.json'))
    .map((name) => fs.readFileSync(path.join(repo, 'contract', name), 'utf8'))
    .join('\n')
    .match(/JLZ-EDU-(?:SK|AG)-\d{3}/g) || [];
  assert.deepStrictEqual([...new Set(otherProductIds)], [contract.product_id]);
  return 'self-contained';
});
if (contract.commercial_boundary) {
  check('T8_SECURITY', 'commercial-boundary', () => {
    const promptPath = contract.product_type === 'Skill'
      ? path.join(repo, 'SKILL.md')
      : path.join(repo, 'agents', `${contract.repository_name}.md`);
    const text = fs.readFileSync(promptPath, 'utf8');
    assert.ok(text.includes(contract.commercial_boundary.other_product));
    assert.ok(text.includes(contract.commercial_boundary.forbidden));
    return 'independent commercial boundary retained';
  });
}

const zipPath = path.join(repo, 'dist', `${contract.repository_name}-v${contract.product_version}.zip`);
check('T9_PACKAGE_INTEGRITY', 'zip-sha256', () => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex').toUpperCase();
  const manifestPath = path.join(repo, 'package-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(hash, manifest.sha256);
  return hash;
});

const failed = checks.filter((item) => item.status !== 'PASS');
const result = {
  product_id: contract.product_id,
  product_type: contract.product_type,
  version,
  contract_version: contract.contract_version,
  tested_commit: process.env.TESTED_COMMIT || null,
  tested_tree_sha: process.env.TESTED_TREE_SHA || null,
  tested_at: process.env.TESTED_AT || new Date().toISOString(),
  test_count: checks.length,
  failure_count: failed.length,
  checks,
  scenario_count: scenarios.length,
  scenario_results: scenarioResults,
  calculator_results: calculatorEvidence,
  deterministic: contract.deterministic,
  agent: contract.agent,
  security: {
    external_paid_api: 'NONE',
    customer_brand_promotion: 'FORBIDDEN_AND_SCANNED',
  },
  runtime_status: 'MODEL_RUNTIME_NOT_VERIFIED',
  workbuddy_validation: 'NOT_EXECUTED',
  overall_status: failed.length === 0 ? 'LOCAL_TEST_PASS' : 'LOCAL_TEST_FAIL',
};

fs.mkdirSync(path.join(repo, 'test-results'), { recursive: true });
fs.writeFileSync(path.join(repo, 'test-results', 'v1.0.1.json'), JSON.stringify(result, null, 2) + '\n');
fs.writeFileSync(path.join(repo, 'test-results', 'scenario-execution.json'), JSON.stringify(scenarioResults, null, 2) + '\n');
const report = `# 产品测试报告 v1.0.1

- 产品：${contract.product_name}（${contract.product_id}）
- 本地测试：${result.overall_status}
- 检查项：${result.test_count}
- 既定场景：${result.scenario_count}
- 模型运行：MODEL_RUNTIME_NOT_VERIFIED
- WorkBuddy：NOT_EXECUTED

## 层级统计

${['T1_FILE_STRUCTURE','T2_METADATA_CONTRACT','T3_INPUT_CONTRACT','T4_OUTPUT_CONTRACT','T5_AGENT_STATE','T6_DETERMINISTIC','T7_SCENARIO_MAPPING','T8_SECURITY','T9_PACKAGE_INTEGRITY']
  .map((layer) => {
    const rows = checks.filter((item) => item.layer === layer);
    return rows.length ? `- ${layer}: ${rows.filter((x) => x.status === 'PASS').length}/${rows.length} PASS` : `- ${layer}: NOT_APPLICABLE`;
  }).join('\n')}

## 边界

生成式模型输出未在本地运行；${result.scenario_count}项既定场景已映射到自动化契约路径，但未逐项进行生成式模型运行，也不能冒充WorkBuddy真实模型调用。
`;
fs.writeFileSync(path.join(repo, 'test-results', 'TEST_REPORT-v1.0.1.md'), report);

console.log(JSON.stringify({
  product_id: result.product_id,
  status: result.overall_status,
  tests: result.test_count,
  failures: result.failure_count,
}, null, 2));
if (failed.length) {
  console.error(failed.map((item) => `${item.layer}/${item.name}: ${item.detail}`).join('\n'));
  process.exit(1);
}
