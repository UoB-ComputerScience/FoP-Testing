"""Render fixture guides from version-controlled expectations, never checker output."""

import csv
import json
from pathlib import Path

MANIFEST = Path(__file__).resolve().parents[1] / "fixtures.json"
FIELDS = (
    "file",
    "description",
    "expected_severity",
    "check_complete",
    "expected_heading",
    "expected_checks",
    "expected_messages",
    "notes",
)


def records(folder):
    return [
        {key: case[key] for key in FIELDS}
        for case in json.loads(MANIFEST.read_text(encoding="utf-8"))
        if case["folder"] == folder
    ]


def write_guides(destination, rows):
    (destination / "expected-results.json").write_text(
        json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    with (destination / "expected-results.csv").open(
        "w", encoding="utf-8-sig", newline=""
    ) as output:
        writer = csv.DictWriter(output, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
