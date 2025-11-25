const https = require('https');
const fs = require('fs');
const path = require('path');

// Rate limiting
const DELAY_MS = 1000; // 1 second between requests to be polite

/**
 * Fetch a Goodreads book page and extract the cover image URL
 */
async function fetchGoodreadsCover(bookId) {
  return new Promise((resolve, reject) => {
    const url = `https://www.goodreads.com/book/show/${bookId}`;
    
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        // Look for the large cover image in the HTML
        const imageRegex = /<img[^>]+class="[^"]*ResponsiveImage[^"]*"[^>]+src="([^"]+)"/;
        const match = data.match(imageRegex);
        
        if (match && match[1]) {
          resolve(match[1]);
        } else {
          // Try alternate pattern
          const altRegex = /<img[^>]+src="(https:\/\/i\.gr-assets\.com\/images\/S\/compressed\.photo\.goodreads\.com\/books\/[^"]+)"/;
          const altMatch = data.match(altRegex);
          
          if (altMatch && altMatch[1]) {
            resolve(altMatch[1]);
          } else {
            resolve(null);
          }
        }
      });
    }).on('error', (err) => {
      console.error(`Error fetching ${url}:`, err.message);
      resolve(null);
    });
  });
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main function
 */
async function main() {
  const booksPath = path.join(process.cwd(), 'data', 'books.json');
  
  if (!fs.existsSync(booksPath)) {
    console.error('books.json not found!');
    process.exit(1);
  }
  
  console.log('Loading books.json...');
  const data = JSON.parse(fs.readFileSync(booksPath, 'utf8'));
  const books = data.books;
  
  // Find books without covers
  const booksNeedingCovers = books.filter(book => !book.imageUrl && book.bookId);
  
  console.log(`\nFound ${booksNeedingCovers.length} books without covers`);
  
  if (booksNeedingCovers.length === 0) {
    console.log('All books have covers! Nothing to do.');
    return;
  }
  
  console.log('Starting to scrape Goodreads for missing covers...\n');
  
  let updated = 0;
  let failed = 0;
  
  for (let i = 0; i < booksNeedingCovers.length; i++) {
    const book = booksNeedingCovers[i];
    console.log(`[${i + 1}/${booksNeedingCovers.length}] Fetching cover for: ${book.title}`);
    
    try {
      const imageUrl = await fetchGoodreadsCover(book.bookId);
      
      if (imageUrl) {
        book.imageUrl = imageUrl;
        updated++;
        console.log(`  ✓ Found cover: ${imageUrl.substring(0, 80)}...`);
      } else {
        failed++;
        console.log(`  ✗ No cover found`);
      }
    } catch (error) {
      failed++;
      console.log(`  ✗ Error: ${error.message}`);
    }
    
    // Rate limiting - wait between requests
    if (i < booksNeedingCovers.length - 1) {
      await sleep(DELAY_MS);
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Total processed: ${booksNeedingCovers.length}`);
  console.log(`Successfully updated: ${updated}`);
  console.log(`Failed: ${failed}`);
  
  // Save updated books.json
  console.log('\nSaving updated books.json...');
  fs.writeFileSync(
    booksPath,
    JSON.stringify({ books, lastUpdated: new Date().toISOString() }, null, 2)
  );
  
  console.log('✓ Done! All covers have been updated.');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

