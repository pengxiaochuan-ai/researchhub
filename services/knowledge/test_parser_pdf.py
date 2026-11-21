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
