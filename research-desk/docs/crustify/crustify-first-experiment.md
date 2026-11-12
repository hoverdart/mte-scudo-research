# First proof experiment and meeting questions

# Proposed first week

This is a proposed plan, not an experiment already executed.

1. **Choose and freeze one target.** Pick an actual ffibox method and commit. Specify whether the first claim is bounds/initialization/ownership or operational aliasing. Record permitted C effects and excluded behaviors.
2. **Reproduce a small existing checked example.** Verify the environment before asking an LLM to construct anything. Prefer a tiny buffer example in the framework the team knows.
3. **Write one reviewed specification manually.** Record an assumption ledger covering C, allocator, translation, memory model, toolchain, and trusted checker. Include examples satisfying the preconditions to expose vacuity.
4. **Build correct and broken pairs.** Candidate mutations include stale length after resize, treating capacity as initialized length, losing an allocation on failed reallocation, retaining an invalidated pointer, or duplicate ownership. Choose only cases actually represented by the model.
5. **Add a proof-only LLM harness.** The model may edit approved proof files, not the code, theorem, assumptions, or foreign contract. Reject `admit`/`sorry`, added axioms, unapproved imports, and specification weakening. Check from a clean immutable target, inspect theorem dependencies, and retain the proof artifacts.
6. **Compare fixed-budget baselines.** No-LLM automation, one-shot LLM, and verifier-feedback LLM. Record checked proof rate, time, tokens/cost, human annotation effort, unsupported cases, invalid-change attempts, and counterexamples separately.

# Interpret the outcomes honestly

A checked proof establishes the stated property under its assumptions. A bounded check is bounded. A dynamic failure is an observed counterexample under its detector/model. A timeout or unsuccessful proof attempt is unknown, not evidence that the implementation is buggy. A system accepting both correct and broken versions has not succeeded merely because its output sounds convincing.

For an aliasing-only pilot, initially exclude concurrency, pointer-integer casts, reallocation, and UnsafeCell; pin a Tree Borrows version and model explicit create/pass/access/return permission transitions. Extend only after the narrow semantics are working.

# Questions for Marius

- Which concrete ffibox primitive and branch should be first?
- Is the initial deliverable a buffer-invariant proof or an operational aliasing result?
- Which C contracts can be assumed, and which C behavior needs verification?
- Does the group have reusable Rocq/Lean/Isabelle artifacts or a preferred framework?
- What would count as a useful contribution beyond Aria and KaPilot?
- Should ffimap implicit-reference blind spots be a secondary engineering task?
- Can the first milestone be one small checked theorem plus a seeded-bug suite, before paid model experiments?

# Short meeting summary

“I looked at how verified Rust buffers separate allocation ownership from initialized contents. A bounds check alone is not enough unless the metadata and access permissions are truthful. I would start with one Crustify primitive and an explicit C-effect contract, freeze the specification, then let the LLM construct a proof checked independently. RefinedRust is the closest buffer model I found, but its aliasing scope matters, so I’d like to choose the first safety claim carefully.”
