"""Regression checks for book-only updates and public-file selection."""
from pathlib import Path
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import site_files

ROOT = Path(__file__).resolve().parents[1]


class SiteBuildTests(unittest.TestCase):
    def test_books_refresh_without_media_tools_preserves_other_projects(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'scripts').mkdir()
            (root / 'data').mkdir()
            shutil.copy2(ROOT / 'scripts/build-previews.py', root / 'scripts/build-previews.py')
            project = {'slug': 'sample', 'mediaStyle': {'video': {'background': '#000'}},
                       'items': [{'src': 'untouched.mp4'}]}
            projects = [project, {'slug': 'bookshelf', 'totalBooks': 0, 'items': []}]
            (root / 'data/previews.js').write_text('window.PORTFOLIO_PREVIEWS = ' + json.dumps(projects) + ';\n')
            books = [{'title': f'Book {i}', 'author': 'Author', 'imageUrl': f'https://example.com/{i}.jpg',
                      'readAt': f'Mon, {i + 1:02} Sep 2025 00:00:00 GMT'} for i in range(8)]
            (root / 'data/books.json').write_text(json.dumps({'books': books}))
            subprocess.run([sys.executable, str(root / 'scripts/build-previews.py'), '--books-only'], check=True,
                           capture_output=True)
            output = json.loads((root / 'data/previews.js').read_text().split(' = ', 1)[1].rstrip(';\n'))
            self.assertEqual(output[0], project)
            self.assertEqual(output[1]['totalBooks'], 8)
            self.assertEqual([item['title'] for item in output[1]['items']],
                             [f'Book {i}' for i in range(7, 1, -1)])
            self.assertFalse((root / 'images').exists())
            before = (root / 'data/previews.js').read_bytes()
            subprocess.run([sys.executable, str(root / 'scripts/build-previews.py'), '--books-only'], check=True,
                           capture_output=True)
            self.assertEqual((root / 'data/previews.js').read_bytes(), before)

    def test_public_artifact_excludes_review_and_source_material(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'source'
            destination = Path(folder) / 'site'
            files = {
                'index.html': '<img src="images/photo with spaces.png"><script src="data/previews.js"></script>',
                'bookshelf.html': '<script src="bookshelf.js"></script>',
                'bookshelf.js': "fetch('data/books.json')", 'styles.css': '',
                'data/books.json': '{}', 'data/previews.js': 'window.PORTFOLIO_PREVIEWS = [];',
                'images/photo with spaces.png': 'image', 'CNAME': 'example.com',
                'background-review.html': '<img src="images/background-review/trial.png">',
                'images/background-review/trial.png': 'trial', '_project-template.html': '',
                'data/preview-projects.json': '{}', 'data/books.backup.json': '{}',
                'scripts/dev.py': '', 'README.md': '',
            }
            for name, text in files.items():
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(text)
            # Explicit roots make file selection testable without copying repository media.
            sources = site_files.public_sources(root)
            self.assertEqual(site_files.media_assets(sources, root), ['images/photo with spaces.png'])
            with patch.object(site_files, 'ROOT', root), \
                 patch.object(site_files, 'public_sources', return_value=sources), \
                 patch.object(site_files, 'media_assets', return_value=site_files.media_assets(sources, root)):
                site_files.prepare(destination)
                with self.assertRaises(ValueError):
                    site_files.prepare(destination)
            self.assertEqual({str(p.relative_to(destination)) for p in destination.rglob('*') if p.is_file()},
                             {'index.html', 'bookshelf.html', 'bookshelf.js', 'styles.css', 'data/books.json',
                              'data/previews.js', 'images/photo with spaces.png', 'CNAME', '.nojekyll'})


if __name__ == '__main__':
    unittest.main()
