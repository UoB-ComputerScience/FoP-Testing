"""Check or regenerate the ignored guides from tests/fixtures.json."""
import argparse
import csv
import json
from pathlib import Path
from generators.guides import records, write_guides


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--check', action='store_true')
    mode.add_argument('--write', action='store_true')
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parent.parent / 'TestFiles/Generated')
    args = parser.parse_args()
    for folder in ('Archive-errors', 'NetBeans-exports', 'Reports'):
        destination = args.root / folder
        rows = records(folder)
        if args.write:
            write_guides(destination, rows)
        else:
            actual = json.loads((destination / 'expected-results.json').read_text(encoding='utf-8-sig'))
            if actual != rows:
                raise SystemExit(f'{folder}: JSON guide differs from tests/fixtures.json')
            with (destination / 'expected-results.csv').open(encoding='utf-8-sig', newline='') as source:
                if list(csv.DictReader(source)) != rows:
                    raise SystemExit(f'{folder}: CSV guide differs from tests/fixtures.json')
        print(f'{folder}: {len(rows)} guide records {"written" if args.write else "match"}')


if __name__ == '__main__':
    main()
