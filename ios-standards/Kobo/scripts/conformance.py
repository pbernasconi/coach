#!/usr/bin/env python3
"""Kobo conformance: checks every component against CONVENTIONS.md rules a machine can verify.

    scripts/conformance.sh            # report and fail on violations
    scripts/conformance.sh --summary  # one line per rule

A line can opt out of one rule with `// kobo: allow <rule-id> <reason>`, for example
`// kobo: allow R16 glass is decided by the caller`. Every finding names the CONVENTIONS rule it enforces.
"""

import os
import re
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = [os.path.join(ROOT, "Sources", d) for d in ("KoboComponents", "KoboPatterns")]
# DOMAIN reads every target, the catalog and tokens included, and the String Catalogs' comments.
DOMAIN_SOURCES = os.path.join(ROOT, "Sources")
REFERENCE = os.environ.get("KOBO_REFERENCE_DIR", os.path.join(ROOT, "Reference", "components"))

RULES = {
    "R2": "Theme from the environment: no system colours (use theme.palette roles)",
    "R7": "Motion only through Motion: no raw spring/ease animations",
    "R9": "Dynamic Type: fixed font sizes need @ScaledMetric",
    "R11": "Haptics through HapticFeedback: no UIKit feedback generators",
    "R13": "Public API documented with a /// summary",
    "R14": "Previews: #Preview inside #if DEBUG, with dark and accessibility3 variants",
    "R15": "Pure logic files: top-level types are nonisolated",
    "R16": "Glass yields to theme.surfaceStyle == .solid",
    "R17": "Text: localized title inits have a verbatim: form; library strings use bundle: .module",
    "DOC": "Every public view has a reference page (README.md and preview.html)",
    "DATA": "No real people's names in samples",
    "DOMAIN": "Generic, not domain: no one app's vocabulary (workouts, sets, reps, kg...) in code or comments",
}

SYSTEM_COLOR = re.compile(
    r"(\b(Color)\.(red|blue|green|orange|yellow|pink|purple|gray|grey|black|white|brown|cyan|mint|teal|indigo)\b)"
    r"|(\.(foregroundStyle|foregroundColor|background|fill|tint|stroke)\(\s*\.(red|blue|green|orange|yellow|pink"
    r"|purple|gray|black|white|brown|cyan|mint|teal|indigo)\b)"
)
RAW_ANIMATION = re.compile(
    r"(withAnimation|\.animation)\(\s*\.(spring|interpolatingSpring|easeIn|easeOut|easeInOut|linear|bouncy|snappy"
    r"|smooth|timingCurve)\b"
)
UIKIT_HAPTICS = re.compile(r"UI(Impact|Notification|Selection)FeedbackGenerator")
FIXED_FONT = re.compile(r"\.font\(\s*\.system\(\s*size:")
GLASS = re.compile(r"\.glassEffect\(|\.buttonStyle\(\s*\.glass(Prominent)?\b|GlassEffectContainer")
UNBUNDLED_STRING = re.compile(r'String\(localized:\s*"(?:[^"\\]|\\.)*"(?![^)]*bundle:)')
REAL_NAMES = re.compile(r"Lovelace|Grace Hopper|Alan Turing|Katherine Johnson|Picard|Steve Jobs|Tim Cook")
# Rule 6: Kobo serves any app, so samples, previews and doc comments use neutral content. These words belong to one
# domain (strength training); "set" the verb and "a set of" are fine, so only the counted forms are listed.
DOMAIN_WORDS = re.compile(
    r"\b(workouts?|exercises?|squats?|bench(es)?|barbells?|dumbbells?|kettlebells?|deadlifts?|reps?|gyms?|lift"
    r"|lifting|lifters?|plates?|1RM|kg|lbs?|deloads?|hypertrophy|bodyweight|supersets?|powerlifting|RPE)\b"
    r"|\bsets? of \d|\b\d+ sets\b|\b(warm-?up|working) sets?\b|\brest[- ]timers?\b|\btraining (load|days?|plan)\b"
    r"|\bpersonal records?\b|figure\.strengthtraining",
    re.IGNORECASE,
)
PUBLIC_VIEW = re.compile(r"^\s*(?:@\w+\s+)*public\s+struct\s+(\w+)(?:<[^>{]*>)?\s*:\s*[^{]*\bView\b")
PUBLIC_DECL = re.compile(
    r"^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:nonisolated\s+)?public\s+(?:nonisolated\s+)?(?:final\s+)?"
    r"(struct|enum|class|protocol)\s+(\w+)"
)
TOP_LEVEL_TYPE = re.compile(r"^(?:public\s+|internal\s+)?(nonisolated\s+)?(?:public\s+)?(?:final\s+)?(struct|enum|class)\s+(\w+)")
TITLE_INIT = re.compile(r"public\s+init\(\s*_\s+\w+\s*:\s*LocalizedStringKey\b")


def allowed(line, rule):
    m = re.search(r"//\s*kobo:\s*allow\s+([\w,\s]+)", line)
    return bool(m) and rule in re.split(r"[,\s]+", m.group(1))


def swift_files():
    for base in SOURCES:
        for d, _, fs in os.walk(base):
            for f in sorted(fs):
                if f.endswith(".swift"):
                    yield os.path.join(d, f)


def domain_files():
    for d, _, fs in os.walk(DOMAIN_SOURCES):
        for f in sorted(fs):
            if f.endswith((".swift", ".xcstrings")):
                yield os.path.join(d, f)


