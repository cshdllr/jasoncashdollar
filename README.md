# Jason Cashdollar — Portfolio

A static HTML, CSS, and JavaScript portfolio. No browser framework, animation library,
CDN dependency, or production build is required.

## Local development

Run `python3 scripts/serve-preview.py` and open `http://127.0.0.1:8000`.
This local server supports byte ranges for video seeking. The homepage also opens
from `index.html` directly; the full bookshelf fetches JSON and needs the server.

## Site structure

- `index.html`, `styles.css`, `script.js`: homepage and shared site behavior.
- `previews.js`, `previews.css`: thumbnail stacks, lightbox, and animations.
- `data/preview-projects.json`: project order, labels, short captions, links, and
  media presentation. `mediaStyle.image` and `mediaStyle.video` support `background`,
  `viewerFit`, and `thumbnailFit`; omitted settings use the CSS defaults.
- `data/previews.js`: generated gallery data, checked in for static hosting and
  direct-file previews. Do not edit by hand.
- Individual project HTML pages: preserved media sources, available at their existing
  URLs but not linked from the homepage. Without JavaScript, project labels remain text.
- `bookshelf.html`, `bookshelf.js`, `bookshelf-coverflow.*`, `bookshelf-identity.js`:
  the bookshelf and its four views. See `BOOKSHELF_README.md` for syncing details.

The homepage and Bookshelf share title/photo styles and header spacing tokens in
`styles.css`: `--home-content-width`, `--site-header-top`, and `--site-header-bottom`.

## Gallery content and assets

Edit the project pages or `data/preview-projects.json`, then run:

```sh
python3 scripts/build-previews.py
```

The full rebuild requires Pillow and FFmpeg. It generates small WebP thumbnails,
small silent 15 fps MP4 previews, and still-image viewer copies capped at 2000 × 1600.
The lightbox uses full-resolution videos. Original media and transparent cutouts
remain preserved for future changes. Pixélmon uses its original photos.

Homepage videos play only while visible, pause offscreen and while the viewer is
open, and retain a poster until a decoded frame is ready. Reduced-motion settings
skip animation and autoplay. Click thumbnails or project titles to open the viewer,
use adjacent cards, arrow keys, or horizontal swipes across photos and captions
to browse, and Escape to close. Touch devices hide native video controls: tap a video to play/pause or swipe to
browse. Desktop retains native playback controls.

Press **T** inside the viewer to adjust media and caption animation settings.
Settings persist locally; Reset restores defaults. Captions remain anchored while
media moves. The implementation also preserves the canvas-export fallback needed
for direct-file video previews.

### Book updates

The scheduled Goodreads workflow refreshes both `data/books.json` and the homepage
book previews/count. To refresh only the homepage books locally:

```sh
python3 scripts/build-previews.py --books-only
```

This uses only Python’s standard library and leaves all other project previews and
media unchanged. Covers still load from their external URLs.

### Background review tools

`background-review.html` compares original photos and transparent derivatives on
light and dark backgrounds. It and the rejected AI trial are local review tools,
excluded from deployment and portable exports. `data/background-review.json` is
also a build input, so keep it with the sources.

To rebuild cutouts, run `python3 scripts/standardize-image-backgrounds.py` (Pillow
and NumPy), followed by the full preview rebuild. Opaque artwork pixels are checked
against originals; only the exterior matte and its antialiased edge are changed.

## Verification

```sh
node scripts/test-viewer-swipe.cjs
node scripts/test-video-frame.cjs
node scripts/test-rubber-band.cjs
node --test .github/scripts/fetch-books.test.js
python3 scripts/test-site-build.py
```

## Publishing and portable previews

GitHub Pages deploys on pushes to `main` and successful bookshelf updates. The
workflow stages public pages, browser code, runtime data, and referenced assets
with `scripts/site_files.py`. Source configs, data backups, scripts, documentation,
and review experiments stay out of the published artifact. Existing project URLs
and their media remain available. Staging does not publish by itself:

```sh
python3 scripts/site_files.py /tmp/portfolio-site
```

The staging destination must be empty. To make a smaller downloadable copy:

```sh
python3 scripts/package-local-preview.py /tmp/portfolio-export
```

The resulting `portfolio-preview.zip` uses the same public file selection, optimizes
exported media, and embeds book data so it can open directly from `index.html`.
The source files remain untouched; external book covers still need internet access.
