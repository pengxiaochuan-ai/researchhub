"""Read a saved ChiCTR MIME message from stdin; emit selected table cells only."""
import json
import sys
from email import policy
from email.parser import BytesParser
from html.parser import HTMLParser


class Tables(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables, self.open_tables, self.rows, self.open_rows, self.cells = [], [], [], [], []
        self.ignored = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.ignored += 1
        if tag == "table":
            if self.cells:
                self.cells[-1]["nested"] = True
            table = {"index": len(self.tables) + 1, "row_count": 0}
            self.tables.append(table)
            self.open_tables.append(table)
        elif tag == "tr" and self.open_tables:
            table = self.open_tables[-1]
            table["row_count"] += 1
            self.open_rows.append({"table": table["index"], "index": table["row_count"], "cells": []})
        elif tag in ("td", "th") and self.open_rows:
            line, column = self.getpos()
            self.cells.append({"owner": self.open_rows[-1], "text": [], "nested": False,
                               "line": line, "column": column + 1})
        elif tag in ("br", "p", "div") and self.cells:
            self.cells[-1]["text"].append("\n")

    def handle_data(self, data):
        if self.cells and not self.ignored:
            self.cells[-1]["text"].append(data)

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.ignored = max(0, self.ignored - 1)
        elif tag in ("td", "th") and self.cells:
            cell = self.cells.pop()
            cell["value"] = " ".join("".join(cell.pop("text")).split())
            cell.pop("owner")["cells"].append(cell)
        elif tag == "tr" and self.open_rows:
            self.rows.append(self.open_rows.pop())
        elif tag == "table" and self.open_tables:
            self.open_tables.pop()


def label(text):
    return text.strip().rstrip("：:").strip()


def extract(raw, source_url, registration_number, include_registration=False):
    if not raw or len(raw) > 8 * 1024 * 1024:
        raise ValueError("REGISTRY_MIME_SIZE_REJECTED")
    message = BytesParser(policy=policy.default).parsebytes(raw)
    if message.get_content_type() != "multipart/related" or message.get("Snapshot-Content-Location") != source_url:
        raise ValueError("REGISTRY_MIME_SOURCE_REJECTED")
    parts = [part for part in message.walk() if part.get_content_type() == "text/html"
             and part.get("Content-Location") == source_url]
    if len(parts) != 1:
        raise ValueError("REGISTRY_MIME_ROOT_REJECTED")
    html = parts[0].get_payload(decode=True).decode("utf-8", errors="strict")
    parser = Tables()
    parser.feed(html)
    parser.close()
    if parser.cells or parser.open_rows or parser.open_tables:
        raise ValueError("REGISTRY_HTML_UNBALANCED")
    rows = [row for row in parser.rows if row["cells"] and not any(cell["nested"] for cell in row["cells"])]
    if not any(registration_number == cell["value"] for row in rows for cell in row["cells"]):
        raise ValueError("REGISTRY_ID_MISMATCH")

    def matching(name, table=None, prefix=False):
        return [row for row in rows if (table is None or row["table"] == table)
                and (label(row["cells"][0]["value"]).startswith(name) if prefix
                     else label(row["cells"][0]["value"]) == name)]

    def one(name, table=None, prefix=False):
        selected = matching(name, table, prefix)
        if len(selected) != 1:
            raise ValueError("REGISTRY_LABEL_AMBIGUOUS_OR_MISSING:" + name)
        return selected[0]

    def field(row, name, key, value_index=1, label_index=0):
        if len(row["cells"]) <= value_index:
            raise ValueError("REGISTRY_CELL_MISSING:" + key)
        cell = row["cells"][value_index]
        value = cell["value"]
        if len(value) > 12000:
            raise ValueError("REGISTRY_FIELD_TOO_LONG")
        return {"key": key, "label": name, "value": value,
                "status": "reported" if value else "not_reported",
                "source": {"tableIndex": row["table"], "rowIndex": row["index"],
                           "cellIndex": value_index + 1, "line": cell["line"], "column": cell["column"],
                           "sourceLabel": row["cells"][label_index]["value"], "quote": value}}

    design = [field(one(source, prefix=prefix), display, key) for key, display, source, prefix in [
        ("studyType", "研究类型", "研究类型", False),
        ("phase", "研究阶段", "研究所处阶段", False),
        ("design", "研究设计", "研究设计", False),
        ("objective", "研究目的", "研究目的", False),
        ("randomization", "随机方法", "随机方法", True),
        ("blinding", "盲法", "盲法", False),
        ("protocol", "治疗方案详述", "药物成份或治疗方案详述", False),
    ]]
    arms = []
    for index, row in enumerate(matching("组别"), 1):
        if len(row["cells"]) != 4 or label(row["cells"][2]["value"]) != "样本量":
            raise ValueError("REGISTRY_ARM_SHAPE_REJECTED")
        arms.append({"id": "arm-" + str(index), "name": field(row, "组别", "name"),
                     "sampleSize": field(row, "原登记样本量", "sampleSize", 3, 2),
                     "intervention": field(one("干预措施", row["table"]), "干预措施", "intervention")})
    outcomes = []
    for index, row in enumerate(matching("指标中文名"), 1):
        if len(row["cells"]) != 4 or label(row["cells"][2]["value"]) != "指标类型":
            raise ValueError("REGISTRY_OUTCOME_SHAPE_REJECTED")
        measurement = one("测量时间点", row["table"])
        if len(measurement["cells"]) != 4 or label(measurement["cells"][2]["value"]) != "测量方法":
            raise ValueError("REGISTRY_MEASUREMENT_SHAPE_REJECTED")
        outcomes.append({"id": "outcome-" + str(index), "name": field(row, "登记结局", "name"),
                         "englishName": field(one("Outcome", row["table"]), "结局英文原文", "englishName"),
                         "type": field(row, "原始指标类型", "type", 3, 2),
                         "timepoint": field(measurement, "测量时间点", "timepoint"),
                         "method": field(measurement, "测量方法", "method", 3, 2)})
    if not 1 <= len(arms) <= 12 or not 1 <= len(outcomes) <= 60:
        raise ValueError("REGISTRY_SECTION_SIZE_REJECTED")
    result = {"schemaVersion": 1, "extractorVersion": "chictr-mhtml-v1", "registrationNumber": registration_number,
              "sourceUrl": source_url, "snapshotDate": message.get("Date"),
              "design": design, "arms": arms, "outcomes": outcomes}
    if include_registration:
        result["schemaVersion"] = 2
        result["registration"] = [
            field(one("注册时间", prefix=True), "注册日期", "registeredOn"),
            field(one("研究实施负责（组长）单位"), "实施负责单位", "leadInstitution"),
            field(one("注册号状态"), "注册号状态", "registrationStatus"),
        ]
    return result


if __name__ == "__main__":
    try:
        result = extract(sys.stdin.buffer.read(8 * 1024 * 1024 + 1), sys.argv[1], sys.argv[2],
                         len(sys.argv) == 4 and sys.argv[3] == "--registration")
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
