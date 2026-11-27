from __future__ import annotations

import re

# 中文数字统一转成阿拉伯数字，便于“第二十二集”和“第22集”互相匹配。
_DIGITS = {
    "零": 0,
    "〇": 0,
    "一": 1,
    "二": 2,
    "两": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
}
_UNITS = {"十": 10, "百": 100, "千": 1000, "万": 10000}
_SEQUENCE = re.compile(r"[零〇一二三四五六七八九十百千万两]+")


def _parse_chinese_number(text: str) -> int | None:
    if not text:
        return None
    if all(char in _DIGITS for char in text):
        digits = "".join(str(_DIGITS[char]) for char in text)
        return int(digits) if digits else None
    total = 0
    section = 0
    number = 0
    for char in text:
        if char in _DIGITS:
            number = _DIGITS[char]
        elif char in _UNITS:
            unit = _UNITS[char]
            if unit == 10000:
                section = (section + number) * unit
                total += section
                section = 0
            else:
                if number == 0:
                    number = 1
                section += number * unit
            number = 0
        else:
            return None
    return total + section + number


def normalize_numbers(text: str) -> str:
    def replace(match: re.Match[str]) -> str:
        value = _parse_chinese_number(match.group(0))
        return str(value) if value is not None else match.group(0)

    return _SEQUENCE.sub(replace, text)
