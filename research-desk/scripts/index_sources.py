"""Rebuild the searchable PDF library without modifying the original PDFs.

Requires Poppler's pdftotext (brew install poppler).
"""
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "research-desk" / "dist"
META = {
    "Plan": ("The research plan", ["Research design", "LLM evaluation"], "Plan", "A staged path from a validated harness and baselines to agent evaluation and real targets."),
    "Tasks": ("Tasks & discussion points", ["Research design", "Meetings"], "Tasks", "The T1–T8 work list, sequencing, and questions to resolve with Marius. Statuses reflect the source document."),
    "Study Guide": ("Memory hardening & LLMs", ["MTE", "Scudo", "PAC & BTI", "Literature", "LLM evaluation"], "Study guide", "The foundational guide: vocabulary, mitigation mechanics, literature, research design, and a glossary."),
    "Target (T1)": ("Target selection: dav1d & Skia", ["Targets"], "Research note", "The proposed read and write cases, their tradeoffs, fallback candidates, and the reasoning behind the sequence."),
    "Project Zero (T3)": ("Project Zero: MTE as implemented", ["MTE", "Literature"], "Reading note", "Notes on known-tag and unknown-tag categories, execution context, and remaining reading."),
    "Scudo + MTE (T4)": ("How Scudo uses MTE", ["Scudo", "MTE"], "Research note", "Source-reading notes on memtag.h, tagging instructions, exclusions, check suppression, and the separate PA question."),
    "BTI (T7)": ("BTI: a background reference", ["PAC & BTI"], "Reading note", "A short reference on branch landing pads and the relationship between BTI, PAC, and MTE."),
    "mte-scudo-meeting-handout.md": ("Pre-meeting handout", ["Meetings", "Scudo", "MTE"], "Meeting", "A question-and-answer handout on tagging, allocator policy, platform assumptions, and follow-ups."),
}


def build():
    if not any((ROOT / "files").glob("*.pdf")):
        raise SystemExit("No PDFs found in ../files. Existing library left intact.")
    originals = DEST / "sources"
    originals.mkdir(parents=True, exist_ok=True)
    records = []
    for path in sorted((ROOT / "files").glob("*.pdf")):
        raw = subprocess.check_output(["pdftotext", "-layout", str(path), "-"]).decode()
        pages = [p.strip() for p in raw.split("\f") if p.strip()]
        title, topics, kind, summary = META.get(path.stem, (path.stem, ["Unsorted"], "Document", "Imported source document."))
        slug = re.sub(r"[^a-z0-9]+", "-", path.stem.lower()).strip("-")
        target = originals / f"{slug}.pdf"
        shutil.copy2(path, target)
        records.append({
            "id": f"source-{slug}", "title": title, "topics": topics, "kind": kind,
            "summary": summary, "body": "", "pages": pages,
            "date": "2026-10-06" if path.stem == "Study Guide" else "",
            "dateBasis": "Date printed in the study guide" if path.stem == "Study Guide" else "No authored date supplied",
            "sourceName": path.name, "file": f"sources/{slug}.pdf", "fileType": "application/pdf",
            "fingerprint": hashlib.sha256(path.read_bytes()).hexdigest(), "seed": True,
        })
    (DEST / "library.json").write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n")
    print(f"Indexed {len(records)} PDFs / {sum(len(r['pages']) for r in records)} pages")


if __name__ == "__main__":
    build()
