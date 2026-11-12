# Marius Research Hub
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
delegated: the user trusts implementation choices. A dependency-light static app with browser-local records, portable backups, and a repeatable PDF indexing script. The user confirmed browser-local storage with export/import backups.

## Users
A researcher taking continuous notes with Marius Momeu about MTE/Scudo, LLM evaluation, unsafe Rust, FFI, Crustify, and formal verification, retrieving material during meetings and review.

## Product Purpose
Make the existing research and new information searchable, organized by date and topic, with a meeting shortlist and direct access to original documents.

## Operating Context
Eight supplied PDFs in files/. Existing material includes a study guide, plan, task list, topic notes, target notes, and meeting handout. Only explicit authored dates are research dates; export timestamps are not research dates.

## Capabilities and Constraints
Preserve the supplied originals. Treat imported claims as research notes rather than newly verified technical facts. Keep source and page attribution. Support adding/editing notes, PDF/text import, filtering, full-text search, meeting selection, and export/import backups.

## Product Principles
- Source text remains retrievable alongside any summary.
- New material should require very little filing effort.
- Retrieval during a meeting should take seconds.
- Data portability and honest date/evidence labels matter.

## Evidence on Hand
Eight local PDF documents; no existing interface or brand identity. The user delegated product/design choices. One primary user; browser-local storage confirmed by the user.


## Deployment access
The user requested moving to Vercel, first considered Google school-account authentication, then explicitly replaced that request with a shared password in the `VERCEL_PASS` environment variable. A successful login lasts 24 hours. Notes remain browser-local; there is no cross-device sync.
