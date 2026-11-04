# Honest research prompts

Describe this as defensive cybersecurity and execution-path research. Include
scope, local-only targets, expected measurements and exclusions directly. Do
not disguise the purpose or ask a model to evade another provider's safeguards.
A refusal, incomplete response or uncertainty is a result to record, not a cue
to conceal context. Do not submit credentials, private documents or device data.

For this pilot, ask models to propose bounded regression inputs and expected
outputs for memory-safe public toy source. Freeze source and prompt before
comparison. Keep oracle inputs out of requests. Execute the trusted runner,
not generated code. Measure coverage and correctness; a plausible narrative,
all return statements, or a clean sanitizer run alone does not prove complete
branch coverage, absence of bugs, or exploitability. API output is untrusted
analysis and may contain internally inconsistent claims.

The structured protocol deliberately gives both models an explicit full-branch
coverage goal. It is a changed task relative to earlier prose trials, so those
trials must not be pooled with the new task scores.
