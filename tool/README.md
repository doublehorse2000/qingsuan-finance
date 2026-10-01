# PDF 流水转 CSV

`parse_cmb_pdf.py` 将招商银行文本型交易流水 PDF 转换为 CSV。输出 CSV 前 7 列为清算流水字段，后面保留银行原始字段。可选用本地 Llama 模型填写 `分类`。

## 创建 Conda 环境

```bash
conda env create -f tool/environment.yml
conda activate qingsuan-pdf
```

已有同名环境时，可以直接安装依赖：

```bash
conda activate qingsuan-pdf
python -m pip install -r tool/requirements.txt
```

## 运行

在项目根目录执行：

```bash
conda run -n qingsuan-pdf python tool/parse_cmb_pdf.py example/招商银行交易流水.pdf
```

默认输出到 `tool/output/招商银行交易流水.csv`，也可以指定路径：

```bash
conda run -n qingsuan-pdf python tool/parse_cmb_pdf.py \
  example/招商银行交易流水.pdf \
  --output tool/output/july-2026.csv \
  --account "招商银行主账户"
```

## 本地模型分类

使用 Ollama 时，先确认本地服务已启动、模型已下载，然后运行：

```bash
conda run -n qingsuan-pdf python tool/parse_cmb_pdf.py \
  example/招商银行交易流水.pdf \
  --classify --llm-model llama3.2
```

默认调用 `http://127.0.0.1:11434/api/chat`。如果模型部署在其他地址，传入完整接口 URL：

```bash
conda run -n qingsuan-pdf python tool/parse_cmb_pdf.py \
  example/招商银行交易流水.pdf \
  --classify --llm-model llama3.2 \
  --llm-url http://127.0.0.1:11434/api/chat
```

如果使用 llama.cpp 等 OpenAI 兼容服务：

```bash
conda run -n qingsuan-pdf python tool/parse_cmb_pdf.py \
  example/招商银行交易流水.pdf \
  --classify --llm-provider openai --llm-model local-llama \
  --llm-url http://127.0.0.1:8080/v1/chat/completions
```

需要鉴权的 OpenAI 兼容服务可在运行前设置 API 密钥，程序会发送 `Authorization: Bearer ...`：

```bash
QINGSUAN_LLM_API_KEY='你的密钥' conda run -n qingsuan-pdf python tool/parse_cmb_pdf.py \
  example/招商银行交易流水.pdf --classify --llm-provider openai \
  --llm-model local-llama --llm-url https://api.example.com/v1/chat/completions
```

程序按交易类型、币种、摘要和交易对象对重复交易去重，分批提交给本地模型。支出分类包括 `餐饮`、`居住`、`交通`、`购物`、`健康`、`学习`、`娱乐`、`人情`、`投资支出`、`其他`；收入分类包括 `工资`、`奖金`、`投资收益`、`副业`、`其他收入`。基金申购、股票或债券买入、证券账户入金等投资用途的支出归为 `投资支出`。已确认的规则是：支出对手信息包含 `基金销售` 时，直接归为 `投资支出`，不交给模型猜测。无法判断时使用 `其他` 或 `其他收入`。如果小模型返回分类名后附带多余的 JSON 结构符号，程序会清除这些符号并重新校验分类；返回相反收支方向的分类时，程序会改用对应方向的兜底分类。模型服务不可用或返回其他非法分类时，程序报错并且不写入 CSV。不传 `--classify` 时仍输出 `待分类`。

金额保留 PDF 中的原始币种，不做汇率换算。正数流水为收入，负数流水为支出，金额列输出绝对值，原始带符号金额保存在 `原始交易金额`。换汇、普通转账等资金流转仍保留银行的收支方向，并在现有分类体系中归入 `其他` 或 `其他收入`；`投资支出` 会计入支出和储蓄率，因此建议在复盘时与日常消费分开观察。

运行测试：`PYTHONPYCACHEPREFIX=/tmp/qingsuan-pycache python3 -m unittest tool.test_parse_cmb_pdf`

## 构建不依赖 Python 的桌面安装包

桌面安装包使用 PyInstaller 把解析器和 Python 依赖编译成单个可执行文件。构建机只需安装一次构建依赖：

```bash
python3 -m pip install -r tool/requirements-build.txt
npm run package:desktop
```

安装后的“导入流水”不再查找 `conda`。解析器按 `darwin-arm64`、`darwin-x64`、`win32-x64` 或 `linux-x64` 放入应用资源目录；跨架构 macOS 包应在对应架构机器上分别构建。
