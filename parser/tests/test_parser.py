import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from parser.parser import GROUP_ID, build_schedule, parse_schedule  # noqa: E402


FIXTURE = Path(__file__).parent / "fixtures" / "cist_schedule_uk_26_1.html"


class ParserTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = FIXTURE.read_bytes().decode("windows-1251")

    def test_parses_real_cist_grid(self):
        lessons = parse_schedule(self.html)

        self.assertGreater(len(lessons), 20)
        self.assertEqual(lessons, sorted(lessons, key=lambda x: (x["date"], x["start"], str(x["subject_id"]))))

    def test_expands_colspan_into_consecutive_weeks(self):
        lessons = parse_schedule(self.html)
        introduction = [item for item in lessons if item["subject"] == "Введення в спеціальність"]

        self.assertIn("2026-09-07", {item["date"] for item in introduction})
        self.assertIn("2026-11-30", {item["date"] for item in introduction})

    def test_reads_subject_teacher_type_and_room(self):
        lessons = parse_schedule(self.html)
        physics = next(item for item in lessons if item["subject"] == "Фізика" and item["type"] == "Лк")

        self.assertEqual(physics["teachers"], ["Коваленко О. М."])
        self.assertEqual(physics["room"], "DL")

    def test_builds_valid_document(self):
        schedule = build_schedule(self.html)

        self.assertEqual(schedule["group_id"], GROUP_ID)
        self.assertEqual(schedule["timezone"], "Europe/Kyiv")
        self.assertTrue(schedule["lessons"])


if __name__ == "__main__":
    unittest.main()
