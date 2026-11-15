# CBox verification: initial source audit and executable model

Research date: 2026-11-15. Status: source inspected; small abstract model checked; original Rust not compiled or formally verified. No paid model calls.

## Concrete target and version

Per Shaurya's report of Marius's selected target, this pass studies ffibox's single-object `CBox` with unique ownership. Inspected public [ffibox 0.1.1 commit 528ea503753737a60d8ba6ee7fc373c38733cbc7](https://github.com/crustify-rs/ffibox/commit/528ea503753737a60d8ba6ee7fc373c38733cbc7), the main revision returned by GitHub at inspection. Preserve this pin when reproducing results.

[Implementation](https://github.com/crustify-rs/ffibox/blob/528ea503753737a60d8ba6ee7fc373c38733cbc7/src/refs.rs#L284): `CBox<T,D>` stores a `NonNull<T>` and a teardown policy `D`. This is NOT a buffer-length task and not an ordinary Rust Box with a different name. Its handles deliberately avoid forming references over the foreign object's bytes.

## Source-to-obligation map

| Method / source lines | What implementation does | Initial verification obligation |
|---|---|---|
| `from_raw_with`, 312–314 | Null becomes None; otherwise stores pointer and policy | Unsafe caller transfers a live unique ownership claim, not merely a non-null address; policy matches object |
| `as_ptr`, 320–322 | Returns raw pointer without consuming owner | Address exposure does not duplicate the ownership/destruction token |
| `into_raw_with`, 341–345 | Disarms owner with ManuallyDrop; reads policy once | Transfer token and policy exactly once; do not run object's teardown |
| `with_policy`, 357–364 | Moves pointer and replaces policy, returning old policy | Caller establishes new destructor's preconditions; no object teardown during transfer |
| `as_ref`, 414–418; `as_mut`, 423–427 | Builds associated lifetime-bound raw handles | Live-owner borrow supports handle; mutable access excludes conflicting handle use |
| `new_with`, 447–453 | Uses policy's constructor | CNew contract gives fresh initialized ownership or failure |
| `Drop`, 557–563 | Calls policy's c_drop unconditionally | Call exactly once when this owning instance is actually normally dropped |
| `try_clone`, 575–584 | c_dup then policy clone | Fresh independent object, not a refcount bump; postpone panic/clone analysis |

`handle_ref` / `handle_mut` use `transmute_copy` under an unsafe CCell layout contract. Size checks alone are NOT the entire justification: transparent layout, validity, lifetimes, absence of handle Drop, and variance are separate requirements. [CCell contract](https://github.com/crustify-rs/ffibox/blob/528ea503753737a60d8ba6ee7fc373c38733cbc7/src/traits.rs#L641) prohibits references to the wrapped object, forbids writes through shared handles, and requires mutable-handle invariance. Model raw handles plus ghost permissions, not literal `&T` / `&mut T` results.

## First theorem to aim for

**Conditional ownership preservation for the initialized, single-threaded CBox core:** assuming a valid CCell implementation, compatible non-reentrant/non-unwinding teardown, and contract-respecting foreign access, adoption, borrowing, transfer and normal destruction preserve a unique ownership claim and do not make a live handle outlast that claim.

Split into small lemmas:
1. Non-null adoption consumes one external ownership token and creates one CBox token; null creates no CBox.
2. Pointer exposure preserves, but does not transfer, the token.
3. `into_raw_with` consumes the CBox token and returns the external token plus policy without invoking c_drop.
4. Re-adopting the transferred pointer, then normally dropping it, invokes the matched policy once.
5. Borrowing suspends conflicting operations until the handle's borrow ends.
6. Policy promotion preserves the token conditional on the replacement policy's precondition.

**Do not claim universal exactly-once physical free.** `mem::forget` may leak in safe Rust. In addition, existing `owned_always_calls_c_drop_gate_folds_internally` tests deliberately exercise a policy that declines to reclaim storage. CBox guarantees the invocation path, while policy behavior determines reclamation. Prove at-most-once consumption under the modeled protocol, plus exactly-one invocation when an owning instance actually runs its destructor normally. The [existing tests](https://github.com/crustify-rs/ffibox/blob/528ea503753737a60d8ba6ee7fc373c38733cbc7/tests/smart_pointers.rs#L307) already distinguish policy invocation and transfer suppression.

## Hands-on result completed

`docs/crustify/cbox-model/check_cbox.py` explores an explicitly finite abstract lifecycle model: one allocation, at most two simultaneous shared handles, one exclusive handle, two abstract compatible policies, sequential execution. All reachable states in this model are checked, not only paths up to a chosen length. The model has **14 reachable states and 30 checked transitions**, with no invariant violations. Three positive controls passed: shared-then-mutable borrow, transfer/readopt/drop once, and permitted leak via forget.

Three deliberately broken MODELS were rejected, each with a concrete shortest discovered trace:
- Permit mutable access over shared handle: adopt → as_ref → as_mut.
- Invoke teardown during into_raw: adopt → into_raw.
- Permit destruction with live handle: adopt → as_ref → drop.

Reproduce: `python3 docs/crustify/cbox-model/check_cbox.py`. Raw output: `docs/crustify/cbox-model/results.json`.

This is a specification-design sanity check, **not a proof of ffibox**, not Rust execution, and not evidence of an actual bug. Guards encode desired Rust borrowing/caller obligations; their enforcement in the actual program is precisely what remains to connect to a verifier. The model abstracts allocation provenance, bytes, layout, callback implementation, Rust panic/unwind, reentrancy, raw-alias foreign writes, multiple allocations, cloning, uninitialized construction, threads, and policy Drop side effects. Its two-handle bound does not establish unbounded shared-borrow behavior. Leaked ownership is a terminal abstract state; forgotten borrowed owners are outside this simplified operational protocol.

## The three suggested papers: concrete use

- [VerusBelt](https://iris-project.org/pdfs/2026-pldi-verusbelt.pdf): borrow its separation between an executable pointer and a unique ghost ownership resource. It proves an idealized framework and pointer APIs, not actual ffibox. Its PPtr borrowed-reference API is not a literal encoding of CBox's raw handles. A port/model must be labeled separately from a proof of the original Rust.
- [Pointer-aliasing restrictions](https://arxiv.org/html/2603.28326v1): use it to state explicit provenance/access obligations and avoid treating address validity as aliasing permission. Work-in-progress logic, not a turnkey source verifier; do not silently assume its soundness/implementation are finished.
- [RefinedRust2](https://iris-project.org/pdfs/2026-oopsla-refinedrust2.pdf): most relevant first source-oriented feasibility spike because it handles unsafe Rust and traits with foundational Rocq proofs. Test the minimal ownership core first; associated lifetime handles and transmute mechanics are separate frontend/model questions. MIR translation and semantics remain trusted; borrowing reasoning does not automatically prove operational Tree Borrows compliance.

## Next executable milestone

Use RefinedRust on a concrete small CBox specialization, initially adoption + into_raw_with + Drop, with an explicit abstract destructor contract. Preserve original executable semantics and record any unsupported feature rather than replacing it silently. First reproduce tool installation/example, then generate and check one ownership-transfer lemma. Only afterward add generic policies, CCell handle construction and model-specific aliasing obligations. Keep exact source hash, theorem statement, contracts, trusted assumptions and tool versions alongside the proof.

No Rust, Lean, Lake, Rocq or Cargo executable was found on the current cloud PATH; the user's Mac was offline when checked. Therefore original cargo tests and proof-assistant checks have NOT run. Python abstract-model checks ran successfully. No upstream files or policies were changed.

### Additional policy-state obligations found in review

`into_raw_with` returns the policy, but `into_raw` selects only the tuple's pointer field, so the policy value is dropped without calling the foreign object's `CDrop::c_drop`. On a null `from_raw_with` path, the unused policy value is also dropped. These Rust `Drop for D` side effects are distinct from the foreign teardown callback; the finite model excludes them. An eventual generic theorem must not silently assume that an arbitrary stateful policy is a harmless zero-sized marker. Start with one concrete simple policy, then generalize with explicit policy-state contracts.
