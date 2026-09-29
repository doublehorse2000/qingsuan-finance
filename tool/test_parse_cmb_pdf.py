import csv
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tool.parse_cmb_pdf import (
    ParsedTransaction,
    _request_categories,
    classify_transactions,
    parse_pdf,
    write_csv,
)


class ClassificationTests(unittest.TestCase):
    def setUp(self):
        self.expense = ParsedTransaction("2026-07-01", "CNY", -18.5, 100, "快捷支付", "餐厅", 1)
        self.income = ParsedTransaction("2026-07-02", "CNY", 100, 200, "工资入账", "公司", 1)

    def test_reuses_category_for_repeated_transaction_signature(self):
        calls = []

        def classify(batch, provider, url, model, timeout):
            calls.append(batch)
            return {item["id"]: "餐饮" if item["type"] == "支出" else "工资" for item in batch}

        rows = [self.expense, self.income, self.expense]
        self.assertEqual(
            classify_transactions(rows, "ollama", "http://127.0.0.1:11434/api/chat", "llama3", 120, classify),
            ["餐饮", "工资", "餐饮"],
        )
        self.assertEqual(len(calls), 1)
        self.assertEqual(len(calls[0]), 2)

    def test_user_confirmed_fund_sales_rule_bypasses_model(self):
        fund_purchase = ParsedTransaction(
            "2026-07-01", "CNY", -10, 100, "快捷支付", "蚂蚁（杭州）基金销售有限公司", 1
        )

        def should_not_be_called(*_args):
            raise AssertionError("基金销售规则应在调用模型前生效")

        self.assertEqual(
            classify_transactions(
                [fund_purchase], "ollama", "http://127.0.0.1/test", "llama3", 10, should_not_be_called
            ),
            ["投资支出"],
        )

    def test_accepts_local_model_response_formats(self):
        batch = [{"id": 0, "type": "支出", "summary": "快捷支付", "counterparty": "餐厅", "currency": "CNY", "amount": 18.5}]
        for provider in ("ollama", "openai"):
            with self.subTest(provider=provider):
                response = {"items": [{"id": 0, "category": "餐饮"}]}
                body = ({"message": {"content": json.dumps(response)}} if provider == "ollama"
                        else {"choices": [{"message": {"content": json.dumps(response)}}]})
                with patch("urllib.request.urlopen", return_value=io.BytesIO(json.dumps(body).encode())) as urlopen:
                    self.assertEqual(_request_categories(batch, provider, "http://127.0.0.1/test", "llama3", 10), {0: "餐饮"})
                    request = urlopen.call_args.args[0]
                    sent = json.loads(request.data)
                    self.assertEqual(sent["model"], "llama3")
                    self.assertEqual(json.loads(sent["messages"][1]["content"]), batch)

    def test_accepts_investment_expense_category(self):
        batch = [{"id": 0, "type": "支出", "summary": "基金申购"}]
        body = {"message": {"content": json.dumps({"items": [{"id": 0, "category": "投资支出"}]})}}
        with patch("urllib.request.urlopen", return_value=io.BytesIO(json.dumps(body).encode())):
            self.assertEqual(
                _request_categories(batch, "ollama", "http://127.0.0.1/test", "llama3", 10),
                {0: "投资支出"},
            )

    def test_sends_optional_api_key_as_bearer_header(self):
        batch = [{"id": 0, "type": "支出"}]
        body = {"message": {"content": json.dumps({"items": [{"id": 0, "category": "其他"}]})}}
        with patch.dict("os.environ", {"QINGSUAN_LLM_API_KEY": "test-key"}), patch("urllib.request.urlopen", return_value=io.BytesIO(json.dumps(body).encode())) as urlopen:
            _request_categories(batch, "ollama", "http://127.0.0.1/test", "llama3", 10)
            request = urlopen.call_args.args[0]
            self.assertEqual(request.get_header("Authorization"), "Bearer test-key")

    def test_rejects_invalid_category(self):
        batch = [{"id": 0, "type": "支出"}]
        body = {"message": {"content": json.dumps({"items": [{"id": 0, "category": "工资"}]})}}
        with patch("urllib.request.urlopen", return_value=io.BytesIO(json.dumps(body).encode())):
            self.assertEqual(
                _request_categories(batch, "ollama", "http://127.0.0.1/test", "llama3", 10),
                {0: "其他"},
            )

    def test_rejects_category_outside_both_direction_lists(self):
        batch = [{"id": 0, "type": "支出"}]
        body = {"message": {"content": json.dumps({"items": [{"id": 0, "category": "未知分类"}]})}}
        with patch("urllib.request.urlopen", return_value=io.BytesIO(json.dumps(body).encode())):
            with self.assertRaisesRegex(ValueError, "分类无效"):
                _request_categories(batch, "ollama", "http://127.0.0.1/test", "llama3", 10)

    def test_csv_uses_categories_without_changing_source_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "transactions.csv"
            write_csv([self.expense, self.income], output, "测试账户", ["餐饮", "工资"])
            with output.open(encoding="utf-8-sig", newline="") as handle:
                rows = list(csv.DictReader(handle))
            self.assertEqual([row["分类"] for row in rows], ["餐饮", "工资"])
            self.assertEqual(rows[0]["原始交易金额"], "-18.50")
            self.assertEqual(rows[1]["金额"], "100.00")

    def test_sample_pdf_still_parses(self):
        sample = Path(__file__).resolve().parents[1] / "example" / "招商银行交易流水.pdf"
        if sample.exists():
            self.assertGreater(len(parse_pdf(sample)), 0)


if __name__ == "__main__":
    unittest.main()
