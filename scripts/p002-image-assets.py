#!/usr/bin/env python3
"""Generate P002's exact source windows and lossless full-image variants.

Run from any directory: python3 scripts/p002-image-assets.py [--check]
Requires Pillow with WebP support. --check never writes files.
Source PNGs and unrelated outputs are never changed or removed.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import io
import json
import re
from collections import Counter
from pathlib import Path

from PIL import Image, features


PROJECT = Path(__file__).resolve().parents[1]
PAGE = PROJECT / "pages" / "p002"
ASSETS = PAGE / "assets"
MANIFEST = PAGE / "crop-assets.json"
FULL_IMAGES = (
    "hero-background.png",
    "section-background.png",
    "join-background.png",
    "hero-wheel-transparent.png",
)


def js_array(source: str, name: str) -> list:
    match = re.search(r"\b(?:export\s+)?const\s+" + re.escape(name) + r"\s*=\s*(\[.*?\]);", source, re.S)
    if not match:
        raise ValueError(f"Missing literal source array: {name}")
    value = ast.literal_eval(match.group(1))
    if not isinstance(value, list):
        raise ValueError(f"Source array is not a list: {name}")
    return value


def crop_windows() -> list[tuple[int, int, int, int, int]]:
    html = (PAGE / "index.html").read_text()
    content = (PAGE / "content.js").read_text()
    app = (PAGE / "app.js").read_text()
    windows = [tuple(int(v) for v in m.split(",")) for m in re.findall(r'data-crop="([0-9,]+)"', html)]
    for name, source in (("stages", 2), ("assets", 3), ("engines", 5), ("roles", 6)):
        windows.extend((source, *row[2 if name in ("stages", "roles") else 1]) for row in js_array(content, name))
    for name, source, offset in (("support", 1, 1), ("tools", 2, 1), ("community", 4, 2), ("benefits", 6, 2), ("join", 7, 2)):
        windows.extend((source, *row[offset:]) for row in js_array(app, name))
    icons = re.search(r"const x=(\[[^\]]+\])\[index\];const y=(\[[^\]]+\]);", app)
    if not icons:
        raise ValueError("Missing engine icon coordinates")
    xs, ys = (ast.literal_eval(icons.group(n)) for n in (1, 2))
    if len(xs) != len(js_array(content, "engines")):
        raise ValueError("Engine icon columns no longer match engine cards")
    windows.extend((5, x, y, 54, 54) for x in xs for y in ys)
    for rect in windows:
        if len(rect) != 5 or any(type(v) is not int for v in rect):
            raise ValueError(f"Invalid crop coordinates: {rect}")
        source, x, y, width, height = rect
        if source not in range(1, 8) or min(x, y) < 0 or min(width, height) < 1 or x + width > 1586 or y + height > 992:
            raise ValueError(f"Crop outside its original reference image: {rect}")
    if len(windows) != 47 or len(set(windows)) != 46:
        raise ValueError(f"Review changed page artwork before generation: {len(windows)} elements, {len(set(windows))} unique crops")
    return windows


def rgba_pixels(image: Image.Image) -> bytes:
    return image.convert("RGBA").tobytes()


def encode_exact(image: Image.Image) -> bytes:
    # exact=True also preserves the hidden RGB values of fully transparent pixels.
    out = io.BytesIO()
    image.save(out, format="WEBP", lossless=True, method=6, exact=True,
               icc_profile=image.info.get("icc_profile", b""))
    data = out.getvalue()
    verify_pixels(image, data)
    return data


def verify_pixels(original: Image.Image, data: bytes) -> None:
    with Image.open(io.BytesIO(data)) as decoded:
        if decoded.format != "WEBP" or decoded.size != original.size or rgba_pixels(decoded) != rgba_pixels(original):
            raise ValueError("WebP decode differs from the original RGBA pixels")
        if decoded.info.get("icc_profile", b"") != original.info.get("icc_profile", b""):
            raise ValueError("WebP color profile differs from the original")


def emit(original: Image.Image, stem: str, folder: str, check: bool) -> dict:
    data = encode_exact(original)
    digest = hashlib.sha256(data).hexdigest()[:16]
    relative = Path("assets") / folder / f"{stem}.{digest}.webp"
    target = PAGE / relative
    if check:
        if not target.is_file() or target.read_bytes() != data:
            raise ValueError(f"Missing or stale generated image: {relative}")
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.is_file() or target.read_bytes() != data:
            target.write_bytes(data)
    # Independently reopen the persisted output; in-memory encode equality is insufficient.
    verify_pixels(original, target.read_bytes())
    return {"src": relative.as_posix(), "width": original.width, "height": original.height}


def run(check: bool) -> dict:
    if not features.check("webp"):
        raise RuntimeError("Pillow was built without WebP support")
    windows = crop_windows()
    manifest = {"crops": {}, "optimized": {}}
    originals = {}
    for source in range(1, 8):
        image = Image.open(ASSETS / f"reference-{source}.png")
        image.load()
        if image.size != (1586, 992):
            raise ValueError(f"Reference {source} changed its coordinate dimensions")
        originals[source] = image
    for source, x, y, width, height in sorted(set(windows)):
        image = originals[source].crop((x, y, x + width, y + height))
        key = f"{source},{x},{y},{width},{height}"
        manifest["crops"][key] = emit(image, f"ref{source}-{x}-{y}-{width}-{height}", "crops", check)
    for name in FULL_IMAGES:
        with Image.open(ASSETS / name) as image:
            image.load()
            manifest["optimized"][name] = emit(image, Path(name).stem, "optimized", check)
    encoded_manifest = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    if check:
        if not MANIFEST.is_file() or MANIFEST.read_text() != encoded_manifest:
            raise ValueError("Missing or stale crop-assets.json")
    elif not MANIFEST.is_file() or MANIFEST.read_text() != encoded_manifest:
        MANIFEST.write_text(encoded_manifest)
    source_bytes = sum((ASSETS / f"reference-{n}.png").stat().st_size for n in range(1, 8))
    full_source_bytes = sum((ASSETS / name).stat().st_size for name in FULL_IMAGES)
    crop_bytes = sum((PAGE / row["src"]).stat().st_size for row in manifest["crops"].values())
    full_bytes = sum((PAGE / row["src"]).stat().st_size for row in manifest["optimized"].values())
    return {"mode": "check" if check else "generate", "cropElements": len(windows), "uniqueCrops": len(manifest["crops"]),
            "referenceElementCounts": dict(sorted(Counter(str(v[0]) for v in windows).items())),
            "sourceReferenceBytes": source_bytes, "generatedCropBytes": crop_bytes,
            "sourceFullImageBytes": full_source_bytes, "generatedFullImageBytes": full_bytes,
            "sourceTotalBytes": source_bytes + full_source_bytes, "generatedTotalBytes": crop_bytes + full_bytes,
            "pixelComparison": "all 50 persisted outputs decode to identical RGBA pixels, including transparent RGB",
            "optimizedImages": {name: {"sourceBytes": (ASSETS / name).stat().st_size,
                                      "outputBytes": (PAGE / row["src"]).stat().st_size}
                                for name, row in manifest["optimized"].items()}}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify exact reproducibility and pixel equality without writing")
    args = parser.parse_args()
    print(json.dumps(run(args.check), ensure_ascii=False, indent=2))
