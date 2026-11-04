# Reproducing the defensive pilot

Use Node 24, Python 3, clang, LLVM coverage tools from the same compiler family,
and FFmpeg with libsvtav1. The reviewed host is ARM64 macOS with Xcode clang 21.
The runners fail on missing tools rather than silently dropping measurements.
Run from `research-desk/`.

```sh
npm ci
npm run study:restore
npm run benchmark:oracle
npm run benchmark:score
npm run costs
```

Restoration uses the committed redacted request/response evidence and never calls
an API. It retains existing original archives and refuses conflicting filenames.
Restored files are labeled as redacted reconstructions, not byte-identical raw
archives. Original archive SHA-256 values remain in the committed manifest.
Scoring executes only the trusted runner and bounded hex inputs, never generated
model code. Invalid schema and unexpected sanitizer/tool failures do not get
silently repaired or skipped. Exact fence-only diagnostics are separately labeled.

One-time local build preparation (downloads source and pinned build tools):

```sh
mkdir -p artifacts/upstream
python3 -m venv artifacts/upstream/tools
artifacts/upstream/tools/bin/python -m pip install meson==1.12.1 ninja==1.13.2
git clone https://github.com/videolan/dav1d.git artifacts/upstream/dav1d
git -C artifacts/upstream/dav1d checkout --detach e5af12796d46cd7788e5f5349da1a27c5f7a8f1a
npm run prepare:skia
```

`prepare:skia` uses Skia snapshot
`aaa39bfcd3934d396e3480fd2d8ab9d311ea3973`, two dependencies pinned from its DEPS,
and the upstream revision-pinned GN download script. It records each download
command in `artifacts/skia/prepare.json`. If a fresh shallow clone has moved past
that snapshot, preparation stops rather than changing the study revision. Fetch
and check out the specified snapshot, then rerun:

```sh
git -C artifacts/upstream/skia fetch --depth 1 origin aaa39bfcd3934d396e3480fd2d8ab9d311ea3973
git -C artifacts/upstream/skia checkout --detach FETCH_HEAD
npm run prepare:skia
```

The reviewed GN configuration is `config/skia-research.gn`. Native Skia uses
CPU raster and libpng/zlib built with ASan/UBSan; upstream sanitizer suppressions
apply. Fonts, GPU backends, PartitionAlloc and unrelated codecs are disabled.
This is a reduced library build, not the Android system configuration.

```sh
npm run experiment
npm run experiment:coverage
npm run experiment:lifetime
npm run experiment:detectors
npm run experiment:dav1d
npm run experiment:skia
npm run study:report
npm test
npm run check
```

The toy coverage command requires 10/10 branch outcomes. Benchmark oracles require
10/10, 10/10 and 14/14 outcomes. An intentionally wrong prediction/missing-branch
test verifies the evaluator detects both failure modes. The arithmetic-only
UBSan positive control is the only expected sanitizer diagnostic.

The dav1d command checks six upstream headers, lifecycle behavior and eight
ordinary generated black clips (8/10-bit; two dimensions; one/three frames),
decoding each twice. The Skia command checks known-color draw/clip/readback and
PNG round trips at three dimensions, running twice. They fail on unexpected
pixel values, sizes, nondeterminism, sanitizer diagnostics or subprocess errors.
No malformed inputs, fuzzing, fault injection or old vulnerable builds are used.

Artifacts are ignored locally. The committed results snapshot includes request
hashes, per-request usage/cost, model answers, executable scores and library
summaries. New runs record source revision, dirty state, input/source hashes,
compiler/build settings, status, signals, stdout and stderr. Encoder output may
vary by version, so semantic pixel expectations are the cross-version check.
Named local reports are overwritten on rerun; preserve them before editing inputs.

All commands above are offline with respect to model providers. A fresh paid
study requires an amended protocol; the request runner refuses duplicate
model/fixture requests, unknown previous costs, or a conservative bound above
$0.50 cumulative spend. The original pilot used seven benchmark requests and
three earlier prose trials; no further calls are needed for reproduction.
