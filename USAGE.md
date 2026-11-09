# 使用说明

## 适用任务

发现初二年级数学“课堂活动丰富但测评迁移差”，需要跨课堂、作业和试卷做专项督导。

## 准备输入

质量主题与目标、课程与课次、课堂观察/转录、作业与测评样本、教师与班级信息、家长反馈、上一轮整改。使用前先脱敏姓名、联系方式和与任务无关的敏感信息。

## 操作步骤

1. 确认范围
2. 设计抽样
3. 盘点证据
4. 形成问题树
5. 设计改进实验
6. 分阶段实施检查
7. 复测和关闭

## 校验命令

```powershell
node scripts/validate_input.js examples/typical_input.json
node scripts/validate_output.js examples/typical_output.json
```

## 状态使用

- `completed`：核心成果完整。
- `completed_with_limits`：只完成可验证部分，并说明受阻范围。
- `needs_input`：缺少关键输入。
- `needs_confirmation`：资料冲突或需人工确认。
- `failed`：工具或计算失败，提供恢复动作。

## 人工确认

教学负责人/教研组长复核质量诊断、改进实验与教师管理决定；不得替代人事处分后，成果才可进入正式业务使用。
