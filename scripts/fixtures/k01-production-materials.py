"""Build original synthetic K01 upload fixtures locally; never contacts a service."""
import hashlib
import json
from pathlib import Path
import sys

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


def build(directory, font_file):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    pdfmetrics.registerFont(TTFont("SyntheticChinese", str(font_file)))
    records = []
    for role in ("admin", "owner"):
        title = "资料问答流程说明（原创合成）· " + role
        lines = [
            title,
            "本材料为原创合成软件验收样例，不是真实研究证据。",
            "资料流程：保存原始材料，核对来源，人工审核，再进行资料问答。",
            "回答应逐条标明依据；资料没有提供的信息应明确说明缺失。",
            "本材料未报告样本量、疗效、统计检验、临床阈值或诊断结论。",
            "撤回审核或失去访问权限后，不得继续使用原材料生成回答。",
        ]
        md = directory / (role + "-guide.md")
        md.write_text("# " + lines[0] + "\n\n" + "\n\n".join(lines[1:]) + "\n", encoding="utf-8")
        pdf = directory / (role + "-guide.pdf")
        page = canvas.Canvas(str(pdf), pagesize=(595, 842), invariant=1)
        page.setTitle(title)
        page.setAuthor("ResearchHub synthetic fixture")
        page.setFont("SyntheticChinese", 12)
        for index, line in enumerate(lines):
            page.drawString(40, 790 - index * 30, line)
        page.showPage()
        page.save()
        for artifact in (md, pdf):
            raw = artifact.read_bytes()
            records.append({"file": artifact.name, "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw), "role": role, "synthetic": True})
    (directory / "manifest.json").write_text(json.dumps({"schema": "k01-production-fixtures.v1", "files": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return records


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python3 k01-production-materials.py OUTPUT_DIRECTORY CHINESE_TTF_FILE")
    print(json.dumps({"files": build(sys.argv[1], sys.argv[2]), "modelCalls": 0, "databaseWrites": 0}, ensure_ascii=False))
