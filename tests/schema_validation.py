# -*- coding: utf-8 -*-
import json
import sys
from pathlib import Path
from jsonschema import Draft202012Validator

repo = Path(sys.argv[1])
input_schema = json.loads((repo / "contract/input.schema.json").read_text(encoding="utf-8"))
output_schema = json.loads((repo / "contract/output.schema.json").read_text(encoding="utf-8"))
cases = json.loads((repo / "tests/fixtures/output_cases.json").read_text(encoding="utf-8"))["cases"]
results = []
for item in cases:
    errors = sorted(Draft202012Validator(output_schema).iter_errors(item["instance"]), key=lambda e: list(e.path))
    valid = not errors
    results.append({
        "case_id": item["case_id"],
        "expected_valid": item["expected_valid"],
        "actual_valid": valid,
        "status": "PASS" if valid == item["expected_valid"] else "FAIL",
        "errors": [e.message for e in errors],
    })
normal = json.loads((repo / "examples/typical_input.json").read_text(encoding="utf-8"))
normal_errors = sorted(Draft202012Validator(input_schema).iter_errors(normal), key=lambda e: list(e.path))
results.append({
    "case_id": "typical_input_schema",
    "expected_valid": True,
    "actual_valid": not normal_errors,
    "status": "PASS" if not normal_errors else "FAIL",
    "errors": [e.message for e in normal_errors],
})
payload = {
    "validator": "jsonschema Draft202012Validator",
    "case_count": len(results),
    "failure_count": sum(item["status"] != "PASS" for item in results),
    "status": "SCHEMA_INSTANCE_VALIDATION_PASS" if all(item["status"] == "PASS" for item in results) else "SCHEMA_INSTANCE_VALIDATION_FAIL",
    "results": results,
}
(repo / "test-results").mkdir(exist_ok=True)
(repo / "test-results/schema-validation.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": payload["status"], "cases": payload["case_count"], "failures": payload["failure_count"]}, ensure_ascii=False))
raise SystemExit(0 if payload["failure_count"] == 0 else 1)
