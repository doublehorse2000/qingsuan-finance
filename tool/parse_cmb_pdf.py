#!/usr/bin/env python3
"""Parse a China Merchants Bank transaction statement PDF into CSV.

The parser targets the text-based statement exported by CMB's web banking.
It keeps the bank-specific fields in addition to the first seven columns used
by QingSuan's transaction CSV export, so a later import step can reuse the
normalized output without losing source details.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import pdfplumber


DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
AMOUNT_RE = re.compile(r"^[+-]?[\d,]+\.\d{2}$")
CURRENCY_RE = re.compile(r"^[A-Z]{3}$")
EXPENSE_CATEGORIES = ("餐饮", "居住", "交通", "购物", "健康", "学习", "娱乐", "人情", "其他")
INCOME_CATEGORIES = ("工资", "奖金", "投资收益", "副业", "其他收入")
DEFAULT_LLM_URLS = {
    "ollama": "http://127.0.0.1:11434/api/chat",
    "openai": "http://127.0.0.1:8080/v1/chat/completions",
}
CLASSIFY_BATCH_SIZE = 20

# These x coordinates are stable in the CMB statement layout and let us
# separate the columns even when the counterparty wraps to another line.
DATE_X_MAX = 90
CURRENCY_X_MIN, CURRENCY_X_MAX = 90, 145
AMOUNT_X_MIN, AMOUNT_X_MAX = 145, 225
BALANCE_X_MIN, BALANCE_X_MAX = 225, 305
SUMMARY_X_MIN, SUMMARY_X_MAX = 300, 417
COUNTERPARTY_X_MIN = 400


@dataclass(frozen=True)
class ParsedTransaction:
    date: str
    currency: str
    signed_amount: float
    balance: float
    summary: str
    counterparty: str
    page: int


def _number(value: str) -> float:
    return float(value.replace(",", ""))


def _text(words: list[dict]) -> str:
    return "".join(word["text"] for word in words).strip()


def _transaction_starts(words: list[dict]) -> list[dict]:
    return [
        word
        for word in words
        if word["x0"] <= DATE_X_MAX and DATE_RE.fullmatch(word["text"])
    ]


def _words_between(words: list[dict], top: float, next_top: float) -> list[dict]:
    # A small tolerance accounts for the text layer's fractional coordinates.
    return [word for word in words if top - 0.5 <= word["top"] < next_top - 0.5]


def _counterparty_words(words: list[dict], starts: list[dict], index: int) -> list[dict]:
    """Assign wrapped counterparty lines to their nearest transaction row.

    CMB vertically centers a two-line counterparty around the date row, so the
    first line can appear slightly above the date and the second slightly
    below it. A simple interval between date rows would attach the first line
    to the previous transaction; nearest-row assignment handles both cases.
    """
    start_top = starts[0]["top"]
    next_top = starts[index + 1]["top"] if index + 1 < len(starts) else float("inf")
    target_top = starts[index]["top"]
    candidates = [
        word
        for word in words
        if word["x0"] >= COUNTERPARTY_X_MIN
        and word["top"] >= start_top - 1
        and word["top"] < next_top + 12
    ]
    return [
        word
        for word in candidates
        if min(range(len(starts)), key=lambda row: abs(starts[row]["top"] - word["top"])) == index
        and abs(word["top"] - target_top) <= 22
    ]


def _parse_page(page: pdfplumber.page.Page, page_number: int) -> list[ParsedTransaction]:
    words = page.extract_words(x_tolerance=2, y_tolerance=3, keep_blank_chars=False)
    starts = _transaction_starts(words)
    transactions: list[ParsedTransaction] = []

    for index, start in enumerate(starts):
        next_top = starts[index + 1]["top"] if index + 1 < len(starts) else page.height
        row_words = _words_between(words, start["top"], next_top)

        currency_words = [
            word
            for word in row_words
            if CURRENCY_X_MIN <= word["x0"] < CURRENCY_X_MAX and CURRENCY_RE.fullmatch(word["text"])
        ]
        amount_words = [
            word
            for word in row_words
            if AMOUNT_X_MIN <= word["x0"] < AMOUNT_X_MAX and AMOUNT_RE.fullmatch(word["text"])
        ]
        balance_words = [
            word
            for word in row_words
            if BALANCE_X_MIN <= word["x0"] < BALANCE_X_MAX and AMOUNT_RE.fullmatch(word["text"])
        ]
        summary_words = [
            word
            for word in row_words
            if SUMMARY_X_MIN <= word["x0"] < SUMMARY_X_MAX and word["top"] < start["top"] + 12
        ]
        counterparty_words = _counterparty_words(words, starts, index)
        counterparty_words.sort(key=lambda word: (word["top"], word["x0"]))

        if not currency_words or not amount_words or not balance_words or not summary_words:
            raise ValueError(
                f"第 {page_number} 页的交易行无法解析：{start['text']}（位置 {start['top']:.2f}）"
            )

        transactions.append(
            ParsedTransaction(
                date=start["text"],
                currency=currency_words[0]["text"],
                signed_amount=_number(amount_words[0]["text"]),
                balance=_number(balance_words[0]["text"]),
                summary=_text(summary_words),
                counterparty=_text(counterparty_words),
                page=page_number,
            )
        )

    return transactions


def parse_pdf(path: Path) -> list[ParsedTransaction]:
    """Extract all transactions from a text-based CMB statement PDF."""
    with pdfplumber.open(path) as pdf:
        transactions = [
            transaction
            for page_number, page in enumerate(pdf.pages, start=1)
            for transaction in _parse_page(page, page_number)
        ]

    if not transactions:
        raise ValueError("PDF 中没有识别到交易记录。请确认文件是招商银行交易流水导出的文本型 PDF。")
    return transactions


def _account_label(path: Path) -> str:
    # The masked account number is intentionally kept as shown in the PDF.
    try:
        with pdfplumber.open(path) as pdf:
            first_page = pdf.pages[0].extract_text() or ""
        match = re.search(r"账号：([^\s]+)", first_page)
        if match:
            return f"招商银行（{match.group(1)}）"
    except (OSError, IndexError):
        pass
    return f"招商银行（{path.stem}）"


def _classification_key(transaction: ParsedTransaction) -> tuple[str, str, str, str]:
    return (
        "收入" if transaction.signed_amount >= 0 else "支出",
        transaction.currency,
        transaction.summary,
        transaction.counterparty,
    )


def _request_categories(
    batch: list[dict], provider: str, url: str, model: str, timeout: float
) -> dict[int, str]:
    system_prompt = (
        "你是个人银行流水分类器。只返回 JSON 对象，格式为 "
        '{"items":[{"id":0,"category":"餐饮"}]}。'
        "每条输入必须有且仅有一个对应 id。只根据交易摘要、交易对象、收支方向、币种和金额判断。"
        "支出只能从以下分类选择：" + "、".join(EXPENSE_CATEGORIES) + "。"
        "收入只能从以下分类选择：" + "、".join(INCOME_CATEGORIES) + "。"
        "基金申购、转账和换汇等资金内部流转不等于消费或收入；"
        "受限于现有分类，支出归为其他，收入归为其他收入。"
        "无法确定时，支出选其他，收入选其他收入。不要修改交易类型或金额。"
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps(batch, ensure_ascii=False)},
    ]
    if provider == "ollama":
        payload = {"model": model, "messages": messages, "stream": False, "format": "json", "options": {"temperature": 0}}
    else:
        payload = {"model": model, "messages": messages, "temperature": 0, "response_format": {"type": "json_object"}}
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = json.load(response)
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
        raise ValueError(f"本地模型请求失败（{url}）：{error}") from error

    try:
        content = body["message"]["content"] if provider == "ollama" else body["choices"][0]["message"]["content"]
        result = json.loads(content)
        items = result["items"]
        if not isinstance(items, list):
            raise TypeError("items 不是数组")
        categories: dict[int, str] = {}
        expected = {item["id"]: item["type"] for item in batch}
        for item in items:
            index, category = item["id"], item["category"]
            allowed = INCOME_CATEGORIES if expected[index] == "收入" else EXPENSE_CATEGORIES
            if index in categories or category not in allowed:
                raise ValueError(f"id={index} 的分类无效：{category}")
            categories[index] = category
        if categories.keys() != expected.keys():
            raise ValueError("分类数量或 id 与请求不一致")
        return categories
    except (KeyError, IndexError, TypeError, ValueError) as error:
        raise ValueError(f"本地模型返回的分类无效：{error}") from error


def classify_transactions(
    transactions: list[ParsedTransaction], provider: str, url: str, model: str, timeout: float,
    request_categories: Callable[[list[dict], str, str, str, float], dict[int, str]] = _request_categories,
) -> list[str]:
    """Classify repeated transaction signatures once, preserving input row order."""
    samples: dict[tuple[str, str, str, str], ParsedTransaction] = {}
    for transaction in transactions:
        samples.setdefault(_classification_key(transaction), transaction)
    keys = list(samples)
    categories: dict[tuple[str, str, str, str], str] = {}
    for offset in range(0, len(keys), CLASSIFY_BATCH_SIZE):
        batch_keys = keys[offset:offset + CLASSIFY_BATCH_SIZE]
        batch = [
            {"id": index, "type": key[0], "currency": key[1], "summary": key[2],
             "counterparty": key[3], "amount": abs(samples[key].signed_amount)}
            for index, key in enumerate(batch_keys)
        ]
        result = request_categories(batch, provider, url, model, timeout)
        categories.update({key: result[index] for index, key in enumerate(batch_keys)})
    return [categories[_classification_key(transaction)] for transaction in transactions]


def write_csv(transactions: list[ParsedTransaction], output: Path, account: str, categories: list[str] | None = None) -> None:
    """Write QingSuan-compatible columns followed by preserved source fields."""
    if categories is not None and len(categories) != len(transactions):
        raise ValueError("分类数量与交易数量不一致")
    output.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "日期",
        "类型",
        "金额",
        "分类",
        "账户",
        "交易对象",
        "备注",
        "币种",
        "原始交易金额",
        "联机余额",
        "交易摘要",
        "对手信息",
        "来源页",
    ]

    with output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for index, transaction in enumerate(transactions):
            transaction_type = "收入" if transaction.signed_amount >= 0 else "支出"
            merchant = transaction.counterparty or transaction.summary
            writer.writerow(
                {
                    "日期": transaction.date,
                    "类型": transaction_type,
                    "金额": f"{abs(transaction.signed_amount):.2f}",
                    "分类": categories[index] if categories is not None else "待分类",
                    "账户": account,
                    "交易对象": merchant,
                    "备注": f"银行摘要：{transaction.summary}；币种：{transaction.currency}；余额：{transaction.balance:.2f}",
                    "币种": transaction.currency,
                    "原始交易金额": f"{transaction.signed_amount:.2f}",
                    "联机余额": f"{transaction.balance:.2f}",
                    "交易摘要": transaction.summary,
                    "对手信息": transaction.counterparty,
                    "来源页": transaction.page,
                }
            )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="将招商银行交易流水 PDF 转为清算可用的 CSV")
    parser.add_argument("pdf", type=Path, help="输入 PDF 文件")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="输出 CSV 文件（默认写入 tool/output，与输入文件同名）",
    )
    parser.add_argument("--account", help="覆盖 CSV 中的账户名称")
    parser.add_argument("--classify", action="store_true", help="调用本地模型填充分类列")
    parser.add_argument("--llm-provider", choices=DEFAULT_LLM_URLS, default="ollama", help="本地模型接口类型（默认 ollama）")
    parser.add_argument("--llm-model", help="本地模型名称，使用 --classify 时必填")
    parser.add_argument("--llm-url", help="完整的本地 API 地址，默认使用所选接口的回环地址")
    parser.add_argument("--llm-timeout", type=float, default=120, help="每批请求超时秒数（默认 120）")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.classify and not args.llm_model:
        parser.error("使用 --classify 时必须指定 --llm-model")
    if args.llm_timeout <= 0:
        parser.error("--llm-timeout 必须大于 0")
    source = args.pdf.expanduser().resolve()
    if not source.is_file():
        print(f"找不到输入文件：{source}", file=sys.stderr)
        return 2

    output = args.output or Path(__file__).resolve().parent / "output" / f"{source.stem}.csv"
    try:
        transactions = parse_pdf(source)
        categories = None
        if args.classify:
            categories = classify_transactions(
                transactions, args.llm_provider, args.llm_url or DEFAULT_LLM_URLS[args.llm_provider],
                args.llm_model, args.llm_timeout,
            )
        write_csv(transactions, output, args.account or _account_label(source), categories)
    except (OSError, ValueError) as error:
        print(f"解析失败：{error}", file=sys.stderr)
        return 1

    print(f"已解析 {len(transactions)} 笔交易")
    if categories is not None:
        print(f"本地模型已分类 {len(categories)} 笔交易")
    print(f"CSV：{output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
