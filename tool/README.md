# PDF 流水转 CSV

`parse_cmb_pdf.py` 将招商银行文本型交易流水 PDF 转换为 CSV。输出 CSV 的前 7 列与清算现有的流水导出格式一致，后面保留银行原始字段，便于后续增加导入和 AI 分类。

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

金额保留 PDF 中的原始币种，不做汇率换算；`分类` 暂时填为 `待分类`。正数流水为收入，负数流水为支出，金额列输出绝对值，原始带符号金额保存在 `原始交易金额`。
