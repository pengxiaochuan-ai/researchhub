"""Local-only literature parser with OCR and bounded MarkItDown conversion."""

from __future__ import annotations

import io
import os
import re
import statistics
import subprocess
import tempfile
import unicodedata
import zipfile
from pathlib import Path
from pathlib import PurePosixPath
from threading import Lock
from typing import Any

import pymupdf as fitz
import pdfplumber
import requests
from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph
from fastapi import FastAPI, File, HTTPException, UploadFile
from markitdown import MarkItDown, StreamInfo

MAX_BYTES = int(os.environ.get("KB_DOC_PARSER_MAX_BYTES", str(100 * 1024 * 1024)))
MAX_PAGES = int(os.environ.get("KB_DOC_PARSER_MAX_PAGES", "1000"))
MAX_OCR_IMAGES_PER_PAGE = int(os.environ.get("KB_DOC_PARSER_MAX_OCR_IMAGES_PER_PAGE", "30"))
MAX_OCR_IMAGES_PER_DOCUMENT = int(
    os.environ.get("KB_DOC_PARSER_MAX_OCR_IMAGES_PER_DOCUMENT", "500")
)
MAX_PDF_LAYOUT_SPANS = int(os.environ.get("KB_DOC_PARSER_MAX_LAYOUT_SPANS", "20000"))
MAX_PDF_LAYOUT_LINES = int(os.environ.get("KB_DOC_PARSER_MAX_LAYOUT_LINES", "2000"))
ALLOWED = {".pdf", ".doc", ".docx", ".pptx", ".html", ".htm", ".epub", ".msg", ".ipynb"}
MARKITDOWN_ALLOWED = {".pptx", ".html", ".htm", ".epub", ".msg", ".ipynb"}
MAX_MARKDOWN_CHARS = int(os.environ.get("KB_DOC_PARSER_MAX_MARKDOWN_CHARS", "5000000"))
MAX_ARCHIVE_ENTRIES = int(os.environ.get("KB_DOC_PARSER_MAX_ARCHIVE_ENTRIES", "5000"))
MAX_ARCHIVE_UNCOMPRESSED_BYTES = int(
    os.environ.get("KB_DOC_PARSER_MAX_ARCHIVE_UNCOMPRESSED_BYTES", str(500 * 1024 * 1024))
)
MAX_ARCHIVE_COMPRESSION_RATIO = int(os.environ.get("KB_DOC_PARSER_MAX_ARCHIVE_RATIO", "200"))
MARKITDOWN_MIMETYPES = {
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".html": "text/html",
    ".htm": "text/html",
    ".epub": "application/epub+zip",
    ".msg": "application/vnd.ms-outlook",
    ".ipynb": "application/x-ipynb+json",
}
OCR_ENGINE = os.environ.get("KB_DOC_PARSER_OCR_ENGINE", "paddle").strip().lower()
TESSERACT_LANG = os.environ.get("KB_DOC_PARSER_TESSERACT_LANG", "chi_sim+eng")
TESSERACT_PSM = os.environ.get("KB_DOC_PARSER_TESSERACT_PSM", "3")
MODEL_ROOT = Path(os.environ.get("PADDLEOCR_HOME", "/opt/paddleocr"))
DET_MODEL_DIR = MODEL_ROOT / "whl/det/ch/ch_PP-OCRv4_det_infer"
REC_MODEL_DIR = MODEL_ROOT / "whl/rec/ch/ch_PP-OCRv4_rec_infer"
CLS_MODEL_DIR = MODEL_ROOT / "whl/cls/ch_ppocr_mobile_v2.0_cls_infer"

app = FastAPI(title="kb-doc-parser", docs_url=None, redoc_url=None)
_ocr: Any | None = None
_ocr_lock = Lock()


class OfflineRequestsSession(requests.Session):
    """Fail closed if a future converter tries to turn document content into a network request."""

    def request(self, method: str, url: str, *args: Any, **kwargs: Any):
        raise RuntimeError("kb-doc-parser 禁止外部网络请求")


def ocr_engine() -> Any:
    global _ocr
    with _ocr_lock:
        if _ocr is None:
            import cv2  # noqa: F401 — Paddle 模式按需加载，避免本地 Tesseract 依赖 OpenCV
            import numpy  # noqa: F401 — 与 PaddleOCR 保持同一延迟加载边界
            from paddleocr import PaddleOCR

            _ocr = PaddleOCR(
                use_angle_cls=True,
                lang="ch",
                show_log=False,
                det_model_dir=str(DET_MODEL_DIR),
                rec_model_dir=str(REC_MODEL_DIR),
                cls_model_dir=str(CLS_MODEL_DIR),
            )
    return _ocr


def ocr_png(data: bytes, *, psm: str | None = None) -> str:
    try:
        if OCR_ENGINE == "tesseract":
            selected_psm = psm or TESSERACT_PSM
            selected_psm = selected_psm if re.fullmatch(r"(?:[1-9]|1[0-3])", selected_psm) else "3"
            with tempfile.NamedTemporaryFile(suffix=".png") as image_file:
                image_file.write(data)
                image_file.flush()
                result = subprocess.run(
                    [
                        "tesseract",
                        str(Path(image_file.name).resolve()),
                        "stdout",
                        "-l",
                        TESSERACT_LANG,
                        "--psm",
                        selected_psm,
                    ],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    timeout=120,
                    check=False,
                )
            return result.stdout.strip() if result.returncode == 0 else ""

        import cv2
        import numpy as np

        image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            return ""
        rows = ocr_engine().ocr(image, cls=True)
        lines: list[str] = []
        for page in rows or []:
            for item in page or []:
                if len(item) >= 2 and item[1]:
                    text = str(item[1][0]).strip()
                    if text:
                        lines.append(text)
        return "\n".join(lines)
    except Exception:
        return ""


