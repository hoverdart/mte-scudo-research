# Crustify research brief

# The concrete opportunity

Start with one actual ffibox buffer primitive and a precisely scoped property. The candidate research question is whether fixed, reviewed C-effect contracts and reusable buffer invariants make LLM-assisted proof construction effective for real Crustify obligations. This is a proposed direction, not an established novelty claim or completed proof.

# Crustify architecture and gaps

The [November 7 Crustify preprint](https://arxiv.org/html/2611.10394v1), coauthored by Marius Momeu, describes ffibox ownership/borrowing primitives, Wavefront translation ordering and ownership records, and ffimap unsafe-surface measurement. ffimap is explicitly a linter, not a sound and complete verifier. Section 3.2 identifies missed implicit references from autoref through raw pointers and some unmapped `-sys` structures. Section 5 identifies unsupported owning-element vectors and C-grown arrays through borrowed pointer/count pairs.

Those gaps suggest both possible engineering improvements and a separate checked-contract/proof track. Passing tests and agreeing with generated ownership records do not prove absence of UB.

# A truthful buffer representation

A pointer, length, and capacity are only a starting representation. A useful invariant must establish:

- the allocation identity, extent, alignment, and required access permissions;
- `len <= cap` and a truthful connection between metadata and storage;
- valid initialized elements in the first `len` slots, distinct from spare capacity;
- allocation lifetime, allocator pairing, and exactly-once release where ownership requires it;
- validity of outstanding Rust references and slices during foreign accesses;
- invalidation or replacement of old pointers after storage is freed or reallocated.

For example, a recorded length of 100 does not justify index 75 if only 50 elements are initialized. An index check is useful only after constructors and updates establish the underlying invariant.

[`slice::from_raw_parts`](https://doc.rust-lang.org/std/slice/fn.from_raw_parts.html) requires valid initialized elements in a single allocation, alignment and a non-null pointer even for an empty slice, an allowed byte extent, and appropriate borrowing conditions. Invalid slice construction can itself violate the contract before indexing.

# Make foreign effects explicit

For each C call, specify which ranges it can read/write, whether it can retain the pointer, free or reallocate storage, invoke callbacks, and what is initialized on return. A proof of Rust under that contract does not automatically establish that the C implementation satisfies it.

A C-side logical-length change is not intrinsically UB. Reallocation, stale metadata, retained pointers, and writes during a conflicting borrow are different hazards. Pin the exact claim and memory model before combining them.

# Keep two proof tracks distinct

**Buffer invariant track:** establish initialization, truthful bounds, allocation ownership, and operation-specific invariants.

**Operational aliasing track:** establish that concrete accesses obey a pinned pointer-permission model such as Tree Borrows. A proof of bounds or ownership does not silently settle every operational aliasing rule. Rust's exact aliasing rules remain incompletely specified in the [Reference](https://doc.rust-lang.org/reference/behavior-considered-undefined.html).

# Research status

This brief is a literature synthesis prepared November 12, 2026. No new proof experiments or paid API calls were run for it. The first primitive, framework, aliasing model, C assumptions, and evaluation suite remain choices for Marius and Shaurya.
