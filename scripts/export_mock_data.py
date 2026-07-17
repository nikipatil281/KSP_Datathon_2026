"""
Export CSV seed data into the Vite mock-data JSON fixtures.

The local-first frontend imports these JSON files directly, while Zoho Catalyst
still uses the CSVs for Data Store imports.
"""

import csv
import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent / "data"
MOCK_DIR = Path(__file__).resolve().parents[1] / "client" / "src" / "mock-data"


def parse_value(value):
    if value == "":
        return ""
    if value == "True":
        return True
    if value == "False":
        return False
    try:
        if "." not in value:
            return int(value)
        return float(value)
    except ValueError:
        return value


def main():
    MOCK_DIR.mkdir(parents=True, exist_ok=True)
    for csv_path in sorted(DATA_DIR.glob("*.csv")):
        with csv_path.open(newline="", encoding="utf-8") as f:
            rows = [
                {key: parse_value(value) for key, value in row.items()}
                for row in csv.DictReader(f)
            ]

        json_path = MOCK_DIR / f"{csv_path.stem}.json"
        with json_path.open("w", encoding="utf-8") as f:
            json.dump(rows, f, indent=2)
            f.write("\n")
        print(f"{json_path.relative_to(MOCK_DIR.parents[2])}: {len(rows)} rows")


if __name__ == "__main__":
    main()
