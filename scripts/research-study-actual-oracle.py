"""Freeze the actual synthetic H5 input and planned two capture channels before analysis."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HUB = ROOT / "researchhub"
spec = importlib.util.spec_from_file_location("generic_oracle", HUB / "scripts/research-study-synthetic-oracle.py")
oracle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oracle)

dest = HUB / "docs/testing/fixtures/research-study/generic-v2"
dest.mkdir(parents=True, exist_ok=True)
source = dest / "h5-source.json"
if not source.exists():
    source.write_bytes((HUB / "docs/testing/evidence/research-t12-2026-11-12/real-email-attempt.json").read_bytes())
feedback = json.loads(source.read_text())
assert feedback["syntheticOnly"] and feedback["submitted"] and feedback["submittedAnswersVerified"]
h5 = feedback["submittedAnswers"]
assert type(h5["value"]) in (int, float) and type(h5["completed"]) is bool
answers = {k: v for k, v in h5.items() if v is not None}
rows = [
    {"case": "onsite", "source": "researcher", "visitCode": "BASELINE", "answers": {"value": 0, "optional_value": 0, "completed": False}},
    {"case": "h5", "source": "patient_h5", "visitCode": "BASELINE", "answers": answers},
    {"case": "csv", "source": "import", "visitCode": "BASELINE", "answers": {"value": 4, "completed": True}},
]
corrected = copy.deepcopy(rows)
corrected[0]["answers"]["value"] = 1
result = {
    "schemaVersion": "generic-workflow-oracle-v2", "syntheticOnly": True,
    "acceptancePerformed": False, "clinicalAcceptance": False,
    "reason": "Real recipient chose different valid synthetic values. Preserve them; do not overwrite to fit v1.",
    "h5Evidence": "generic-v2/h5-source.json",
    "originalEvidence": "research-t12-2026-11-12/real-email-attempt.json",
    "h5EvidenceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "source": "Independent saved Python standard library oracle; calculated before the main analysis, no LLM numeric computation",
    "missingRule": "Absent optional field is missing; zero/false remain observed",
    "unit": "one current approved response per subject at BASELINE",
    "rows": rows, "expected": oracle.summarize(rows),
    "correction": {"case": "onsite", "field": "value", "oldValue": 0, "newValue": 1, "expected": oracle.summarize(corrected)},
}
text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
(dest / "oracle.json").write_text(text)
print(json.dumps({"written": True, "oracleSha256": hashlib.sha256(text.encode()).hexdigest(), "acceptancePerformed": False}))
