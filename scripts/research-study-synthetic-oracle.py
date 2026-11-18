"""Independent standard-library oracle for the agreed generic workflow acceptance."""
import csv
import hashlib
import json
import statistics
from pathlib import Path

DEST = Path(__file__).resolve().parents[1] / "docs/testing/fixtures/research-study/generic-v1"


def summarize(rows):
    result = {}
    for field in ("value", "optional_value"):
        values = [row["answers"][field] for row in rows if field in row["answers"]]
        assert all(type(value) in (int, float) for value in values)
        result[field] = {
            "totalRows": len(rows), "observed": len(values), "missing": len(rows) - len(values),
            "sum": sum(values) if values else None,
            "mean": statistics.mean(values) if values else None,
            "median": statistics.median(values) if values else None,
            "sampleStandardDeviation": statistics.stdev(values) if len(values) > 1 else None,
            "min": min(values) if values else None, "max": max(values) if values else None,
        }
    flags = [row["answers"]["completed"] for row in rows]
    assert all(type(flag) is bool for flag in flags)
    result["completed"] = {"true": sum(flag is True for flag in flags), "false": sum(flag is False for flag in flags), "missing": 0}
    return result


def main():
    # These are software test values, not patients, clinical norms or efficacy estimates.
    rows = [
        {"case": "onsite", "visitCode": "BASELINE", "source": "researcher", "answers": {"value": 0, "optional_value": 0, "completed": False}},
        {"case": "h5", "visitCode": "BASELINE", "source": "patient_h5", "answers": {"value": 2, "completed": True}},
        {"case": "csv", "visitCode": "BASELINE", "source": "import", "answers": {"value": 4, "optional_value": 4, "completed": True}},
    ]
    corrected = json.loads(json.dumps(rows))
    corrected[0]["answers"]["value"] = 1
    result = {
        "schemaVersion": "generic-workflow-oracle-v1", "syntheticOnly": True,
        "acceptancePerformed": False, "clinicalAcceptance": False,
        "unit": "one current approved response per subject and BASELINE visit",
        "source": "Python standard library statistics; no LLM-calculated statistics",
        "missingRule": "absent optional field is missing; zero and false remain observed values",
        "rounding": "unrounded numeric results; compare with an explicit tolerance in executor tests",
        "rows": rows, "expected": summarize(rows),
        "correction": {"case": "onsite", "field": "value", "oldValue": 0, "newValue": 1, "expected": summarize(corrected)},
    }
    DEST.mkdir(parents=True, exist_ok=True)
    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    (DEST / "oracle.json").write_text(text)
    with (DEST / "import-template.csv").open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=["case", "visit_code", "value", "optional_value", "completed"])
        writer.writeheader()
        row = rows[2]
        writer.writerow({"case": row["case"], "visit_code": row["visitCode"], **{key: str(value).lower() if type(value) is bool else value for key, value in row["answers"].items()}})
    print(json.dumps({"written": True, "syntheticOnly": True, "acceptancePerformed": False, "rows": len(rows), "oracleSha256": hashlib.sha256(text.encode()).hexdigest()}))


if __name__ == "__main__":
    main()
