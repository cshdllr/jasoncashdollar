# Bookshelf Feature Documentation

## Overview

The bookshelf feature automatically syncs your read books from Goodreads and displays them in a beautiful 3D coverflow carousel on your website.

## How It Works

### 1. Automatic Data Fetching
- **GitHub Actions Workflow** (`.github/workflows/update-bookshelf.yml`) runs every Monday at 9:00 AM UTC
- Can also be triggered manually from the Actions tab on GitHub
- Fetches your Goodreads RSS feed and parses book data
- Saves book information to `data/books.json`
- Automatically commits and pushes changes if new books are detected

### 2. Book Data
The following information is extracted for each book:
- Title
- Author
- Your rating (1-5 stars)
- Date read
- Book cover image (high-resolution from Goodreads)
- Average rating on Goodreads
- Number of pages
- Publication year
- ISBN (when available)

### 3. Display
- **Coverflow Effect**: Books are displayed in a 3D carousel using Swiper.js
- **Navigation**: Arrow buttons, keyboard arrow keys, and touch/swipe gestures
- **Book Details**: When a book is selected, its details appear below the carousel
- **Responsive Design**: Adapts beautifully to desktop, tablet, and mobile devices

## Files

### Core Files
- `bookshelf.html` - Main bookshelf page
- `bookshelf.js` - JavaScript logic for coverflow and data loading
- `styles.css` - Contains bookshelf-specific styles at the bottom
- `data/books.json` - Auto-generated book data (don't edit manually)

### Automation Files
- `.github/workflows/update-bookshelf.yml` - GitHub Actions workflow
- `.github/scripts/fetch-books.js` - Node.js script that fetches and parses RSS feed

## Usage

### Viewing the Bookshelf
Simply navigate to `bookshelf.html` on your website or click the "Bookshelf" link in the navigation.

### Adding New Books
1. Mark books as "read" on your Goodreads profile
2. Wait for the next automated update (every Monday) OR
3. Manually trigger the workflow:
   - Go to your GitHub repository
   - Click "Actions" tab
   - Select "Update Bookshelf" workflow
   - Click "Run workflow"

### Manual Update (Local Development)
```bash
cd /path/to/your/repo
node .github/scripts/fetch-books.js
```

## Customization

### Change Update Frequency
Edit `.github/workflows/update-bookshelf.yml` and modify the cron schedule:
```yaml
schedule:
  - cron: '0 9 * * 1'  # Every Monday at 9am UTC
```

Common schedules:
- Daily: `'0 9 * * *'`
- Weekly (Monday): `'0 9 * * 1'`
- Monthly (1st of month): `'0 9 1 * *'`

### Customize Coverflow Settings
Edit `bookshelf.js` and modify the Swiper configuration:
```javascript
const swiper = new Swiper('.bookshelf-swiper', {
    effect: 'coverflow',
    coverflowEffect: {
        rotate: 50,      // Rotation angle
        stretch: 0,      // Stretch space between slides
        depth: 100,      // Depth offset
        modifier: 1,     // Effect multiplier
        slideShadows: true,
    },
    // ... other settings
});
```

### Styling
Bookshelf-specific styles are in `styles.css` under the `/* ===== BOOKSHELF PAGE STYLES ===== */` section.

## Dependencies

### External Libraries
- **Swiper.js v11** - Coverflow carousel effect
  - Loaded from CDN in `bookshelf.html`
  - CSS: `https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css`
  - JS: `https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js`

### GitHub Actions
- **Node.js 20** - For running the fetch script
- Uses built-in Node.js `https` module (no external npm packages required)

## Troubleshooting

### Books Not Updating
1. Check if the workflow ran successfully in GitHub Actions tab
2. Verify your Goodreads RSS feed URL is correct in `.github/scripts/fetch-books.js`
3. Make sure the repository has write permissions for GitHub Actions

### Images Not Loading
- Goodreads images are served from their CDN
- If an image fails to load, a placeholder will be shown
- Some very old books may not have cover images

### Coverflow Not Working
1. Check browser console for errors
2. Ensure Swiper.js CDN links are loading properly
3. Verify `data/books.json` exists and contains valid JSON

## Technical Details

### RSS Feed Format
The Goodreads RSS feed is in XML format with book data in `<item>` blocks. The fetch script uses regex to parse this XML (simple and reliable for this structured format).

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge) - Full support
- Mobile browsers - Full support with touch gestures
- Older browsers - Graceful fallback (no 3D effects, but still functional)

### Performance
- Images are lazy-loaded for better performance
- Only 100 most recent books are fetched (Goodreads RSS limit)
- Book data is cached in `data/books.json` to avoid repeated API calls

## Future Enhancements

Potential improvements you could add:
- Search/filter functionality
- Sort by rating, date, or author
- Different view modes (grid, list, etc.)
- Book reviews/notes from Goodreads
- Link to Goodreads book page
- Reading statistics and charts

