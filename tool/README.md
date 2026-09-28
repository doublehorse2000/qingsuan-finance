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

程序按交易类型、币种、摘要和交易对象对重复交易去重，分批提交给本地模型。分类只使用清算现有的收入、支出分类，无法判断时使用 `其他` 或 `其他收入`。模型服务不可用或返回非法分类时，程序报错并且不写入 CSV；不传 `--classify` 时仍输出 `待分类`。

金额保留 PDF 中的原始币种，不做汇率换算。正数流水为收入，负数流水为支出，金额列输出绝对值，原始带符号金额保存在 `原始交易金额`。基金申购、换汇、转账等资金流转目前仍保留银行的收支方向，在现有分类体系中归入 `其他` 或 `其他收入`，不应直接当作真实消费或收入汇总。

运行测试：`PYTHONPYCACHEPREFIX=/tmp/qingsuan-pycache python3 -m unittest tool.test_parse_cmb_pdf`
