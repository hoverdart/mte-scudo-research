# Research with Marius

# Current direction

This hub brings together the original MTE/Scudo research and the newer unsafe Rust, FFI, and Crustify work with Marius Momeu. The older documents remain intact: their claims and task statuses are historical notes, not automatically current results.

## Start here

- [Understanding Rust and Crustify research](#entry=crustify-beginner-guide): the full beginner guide, worked examples, glossary, and call agenda.
- [Meeting notes: the two research avenues](#entry=crustify-meeting-avenues): the original notes supplied on November 12, followed by technical clarifications.
- [Crustify research brief](#entry=crustify-research-brief): the new paper, concrete verification obligations, and possible first target.
- [Verification tools and reading map](#entry=crustify-reading-map): which systems help, where their guarantees stop, and sources.
- [First proof experiment and meeting questions](#entry=crustify-first-experiment): a proposed first-week plan, not completed experimental work.

## Two research tracks

**Memory hardening and empirical evaluation:** MTE, Scudo, PAC/BTI, native target studies, reproducible experiments, and testing LLM-generated claims. Use the existing topic filters and original PDFs.

**Unsafe Rust and FFI verification:** model particular failure modes, understand existing verified primitives, then investigate LLM-assisted construction of proofs checked independently. The November 4 discussion narrowed toward this proof-oriented direction, while static analysis remains an alternative avenue.

## Decisions for the next meeting

Choose one actual ffibox primitive and version, one precise safety claim, the C-effect contract, and the proof framework. Decide whether the first claim concerns bounds/initialization/ownership or operational aliasing; those are not interchangeable.

## Evidence labels

Meeting notes record what was discussed. Literature notes report sources and their limits. Proposed experiments are plans until accompanied by checked artifacts and reproducible results. A failure to prove is unknown, not proof of a bug.

## Keeping the hub useful

Use New note for meeting outcomes and Import files for papers or existing Markdown. Tag notes by track and add only genuinely useful entries to the Meeting shortlist. Browser notes are local to this exact site origin; export backups regularly. The existing URL, storage identities, and original files are retained.
