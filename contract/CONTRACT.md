# 输入输出契约

## 输入字段

| 键 | 名称 | 类型 | 必填 |
|---|---|---|---|
| `supervision_scope` | 督导范围 | string | 是 |
| `quality_goals` | 质量目标 | array | 是 |
| `evidence_sources` | 证据来源 | array | 是 |
| `sample_records` | 样本记录 | array | 是 |
| `previous_actions` | 上一轮整改 | array | 否 |
| `reviewer_roles` | 复核角色 | array | 是 |

## 状态

- `completed`：核心成果完整，关键结论人工确认要求满足。
- `completed_with_limits`：至少一项实质成果，说明限制、已完成和受阻范围。
- `needs_input`：必填字段缺失。
- `needs_confirmation`：资料冲突或人工确认未完成。
- `failed`：计算或工具失败。

## 输出

- `专项督导方案`：结构化条目数组，不允许空壳或占位文本。
- `证据样本表`：结构化条目数组，不允许空壳或占位文本。
- `质量诊断`：结构化条目数组，不允许空壳或占位文本。
- `问题优先级`：结构化条目数组，不允许空壳或占位文本。
- `改进实验`：结构化条目数组，不允许空壳或占位文本。
- `责任/时间表`：结构化条目数组，不允许空壳或占位文本。
- `复测标准`：结构化条目数组，不允许空壳或占位文本。
- `升级项`：结构化条目数组，不允许空壳或占位文本。

完整机器契约见`contract/input.schema.json`、`contract/output.schema.json`和`contract/runtime_contract.json`。
