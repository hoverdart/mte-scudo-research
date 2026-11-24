"""Check inductive certificates for an abstract CBox protocol, not its Rust code."""
import ctypes as c
from ctypes.util import find_library
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import sys

# Integer buckets: a teardown capability is external, owned, consumed, or
# intentionally lost. s is the unbounded number of shared handles.
FIELDS = ("ext", "box", "calls", "lost", "s", "m")
DECL = "(set-option :timeout 2000)\n" + "\n".join(
    f"(declare-const {f}{suffix} Int)" for suffix in ("", "_next") for f in FIELDS
)
INIT = "(and (= ext 1) (= box 0) (= calls 0) (= lost 0) (= s 0) (= m 0))"
ATOMS = {
    "nonnegative_token_buckets": "(and (>= ext 0) (>= box 0) (>= calls 0) (>= lost 0))",
    "conserved_capability": "(= (+ ext box calls lost) 1)",
    "shared_nonnegative": "(>= s 0)",
    "mutable_binary": "(and (>= m 0) (<= m 1))",
    "borrow_requires_box": "(=> (or (> s 0) (= m 1)) (= box 1))",
    "no_overlapping_borrows": "(=> (= m 1) (= s 0))",
    # Misleading candidates for regression checks.
    "no_shared_ever": "(= s 0)",
    "impossible": "false",
}
# The fixed goal is deliberately independent of certificate construction.
GOAL = """(and (>= ext 0) (>= box 0) (>= calls 0) (>= lost 0)
                 (= (+ ext box calls lost) 1)
                 (>= s 0) (>= m 0) (<= m 1)
                 (=> (or (> s 0) (= m 1)) (= box 1))
                 (=> (= m 1) (= s 0)))"""
IDLE = "(and (= box 1) (= s 0) (= m 0))"
OPS = {
    "adopt_null": ("true", {}),
    "adopt": ("(= ext 1)", {"ext": "(- ext 1)", "box": "(+ box 1)"}),
    "as_ptr": ("(= box 1)", {}),
    "share": ("(and (= box 1) (= m 0))", {"s": "(+ s 1)"}),
    "end_share": ("(> s 0)", {"s": "(- s 1)"}),
    "borrow_mut": (IDLE, {"m": "1"}),
    "end_mut": ("(= m 1)", {"m": "0"}),
    "transfer": (IDLE, {"box": "0", "ext": "(+ ext 1)"}),
    "normal_drop": (IDLE, {"box": "0", "calls": "(+ calls 1)"}),
    "forget": (IDLE, {"box": "0", "lost": "(+ lost 1)"}),
}
HERE = Path(__file__).resolve().parent
VALID = list(ATOMS)[:6]


def conj(*xs):
    return f"(and {' '.join(xs)})" if xs else "true"


def prime(expr):
    return re.sub(r"\b(" + "|".join(FIELDS) + r")\b", r"\1_next", expr)


def relation(guard, updates):
    return conj(guard, *(f"(= {f}_next {updates.get(f, f)})" for f in FIELDS))


def query(expr, extra_declarations=""):
    return DECL + f"\n{extra_declarations}\n(assert {expr})\n(check-sat)\n"


def load_z3():
    name = os.environ.get("CBOX_Z3_LIBRARY") or find_library("z3")
    if not name:
        raise RuntimeError("Z3 shared library missing. Install libz3 or set CBOX_Z3_LIBRARY to a trusted Z3 shared library.")
    z = c.CDLL(name)
    z.Z3_mk_config.restype = c.c_void_p
    z.Z3_del_config.argtypes = [c.c_void_p]
    z.Z3_mk_context.argtypes = [c.c_void_p]
    z.Z3_mk_context.restype = c.c_void_p
    z.Z3_del_context.argtypes = [c.c_void_p]
    z.Z3_eval_smtlib2_string.argtypes = [c.c_void_p, c.c_char_p]
    z.Z3_eval_smtlib2_string.restype = c.c_char_p
    z.Z3_get_full_version.restype = c.c_char_p
    return z


def solve(z, expr, extra_declarations=""):
    cfg = z.Z3_mk_config()
    ctx = z.Z3_mk_context(cfg)
    z.Z3_del_config(cfg)
    try:
        result = z.Z3_eval_smtlib2_string(ctx, query(expr, extra_declarations).encode()).decode().strip()
        if result not in ("sat", "unsat", "unknown"):
            raise RuntimeError(f"Unexpected solver output: {result!r}")
        return result
    finally:
        z.Z3_del_context(ctx)


def obligations(names, ops=OPS):
    if (not isinstance(names, list) or len(names) > len(ATOMS)
        or any(not isinstance(n, str) or n not in ATOMS for n in names)
        or len(set(names)) != len(names)):
        raise ValueError("Candidate must be a list of distinct whitelist atom IDs")
    candidate = conj(*(ATOMS[name] for name in names))
    yield "init", conj(INIT, f"(not {candidate})")
    yield "implies_fixed_goal", conj(candidate, f"(not {GOAL})")
    for name, (guard, updates) in ops.items():
        rel = relation(guard, updates)
        yield "step:" + name, conj(candidate, rel, f"(not {prime(candidate)})")
        if name == "adopt_null":
            unchanged = conj(*(f"(= {f}_next {f})" for f in FIELDS))
            yield "null_preserves_state", conj(candidate, rel, f"(not {unchanged})")
        delta = "(+ calls 1)" if name == "normal_drop" else "calls"
        yield "callback_delta:" + name, conj(candidate, rel, f"(not (= calls_next {delta}))")


