# Safe execution-path experiment

## What the note means

The note is describing a staged memory-safety research workflow:

1. Use a cheaper model for routine reading and code-navigation questions, and reserve a stronger model for the few questions that need it.
2. Start with small, deterministic programs. Record which input reaches which function, driver, parser, or allocator call.
3. Move to locally built, patched copies of larger projects such as Skia and dav1d only after the harness and observability work.
4. Characterize a memory-safety *primitive* in a controlled test: for example, whether a test case can cause an out-of-bounds read/write or a stale-reference access, how many bytes are involved, and whether the location is deterministic.
5. In real exploit development, researchers then look for useful objects to corrupt. That is the dangerous part of the note: changing permissions, capabilities, or operating-system state is an escalation goal, and is intentionally excluded here.

The requested safe interpretation is therefore: map execution paths and measure defensive behavior in toy or patched builds, without developing a payload, bypass, privilege escalation, or targeting live Android objects.

## Deliverables in this repository

- `research-desk/scripts/analyze-path.mjs` sends a small, redacted source snippet to Anthropic and asks for a reachability/instrumentation report. It has a hard output budget and does not ask for exploit steps.
- `research-desk/scripts/synthetic-memory-lab.mjs` runs a local toy allocator experiment. It records allocation/free/reuse events and intentionally stops at detection; it does not model a real allocator or produce a corruption primitive.
- `EXPERIMENT_SCOPE.md` defines phases, stop conditions, evidence to collect, and the approval gate before any project-specific work.
- `.env.example` documents the optional Anthropic configuration. Put real credentials in an untracked `.env` or `.env.local`; never commit them.

## Approval gates and stop conditions

Do not connect this harness to a production device, privileged service, kernel target, or unpatched third-party binary. Stop if a test begins producing a working overwrite, control-flow redirection, permission change, sandbox escape, or a reproducible crash outside the intended toy fixture. Preserve the input and logs, then review with the project owner.


## Implemented defensive extensions

The user approved the defensive extensions on November 3, 2026, excluding
corruption-primitive characterization. See `EXPERIMENT_SCOPE.md` for exact commands,
revision pin, expected artifacts, resource bounds and stop rules. The harness now
measures LLVM branch coverage, traces a real safe allocation lifetime, checks an
arithmetic-only UBSan positive control, and runs a pinned maintained dav1d build
with header tests, lifecycle assertions and one generated ordinary black frame.
The model workflow archives bounded single requests and supports offline human
comparison; no paid capability assessment or MTE/Scudo result is claimed.
