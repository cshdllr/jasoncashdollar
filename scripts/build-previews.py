"""Rebuild homepage preview data and small thumbnails from the preserved pages.

Run from any directory: python scripts/build-previews.py (requires Pillow and FFmpeg).
The original HTML pages remain the source of descriptions and media.
"""
from html.parser import HTMLParser
from pathlib import Path
from email.utils import parsedate_to_datetime
import argparse
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BACKGROUND_MANIFEST = ROOT / 'data' / 'background-review.json'
IMAGE_VARIANTS = json.loads(BACKGROUND_MANIFEST.read_text()) if BACKGROUND_MANIFEST.exists() else {}


class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent = tag, dict(attrs), parent
        self.children = []

    def find(self, predicate):
        result = []
        for child in self.children:
            if isinstance(child, Node):
                if predicate(child):
                    result.append(child)
                result.extend(child.find(predicate))
        return result

    def has_class(self, name):
        return name in self.attrs.get('class', '').split()

    def text(self):
        return ' '.join(''.join(c.text() if isinstance(c, Node) else c for c in self.children).split())


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.root = self.current = Node()
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.current)
        self.current.children.append(node)
        if tag not in ('img', 'meta', 'link', 'br', 'hr', 'input', 'source', 'wbr'):
            self.current = node

    def handle_endtag(self, tag):
        node = self.current
        while node.parent:
            if node.tag == tag:
                self.current = node.parent
                return
            node = node.parent

    def handle_data(self, text):
        self.current.children.append(text)


def paragraphs(node):
    return [p.text() for p in node.find(lambda n: n.has_class('section-text') or n.has_class('image-caption'))
            if p.text() and not p.find(lambda n: n.has_class('link-button'))]


def thumbnail(source, slug, index):
    path = ROOT / 'images' / 'previews' / f'{slug}-{index + 1}.webp'
    source = ROOT / source
    if not path.exists() or max(source.stat().st_mtime, Path(__file__).stat().st_mtime) > path.stat().st_mtime:
        from PIL import Image, ImageOps
        with Image.open(source) as image:
            image = ImageOps.exif_transpose(image).convert('RGBA')
            image.thumbnail((360, 224))
            image.save(path, 'WEBP', quality=82)
    return str(path.relative_to(ROOT))


def viewer_image(source, slug, index):
    """Bound still-image decode cost at 2x the desktop viewer's size."""
    from PIL import Image, ImageOps
    source = ROOT / source
    path = ROOT / 'images' / 'viewer' / f'{slug}-{index + 1}.webp'
    with Image.open(source) as image:
        if image.width <= 2000 and image.height <= 1600:
            return str(source.relative_to(ROOT))
        if not path.exists() or source.stat().st_mtime > path.stat().st_mtime:
            path.parent.mkdir(parents=True, exist_ok=True)
            image = ImageOps.exif_transpose(image).convert('RGBA')
            image.thumbnail((2000, 1600), Image.Resampling.LANCZOS)
            image.save(path, 'WEBP', quality=90, method=4)
    return str(path.relative_to(ROOT))


def video_preview(source, slug, index):
    path = ROOT / 'images' / 'previews' / f'{slug}-{index + 1}.mp4'
    source = ROOT / source
    if not path.exists() or source.stat().st_mtime > path.stat().st_mtime:
        # Small, silent copies keep simultaneous homepage playback inexpensive.
        temporary = path.with_suffix('.tmp.mp4')
        subprocess.run([
            'ffmpeg', '-v', 'error', '-y', '-i', str(source), '-an',
            '-vf', 'scale=360:224:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,fps=15',
            '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '29',
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(temporary),
        ], check=True)
        temporary.replace(path)
    return str(path.relative_to(ROOT))


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--books-only', action='store_true',
                    help='Refresh only book previews; no Pillow or FFmpeg required.')
args = parser.parse_args()
if args.books_only:
    projects = json.loads((ROOT / 'data/previews.js').read_text().split(' = ', 1)[1].rstrip(';\n'))
else:
    (ROOT / 'images' / 'previews').mkdir(exist_ok=True)
    projects = json.loads((ROOT / 'data' / 'preview-projects.json').read_text())
for project in projects:
    slug = project['slug']
    if slug == 'bookshelf':
        books = json.loads((ROOT / 'data' / 'books.json').read_text())['books']
        project['totalBooks'] = len(books)
        books = sorted((b for b in books if b.get('readAt')),
                       key=lambda b: parsedate_to_datetime(b['readAt']), reverse=True)[:6]
        project['links'] = [{'href': 'bookshelf.html', 'label': 'All books'}]
        project['items'] = []
        for book in books:
            project['items'].append({
                'type': 'book', 'src': book['imageUrl'], 'thumbnail': book['imageUrl'],
                'title': book['title'], 'alt': f"{book['title']} by {book['author']}",
                'description': [f"By {book['author']}"],
            })
        continue
    if args.books_only:
        continue
    doc = Document((ROOT / f'{slug}.html').read_text()).root
    main = doc.find(lambda n: n.tag == 'main')[0]
    sections = main.find(lambda n: n.has_class('project-section'))
    overview = next((paragraphs(s) for s in sections
                     if paragraphs(s) and not s.find(lambda n: n.has_class('section-header'))), [])
    project['links'] = [{'href': a.attrs['href'], 'label': a.text()}
                        for a in main.find(lambda n: n.tag == 'a' and n.attrs.get('href', '').startswith('https:'))]
    project['links'] = project.pop('previewLinks', project['links'])
    preview_title = project.pop('previewTitle', None)
    use_original_images = project.pop('useOriginalImages', False)
    project['items'] = []
    excluded = project.pop('excludeMedia', [])
    titles = project.pop('mediaTitles', {})
    descriptions = project.pop('mediaDescriptions', {})
    # Keep derivative filenames stable when a gallery item is excluded.
    for media_index, media in enumerate(main.find(lambda n: n.tag in ('img', 'video'))):
        src = media.attrs['src']
        if src in excluded:
            continue
        section = media.parent
        while section.parent and not section.has_class('project-section'):
            section = section.parent
        headings = section.find(lambda n: n.has_class('section-header'))
        title = headings[0].text() if headings else project['title']
        title = titles.get(src, preview_title or title)
        description = paragraphs(section) or overview or [project['description']]
        description = descriptions.get(src, description)
        poster = media.attrs.get('poster', '')
        assert (ROOT / src).is_file(), src
        original_src = src
        if media.tag == 'img' and not use_original_images:
            src = IMAGE_VARIANTS.get(src, {}).get('src', src)
        project['items'].append({
            'type': 'video' if media.tag == 'video' else 'image',
            'src': src, 'poster': poster,
            'thumbnail': thumbnail(poster or src, slug, media_index),
            'title': title, 'alt': media.attrs.get('alt') or media.attrs.get('aria-label') or title,
            'description': description,
        })
        if src != original_src:
            project['items'][-1]['originalSrc'] = original_src
        if media.tag == 'img':
            project['items'][-1]['viewerSrc'] = viewer_image(src, slug, media_index)
        if media.tag == 'video':
            project['items'][-1]['previewVideo'] = video_preview(src, slug, media_index)

output = '// Generated by scripts/build-previews.py; edit source pages or data/preview-projects.json, then rebuild.\n'
output += 'window.PORTFOLIO_PREVIEWS = ' + json.dumps(projects, ensure_ascii=False, indent=2) + ';\n'
(ROOT / 'data' / 'previews.js').write_text(output)
print(f"Built {len(projects)} galleries with {sum(len(p['items']) for p in projects)} previews.")