def escape_cell(value: object) -> str:
    return str(value or "").replace("|", "\\|").replace("\n", " ").strip()


def markdown_table(rows: list[list[object]]) -> str:
    rows = [row for row in rows if any(str(cell or "").strip() for cell in row)]
    if not rows:
        return ""
    width = min(max(len(row) for row in rows), 50)
    normalized = [[escape_cell(row[index] if index < len(row) else "") for index in range(width)] for row in rows]
    header = normalized[0]
    body = normalized[1:]
    return "\n".join([
        f"| {' | '.join(header)} |",
        f"| {' | '.join('---' for _ in header)} |",
        *(f"| {' | '.join(row)} |" for row in body[:2000]),
    ])


def title_from_markdown(markdown: str) -> str:
    without_comments = re.sub(r"<!--.*?-->", "", markdown, flags=re.DOTALL)
    for raw in without_comments.splitlines():
        line = re.sub(r"^#{1,6}\s+", "", raw).strip(" *_`>|\t")
        extraction_heading = re.fullmatch(
            r"(?:第\s*\d+\s*页|图\s*\d+(?:[-.]\d+)?\s*OCR|表\s*\d+(?:[-.]\d+)?|脚注|插图\s*OCR)",
            line,
            flags=re.IGNORECASE,
        )
        if len(line) >= 2 and not re.fullmatch(r"[-:]+", line) and not extraction_heading:
            return line[:120]
    return "导入文档"


DOI_PATTERN = re.compile(r"\b10\.\d{4,9}/[-._;()/:a-z0-9]+", re.IGNORECASE)


def normalize_doi(value: str | None) -> str | None:
    match = DOI_PATTERN.search(str(value or ""))
    if not match:
        return None
    return match.group(0).rstrip(".,;:，。；：").lower()


def split_authors(value: str | None) -> list[str]:
    authors: list[str] = []
    seen: set[str] = set()
    for part in re.split(r"\s*(?:;|；|,|，|、|\band\b|&)\s*", str(value or ""), flags=re.IGNORECASE):
        author = re.sub(r"\s+", " ", part).strip()[:80]
        key = author.lower()
        if not author or key in seen:
            continue
        seen.add(key)
        authors.append(author)
        if len(authors) >= 20:
            break
    return authors


def publication_year(value: str) -> int | None:
    normalized = unicodedata.normalize("NFKC", value)
    for match in re.findall(r"(?<!\d)(?:19|20)\d{2}(?!\d)", normalized):
        year = int(match)
        if 1900 <= year <= 2100:
            return year
    return None


def _visual_text(value: str) -> str:
    text = unicodedata.normalize("NFKC", value).strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])", "", text)
    text = re.sub(r"(?<=[\u3400-\u9fff])\s+(?=[—–])", "", text)
    return re.sub(r"(?<=[—–])\s+(?=[\u3400-\u9fff])", "", text)


def _first_page_visual_lines(document: fitz.Document) -> list[dict[str, object]]:
    page = document[0]
    spans: list[dict[str, object]] = []
    for block in page.get_text("dict").get("blocks", []):
        if len(spans) >= MAX_PDF_LAYOUT_SPANS:
            break
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            if len(spans) >= MAX_PDF_LAYOUT_SPANS:
                break
            for span in line.get("spans", []):
                if len(spans) >= MAX_PDF_LAYOUT_SPANS:
                    break
                text = _visual_text(str(span.get("text") or ""))
                if not text:
                    continue
                bbox = tuple(float(value) for value in span.get("bbox", (0, 0, 0, 0)))
                if bbox[1] > float(page.rect.height) * 0.5:
                    continue
                spans.append({"text": text, "size": float(span.get("size") or 0), "bbox": bbox})
    spans.sort(key=lambda item: (item["bbox"][1], item["bbox"][0]))

    rows: list[list[dict[str, object]]] = []
    for span in spans:
        matching = next(
            (
                row
                for row in reversed(rows[-4:])
                if abs(float(row[0]["bbox"][1]) - float(span["bbox"][1])) <= 3.0
            ),
            None,
        )
        if matching is None:
            rows.append([span])
        else:
            matching.append(span)

    visual_lines: list[dict[str, object]] = []
    for row in rows:
        row.sort(key=lambda item: item["bbox"][0])
        text = ""
        previous: dict[str, object] | None = None
        for span in row:
            if previous is not None:
                gap = float(span["bbox"][0]) - float(previous["bbox"][2])
                if gap > max(3.0, min(float(span["size"]), float(previous["size"])) * 0.5):
                    text += " "
            text += str(span["text"])
            previous = span
        visual_lines.append({
            "text": _visual_text(text),
            "size": max(float(span["size"]) for span in row),
            "bbox": (
                min(float(span["bbox"][0]) for span in row),
                min(float(span["bbox"][1]) for span in row),
                max(float(span["bbox"][2]) for span in row),
                max(float(span["bbox"][3]) for span in row),
            ),
        })
    return visual_lines[:MAX_PDF_LAYOUT_LINES]


