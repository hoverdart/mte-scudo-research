# CBox source-proof feasibility

Prior compiler feasibility report from 2026-11-19; Mac follow-up below. **No RefinedRust/Rocq proof has run yet.** Rust tests are not a source-level proof.

## Pinned sources and compiler compatibility

- ffibox: [`37ea234e1f765d6e1253563f111c97ab3b3e9bc8`](https://github.com/crustify-rs/ffibox/tree/37ea234e1f765d6e1253563f111c97ab3b3e9bc8). Its [manifest](https://github.com/crustify-rs/ffibox/blob/37ea234e1f765d6e1253563f111c97ab3b3e9bc8/Cargo.toml) requires Rust 1.100.
- Latest development RefinedRust inspected in the cloud: [`2862b1d8044919d22330a9c8d5778fef85a47936`](https://gitlab.mpi-sws.org/lgaeher/refinedrust-dev/-/tree/2862b1d8044919d22330a9c8d5778fef85a47936). Its [frontend toolchain](https://gitlab.mpi-sws.org/lgaeher/refinedrust-dev/-/blob/2862b1d8044919d22330a9c8d5778fef85a47936/rr_frontend/rust-toolchain.toml) pins nightly-2026-11-15. The [official Rust manifest](https://static.rust-lang.org/dist/2026-11-15/channel-rust-nightly.toml) identifies Rust 1.102.0-nightly (5f4effd57). This clears the numerical MSRV requirement, and the pinned ffibox crate built with this plain nightly in Linux. This does not establish RefinedRust frontend compatibility.
- The [published v2 artifact](https://zenodo.org/records/21636474) instead pins nightly-2026-06-29, Rust 1.98.0-nightly, which cannot directly build the full unmodified ffibox crate with its declared MSRV.

## Verified cloud Rust checks

On the pinned ffibox source and the newer plain nightly:

- `cargo test --offline --tests`: **255 passed, zero failures**.
- `cargo test --offline --test smart_pointers`: **28 passed** (a subset, not 28 additional tests).
- Full `cargo test` fails an unrelated `shared.rs` `CArc::lock` documentation example with E0599: its scope is not `LockFields`. Not fixed in this pilot.

These checks were run in the cloud, not on this Mac. They establish executable test results only, not a checked ownership theorem.

## Remaining source-proof obligation and next step

First reproduce a small official example using the pinned latest development revision, preferably its evenint or linkedlist case study, with the matching Rocq dependencies and frontend. Then probe the actual CBox `into_raw_with` path, including `disarm`, `ManuallyDrop`, and `ZstPolicy::into_inner`, under a concrete unit destructor policy. [Source anchors](https://github.com/crustify-rs/ffibox/blob/37ea234e1f765d6e1253563f111c97ab3b3e9bc8/src/refs.rs#L245-L327) and [ownership-transfer implementation](https://github.com/crustify-rs/ffibox/blob/37ea234e1f765d6e1253563f111c97ab3b3e9bc8/src/refs.rs#L445-L464).

The inspected latest RefinedRust standard-library tree contains only commented `ManuallyDrop` mentions in [boxed/src/lib.rs](https://gitlab.mpi-sws.org/lgaeher/refinedrust-dev/-/blob/2862b1d8044919d22330a9c8d5778fef85a47936/stdlib/boxed/src/lib.rs). This is a concrete support question, not proof that translation must fail: frontend handling and required models still need testing. Do not substitute an abstract state machine and label it a proof of these source lines. An extracted slice must explicitly record all differences and assumptions.

## Mac follow-up, November 24

The abstract SMT model can run independently of the Rust frontend (see `README.md`). The Mac's existing Docker context denied access to its socket, and no usable native Rust/RefinedRust/Rocq toolchain was found. An isolated Rust installer download timed out before installation. The source smoke-test script passed Bash syntax validation and rejected a mismatched checkout before invoking Cargo. No privilege changes or Docker workaround were used. We did not run the official RefinedRust example or attempt a source-level proof on this Mac. The earlier Linux Rust test result above is historical and was not rerun in this pass.

Next source milestone: run the known-good RefinedRust example in an authorized isolated toolchain, then attempt the exact transfer path. Record the first unsupported construct or the checked theorem; keep either outcome separate from the SMT protocol result.
