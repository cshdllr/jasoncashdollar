"""Create lossless transparent derivatives; originals are never overwritten.

Requires Pillow and NumPy. Background is removed only when connected to an
image edge. Color Research's isolated caption also clears letter counters.
Interior opaque pixels are verified byte-for-byte against the source.
"""
from pathlib import Path
from collections import deque
import json
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'images' / 'themed'
OUT.mkdir(exist_ok=True)


def exterior(candidate):
    """Scanline flood fill avoids Python work for every background pixel."""
    h, w = candidate.shape
    seen = np.zeros_like(candidate)
    queue = deque()
    for y in (0, h - 1):
        starts = np.flatnonzero(candidate[y] & ~np.r_[False, candidate[y, :-1]])
        queue.extend((y, int(x)) for x in starts)
    for y in range(h):
        if candidate[y, 0]: queue.append((y, 0))
        if candidate[y, -1]: queue.append((y, w - 1))
    while queue:
        y, x = queue.popleft()
        if seen[y, x] or not candidate[y, x]: continue
        row = candidate[y]
        left = np.flatnonzero(~row[:x])
        right = np.flatnonzero(~row[x:])
        lo = int(left[-1] + 1) if left.size else 0
        hi = int(x + right[0]) if right.size else w
        seen[y, lo:hi] = True
        for ny in (y - 1, y + 1):
            if not 0 <= ny < h: continue
            available = candidate[ny, lo:hi] & ~seen[ny, lo:hi]
            starts = np.flatnonzero(available & ~np.r_[False, available[:-1]])
            queue.extend((ny, int(lo + nx)) for nx in starts)
    return seen


def expand(mask):
    out = mask.copy()
    out[1:] |= mask[:-1]; out[:-1] |= mask[1:]
    out[:, 1:] |= mask[:, :-1]; out[:, :-1] |= mask[:, 1:]
    return out


def convert(path):
    image = Image.open(ROOT / path).convert('RGBA')
    pixels = np.asarray(image)
    rgb = pixels[:, :, :3].astype(np.float32)
    h, w = rgb.shape[:2]
    gradient = '/pixelmon/' in path
    if gradient:
        # The neutral background varies vertically. Estimate it from both
        # unobstructed side margins, never from the console or its screen.
        left = np.median(rgb[:, :40], axis=1)
        right = np.median(rgb[:, -40:], axis=1)
        t = np.linspace(0, 1, w, dtype=np.float32)[None, :, None]
        background = left[:, None, :] * (1-t) + right[:, None, :] * t
        tolerance = 9
    else:
        background = rgb[0, 0].copy()
        # The Color Research canvas includes very pale baked-in shadows;
        # include those in the matte so they cannot leave a cream halo.
        tolerance = 16 if 'color-research-cover' in path else 2
    distance = np.max(np.abs(rgb - background), axis=2)
    candidate = distance <= tolerance
    removed = exterior(candidate)
    color_canvas = 'color-research-cover' in path
    if color_canvas:
        # Only the caption's counters need global keying. Never key the whole
        # canvas: the white "Mix" label is enclosed inside its black button.
        caption_top = int(h * .73)
        removed[caption_top:] |= candidate[caption_top:]
    alpha = np.full((h,w), 255, dtype=np.uint8)
    alpha[removed] = 0
    # Unmatte the edge to avoid a baked-in light/dark fringe. Color Research
    # has a wider soft shadow; all pixels inside the edge stay unchanged.
    edge_band = removed.copy()
    for _ in range(6 if color_canvas else 1): edge_band = expand(edge_band)
    edge = edge_band & ~removed
    peak = distance.copy()
    for _ in range(10 if color_canvas else 2):
        next_peak = peak.copy()
        next_peak[1:] = np.maximum(next_peak[1:], peak[:-1])
        next_peak[:-1] = np.maximum(next_peak[:-1], peak[1:])
        next_peak[:,1:] = np.maximum(next_peak[:,1:], peak[:,:-1])
        next_peak[:,:-1] = np.maximum(next_peak[:,:-1], peak[:,1:])
        peak = next_peak
    coverage = np.clip(distance / np.maximum(peak, 1), 0, 1)
    feather = edge & (coverage < .98)
    alpha[feather] = np.maximum(1, np.round(coverage[feather]*255)).astype(np.uint8)
    result = pixels.copy()
    result[:,:,3] = alpha
    bg = np.broadcast_to(background, rgb.shape)
    a = alpha[feather, None].astype(np.float32) / 255
    result[feather,:3] = np.clip(np.round((rgb[feather] - bg[feather]*(1-a))/a),0,255).astype(np.uint8)
    assert np.array_equal(result[alpha == 255], pixels[alpha == 255]), path
    assert .05 < removed.mean() < .95, (path, removed.mean())
    target = OUT / (Path(path).stem.replace(' ', '-') + '.webp')
    Image.fromarray(result).save(target, 'WEBP', lossless=True, method=4)
    # Verify encoded output rather than relying on the encoder flag alone.
    decoded = np.asarray(Image.open(target).convert('RGBA'))
    assert np.array_equal(decoded[alpha == 255], pixels[alpha == 255]), path
    assert np.array_equal(decoded[:,:,3], alpha), path
    return {
        'src': str(target.relative_to(ROOT)), 'status': 'Transparent background',
        'note': ('Canvas background removed; original UI colors retained. The black Mix button has less contrast on charcoal.' if color_canvas else
                 'Exterior background removed; original dimensions and opaque artwork pixels preserved.' + (' Gradient surround removed.' if gradient else '')),
        'width': w, 'height': h, 'backgroundRemovedPercent': round(float(removed.mean()*100),2),
        'opaquePixelsUnchanged': True,
    }


def main():
    source = (ROOT / 'data/previews.js').read_text()
    projects = json.loads(source[source.index('['):].rstrip(';\n'))
    manifest = {}
    for project in projects:
        for item in project['items']:
            if item['type'] != 'image': continue
            path = item.get('originalSrc', item['src'])
            if 'pixelmon-editor' in path:
                result = {'src': path, 'status': 'Full-screen interface', 'note': 'The dark areas are the application interface itself, so this screenshot is preserved.'}
            elif '/glance/' in path:
                result = {'src': path, 'status': 'Already transparent', 'note': 'The existing transparent asset already adapts to either background.'}
            else:
                result = convert(path)
            manifest[path] = result
            print(path, result['status'], flush=True)
    (ROOT / 'data/background-review.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(f'Prepared {len(manifest)} images for comparison.')

if __name__ == '__main__': main()
