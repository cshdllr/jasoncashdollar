"""Create a downloadable preview that opens directly from index.html.

Requires Pillow and FFmpeg. Optimizes only the exported copies of media; the
source site and its original project pages remain untouched.
"""
from pathlib import Path
from PIL import Image, ImageOps
import argparse
import json
import shutil
import subprocess
import zipfile
from site_files import public_sources, media_assets

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('destination', type=Path)
args = parser.parse_args()
output = args.destination.resolve()
folder = output / 'Portfolio preview'
folder.mkdir(parents=True, exist_ok=True)

sources = public_sources()
assets = media_assets(sources)
mapping = {}
for asset in sorted(assets):
    source = ROOT / asset
    if not source.is_file():
        continue
    target = folder / asset
    if source.suffix.lower() in ('.png', '.jpg', '.jpeg') and 'images/previews/' not in asset:
        target = target.with_suffix('.webp')
        mapping[asset] = str(target.relative_to(folder))
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists() or source.stat().st_mtime > target.stat().st_mtime:
            with Image.open(source) as image:
                image = ImageOps.exif_transpose(image).convert('RGBA')
                image.thumbnail((2000, 1600))
                image.save(target, 'WEBP', quality=88)
    elif source.suffix == '.mp4' and 'images/previews/' not in asset:
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists() or source.stat().st_mtime > target.stat().st_mtime:
            print(f'Preparing {asset}', flush=True)
            subprocess.run([
                'ffmpeg', '-v', 'error', '-y', '-i', str(source),
                '-vf', 'scale=1280:1280:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,fps=24',
                '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '26',
                '-c:a', 'aac', '-b:a', '96k', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(target),
            ], check=True)
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)

books = json.dumps(json.loads((ROOT / 'data/books.json').read_text()), ensure_ascii=False)
for source in sources:
    text = source.read_text()
    for original, replacement in mapping.items():
        text = text.replace(original, replacement)
    if source.name == 'bookshelf.js':
        # file:// cannot fetch local JSON, so embed the same data in these copies.
        text = text.replace("await fetch('data/books.json')", f'({{ok: true, json: async () => ({books})}})')
    if source.name == 'analytics.js':
        text = '// Analytics disabled in this local preview.\n'
    target = folder / source.relative_to(ROOT)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text)

(folder / 'OPEN ME.txt').write_text(
    'Unzip this folder, then double-click index.html to open the preview in your browser.\n'
    'No server or installation is needed. The videos and project images are included.\n'
    'Click a thumbnail to enlarge it, use arrow keys to browse, and Escape to close.\n'
    'Book covers and external project links still need an internet connection.\n'
    'This export uses optimized media copies; the source files remain unchanged.\n'
)
archive = output / 'portfolio-preview.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as package:
    for path in sorted(folder.rglob('*')):
        if path.is_file():
            package.write(path, path.relative_to(output))
print(f'Created {archive} ({archive.stat().st_size / 1024**2:.1f} MB)', flush=True)
