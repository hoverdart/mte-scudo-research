# Verification — October 22, 2026

## Local automated checks

- `npm test`: 10 passed, 0 failed. Includes app-level note creation/editing, full-text search, HTML escaping, source metadata editing, backup restoration with PDF attachments and merge preservation, source/page attribution, dates, meeting exports, PDF worker buffer lifetime, and atomic storage mutations.
- `npm run check`: JavaScript syntax checks passed.
- Source indexing: 8 PDFs, 73 pages. Only the study guide has an explicit authored date (October 6, 2026); all other source records are undated.
- A real browser-exported backup was parsed and validated: 10 entries, 9 PDF attachments, 1 meeting selection (including temporary browser test data). Each of the eight bundled PDFs was compared byte for byte with the original and matched.
- Design detector: run once. The selection stripe was removed. The intentional paper background was retained as part of the documented editorial index design.

## Local Chrome verification

Chrome Guest session, http://127.0.0.1:4317:

- Desktop library and reader rendered with real source material.
- Full-text query `ScopedDisableMemoryTagChecks` returned two documents and opened the matching source page with highlighting.
- A temporary note saved successfully; the note and its meeting selection remained after reload.
- PDF file import parsed the text and stored the original attachment. Browser testing caught two integration issues (loading-task cleanup and worker-buffer transfer), both fixed before packaging. A regression test checks the transfer/cleanup behavior.
- Export full backup downloaded a valid JSON backup with original attachments.
- Narrow-screen layout inspected using Chrome's 400-pixel responsive viewport; navigation adjusted to fit the width. This is browser emulation, not physical-phone testing.

## Boundaries

The local browser workspace is separate from the hosted origin. Test data lives only in the local Guest profile and is not bundled or deployed. There is no OCR, automatic cloud sync, or independent technical fact-checking of the supplied research. Automated tests use jsdom and fake IndexedDB; they complement the actual Chrome checks.


## Structured reading update — October 22, 2026

The reader now uses PDF logical structure and embedded font metadata, preserving headings, paragraphs, emphasis, lists, code, and tables. All 73 pages have nonempty structured output. Fixed-layout line breaks and whitespace are reflowed in prose; actual code blocks retain whitespace. Markdown notes and imports render full document structure through a bundled Markdown renderer and sanitizer.

- `npm test`: 17 passed, 0 failed after the update. New cases cover all source pages, headings and table cells, lists, emphasis, wrapped compound words, Markdown, text-only search highlighting, safe rendering, untagged PDF fallback, and compatibility with earlier backups/metadata edits.
- `npm run check`: all first-party JavaScript syntax checks passed.
- Chrome: confirmed the plan's semantic headings, emphasized paragraphs, and real table cells. Opened an older imported PDF with no stored structure and confirmed it was automatically formatted with headings and lists. Created and saved a Markdown note with heading levels, bold/italic text, bullet points, a table, and a fenced code block; the browser accessibility tree recognizes these elements.
- User notes and metadata remain in the existing browser database; no reset or reimport is required. Bundled raw page text and original PDFs are retained.

- Mobile reading view checked at 400 CSS pixels: heading hierarchy, visible bold/italic text, normal paragraphs, bullet lists, table layout, and preserved code indentation all rendered correctly.
- Reader source-page links were moved outside disclosure summaries, and the topic selector uses a fieldset/legend, resolving the browser's structural markup findings.


## Vercel password variant — October 22, 2026

- 24 automated tests passed; all first-party syntax checks passed. New tests cover the environment-only password, exact 24-hour expiration, password rotation invalidating cookies, session tampering, CSRF and origin checks, authenticated source bytes, direct API access, and exclusion of documents from the public build.
- Chrome completed a real login using a disposable password on the local Vercel-style server. No actual deployment password was used in testing.
- The native browser preview returned inconsistent screenshots while its accessibility tree updated correctly; visual QA of the new login surface is limited. The existing research reader retains its earlier desktop/mobile verification.
- Hosted access and environment readiness are checked after deployment. Real-password testing requires the user to set `VERCEL_PASS`; no default password exists.