def _layout_title(document: fitz.Document) -> tuple[str | None, str, tuple[float, float] | None]:
    lines = _first_page_visual_lines(document)
    weighted_sizes = [
        float(line["size"])
        for line in lines
        for _ in range(min(len(re.sub(r"\s", "", str(line["text"]))), 20))
    ]
    weighted_sizes.sort()
    body_size = weighted_sizes[int((len(weighted_sizes) - 1) * 0.4)] if weighted_sizes else 10.0
    page_height = float(document[0].rect.height)
    candidates = [
        line
        for line in lines
        if page_height * 0.035 <= float(line["bbox"][1]) <= page_height * 0.5
        and float(line["size"]) >= max(12.0, body_size * 1.35)
        and 4 <= len(str(line["text"]).strip(" *＊△◆")) <= 180
        and not re.match(
            r"^(?:摘要|Abstract|关键词|Key\s*words|DOI|作者简介|中图分类号)",
            str(line["text"]),
            re.I,
        )
    ]
    if not candidates:
        return None, "low", None
    primary = max(candidates, key=lambda line: float(line["size"]))
    maximum_gap = max(45.0, float(primary["size"]) * 1.8)
    selected = [primary]
    for line in candidates:
        text = str(line["text"]).lstrip()
        continuation = bool(re.match(r"^(?:--|[—–]{2,})", text))
        minimum_size = max(12.0, float(primary["size"]) * (0.60 if continuation else 0.72))
        if line is primary or float(line["size"]) < minimum_size:
            continue
        top = min(float(item["bbox"][1]) for item in selected)
        bottom = max(float(item["bbox"][3]) for item in selected)
        if float(line["bbox"][1]) - bottom <= maximum_gap and top - float(line["bbox"][3]) <= maximum_gap:
            selected.append(line)
    selected.sort(key=lambda line: (float(line["bbox"][1]), float(line["bbox"][0])))
    parts = [str(line["text"]).strip(" *＊△◆") for line in selected]
    title = _visual_text(" ".join(parts))[:120]
    ratio = float(primary["size"]) / max(body_size, 1.0)
    confidence = "high" if ratio >= 1.6 and len(title) >= 6 else "medium"
    return title or None, confidence, (
        min(float(line["bbox"][1]) for line in selected),
        max(float(line["bbox"][3]) for line in selected),
    )


def _usable_pdf_metadata_title(value: object) -> str:
    title = _visual_text(str(value or ""))
    if re.search(r"(?:microsoft\s+word|adobe\s+acrobat|downloaded|knowledge[_-])", title, re.I):
        return ""
    if re.search(r"\.(?:pdf|docx?|pptx?)$", title, re.I):
        return ""
    return "" if title.lower() in {"untitled", "microsoft word"} else title


def _usable_pdf_metadata_authors(value: object) -> list[str]:
    authors = split_authors(str(value or ""))
    generator_names = re.compile(
        r"^(?:cnki|adobe(?:\s+acrobat)?|microsoft(?:\s+word)?|wps|readerex|epxservice(?:\s+pdf\s+output)?|unknown|administrator)$",
        re.I,
    )
    return [author for author in authors if not generator_names.fullmatch(author)]


def _split_layout_authors(value: str) -> list[str]:
    cleaned = _visual_text(value)
    cleaned = re.sub(r"(?<=[\u3400-\u9fff])\d+(?=\s*[\u3400-\u9fff])", ";", cleaned)
    cleaned = re.sub(r"(?<=[\u3400-\u9fff])\d+(?=\s*[*＊△▲▽†‡]*$)", "", cleaned)
    cleaned = re.sub(r"[①-⑳*＊△▲▽†‡]+", ";", cleaned)
    cleaned = re.sub(r"\s*;\s*", ";", cleaned).strip(" ;,，、")
    return split_authors(cleaned)


def _layout_authors(
    document: fitz.Document,
    title_range: tuple[float, float] | None,
) -> list[str]:
    if title_range is None:
        return []
    page_height = float(document[0].rect.height)
    start = title_range[1] - 2.0
    end = min(page_height * 0.45, title_range[1] + 120.0)
    for line in _first_page_visual_lines(document):
        text = str(line["text"])
        y = float(line["bbox"][1])
        if y < start or y > end:
            continue
        if re.match(r"^(?:摘要|摘\s*要|Abstract|关键词|Key\s*words)", text, re.I):
            break
        if (
            len(text) < 2
            or len(text) > 120
            or re.search(r"(?:大学|学院|医院|研究所|中心|地址|作者简介|基金|DOI|中图分类|文献标识|文章编号)", text, re.I)
            or re.search(r"[。.!?！？:：]", text)
            or text.startswith(("(", "（"))
        ):
            continue
        authors = _split_layout_authors(text)
        if authors and all(2 <= len(author) <= 80 for author in authors):
            return authors
    return []


