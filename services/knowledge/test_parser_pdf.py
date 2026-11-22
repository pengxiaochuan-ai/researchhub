import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import parser


class PdfPageCoverageTest(unittest.TestCase):
    def pdf(self, with_text):
        with parser.fitz.open() as doc:
            if with_text:
                doc.new_page().insert_text((40, 40), "Synthetic research evidence on page one.")
            doc.new_page().draw_rect(parser.fitz.Rect(40, 40, 180, 100), fill=(0, 0, 0))
            if with_text:
                doc.new_page().insert_text((40, 40), "Synthetic research evidence on page three.")
            return doc.tobytes()

    def test_unreadable_page_keeps_original_number_and_warning(self):
        with patch.object(parser, "ocr_png", return_value=""):
            text, pages, used_ocr, warnings = parser.extract_pdf(self.pdf(True))
        self.assertEqual(pages, 3)
        self.assertFalse(used_ocr)
        self.assertIn("## 第 2 页\n\n## 第 3 页", text)
        self.assertIn("evidence on page three", text)
        self.assertTrue(any("第 2 页未识别" in warning for warning in warnings))

    def test_no_text_in_entire_document_is_still_rejected(self):
        with patch.object(parser, "ocr_png", return_value=""):
            with self.assertRaises(parser.HTTPException) as error:
                parser.extract_pdf(self.pdf(False))
        self.assertEqual(error.exception.status_code, 422)

    def test_page_ranges_keep_global_number_and_allow_unreadable_segment(self):
        source = self.pdf(True)
        with patch.object(parser, "PDF_PAGE_BATCH_SIZE", 1), patch.object(parser, "ocr_png", return_value=""):
            middle, pages, _, warnings = parser.extract_pdf(source, start_page=2)
            last, _, _, _ = parser.extract_pdf(source, start_page=3)
            with self.assertRaises(parser.HTTPException):
                parser.extract_pdf(source, start_page=4)
        self.assertEqual(pages, 3)
        self.assertEqual(middle, "## 第 2 页")
        self.assertIn("第 2 页未识别", warnings[0])
        self.assertIn("## 第 3 页", last)

    def test_http_page_range_runs_isolated_parser_without_renumbering(self):
        from fastapi.testclient import TestClient

        document = parser.fitz.open()
        for page in range(13):
            document.new_page().insert_text((40, 40), f"Synthetic research evidence from original page {page + 1}.")
        source = document.tobytes()
        document.close()
        with TestClient(parser.app) as client:
            response = client.post("/extract/pdf-range?start=13", files={"file": ("test.pdf", source)})
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual((result["startPage"], result["endPage"], result["pageCount"]), (13, 13, 13))
        self.assertIn("## 第 13 页", result["contentMd"])
        self.assertIn("original page 13", result["contentMd"])
