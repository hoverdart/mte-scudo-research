#!/usr/bin/env bash
# Behavioral smoke check, not a source proof or a verifier setup script.
set -euo pipefail

readonly PIN=37ea234e1f765d6e1253563f111c97ab3b3e9bc8
if [[ "$#" != 1 ]]; then
  printf 'Usage: %s /path/to/clean-ffibox-checkout\n' "$0" >&2
  exit 2
fi

cd -- "$1"
if [[ "$(git rev-parse --show-prefix)" != "" || "$(git rev-parse HEAD)" != "$PIN" ]]; then
  printf 'Expected the root of ffibox at %s\n' "$PIN" >&2
  exit 2
fi
if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
  printf 'Refusing to test a dirty source checkout. Use a clean disposable checkout.\n' >&2
  exit 2
fi

compiler="${RUSTC:-rustc}"
cargo_cmd="${CARGO:-cargo}"
"$compiler" --version --verbose
"$cargo_cmd" --version
tests=(
  owned_drop_calls_c_drop
  owned_into_raw_suppresses_drop
)
for test_name in "${tests[@]}"; do
  printf '\nChecking %s\n' "$test_name"
  output="$("$cargo_cmd" test --offline --test smart_pointers -- "$test_name" --exact)"
  printf '%s\n' "$output"
  # Cargo considers zero matches a success. This pilot requires one exact match.
  if [[ "$output" != *'test result: ok. 1 passed; 0 failed;'* ]]; then
    printf 'Expected exactly one passing test for %s\n' "$test_name" >&2
    exit 1
  fi
done