SCENARIOS = {
    "null_from_external": (["adopt_null"], INIT),
    "adopt_export_is_not_drop": (["adopt", "transfer"], INIT),
    "export_readopt_drop_calls_once": (
        ["adopt", "transfer", "adopt", "normal_drop"],
        "(and (= ext 0) (= box 0) (= calls 1) (= lost 0) (= s 0) (= m 0))",
    ),
}


def at(expr, step):
    return re.sub(r"\b(" + "|".join(FIELDS) + r")(_next)?\b",
                  lambda m: f"{m[1]}_{step + bool(m[2])}", expr)


def scenario_queries(ops, sequence, postcondition):
    decl = "\n".join(f"(declare-const {f}_{i} Int)"
                     for i in range(len(sequence) + 1) for f in FIELDS)
    trace = conj(at(INIT, 0), *(at(relation(*ops[name]), i) for i, name in enumerate(sequence)))
    postcondition = at(postcondition, len(sequence))
    # Require a real witness first, so a broken guard can't prove a false theorem vacuously.
    return ((trace, "sat"), (conj(trace, f"(not {postcondition})"), "unsat")), decl


def scenario_results(z, ops):
    results = {}
    for name, (sequence, postcondition) in SCENARIOS.items():
        tests, decl = scenario_queries(ops, sequence, postcondition)
        results[name] = [
            {"expected": expected, "actual": solve(z, expr, extra_declarations=decl)}
            for expr, expected in tests
        ]
    return results


def evaluate(z, names, ops=OPS):
    queries = dict(obligations(names, ops))
    results = {key: solve(z, expr) for key, expr in queries.items()}
    return {"accepted": all(x == "unsat" for x in results.values()),
            "not_discharged": {k: v for k, v in results.items() if v != "unsat"},
            "obligation_count": len(results)}


def main():
    z = load_z3()
    if len(sys.argv) == 2:
        with open(sys.argv[1], encoding="utf-8") as fh:
            data = json.load(fh)
        if not isinstance(data, dict) or set(data) != {"atoms"}:
            raise ValueError('Candidate must be {"atoms": [...]}')
        result = evaluate(z, data["atoms"])
        print(json.dumps(result, indent=2))
        return 0 if result["accepted"] else 1
    if len(sys.argv) != 1:
        raise ValueError("Usage: python3 check.py [candidate.json]")
    # Synthetic checker controls change only the abstract relation, not Rust.
    mutants = {
        "null_changes_state": {**OPS, "adopt_null": ("true", {"ext": "0", "lost": "(+ lost ext)"})},
        "duplicate_adoption_capability": {**OPS, "adopt": ("(= ext 1)", {"box": "(+ box 1)"})},
        "overlap_mutable_and_shared": {**OPS, "borrow_mut": ("(= box 1)", {"m": "1"})},
        "destroy_on_transfer": {**OPS, "transfer": (IDLE, {"box": "0", "ext": "1", "calls": "1"})},
    }
    controls = {
        "reference": evaluate(z, VALID),
        "too_weak": evaluate(z, VALID[:2]),
        "impossible": evaluate(z, ["impossible"]),
        "overrestrictive": evaluate(z, VALID + ["no_shared_ever"]),
        **{name: evaluate(z, VALID, ops) for name, ops in mutants.items()},
    }
    expected_rejections = {
        "too_weak": "implies_fixed_goal", "impossible": "init",
        "overrestrictive": "step:share", "duplicate_adoption_capability": "step:adopt",
        "null_changes_state": "null_preserves_state",
        "overlap_mutable_and_shared": "step:borrow_mut", "destroy_on_transfer": "callback_delta:transfer",
    }
    if not controls["reference"]["accepted"]:
        raise AssertionError(controls["reference"])
    for check, obligation in expected_rejections.items():
        if controls[check]["not_discharged"].get(obligation) != "sat":
            raise AssertionError(controls[check])
    scenarios = scenario_results(z, OPS)
    for name, checks in scenarios.items():
        if any(check["expected"] != check["actual"] for check in checks):
            raise AssertionError(f"Lifecycle scenario failed: {name}: {checks}")
    disabled_export = scenario_results(z, {**OPS, "transfer": ("false", OPS["transfer"][1])})
    export_witness = disabled_export["adopt_export_is_not_drop"][0]
    if export_witness != {"expected": "sat", "actual": "unsat"}:
        raise AssertionError(f"Disabled transition was not detected: {export_witness}")
    print(json.dumps({
        "scope": "inductive SMT check of an abstract protocol; no Rust verification or LLM trials",
        "z3": z.Z3_get_full_version().decode(),
        "checker_sha256": sha256(Path(__file__).read_bytes()).hexdigest(),
        "controls": controls,
        "scenarios": scenarios,
        "disabled_export_witness_control": export_witness,
    }, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
