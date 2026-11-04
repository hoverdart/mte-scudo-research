#!/usr/bin/env python3
"""One-time minimal pinned Skia checkout/dependencies; records every download command."""
import json
import pathlib
import subprocess
from datetime import datetime, timezone
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts' / 'skia'
SOURCE = ROOT / 'artifacts' / 'upstream' / 'skia'
PIN = 'aaa39bfcd3934d396e3480fd2d8ab9d311ea3973'
DEPS = {
    'libpng': ('https://skia.googlesource.com/third_party/libpng.git', 'd5515b5b8be3901aac04e5bd8bd5c89f287bcd33'),
    'zlib': ('https://chromium.googlesource.com/chromium/src/third_party/zlib', '646b7f569718921d7d4b5b8e22572ff6c76f2596'),
}
OUT.mkdir(parents=True, exist_ok=True)
steps = []
def run(args, cwd=ROOT):
    print('prepare:', args[0], args[1], flush=True)
    result = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=120)
    steps.append(dict(command=args, cwd=str(cwd), status=result.returncode, stdout=result.stdout, stderr=result.stderr))
    if result.returncode: raise RuntimeError('Preparation failed; see prepare.json')
    return result.stdout.strip()
passed = False
try:
    if not SOURCE.exists():
        run(['git', 'clone', '--depth', '1', 'https://skia.googlesource.com/skia.git', str(SOURCE)])
    if run(['git', 'rev-parse', 'HEAD'], SOURCE) != PIN:
        raise RuntimeError('Expected pinned Skia snapshot; no automatic revision changes')
    if not (SOURCE / 'bin/gn').exists(): run(['python3', 'bin/fetch-gn'], SOURCE)
    run([str(SOURCE / 'bin/gn'), '--version'])
    for name, (url, revision) in DEPS.items():
        target = SOURCE / 'third_party' / 'externals' / name
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            run(['git', 'init', str(target)])
            run(['git', 'remote', 'add', 'origin', url], target)
            run(['git', 'fetch', '--depth', '1', 'origin', revision], target)
            run(['git', 'checkout', '--detach', 'FETCH_HEAD'], target)
        if run(['git', 'rev-parse', 'HEAD'], target) != revision: raise RuntimeError('Wrong dependency revision')
    passed = True
finally:
    (OUT / 'prepare.json').write_text(json.dumps(dict(capturedAt=datetime.now(timezone.utc).isoformat(), passed=passed, pinned=PIN, dependencies=DEPS, steps=steps), indent=2)+'\n')
