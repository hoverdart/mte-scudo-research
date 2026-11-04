# MTE / Scudo Research Desk

A personal library seeded with all eight supplied PDFs (73 pages). Browse by topic or authored date, search full document text, write notes, and save material for meetings.

## Open locally

From the repository root:

```sh
cd research-desk
npm start
```

Open http://127.0.0.1:4317. No runtime npm dependencies or build step are required. Use a consistent URL and port: browser storage belongs to an origin, so localhost, 127.0.0.1, and the hosted site each have separate workspaces.

## Everyday use

- Search finds terms in titles, summaries, notes, and every extracted PDF page. `/` focuses search. Multiple search terms must all occur within an entry.
- Topics filter the library; the Type menu narrows it further. By date sorts newest first and keeps undated material separate. PDF export timestamps are deliberately not treated as research dates.
- New note creates an editable entry with date, type, topics, summary, and body. Notes support Markdown headings, bold and italic text, lists, links, tables, blockquotes, and fenced code blocks.
- Import files accepts PDF, Markdown, and plain text, up to 25 MB per file. PDFs are parsed on this device using the bundled PDF.js. Tagged PDFs retain headings, lists, tables, and font emphasis; untagged PDFs use font sizes and positions to recover paragraphs and headings. This does not OCR scanned pages. Imported documents begin undated and unsorted; Edit details lets you file them afterward. Identical file contents are skipped.
- Add a related note attaches a note to its source. Original PDF links include page numbers.
- The bookmark saves an entry to Meeting shortlist. Export meeting brief downloads the saved entries' summaries and note bodies as Markdown, with source filenames.
- Export backup includes your notes, edits to document details, all original PDFs, meeting selections, and removed-entry state. Restore backup merges entries; older edits become separate copies when a newer local edit exists. Export before restoring if you want a copy of the exact previous workspace.

## Data and portability

User changes and imported attachments live in IndexedDB in this browser. There is no account database or automatic cross-device sync. Browser clearing, profile deletion, and private browsing can remove additions. Export backups regularly and use Restore backup to move between devices or between local and hosted versions. Static seed PDFs remain bundled with the app. Uploaded files and note text are not sent to a server.

Original repository PDFs in `../files` are never modified. All summaries are navigation aids drawn from the supplied notes, not independent verification of technical claims. The PDF view preserves source claims even when documents disagree.

## Refresh the bundled library

Add PDFs to the repository's `files/` folder and, from `research-desk`, run:

```sh
npm run index
```

This requires Poppler's `pdftotext` (`brew install poppler` on macOS). Known documents have curated metadata in `scripts/index_sources.py`; new filenames default to an undated, unsorted document. The indexer refuses to overwrite the library if there are no input PDFs. It then runs the shared PDF structure extractor to prepare the formatted reading view. Run `npm run format-sources` to rebuild formatting from the bundled originals alone (Node 24 or newer), without reimporting the PDFs. Browser-imported files do not require this step. Local edits to a seed document's metadata take precedence over updated bundled metadata.

## Verification

```sh
npm ci
npm test
npm run check
```

Tests cover all supplied source pages, full-text search, safe rendering, filtering, dates, backup validation, meeting exports, app note editing, and atomic storage changes. Browser QA is recorded in `VERIFICATION.md`.

Written notes use Marked 18.1.1 and DOMPurify 3.4.17, bundled with their license notices. Formatted PDF pages store validated document structure, not arbitrary HTML. Existing imported PDFs are formatted locally when opened; existing source metadata edits inherit the updated bundled structure.

PDF.js 6.4.299 is vendored under `dist/vendor/`, with its Apache 2.0 license. Fonts are bundled locally; see `dist/fonts/` for font license notices. No external fonts, analytics, or AI API calls are used.


## Vercel password deployment

The Vercel variant uses a single password stored in the Production environment variable `VERCEL_PASS`. There is no Google OAuth or ChatGPT sign-in in this variant. A successful password login sets a signed, HTTP-only session cookie that expires exactly 24 hours later; reads do not extend it. Changing the password invalidates existing cookies after redeploying.

From `research-desk`, use `npm run build:vercel` to prepare the static shell. The build excludes `library.json` and original PDFs from the public directory; an authenticated Vercel function serves them. `vercel deploy --prod --scope syntaxx` publishes the linked project. Set `VERCEL_PASS` in Vercel Project Settings > Environment Variables for Production, then redeploy to apply it. The site stays locked if the variable is absent. Never put the actual password in source, a build argument, or chat.

The linked project is `syntaxx/mte-scudo-research`. CLI deployments use `research-desk` as the project root. If enabling deployments from Git commits later, configure the Git project's Root Directory to `research-desk`; the CLI-created project initially reports `.`.

Local password preview (use a disposable test password):

```sh
VERCEL_PASS=local-verification-password node scripts/dev-vercel.mjs
```

This runs at http://127.0.0.1:4318. The password preview and every hosted origin have separate browser storage. Before moving from the ChatGPT Sites address, export a full backup there, then restore it on the Vercel address. The older Sites copy remains private until it is deliberately retired.

## Defensive research experiments

The local harness and completed measured pilot are documented in
[the results report](docs/results/REPORT.md), [reproduction guide](docs/REPRODUCE.md),
and [study protocol](docs/STUDY_PROTOCOL.md). They cover safe C branch tests,
model prediction scoring, ordinary native Skia/dav1d tests and cumulative model
costs. `npm run study:restore`, `npm run benchmark:score` and `npm run costs`
replay/report saved model evidence without making paid requests.

For general prompts, code-only responses and named text-file bundles, use
`npm run prompt -- --help`; see [PROMPT_RUNNER.md](docs/PROMPT_RUNNER.md).
