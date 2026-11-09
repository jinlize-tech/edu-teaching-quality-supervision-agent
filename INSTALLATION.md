# 安装说明

1. 解压`edu-teaching-quality-supervision-agent-v1.0.1.zip`。
2. 保留根目录`edu-teaching-quality-supervision-agent/`及内部相对路径。
3. 使用平台Agent导入功能加载插件目录，并保留`.codebuddy-plugin/`、`agents/`、`skills/`和`avatars/`的相对结构。
4. 根据`contract/input.schema.json`准备自己的`input.json`。
5. 运行`node scripts/validate_input.js input.json`检查输入。
6. 完成任务后保存`output.json`，运行`node scripts/validate_output.js output.json`检查成果。

安装包不包含仓库中的`examples/`、`tests/`或`test-results/`。WorkBuddy真实安装和审核尚未执行，不得在平台验证前标记已上架。
