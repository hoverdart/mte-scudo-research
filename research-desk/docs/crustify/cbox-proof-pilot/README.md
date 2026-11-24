# CBox ownership proof pilot

Research workspace: [mte-scudo-research](https://github.com/hoverdart/mte-scudo-research).
This extends the [November 15 finite model](https://github.com/hoverdart/mte-scudo-research/commit/217c09a1bd7dbd27b52f663673b1c0a6f0738bdd), which checked 14 reachable states and 30 transitions with at most two shared handles. The new model checks an inductive invariant with no bound on the number of shared handles or the length of a trace. It still models one allocation and sequential operations. It is not a verification of ffibox's Rust implementation.

## Reproduce

Use Python 3.10+ and a trusted Z3 shared library. If the system loader cannot find it (common on macOS), set `CBOX_Z3_LIBRARY` to the explicit `libz3.so` or `libz3.dylib` path. For example, from this directory:

```sh
python3 -m venv /tmp/cbox-z3
/tmp/cbox-z3/bin/python -m pip install z3-solver==4.13.3.0
export CBOX_Z3_LIBRARY="$(find /tmp/cbox-z3 -type f \( -name libz3.dylib -o -name libz3.so \) -print -quit)"
/tmp/cbox-z3/bin/python check.py
/tmp/cbox-z3/bin/python check.py reference.json
```

The solver is invoked locally: no credentials, network access, model calls, or Docker are needed to run the checks once the library is installed. The default run checks the reference certificate and its rejection controls, then checks three end-to-end abstract traces. A certificate run checks 23 obligations: initial state, implication of the fixed goal, ten inductive steps, ten assertions about foreign teardown calls, and one null-adoption identity requirement.

Each end-to-end query verifies both that the trace is feasible and that no trace with those operations can violate the expected final state. The disabled-export negative control deliberately removes a transition to verify that a vacuous proof is rejected. Additional checks reject three deficient certificates and four incorrect abstract relations. A satisfying *counterexample* query, solver error, or solver unknown cannot discharge a proof obligation. On November 24, 2026, the arm64 macOS run passed all 23 reference obligations and all three paired lifecycle checks; it rejected all eight negative controls. See `results.json` for the recorded Z3 output and checker hash.

## What the model says

The starting state gives the foreign caller one live teardown capability. Four nonnegative integer buckets represent the capability being external, held by a CBox, consumed by a normal destructor, or abandoned by forgetting the wrapper. Their sum remains one. The model counts shared handles over the nonnegative integers and permits one exclusive handle only when there are no shared handles. A live handle requires the capability to remain with the box. Adopting null preserves the state and produces no modeled owner. Non-null adoption, raw-pointer exposure, consuming transfer, and forgetting do not invoke the foreign teardown callback. A normal modeled drop invokes it once. The release capability is not the same as a machine address, and callback invocation is not itself proof that the storage was freed.

The model assumes correct caller ownership and a compatible foreign policy. It encodes borrow and destructor preconditions instead of verifying that the Rust implementation enforces them. It omits concrete null-pointer representation, nontrivial Rust policy destruction on null, object bytes and initialization, pointer provenance, address identity, handle representation, Rust unwinding, foreign reentrancy, threads, closure effects, and side effects of dropping the Rust policy value. It does not prove progress or promise that every allocation is eventually freed. In particular, forgetting a wrapper is not evidence of a memory-safety violation.

See [source-proof.md](source-proof.md) for the one-Rust-operation milestone and [experiment.md](experiment.md) for the guarded model-improvement experiment.
