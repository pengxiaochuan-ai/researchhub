"""Read-only XLSX extraction for ResearchHub source preflight. No workbook is saved."""

import json
import sys
from datetime import date, datetime

from openpyxl import load_workbook


def scalar(value):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def main():
    if len(sys.argv) != 3:
        raise SystemExit("HUB_SOURCE_XLSX_ARGUMENTS")
    workbook = load_workbook(sys.argv[1], read_only=True, data_only=True)
    sheet_name = sys.argv[2]
    sheets = [
        {"name": sheet.title, "maxRow": sheet.max_row, "maxColumn": sheet.max_column}
        for sheet in workbook.worksheets
    ]
    if sheet_name not in workbook.sheetnames:
        raise SystemExit("HUB_SOURCE_SHEET_NOT_FOUND")
    sheet = workbook[sheet_name]
    iterator = sheet.iter_rows(values_only=True)
    header = [str(value).strip() if value is not None else "" for value in next(iterator)]
    if not header or len(set(header)) != len(header) or not all(header):
        raise SystemExit("HUB_SOURCE_HEADER_REJECTED")
    rows = []
    for row_number, values in enumerate(iterator, 2):
        raw = {header[index]: scalar(values[index]) if index < len(values) else None
               for index in range(len(header))}
        rows.append({"rowNumber": row_number, "raw": raw})
    json.dump({"sheets": sheets, "rows": rows}, sys.stdout, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
