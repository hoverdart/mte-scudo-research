# Send a prompt and save text, code, or files

The runner uses your existing local `OPENROUTER_API_KEY`. Set a model explicitly
with `--model`, or use `OPENROUTER_MODEL` from `.env`. It makes one Chat Completions
request, without retries, tool execution, project-context uploads or model fallback.
It works with text models listed in the live OpenRouter catalog.

From `research-desk/`:

```sh
# Free: show available options.
npm run prompt -- --help

# One paid request: plain-text answer to your own prompt file.
ALLOW_LOCAL_RESEARCH_API=1 npm run prompt -- --prompt-file prompts/hello-code.txt --model anthropic/claude-haiku-4.5 --mode text

# One paid request: code-only content, saved as files/code.txt.
ALLOW_LOCAL_RESEARCH_API=1 npm run prompt -- --prompt-file prompts/hello-code.txt --model anthropic/claude-sonnet-4.5 --mode code --max-tokens 2000

# One paid request: named text files in a fresh output directory.
ALLOW_LOCAL_RESEARCH_API=1 npm run prompt -- --prompt-file prompts/hello-files.txt --model anthropic/claude-sonnet-4.5 --mode files --max-tokens 3000
```

Run only the command for the mode you want; the three examples are separate
requests. Replace the prompt file with your own UTF-8 text. The runner sends that
file's entire content plus a formatting instruction, and no other source files.
Model availability and restrictions depend on your provider/key; the runner does
not bypass them. Supported usage follows the provider's API and model policies.

## What “return files” means here

The model returns text. In `files` mode, it is asked to return JSON:

```json
{
  "files": [
    {"path": "src/example.py", "content": "print('hello')\n"},
    {"path": "README.md", "content": "Example project.\n"}
  ]
}
```

The runner validates the entire bundle and writes those strings as actual local
UTF-8 files. It does not ask the model to access your filesystem. This mode is
for code/text files, not binary attachments, ZIP archives, images or PDFs.
Code mode requests source without explanations; a complete outer Markdown fence
is removed if present. Formatting instructions remain model-dependent; the
runner cannot establish that arbitrary code is correct or complete.

## Outputs and accounting

Each run creates a unique directory under `artifacts/generations/<id>/`:

- `response.txt`: raw model text, including partial responses when available.
- `files/answer.txt`, `files/code.txt`, or the generated relative filenames.
- `record.json`: exact request, response, completion reason, timing and usage.

An archive is also saved in `artifacts/analyses/<id>.json`, and the existing
`artifacts/cost-ledger.json` is updated. Inspect cumulative provider-reported
cost with `npm run costs`. Prompt/response logs stay in ignored local artifacts;
they can contain whatever information you put in your prompt. The configured
API credential is not included in logged headers and is redacted if reflected
in a response; a prompt containing that credential is rejected before sending.

The runner never executes generated code, installs its dependencies or overwrites
project files. Generated files remain in the new run directory for review.
Invalid paths, path conflicts or invalid JSON fail without materializing files.
Truncation also stops file materialization, preserving the raw partial response
and reported cost without a retry. An OS write failure can leave a partial output
bundle; the record then marks the run failed.

Defaults are 1000 output tokens, a conservative $0.10 per-request estimate and
$1 cumulative logged spend. Override explicitly when needed:

```sh
ALLOW_LOCAL_RESEARCH_API=1 npm run prompt -- --prompt-file my-prompt.txt --mode files --max-tokens 4096 --request-budget-usd 0.20 --total-budget-usd 2
```

Input is limited to 32 KiB, output to 4096 tokens, and file bundles to 16 files /
256 KiB. Budget estimates use prompt bytes plus framing allowance, advertised
maximum text token rates and any advertised fixed request fee. They are not a
provider billing guarantee or a limit on other users of the key. Missing costs
block subsequent requests until provider activity is reviewed. No automatic
retry is performed after errors or timeouts; a timeout can still incur charges.

[OpenRouter API reference](https://openrouter.ai/docs/api/reference/overview)
explains the request/response format. Compatible models also support
[provider-enforced structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs);
this runner uses portable formatting instructions plus local validation instead
of assuming every model supports the same JSON-schema feature.
