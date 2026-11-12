# Verification tools and reading map

# Start with existing verified primitives

[RustBelt, POPL 2018](https://plv.mpi-sws.org/rustbelt/popl18/paper.pdf) models ownership and sharing as logical resources and proves selected modeled unsafe libraries uphold safe-client guarantees. It is not a proof of all current Rust, its compiler, and its standard library. Read it for the distinction between knowing an address and having permission to access a resource.

[RefinedRust, PLDI 2024](https://plv.mpi-sws.org/refinedrust/paper-refinedrust.pdf) is a particularly close buffer template. Its simplified vector separates allocation and deallocation resources from initialized contents, spare storage, length, and borrowing obligations. Read Section 3 and Figure 4. It is not a proof of all upstream `Vec`, and it leaves a full operational aliasing model outside its account.

The [October 2026 RefinedRust extension](https://iris-project.org/pdfs/2026-oopsla-refinedrust2.pdf) adds traits, closures, and iterators and evaluates memory-management code. Frontend encoding and underlying semantics still belong to the trust story; slice/unsized support needs attention for the chosen target.

# Framework choices

- **RefinedRust/Rocq:** strongest existing match for a real unsafe buffer proof about metadata, initialization, or ownership. Reproduce an existing proof before adding an LLM.
- **Small Lean model:** useful for learning and testing invariants, but proving the model is not yet proving ffibox source. Avoid building a whole translator as the first project.
- **[AutoCorrode/Isabelle](https://github.com/awslabs/AutoCorrode):** credible separation-logic infrastructure with a µRust frontend, not arbitrary Rust/C import. Existing group expertise should influence the choice.
- **[Aeneas](https://github.com/AeneasVerif/aeneas):** valuable safe-Rust work; do not assume arbitrary unsafe ffibox internals are already supported.
- **[lean-miri](https://github.com/proofs-rs/lean-miri):** new MIR-to-Lean experimental direction introduced November 5. Its status distinguishes importing, executing, and proving. Successful process exit can coexist with incomplete guest execution; treat this as a feasibility lead, not a mature universal verifier.

# Aliasing and mixed-language baselines

[Tree Borrows, PLDI 2025](https://plf.inf.ethz.ch/research/pldi25-tree-borrows.html) supplies a model and Rocq artifact. [Towards verifying unsafe Rust programs against Rust’s pointer-aliasing restrictions](https://arxiv.org/html/2603.28326v1) is work in progress; implementation and soundness goals must not be treated as completed support.

[MiriLLI](https://github.com/icmccorm/mirilli) combines Rust and LLVM interpretation for dynamic mixed-language checking. Its [study](https://arxiv.org/abs/2404.11671) gives realistic failure examples, not universal proof. [Miri native-library support](https://github.com/rust-lang/miri) is explicitly experimental with tracking limitations; a clean native FFI run is not an aliasing certificate.

[Crema](https://github.com/AFx3/crema-static-analyzer) targets cross-language heap management including leaks, double-free, and UAF; it is early-stage and not a full aliasing verifier. [FFIChecker](https://github.com/lizhuohua/rust-ffi-checker) is an older LLVM-based baseline with pinned-toolchain compatibility costs. [BorrowSanitizer](https://goals.rust-lang.org/2026/borrowsanitizer.html) is important ongoing dynamic aliasing work; planned feature parity is not established completion. [Kani foreign stubs](https://model-checking.github.io/kani/reference/experimental/stubbing.html) enable reduced checks, but prove against the replacement model unless a separate argument connects it to C.

# Closest LLM work and the novelty question

[Aria](https://arxiv.org/html/2607.06341v1) reports kernel-checked reconstruction of RustBelt/Iris lemmas with an agent harness. [KaPilot](https://arxiv.org/html/2607.21957v1) studies unsafe-Rust specification generation and Kani checking. [A Rust-to-Lean AI-prover experience report](https://arxiv.org/html/2605.30106v1) combines extraction, specifications, generated proofs, and kernel checking, but does not currently cover unsafe Rust.

Therefore “an LLM writes proofs” is not enough as a contribution. Focus on real Crustify contracts, reusable invariants, checked assumptions, and an evaluation that distinguishes proof success from vacuous specifications.

# Suggested reading order

1. Crustify §§3.2, 4.6, 5 and Appendix E: architecture and its actual limits.
2. Rust slice safety contract and undefined-behavior reference: enumerate obligations.
3. RefinedRust §3/Fig. 4: buffer representation; then its limitations and 2026 extension.
4. RustBelt: ownership/sharing and abstraction soundness.
5. Aria and KaPilot: what existing LLM proof/specification work already does.
6. Tree Borrows and MiriLLI if the chosen first target is operational aliasing.