def pdf_literature_metadata(data: bytes, markdown: str) -> dict[str, object]:
    document = fitz.open(stream=data, filetype="pdf")
    try:
        metadata = document.metadata or {}
        first_page = document[0]
        if _pdf_page_text_issue(first_page) or len(re.sub(r"\s", "", first_page.get_text())) < 20:
            # OCR body must not be overwritten by the same broken font text layer.
            return {
                "title": _pdf_ocr_title_region(document) or _pdf_ocr_title(markdown),
                "authors": [],
                "doi": normalize_doi(markdown[:50000]),
                "publicationYear": publication_year(markdown[:20000]),
                "metadataSource": "pdf_ocr",
                "metadataConfidence": "low",
            }
        layout_title, layout_confidence, title_range = _layout_title(document)
        metadata_authors = _usable_pdf_metadata_authors(metadata.get("author"))
        authors = metadata_authors or _layout_authors(document, title_range)
    finally:
        document.close()
    metadata_title = _usable_pdf_metadata_title(metadata.get("title"))
    title = layout_title if layout_title and layout_confidence == "high" else metadata_title or layout_title
    source = "pdf_layout" if title and title == layout_title else "pdf_metadata" if metadata_title else "content_heading"
    confidence = layout_confidence if source == "pdf_layout" else "high" if metadata_title else "low"
    metadata_text = "\n".join(str(value or "") for value in metadata.values())
    return {
        "title": title or title_from_markdown(markdown),
        "authors": authors,
        "doi": normalize_doi(metadata_text) or normalize_doi(markdown[:50000]),
        "publicationYear": publication_year(metadata_text) or publication_year(markdown[:20000]),
        "metadataSource": source,
        "metadataConfidence": confidence,
    }


def docx_literature_metadata(path: Path, markdown: str) -> dict[str, object]:
    properties = Document(path).core_properties
    title = str(properties.title or "").strip()
    author_value = str(properties.author or "").strip()
    combined = "\n".join(
        str(value or "")
        for value in [properties.title, properties.author, properties.subject, properties.keywords]
    )
    return {
        "title": title or title_from_markdown(markdown),
        "authors": split_authors(author_value),
        "doi": normalize_doi(combined) or normalize_doi(markdown[:50000]),
        "publicationYear": publication_year(combined) or publication_year(markdown[:20000]),
        "metadataSource": "docx_core_properties" if title or author_value else "content_heading",
        "metadataConfidence": "high" if title else "low",
    }


def sanitize_markdown(markdown: str) -> tuple[str, list[str]]:
    """Keep textual evidence while preventing converted Markdown from loading active media."""
    warnings: list[str] = []
    cleaned = re.sub(
        r"<(script|style|iframe|object|embed)\b[^>]*>.*?</\1\s*>",
        "",
        markdown,
        flags=re.IGNORECASE | re.DOTALL,
    )
    cleaned = re.sub(
        r"<(?:script|style|iframe|object|embed|img|audio|video|source)\b[^>]*?/?>",
        "",
        cleaned,
        flags=re.IGNORECASE | re.DOTALL,
    )
    media_pattern = re.compile(
        r"!\[([^\]]*)\]\([^\n)]*\)",
        flags=re.IGNORECASE,
    )
    removed_active_content = bool(media_pattern.search(cleaned)) or cleaned != markdown
    cleaned = media_pattern.sub(
        lambda match: f"[图片：{match.group(1).strip() or '无替代文本'}]",
        cleaned,
    )
    unsafe_link_pattern = re.compile(
        r"\[([^\]]+)\]\(\s*(?:javascript|vbscript|data|file):[^\n)]*\)",
        flags=re.IGNORECASE,
    )
    removed_active_content = bool(unsafe_link_pattern.search(cleaned)) or removed_active_content
    cleaned = unsafe_link_pattern.sub(lambda match: match.group(1).strip(), cleaned)
    cleaned = re.sub(
        r"</?(?:[a-zA-Z][a-zA-Z0-9:-]*)(?:\s[^<>]*?)?/?>",
        "",
        cleaned,
    )
    if removed_active_content or cleaned != markdown:
        warnings.append("已移除可能自动加载图片或执行的活动内容")
    cleaned = re.sub(r"\n{4,}", "\n\n\n", cleaned).strip()
    if len(cleaned) > MAX_MARKDOWN_CHARS:
        raise HTTPException(422, f"转换后的 Markdown 正文超过 {MAX_MARKDOWN_CHARS} 字符上限")
    return cleaned, warnings


