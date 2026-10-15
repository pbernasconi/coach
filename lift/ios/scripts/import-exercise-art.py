#!/usr/bin/env python3
"""Imports Everkinetic line drawings into Lift's asset catalog.

    python3 -I scripts/import-exercise-art.py <path/to/everkinetic-data checkout>

Reads ExerciseArt/mapping.json (seed exercise -> Everkinetic exercise and the two frames to use), turns
each black-on-white PNG into a template image (line darkness becomes alpha, so the app can tint it), trims the
white margin, resizes it to 600 px (@3x) and 400 px (@2x) tall, and writes
Lift/Resources/ExerciseArt.xcassets/<slug>-start.imageset and <slug>-end.imageset with template rendering.
It also rewrites ExerciseArt/ATTRIBUTION.md. Re-running replaces every imageset it manages.

The drawings are Everkinetic (everkinetic.com), CC BY-SA 4.0. The converted images stay CC BY-SA 4.0.
Needs Pillow (pip install Pillow).
"""

import json
import shutil
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow is missing: python3 -m pip install Pillow")

IOS = Path(__file__).resolve().parent.parent
MAPPING = IOS / "ExerciseArt" / "mapping.json"
ATTRIBUTION = IOS / "ExerciseArt" / "ATTRIBUTION.md"
CATALOG = IOS / "Lift" / "Resources" / "ExerciseArt.xcassets"
HEIGHTS = {"2x": 400, "3x": 600}
PADDING = 12  # source pixels kept around the trimmed drawing
NOISE = 24  # alpha below this counts as background when trimming
LEVELS = 32  # alpha levels kept after resizing: smooth edges at a third of the file size


def template_image(source: Path) -> Image.Image:
    """Black lines on white -> black lines on transparent, anti-aliasing kept as partial alpha."""
    gray = Image.open(source).convert("L")
    alpha = ImageOps.invert(gray)
    box = alpha.point(lambda value: 255 if value >= NOISE else 0).getbbox()
    if box is None:
        raise ValueError(f"{source.name} is blank")
    left, top, right, bottom = box
    box = (
        max(0, left - PADDING),
        max(0, top - PADDING),
        min(gray.width, right + PADDING),
        min(gray.height, bottom + PADDING),
    )
    alpha = alpha.crop(box)
    ink = Image.new("L", alpha.size, 0)
    return Image.merge("LA", (ink, alpha))


def write_imageset(image: Image.Image, name: str) -> int:
    folder = CATALOG / f"{name}.imageset"
    folder.mkdir(parents=True)
    images = [{"idiom": "universal", "scale": "1x"}]
    written = 0
    for scale, height in HEIGHTS.items():
        width = round(image.width * height / image.height)
        filename = f"{name}@{scale}.png"
        resized = image.resize((width, height), Image.Resampling.LANCZOS)
        ink, alpha = resized.split()
        step = 256 // LEVELS
        alpha = alpha.point(lambda value: min(255, round(value / step) * step))
        Image.merge("LA", (ink, alpha)).save(folder / filename, optimize=True)
        written += (folder / filename).stat().st_size
        images.append({"filename": filename, "idiom": "universal", "scale": scale})
    contents = {
        "images": images,
        "info": {"author": "xcode", "version": 1},
        "properties": {"template-rendering-intent": "template"},
    }
    (folder / "Contents.json").write_text(json.dumps(contents, indent=2) + "\n")
    return written


def frame_path(source_root: Path, everkinetic: dict, frame: int) -> Path:
    """The web image for frame `frame` (1-based), taken from exercises.json so odd file names resolve."""
    names = [Path(path).name for path in everkinetic.get("img", [])]
    wanted = [name for name in names if name.endswith(f"-{frame}.png")]
    if not wanted:
        raise ValueError(f"{everkinetic['name']} has no frame {frame}")
    path = source_root / "src" / "images-web" / wanted[0]
    if not path.exists():
        raise ValueError(f"missing {path}")
    return path


def reset_catalog() -> None:
    if CATALOG.exists():
        shutil.rmtree(CATALOG)
    CATALOG.mkdir(parents=True)
    root = {"info": {"author": "xcode", "version": 1}}
    (CATALOG / "Contents.json").write_text(json.dumps(root, indent=2) + "\n")


def attribution(mapping: dict, rows: list) -> str:
    source = mapping["source"]
    lines = [
        "# Exercise illustrations",
        "",
        "The exercise drawings in `Lift/Resources/ExerciseArt.xcassets` come from",
        f"[Everkinetic](https://everkinetic.com) ([data repository]({source['repository']}),",
        f"commit `{source['commit'][:7]}`), by Greg Priday and contributors, licensed under",
        f"[{source['license']}]({source['licenseURL']}).",
        "",
        "Changes made by `scripts/import-exercise-art.py`: the white background was removed (line darkness became",
        "transparency so the app can tint the lines), the margins were trimmed, and the images were resized to 400",
        f"and 600 pixels tall. The changed images are also licensed under {source['license']}.",
        "",
        "The app's code and the exercise instructions are not part of the licensed material.",
        "",
        "| Lift exercise | Asset names | Everkinetic exercise | Frames used |",
        "| --- | --- | --- | --- |",
    ]
    for row in rows:
        lines.append(
            f"| {row['name']} | `{row['slug']}-start`, `{row['slug']}-end` | {row['everkinetic']} | "
            f"{row['frames'][0]}, {row['frames'][1]} |"
        )
    missing = [entry["name"] for entry in mapping["exercises"] if not entry.get("everkinetic")]
    lines += ["", "No illustration (Everkinetic has no drawing of the same movement): " + ", ".join(missing) + ".", ""]
    return "\n".join(lines)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    source_root = Path(sys.argv[1]).resolve()
    library = {entry["name"]: entry for entry in json.loads((source_root / "exercises.json").read_text())}
    mapping = json.loads(MAPPING.read_text())
    reset_catalog()
    rows, total = [], 0
    for entry in mapping["exercises"]:
        name = entry.get("everkinetic")
        if not name:
            continue
        everkinetic = library[name]
        start, end = entry["frames"]
        for suffix, frame in (("start", start), ("end", end)):
            image = template_image(frame_path(source_root, everkinetic, frame))
            total += write_imageset(image, f"{entry['slug']}-{suffix}")
        rows.append(entry)
    ATTRIBUTION.write_text(attribution(mapping, rows))
    print(f"{len(rows)} exercises, {len(rows) * 2} imagesets, {total / 1_000_000:.1f} MB of PNG in {CATALOG}")


if __name__ == "__main__":
    main()
