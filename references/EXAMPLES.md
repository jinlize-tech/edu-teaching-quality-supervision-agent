# 教学质量专项督导示例

## 典型场景

发现初二年级数学“课堂活动丰富但测评迁移差”，需要跨课堂、作业和试卷做专项督导。

## 具体示例

Agent 比较课堂对话、作业类型和测评题目，提出增加迁移任务的小规模实验，而不是直接评价教师个人。

## 脱敏输入示例

```json
{
  "contract_version": "1.2.0",
  "data_status": "confirmed",
  "contains_sensitive_data": false,
  "requested_output_language": "zh-CN",
  "supervision_scope": "督导范围已核对（脱敏示例）",
  "quality_goals": [
    {}
  ],
  "evidence_sources": [
    {}
  ],
  "sample_records": [
    {}
  ],
  "previous_actions": [
    {}
  ],
  "reviewer_roles": [
    {}
  ],
  "resume_mode": "new"
}
```

## 预期处理

1. 运行输入契约校验。
2. 逐项核对输入来源、版本和口径。
3. 按`references/PROFESSIONAL_PLAYBOOK.md`完成专业分析。
4. 输出专项督导方案、质量诊断、改进实验等核心成果。
5. 由教学负责人/教研组长确认质量诊断、改进实验与教师管理决定；不得替代人事处分后才可作为正式业务结论。

## 不应出现的输出

- 虚构政策、价格、人员、课程或客户事实。
- 以“暂无”“待完善”等占位文本冒充完成。
- 无依据的确定性判断或伪造人工签批。
