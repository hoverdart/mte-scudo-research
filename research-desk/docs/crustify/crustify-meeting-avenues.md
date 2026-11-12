# Meeting notes on the two research avenues

# Original meeting notes

Supplied by Shaurya on November 12, 2026; described as notes from the “last last meeting.” The actual meeting date is unconfirmed. Original wording is preserved below, including shorthand and technical terminology that needs clarification.

> Safe rust promises a lot of things: no null-pointer references, no dangling pointers. Easy to constrain the LLMs from reward hacking by asking them to "always build reproducer with Rust annotator, forbid unsafe code"
>
> LLM instructions' find me a reproducer (a comibnation of rust statements) that you can compile with forbid unsafe code), and that triggers a santizier. Not much there; it's a UB.
>
> LLM harness is only a lower bound; doesn't give you complete guarantees. Jusbt becauseyou ask an LLM to look at asnippet of rust code and find issues, it doesn't mean that it doesnt have issues. He wants to look into achieving stronger guarantees by using traditional verification methods (Static analysis, formal verification) along WITH LLMs. This research aims to improve crustify to improve Rust code.
>
> There are two avenues:
> - static analysis (try to extend what the rust compiler already does in Safe Rust, writing our own static analyser that extends those assumptions/properties that the Rust compiler carries on pointers; types, etc, and extend them into C); if the static analysis pass find an execution path that encounters a lifetime that outlives the bound object, that's a candidate for bugs. It's overapproximated (not precise; false positives and/or negatives). Some algorithms are complete and not sound (no false negatives but false positives). To mitigate that, we write tests + ask the LLM to triage these false positives.
> - Formal Verficiation is crazy. We'd need to migrate Rust code AND C code to a formal verification engine (Lean, for example), and express tehse properties as a mathematical expression in Lean's Terms. Then, ask LLM to drive these interactive proofs to prove that this Rust code can NEVER have UB bugs.

# Technical clarifications

## A safe client can expose an unsafe library

A client crate using `#![forbid(unsafe_code)]` cannot itself use unsafe code, but it can call safe APIs whose dependencies contain unsafe implementations. Such a client can expose an unsound library or FFI wrapper. This is not evidence that the safe Rust language routinely permits UB: the relevant defect may be in unsafe dependencies, the compiler, or the standard library. A reproducible sanitizer finding is evidence of the specific detected failure, not a universal detector for every kind of UB. Forbidding unsafe client code constrains one form of reward hacking; it does not establish that the target, test oracle, or sanitizer configuration is correct.

## Soundness and completeness need a stated framing

For an overapproximating may-bug analysis, the ideal is to include every modeled execution, possibly reporting paths that cannot occur. This is commonly described as sound analysis with possible false alarms; terminology can reverse depending on whether one is discussing bug reports, a proof procedure, or a classifier. Rather than relying on the labels alone, write the intended guarantee explicitly: which modeled errors can be missed, which false alarms can occur, and under what assumptions? Actual tools may sacrifice coverage or precision. LLM triage is heuristic unless its dismissal is independently justified; it must not silently remove findings from a claimed sound result.

## Proofs establish specified properties under assumptions

Formal verification need not begin by migrating an entire Rust/C program. A modular first step can verify a Rust wrapper under explicit C contracts. The conclusion is conditional on those contracts, the chosen semantics, translation, and trusted checker. “Never has any UB” is much broader than proving one method preserves a buffer invariant.

Sources: [Rust undefined behavior](https://doc.rust-lang.org/reference/behavior-considered-undefined.html), [Rust unsafe code](https://doc.rust-lang.org/book/ch20-01-unsafe-rust.html), [Static Program Analysis](https://cs.au.dk/~amoeller/spa/).

# Later narrowing

In the [November 4 discussion](https://chatgpt.com/c/6aeaf053-ace8-83e8-9a49-ca7ad63f9a9e?messageId=6cc1c8ad-98b9-421d-b123-a112c2d09374), the immediate assignment narrowed to modeling particular custom-buffer and FFI hazards, studying verified primitives, and proposing proof-oriented approaches before paid LLM experiments. The two avenues above remain the broader context, not two completed implementations.
