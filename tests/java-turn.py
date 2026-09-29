"""Check the Java turn-test contract with controlled variants of the original starter."""
import argparse
import json
from pathlib import Path
import re
import subprocess
import tempfile
import zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--java', required=True, help='JDK java executable (Java 24 or later).')
    parser.add_argument('--starter', type=Path, required=True, help='Original FoPCW2025.zip.')
    args = parser.parse_args()
    launcher = Path(__file__).resolve().parent.parent / 'java/Run.java'
    with zipfile.ZipFile(args.starter) as source:
        entries = [(info.filename, source.read(info)) for info in source.infolist()]
    engine = next(name for name, _ in entries if name.endswith('/GameEngine.java'))
    text = dict(entries)[engine].decode('utf-8-sig').replace('\r', '')
    pattern = r'public void movePlayer\(int direction\)\s*\{\s*//YOUR CODE HERE\s*\}'
    if len(re.findall(pattern, text)) != 1:
        raise SystemExit('Expected the untouched starter movePlayer method; no input was changed.')
    movement = '''
        int x = player.getX(), y = player.getY();
        switch (direction) {
            case 1: y--; break;
            case 2: x++; break;
            case 3: y++; break;
            case 4: x--; break;
        }
        player.setPosition(x, y);
    '''
    variants = [
        ('untouched', None, 'failed'),
        ('movement-preserves-turn', movement, 'passed'),
        ('movement-advances-turn', movement + '\nturnNumber++;', 'failed'),
        ('one-direction-empty', 'if (direction == 4) return;\n' + movement, 'failed'),
    ]
    with tempfile.TemporaryDirectory(prefix='fop-turn-regression-') as temporary:
        root = Path(temporary)
        for name, body, expected in variants:
            submission = args.starter.resolve()
            if body is not None:
                submission = root / (name + '.zip')
                changed = re.sub(pattern, lambda _: 'public void movePlayer(int direction) {' + body + '}', text)
                with zipfile.ZipFile(submission, 'x') as output:
                    for filename, data in entries:
                        output.writestr(filename, changed.encode('utf-8') if filename == engine else data)
            report_path = root / (name + '.json')
            # Launch outside the checkout too: Run.java must resolve its own sources.
            result = subprocess.run([args.java, str(launcher), '--zip', str(submission),
                                     '--select', 'all' if body is None else 'task2.turn',
                                     '--output', str(report_path)], cwd=root, capture_output=True, timeout=120)
            if not report_path.exists():
                raise AssertionError(result.stdout.decode(errors='replace') + result.stderr.decode(errors='replace'))
            report = json.loads(report_path.read_text(encoding='utf-8'))
            expected_code = 0 if expected == 'passed' else 1
            if result.returncode != expected_code or report['profile_version'] != '3':
                raise AssertionError((name, result.returncode, report))
            checks = report['tests']
            if len(checks) != (9 if body is None else 1) or any(c['status'] != expected for c in checks):
                raise AssertionError((name, checks))
            compilation = next(stage for stage in report['stages'] if stage['stage'] == 'compilation')
            if compilation['status'] != 'passed':
                raise AssertionError((name, compilation))
            print(f'PASS {name}: {len(checks)} checks reported {expected}', flush=True)


if __name__ == '__main__':
    main()
