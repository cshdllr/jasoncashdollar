"""Stage public site files, excluding source data, scripts, and review experiments."""
from pathlib import Path
import argparse
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]


def public_sources(root=ROOT):
    sources = [path for extension in ('html', 'css', 'js')
               for path in root.glob(f'*.{extension}')
               if not path.name.startswith('_') and path.name != 'background-review.html']
    return sorted(sources + [root / 'data/books.json', root / 'data/previews.js'])


def media_assets(sources, root=ROOT):
    # Both HTML and generated JS use literal asset paths; retain spaces in names.
    assets = {asset for source in sources
              for asset in re.findall(r'''["'](images/[^"']+)["']''', source.read_text())}
    assets.update(str(path.relative_to(root)) for path in (root / 'icons').glob('*') if path.is_file())
    return sorted(asset for asset in assets if (root / asset).is_file())


def prepare(destination):
    destination = destination.resolve()
    if destination.exists() and any(destination.iterdir()):
        raise ValueError('Destination must be empty; refusing to overwrite existing files.')
    sources = public_sources()
    sources += [ROOT / asset for asset in media_assets(sources)]
    sources += [ROOT / name for name in ('CNAME', 'robots.txt', 'sitemap.xml') if (ROOT / name).is_file()]
    for source in sources:
        target = destination / source.relative_to(ROOT)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    (destination / '.nojekyll').touch()
    print(f'Staged {len(sources)} public files in {destination}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination', type=Path)
    prepare(parser.parse_args().destination)