- Vercel production deployment succeeded at https://mte-scudo-research.vercel.app (deployment `dpl_2i9XQcUdNE5qW8gS1j13dRQMDjWd`). Anonymous checks: login page 200, session endpoint reports false, source index and PDF endpoints 401, direct resource API 401, and `/dist/library.json` 404. At this verification the Production environment did not yet contain `VERCEL_PASS`, so the site correctly reported `configured: false`. A deployment after the user sets the variable is still required.

- After the user set `VERCEL_PASS`, production was redeployed successfully as `dpl_HLiybLb2PwVfq7BSLYw5BcRMMZtm` at the same production URL. Live checks confirm `configured: true`, a working CSRF endpoint and cookie, and an unauthenticated session. The source index, original PDF, and direct resource API each return 401 with `private, no-store`; `/dist/library.json` returns 404. The actual production password was neither read nor entered; successful login and the exact 24-hour session lifetime were verified locally with a disposable password.

## Marius Research Hub expansion — November 12, 2026

- Expanded the visible hub name and topics without changing the deployed origin, database/broadcast names, backup format, or original source IDs.
- Added five curated entries: orientation, supplied meeting notes with separate clarifications, Crustify brief, reading map, and first-experiment plan.
- All eight original PDFs and 73 indexed pages remain present; the existing Tasks annotations are retained.
- `npm test`: 49 passing tests, including original-source coverage, storage/backup roundtrips, password protection, hub note attribution, and overview-link navigation through the app.
- `npm run check`, `node --check scripts/refresh-hub.mjs`, Python indexer syntax check, and `npm run build:vercel` pass.
- Repeated `npm run hub:refresh` produces an identical library. The indexer preserves non-PDF seed entries and repository-authored PDF body annotations.
- Browser screenshot QA was unavailable because no supported browser surfaces were exposed. DOM-level application tests ran; this is not a claim of fresh desktop/mobile visual inspection.
- This verification records local changes; production deployment status must be checked separately.

### Production publication

Published the requested hub update to the existing `https://mte-scudo-research.vercel.app` alias. Vercel reported READY for deployment `dpl_FVKErrPyHvLfhbKSJRjeYbdUD5wM`. Used an isolated staging directory based on the previous deployment's source inventory and library, not the dirty working tree. SHA1 comparison confirmed unchanged runtime/auth assets; only intended UI edits and five new notes were overlaid. All eight previously deployed records were retained byte-equivalently as JSON objects. Unrelated local temporal-experiment changes and local-only Tasks annotations were not published and remain in the checkout.

Live HTTP checks: `/` and `/login.html` show Marius branding (200), `/api/config` reports configured, and unauthenticated `/library.json`, `/sources/plan.pdf`, and the direct function library route return 401. Deployed library/app/auth source hashes match the isolated build. Successful authenticated browser rendering was not freshly inspected because no browser surface was available; authentication behavior is covered by local integration tests.

### Beginner guide integration and isolated commit verification

Added the completed 15-page beginner guide as a searchable Study guide entry with an authenticated original-PDF link, plus the editable DOCX source in `docs/crustify/`. The hub now has six new research entries and nine PDFs including the eight originals. The original guide artifacts were visually reviewed during document production.

The exact staged repository snapshot passed all 49 tests, syntax checks, and the Vercel build from a clean isolated verification directory. The instrumentation check needed a canonical physical working-directory path on macOS (`/private/tmp`, rather than its `/tmp` symlink); it passed after that environment correction without source changes. Hub refresh preserves formatted pages for the unchanged guide fingerprint.

Published guide deployment `dpl_7k8CUiuDZksTq2vxHcEA6DpV1EA5` is READY on the existing alias. Its PDF, library, and unchanged authentication-source hashes match the isolated deployment bundle. Unauthenticated library and guide-PDF requests return 401. No browser-local user records were migrated or cleared.