def domain_findings():
    """Rule 6 over every source line, strings and comments included: a word from one app's domain."""
    found = []
    for path in sorted(domain_files()):
        with open(path, encoding="utf-8") as handle:
            for i, line in enumerate(handle, 1):
                m = DOMAIN_WORDS.search(line)
                if m and not allowed(line, "DOMAIN"):
                    found.append(("DOMAIN", os.path.relpath(path, ROOT), i, f"domain word \"{m.group(0)}\"; use neutral sample content"))
    return found


def strip_strings(line):
    return re.sub(r'"(?:[^"\\]|\\.)*"', '""', line)


def main():
    summary = "--summary" in sys.argv
    findings = []
    files = {p: open(p, encoding="utf-8").read().splitlines() for p in swift_files()}
    previews_by_file = {}

    def add(rule, path, line_no, msg):
        line = files[path][line_no - 1] if 0 < line_no <= len(files[path]) else ""
        if not allowed(line, rule):
            findings.append((rule, os.path.relpath(path, ROOT), line_no, msg))

    for path, lines in files.items():
        text = "\n".join(lines)
        imports_swiftui = "import SwiftUI" in text
        uses_scaled = "@ScaledMetric" in text
        mentions_surface = "surfaceStyle" in text or "SurfaceStyle" in text
        depth, debug_depths = 0, []
        for i, raw in enumerate(lines, 1):
            line = strip_strings(raw)
            code = line.split("//")[0]
            stripped = raw.strip()
            if stripped.startswith("#if"):
                depth += 1
                if "DEBUG" in stripped:
                    debug_depths.append(depth)
            elif stripped.startswith("#endif"):
                if debug_depths and debug_depths[-1] == depth:
                    debug_depths.pop()
                depth -= 1
            if stripped.startswith("#Preview") and not debug_depths:
                add("R14", path, i, "#Preview outside #if DEBUG")
            if SYSTEM_COLOR.search(code):
                add("R2", path, i, "system colour; use a palette role")
            if RAW_ANIMATION.search(code):
                add("R7", path, i, "raw animation curve; use a Motion preset")
            if UIKIT_HAPTICS.search(code):
                add("R11", path, i, "UIKit haptic generator; use HapticFeedback + .koboFeedback")
            if FIXED_FONT.search(code) and not uses_scaled:
                add("R9", path, i, "fixed font size without @ScaledMetric in the file")
            if GLASS.search(code) and not mentions_surface and not debug_depths:
                add("R16", path, i, "glass without a surfaceStyle check in this file")
            if UNBUNDLED_STRING.search(raw) and not debug_depths and not stripped.startswith("//"):
                add("R17", path, i, "library string without bundle: .module")
            if REAL_NAMES.search(raw):
                add("DATA", path, i, "real person's name in sample data")
            m = PUBLIC_DECL.match(raw)
            if m and not debug_depths:
                j = i - 2
                while j >= 0 and (lines[j].strip().startswith("@") or lines[j].strip() == ""):
                    if lines[j].strip() == "":
                        break
                    j -= 1
                if j < 0 or not lines[j].strip().startswith("///"):
                    add("R13", path, i, f"public {m.group(1)} {m.group(2)} has no /// summary")
            if not imports_swiftui and "/Resources/" not in path:
                t = TOP_LEVEL_TYPE.match(raw)
                attrs = " ".join(lines[max(0, i - 4):i - 1])
                if t and not t.group(1) and "@MainActor" not in attrs:
                    add("R15", path, i, f"{t.group(2)} {t.group(3)} in a Foundation-only file is not nonisolated")
        previews_by_file[path] = text if "#Preview" in text else ""

    # Public views: previews, verbatim forms and reference pages.
    all_text = {p: "\n".join(l) for p, l in files.items()}
    for path, lines in files.items():
        for i, raw in enumerate(lines, 1):
            m = PUBLIC_VIEW.match(raw)
            if not m:
                continue
            name = m.group(1)
            related = [p for p, t in all_text.items()
                       if re.search(rf"\b(struct|extension)\s+{name}\b", t)]
            preview_texts = [all_text[p] for p in set(related + [path]) if "#Preview" in all_text[p]]
            preview_texts += [t for p, t in all_text.items()
                              if "#Preview" in t and (os.path.basename(p).startswith(name)
                                                      or re.search(rf"\b{name}\b", t))]
            joined = "\n".join(preview_texts)
            if not joined:
                add("R14", path, i, f"{name} has no #Preview")
            else:
                if "dark" not in joined:
                    add("R14", path, i, f"{name} previews have no dark variant")
                if "accessibility3" not in joined and "previewMatrix" not in joined:
                    add("R14", path, i, f"{name} previews have no accessibility3 variant")
            rel_text = "\n".join(all_text[p] for p in related)
            if TITLE_INIT.search(rel_text) and "verbatim" not in rel_text:
                add("R17", path, i, f"{name} has a localized title init but no verbatim: form")
            if os.path.isdir(os.path.dirname(REFERENCE)) and not os.path.isfile(os.path.join(REFERENCE, name, "README.md")):
                add("DOC", path, i, f"{name} has no reference page at Reference/components/{name}/")

    findings += domain_findings()

    by_rule = defaultdict(list)
    for f in findings:
        by_rule[f[0]].append(f)
    print("Kobo conformance (CONVENTIONS.md)")
    for rule, desc in RULES.items():
        n = len(by_rule.get(rule, []))
        print(f"  {'✓' if n == 0 else '✗'} {rule:<6} {n:>3}  {desc}")
    if not summary:
        for rule in RULES:
            for _, rel, ln, msg in by_rule.get(rule, []):
                print(f"{rel}:{ln}: [{rule}] {msg}")
    if findings:
        print(f"conformance: {len(findings)} finding(s). Fix them, or add '// kobo: allow <rule> <reason>' if justified.",
              file=sys.stderr)
        return 1
    print("conformance: clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