def validate_zip_package(data: bytes, suffix: str) -> None:
    """Bound OOXML/EPUB expansion before a third-party converter opens the archive."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_ARCHIVE_ENTRIES:
                raise HTTPException(422, f"压缩文献超过 {MAX_ARCHIVE_ENTRIES} 个条目上限")
            total_size = 0
            names: set[str] = set()
            for entry in entries:
                name = entry.filename.replace("\\", "/")
                path = PurePosixPath(name)
                if path.is_absolute() or ".." in path.parts:
                    raise HTTPException(422, "压缩文献包含不安全路径")
                if entry.flag_bits & 0x1:
                    raise HTTPException(422, "不支持加密压缩文献")
                total_size += entry.file_size
                if total_size > MAX_ARCHIVE_UNCOMPRESSED_BYTES:
                    raise HTTPException(422, "压缩文献解压总量超过安全上限")
                if (
                    entry.file_size > 0
                    and entry.compress_size > 0
                    and entry.file_size / entry.compress_size > MAX_ARCHIVE_COMPRESSION_RATIO
                ):
                    raise HTTPException(422, "压缩文献的单条目压缩比超过安全上限")
                names.add(name)
    except zipfile.BadZipFile as error:
        raise HTTPException(422, "文献压缩容器损坏") from error

    required = {
        ".pptx": {"[Content_Types].xml", "ppt/presentation.xml"},
        ".epub": {"mimetype", "META-INF/container.xml"},
    }[suffix]
    if not required.issubset(names):
        raise HTTPException(422, "文献压缩容器结构与扩展名不一致")


def merge_slide_image_ocr(markdown: str, slide_ocr: dict[int, list[str]]) -> str:
    """Insert locally recognized picture text before the next slide marker."""
    if not slide_ocr:
        return markdown
    marker = re.compile(r"(?=<!--\s*Slide number:\s*\d+\s*-->)", re.IGNORECASE)
    sections = marker.split(markdown)
    merged: list[str] = []
    unmatched = dict(slide_ocr)
    for section in sections:
        match = re.match(
            r"<!--\s*Slide number:\s*(\d+)\s*-->",
            section,
            flags=re.IGNORECASE,
        )
        slide_no = int(match.group(1)) if match else None
        recognized = unmatched.pop(slide_no, []) if slide_no is not None else []
        if recognized:
            section = section.rstrip() + (
                f"\n\n### 第 {slide_no} 页图片 OCR\n\n" + "\n\n".join(recognized) + "\n\n"
            )
        merged.append(section)
    if unmatched:
        trailing = [
            f"### 第 {slide_no} 页图片 OCR\n\n" + "\n\n".join(values)
            for slide_no, values in sorted(unmatched.items())
            if values
        ]
        if trailing:
            merged.append("\n\n## 幻灯片图片 OCR\n\n" + "\n\n".join(trailing))
    return "".join(merged)


def extract_pptx_image_ocr(data: bytes) -> dict[int, list[str]]:
    """Read picture shapes only; no presentation content leaves this process."""
    from pptx import Presentation
    from pptx.enum.shapes import MSO_SHAPE_TYPE

    presentation = Presentation(io.BytesIO(data))
    result: dict[int, list[str]] = {}
    image_count = 0
    for slide_no, slide in enumerate(presentation.slides, 1):
        texts: list[str] = []
        for shape in sorted(slide.shapes, key=lambda item: (item.top, item.left)):
            if shape.shape_type != MSO_SHAPE_TYPE.PICTURE:
                continue
            if image_count >= MAX_OCR_IMAGES_PER_DOCUMENT:
                return result
            image_count += 1
            recognized = ocr_png(shape.image.blob)
            if recognized:
                texts.append(recognized)
        if texts:
            result[slide_no] = texts
    return result


def extract_markitdown(
    data: bytes,
    suffix: str,
    slide_ocr: dict[int, list[str]] | None = None,
) -> tuple[str, str | None, list[str]]:
    """Use the stream-only API; URLs, plugins, LLMs and Azure are not enabled."""
    if suffix in {".pptx", ".epub"}:
        validate_zip_package(data, suffix)
    converter = MarkItDown(
        enable_plugins=False,
        requests_session=OfflineRequestsSession(),
    )
    result = converter.convert_stream(
        io.BytesIO(data),
        stream_info=StreamInfo(
            extension=suffix,
            mimetype=MARKITDOWN_MIMETYPES[suffix],
            filename=f"document{suffix}",
        ),
    )
    converted = result.markdown or ""
    if suffix == ".pptx" and slide_ocr:
        converted = merge_slide_image_ocr(converted, slide_ocr)
    markdown, warnings = sanitize_markdown(converted)
    warnings.insert(0, "由 MarkItDown 0.1.7 离线转换，请人工核对结构、表格和图片替代文本")
    if slide_ocr:
        warnings.append("已对幻灯片中的图片执行本地 OCR，并按页保留识别结果")
    preferred_title = re.sub(r"\s+", " ", str(result.title or "")).strip()[:120] or None
    return markdown, preferred_title, warnings


def _bbox_contains_center(container: tuple[float, float, float, float], item: tuple[float, float, float, float]) -> bool:
    center_x = (item[0] + item[2]) / 2
    center_y = (item[1] + item[3]) / 2
    return container[0] <= center_x <= container[2] and container[1] <= center_y <= container[3]


def _unreadable_pdf_text(text: str) -> bool:
    chars = [char for char in text if not char.isspace()]
    damaged = sum(
        char == "\ufffd" or unicodedata.category(char) in {"Cc", "Co", "Cs"}
        for char in chars
    )
    return damaged >= max(2, len(chars) * 0.02)


def _unmapped_pdf_font_names(page: fitz.Page) -> list[str]:
    names: list[str] = []
    for font in page.get_fonts():
        xref, embedded_type, _kind, name, _resource, encoding = font[:6]
        if (xref and embedded_type != "n/a" and encoding in {"", "Identity-H", "Identity-V"}
                and page.parent.xref_get_key(xref, "ToUnicode")[0] == "null"):
            names.append(re.sub(r"^[A-Z]{6}\+", "", name))
    return names


def _pdf_page_text_issue(page: fitz.Page, layout: dict[str, Any] | None = None) -> bool:
    spans = [
        span
        for block in (layout or page.get_text("dict", flags=fitz.TEXTFLAGS_DICT & ~fitz.TEXT_CID_FOR_UNKNOWN_UNICODE)).get("blocks", [])
        if block.get("type") == 0
        for line in block.get("lines", [])
        for span in line.get("spans", [])
    ]
    if _unreadable_pdf_text("".join(str(span.get("text", "")) for span in spans)):
        return True
    for base_name in _unmapped_pdf_font_names(page):
        # MuPDF can shorten the reported span font name; inspect only fonts actually used.
        used = "".join(
            str(span.get("text", "")) for span in spans
            if span.get("font") and base_name.startswith(str(span["font"]))
        )
        if len(re.sub(r"\s", "", used)) >= 4:
            return True
    return False


def _pdf_ocr_title(markdown: str) -> str:
    first_page = re.split(r"(?m)^## 第 (?!1 页)\d+ 页\s*$", markdown, maxsplit=1)[0]
    lines = [re.sub(r"^#{1,6}\s+", "", line).strip() for line in first_page.splitlines()]

    def candidate(line: str) -> bool:
        compact = re.sub(r"\s", "", line)
        return (
            len(compact) >= 4
            and compact not in {"团体标准", "国家标准", "行业标准", "目录", "前言", "导言"}
            and not re.match(r"^(?:ICS\b|CCS\b|第\s*\d+\s*页|T\s*[/／]|GB(?:/T)?\s*\d|20\d{2}[-年]|摘要|关键词|正文)", line, re.I)
            and not _unreadable_pdf_text(line)
            and bool(re.search(r"[\u3400-\u9fff]{2}|[A-Za-z]+\s+[A-Za-z]+", line))
        )

    for index, line in enumerate(lines):
        if not candidate(line):
            continue
        title = _visual_text(line)
        following = next((value for value in lines[index + 1:] if value), "")
        if (re.fullmatch(r"[\u3400-\u9fff\s]+", title)
                and re.fullmatch(r"[\u3400-\u9fff\s]+", following)
                and candidate(following)):
            title += _visual_text(following)
        return title[:120]
    return "导入文档"


def _pdf_ocr_title_region(document: fitz.Document) -> str | None:
    page = document[0]
    # Geometry remains useful when a font's character mapping is unusable. Ignore
    # short cover labels, and OCR only the prominent multi-character title lines.
    unmapped = _unmapped_pdf_font_names(page)
    if not unmapped:
        return None
    raw = page.get_text("dict")
    spans = [span for block in raw.get("blocks", []) if block.get("type") == 0
             for line in block.get("lines", []) for span in line.get("spans", [])
             if span.get("font") and any(name.startswith(span["font"]) for name in unmapped)]
    lines = [line for line in _first_page_visual_lines(document)
             if len(re.sub(r"\s", "", str(line["text"]))) >= 6
             and float(line["size"]) >= 14
             and float(line["bbox"][1]) >= float(page.rect.height) * 0.035
             and any(_bbox_contains_center(tuple(line["bbox"]), tuple(span["bbox"])) for span in spans)]
    if not lines:
        return None
    primary = max(lines, key=lambda line: float(line["size"]))
    selected = [line for line in lines
                if float(line["size"]) >= float(primary["size"]) * 0.85
                and abs(float(line["bbox"][1]) - float(primary["bbox"][1])) <= float(primary["size"]) * 4]
    padding = float(primary["size"])
    clip = fitz.Rect(min(line["bbox"][0] for line in selected) - padding,
                     min(line["bbox"][1] for line in selected) - padding * 0.5,
                     max(line["bbox"][2] for line in selected) + padding,
                     max(line["bbox"][3] for line in selected) + padding * 0.5) & page.rect
    recognized = ocr_png(page.get_pixmap(matrix=fitz.Matrix(3, 3), clip=clip, alpha=False).tobytes("png"), psm="6")
    title = _pdf_ocr_title(recognized)
    return None if title == "导入文档" else title


def _pdf_text_block(block: dict[str, Any]) -> tuple[str, list[float]]:
    lines: list[str] = []
    sizes: list[float] = []
    for line in block.get("lines", []):
        spans = line.get("spans", [])
        text = "".join(str(span.get("text", "")) for span in spans).strip()
        if text:
            lines.append(text)
        for span in spans:
            span_text = str(span.get("text", "")).strip()
            size = float(span.get("size", 0) or 0)
            if span_text and size > 0:
                sizes.extend([size] * min(max(len(span_text), 1), 40))
    return "\n".join(lines).strip(), sizes


def _render_pdf_page(
    page: fitz.Page,
    plumber_page: Any,
    page_no: int,
) -> tuple[str, bool, list[str]]:
    warnings: list[str] = []
    layout = page.get_text("dict", sort=True, flags=fitz.TEXTFLAGS_DICT & ~fitz.TEXT_CID_FOR_UNKNOWN_UNICODE)
    blocks = layout.get("blocks", [])
    text_blocks: list[dict[str, Any]] = []
    all_text = ""
    for block in blocks:
        if block.get("type") != 0:
            continue
        text, sizes = _pdf_text_block(block)
        if not text:
            continue
        bbox = tuple(float(value) for value in block.get("bbox", (0, 0, 0, 0)))
        text_blocks.append({"bbox": bbox, "text": text, "sizes": sizes})
        all_text += text

    text_char_count = len(re.sub(r"\s", "", all_text))
    text_issue = _pdf_page_text_issue(page, layout)
    # Limit raster memory for oversized pages and reuse the same image for
    # blank-page detection and OCR. samples_mv avoids a second RGB buffer.
    if text_char_count < 20 or text_issue:
        area = max(1, page.rect.width * page.rect.height)
        scale = min(3 if text_issue else 2, (4_000_000 / area) ** 0.5)
        pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        if text_char_count == 0 and all(value == 255 for value in pixmap.samples_mv):
            return f"## 第 {page_no} 页", False, warnings
        recognized = ocr_png(pixmap.tobytes("png"))
        if any(char.isalnum() for char in recognized) and not _unreadable_pdf_text(recognized):
            if text_issue:
                warnings.append(f"第 {page_no} 页文字层或字体映射异常，已使用本地 OCR，题名、正文及数值请对照原件核对")
            return f"## 第 {page_no} 页\n\n{recognized.strip()}", True, warnings
        if text_issue or text_char_count == 0:
            warnings.append(f"第 {page_no} 页未识别到可用文字，未纳入解析正文，请对照原件核对")
            return f"## 第 {page_no} 页", False, warnings

    tables: list[dict[str, Any]] = []
    try:
        for table_no, table in enumerate(plumber_page.find_tables() or [], 1):
            rendered = markdown_table(table.extract() or [])
            if not rendered:
                continue
            bbox = tuple(float(value) for value in table.bbox)
            tables.append(
                {
                    "bbox": bbox,
                    "text": f"### 表 {page_no}-{table_no}\n\n{rendered}",
                    "kind": "table",
                }
            )
    except Exception:
        warnings.append(f"第 {page_no} 页复杂表格未完整结构化，原件仍可按原版式核对")

    table_boxes = [table["bbox"] for table in tables]
    page_height = float(page.rect.height)
    body_sizes = [
        size
        for block in text_blocks
        if not any(_bbox_contains_center(box, block["bbox"]) for box in table_boxes)
        and block["bbox"][1] < page_height * 0.68
        for size in block["sizes"]
    ]
    body_font_size = statistics.median(body_sizes) if body_sizes else 0
    page_area = float(page.rect.width * page.rect.height)
    items: list[dict[str, Any]] = list(tables)
    footnotes: list[str] = []
    for block in text_blocks:
        if any(_bbox_contains_center(box, block["bbox"]) for box in table_boxes):
            continue
        sizes = block["sizes"]
        font_size = statistics.median(sizes) if sizes else body_font_size
        is_footnote = (
            body_font_size > 0
            and block["bbox"][1] >= page_height * 0.68
            and font_size <= body_font_size * 0.82
        )
        if is_footnote:
            footnotes.append(block["text"])
        else:
            items.append({"bbox": block["bbox"], "text": block["text"], "kind": "text"})

    image_no = 0
    image_attempts = 0
    used_ocr = False
    for block in blocks:
        if block.get("type") != 1 or not block.get("image"):
            continue
        bbox = tuple(float(value) for value in block.get("bbox", (0, 0, 0, 0)))
        if any(_bbox_contains_center(box, bbox) for box in table_boxes):
            continue
        # Ignore decorative specks while retaining figures that can contain labels or table images.
        image_area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
        if image_area < page_area * 0.001 or (image_area > page_area * 0.7 and text_char_count >= 20):
            continue
        if image_attempts >= MAX_OCR_IMAGES_PER_PAGE:
            warnings.append(f"第 {page_no} 页图片超过 OCR 上限，原件仍可按原版式核对")
            break
        image_attempts += 1
        image_no += 1
        recognized = ocr_png(block["image"])
        if not recognized:
            continue
        used_ocr = True
        items.append(
            {
                "bbox": bbox,
                "text": f"### 图 {page_no}-{image_no} OCR\n\n{recognized}",
                "kind": "image",
            }
        )

    items.sort(key=lambda item: (item["bbox"][1], item["bbox"][0]))
    page_parts = [f"## 第 {page_no} 页", *(item["text"] for item in items)]
    if footnotes:
        page_parts.extend(["### 脚注", "\n\n".join(footnotes)])
    return "\n\n".join(value for value in page_parts if value), used_ocr, warnings


def extract_pdf(data: bytes) -> tuple[str, int, bool, list[str]]:
    parts: list[str] = []
    used_ocr = False
    warnings: list[str] = []
    with fitz.open(stream=data, filetype="pdf") as document:
        page_count = document.page_count
        if page_count > MAX_PAGES:
            raise HTTPException(422, f"PDF 超过 {MAX_PAGES} 页解析上限")
        with pdfplumber.open(io.BytesIO(data)) as plumber:
            for index, page in enumerate(document):
                plumber_page = plumber.pages[index]
                try:
                    rendered, page_used_ocr, page_warnings = _render_pdf_page(
                        page, plumber_page, index + 1,
                    )
                    parts.append(rendered)
                    used_ocr = used_ocr or page_used_ocr
                    warnings.extend(page_warnings)
                finally:
                    # pdfplumber retains layout objects for every visited page.
                    # Release them before decoding the next page.
                    plumber_page.close()
                    fitz.TOOLS.store_shrink(100)
    markdown = "\n\n".join(parts).strip()
    meaningful = re.sub(r"(?m)^## 第 \d+ 页\s*$", "", markdown)
    if not re.sub(r"\s", "", meaningful):
        raise HTTPException(422, "PDF 未提取到可用文本")
    return markdown, page_count, used_ocr, warnings


def iter_docx_blocks(document: Document):
    for child in document.element.body.iterchildren():
        if child.tag.endswith("}p"):
            yield Paragraph(child, document)
        elif child.tag.endswith("}tbl"):
            yield Table(child, document)


def _paragraph_image_ocr(
    paragraph: Paragraph,
    document: Document,
    cache: dict[str, str],
    remaining: int,
) -> list[str]:
    recognized: list[str] = []
    for blip in paragraph._p.xpath(".//a:blip"):
        if len(recognized) >= remaining:
            break
        relationship_id = blip.get(qn("r:embed"))
        if not relationship_id:
            continue
        if relationship_id not in cache:
            part = document.part.related_parts.get(relationship_id)
            content_type = getattr(part, "content_type", "")
            cache[relationship_id] = (
                ocr_png(part.blob) if part is not None and content_type.startswith("image/") else ""
            )
        if cache[relationship_id]:
            recognized.append(cache[relationship_id])
    return recognized


def extract_docx(path: Path) -> tuple[str, list[str]]:
    document = Document(path)
    parts: list[str] = []
    image_ocr: list[str] = []
    ocr_cache: dict[str, str] = {}
    for block in iter_docx_blocks(document):
        if isinstance(block, Paragraph):
            text = block.text.strip()
            if text:
                style = (block.style.name if block.style else "").lower()
                match = re.search(r"heading\s*([1-6])", style)
                parts.append(f"{'#' * int(match.group(1))} {text}" if match else text)
            recognized = _paragraph_image_ocr(
                block,
                document,
                ocr_cache,
                MAX_OCR_IMAGES_PER_DOCUMENT - len(image_ocr),
            )
            if recognized:
                image_ocr.extend(recognized)
                parts.append("#### 插图 OCR\n\n" + "\n\n".join(recognized))
        else:
            rendered = markdown_table([[cell.text for cell in row.cells] for row in block.rows])
            if rendered:
                parts.append(rendered)
    return "\n\n".join(parts).strip(), image_ocr


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED:
        raise HTTPException(415, "不支持该文献格式")
    data = await file.read(MAX_BYTES + 1)
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(413, "文献文件为空或超过解析上限")

    warnings: list[str] = []
    used_ocr = False
    page_count: int | None = None
    preferred_title: str | None = None
    literature_metadata: dict[str, object] | None = None
    if suffix in MARKITDOWN_ALLOWED:
        try:
            slide_ocr = extract_pptx_image_ocr(data) if suffix == ".pptx" else {}
            markdown, preferred_title, warnings = extract_markitdown(data, suffix, slide_ocr)
            used_ocr = bool(slide_ocr)
            literature_metadata = {
                "title": preferred_title or title_from_markdown(markdown),
                "authors": [],
                "doi": normalize_doi(markdown[:50000]),
                "publicationYear": publication_year(markdown[:20000]),
                "metadataSource": "markitdown_title" if preferred_title else "content_heading",
                "metadataConfidence": "medium" if preferred_title else "low",
            }
        except HTTPException:
            raise
        except Exception as error:
            raise HTTPException(422, f"扩展格式文献转换失败：{type(error).__name__}") from error
    elif suffix == ".pdf":
        markdown, page_count, used_ocr, warnings = extract_pdf(data)
        literature_metadata = pdf_literature_metadata(data, markdown)
    else:
        with tempfile.TemporaryDirectory(prefix="kb-doc-parser-") as directory:
            source = Path(directory) / f"document{suffix}"
            source.write_bytes(data)
            docx_path = source
            if suffix == ".doc":
                result = subprocess.run(
                    ["libreoffice", "--headless", "--convert-to", "docx", "--outdir", directory, str(source)],
                    capture_output=True,
                    text=True,
                    timeout=120,
                    check=False,
                )
                docx_path = Path(directory) / "document.docx"
                if result.returncode != 0 or not docx_path.exists():
                    raise HTTPException(422, "旧版 DOC 转换失败")
            markdown, image_ocr = extract_docx(docx_path)
            used_ocr = bool(image_ocr)
            literature_metadata = docx_literature_metadata(docx_path, markdown)
    if not markdown:
        raise HTTPException(422, "未提取到可用正文")
    metadata = literature_metadata or {
        "title": preferred_title or title_from_markdown(markdown),
        "authors": [],
        "doi": normalize_doi(markdown[:50000]),
        "publicationYear": publication_year(markdown[:20000]),
        "metadataSource": "content_heading",
        "metadataConfidence": "low",
    }
    return {
        "title": metadata["title"],
        "contentMd": markdown,
        "pageCount": page_count,
        "usedOcr": used_ocr,
        "warnings": warnings,
        "authors": metadata["authors"],
        "doi": metadata["doi"],
        "publicationYear": metadata["publicationYear"],
        "metadataSource": metadata["metadataSource"],
        "metadataConfidence": metadata["metadataConfidence"],
    }
