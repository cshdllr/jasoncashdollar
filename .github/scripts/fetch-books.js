const https = require('https');
const fs = require('fs');
const path = require('path');

const RSS_FEED_URL = 'https://www.goodreads.com/review/list_rss/7275511?key=FDAhzaFkwW1x8rhr_M0sD54b28PYpbMSXyLrOUIB_FLLkctm&shelf=read';
const CSV_PATH = path.join(process.cwd(), 'data', 'goodreads_library.csv');

/**
 * Fetch the RSS feed from Goodreads
 */
function fetchRSSFeed(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(data);
      });
      
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Parse CSV file and extract read books
 */
function parseCSV(csvPath) {
  const books = [];
  
  if (!fs.existsSync(csvPath)) {
    console.log('CSV file not found, skipping CSV import');
    return books;
  }
  
  const csvData = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvData.split('\n');
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV (handling quoted fields)
    const fields = parseCSVLine(line);
    
    if (fields.length < 19) continue;
    
    // Column mapping based on CSV structure
    const bookId = fields[0];
    const title = fields[1];
    const author = fields[2];
    const myRating = parseInt(fields[7]) || 0;
    const averageRating = parseFloat(fields[8]) || 0;
    const numPages = parseInt(fields[11]) || 0;
    const yearPublished = fields[12];
    const dateRead = fields[14]; // Format: YYYY/MM/DD
    const exclusiveShelf = fields[18];
    
    // Only include books marked as "read"
    if (exclusiveShelf !== 'read') continue;
    
    // Convert date format from YYYY/MM/DD to a readable format
    let readAt = '';
    if (dateRead) {
      const dateParts = dateRead.split('/');
      if (dateParts.length === 3) {
        const [year, month, day] = dateParts;
        readAt = new Date(`${year}-${month}-${day}`).toUTCString();
      }
    }
    
    books.push({
      title: cleanField(title),
      author: cleanField(author),
      rating: myRating,
      readAt: readAt,
      bookId: bookId,
      isbn: '',
      imageUrl: '', // Will use Goodreads URL from RSS if book is in both sources
      averageRating: averageRating,
      bookPublished: yearPublished,
      numPages: numPages,
      source: 'csv'
    });
  }
  
  console.log(`Parsed ${books.length} read books from CSV`);
  return books;
}

/**
 * Simple CSV line parser that handles quoted fields
 */
function parseCSVLine(line) {
  const fields = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  // Add last field
  fields.push(currentField);
  
  return fields;
}

/**
 * Clean field by removing quotes and extra whitespace
 */
function cleanField(field) {
  return field.replace(/^["']|["']$/g, '').trim();
}

/**
 * Simple XML parser to extract book data from RSS feed
 */
function parseRSSFeed(xmlData) {
  const books = [];
  
  // Match all <item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const items = [...xmlData.matchAll(itemRegex)];
  
  items.forEach((itemMatch) => {
    const itemContent = itemMatch[1];
    
    // Extract fields using regex
    const title = extractTag(itemContent, 'title');
    const author = extractTag(itemContent, 'author_name');
    const rating = parseInt(extractTag(itemContent, 'user_rating')) || 0;
    const readAt = extractTag(itemContent, 'user_read_at');
    const bookId = extractTag(itemContent, 'book_id');
    const isbn = extractTag(itemContent, 'isbn');
    const averageRating = parseFloat(extractTag(itemContent, 'average_rating')) || 0;
    const bookPublished = extractTag(itemContent, 'book_published');
    const numPages = parseInt(extractTag(itemContent, 'num_pages')) || 0;
    
    // Extract image URLs - prefer large image
    const largeImageUrl = extractTag(itemContent, 'book_large_image_url');
    const mediumImageUrl = extractTag(itemContent, 'book_medium_image_url');
    const smallImageUrl = extractTag(itemContent, 'book_image_url');
    
    // Use the largest available image
    const imageUrl = largeImageUrl || mediumImageUrl || smallImageUrl;
    
    if (title && author) {
      books.push({
        title,
        author,
        rating,
        readAt,
        bookId,
        isbn,
        imageUrl,
        averageRating,
        bookPublished,
        numPages,
        source: 'rss'
      });
    }
  });
  
  return books;
}

/**
 * Extract content from XML tag
 */
function extractTag(content, tagName) {
  const regex = new RegExp(`<${tagName}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, 'i');
  const cdataMatch = content.match(regex);
  
  if (cdataMatch) {
    return cdataMatch[1].trim();
  }
  
  // Try without CDATA
  const simpleRegex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const simpleMatch = content.match(simpleRegex);
  
  if (simpleMatch) {
    return simpleMatch[1].trim();
  }
  
  return '';
}

/**
 * Merge CSV books with RSS books, preserving existing Goodreads imageUrls
 * Priority: RSS > existing books.json > CSV
 */
function mergeBooks(csvBooks, rssBooks, existingBooks = []) {
  const bookMap = new Map();
  
  // First, add existing books to preserve their imageUrls
  existingBooks.forEach(book => {
    const key = `${book.title.toLowerCase()}_${book.author.toLowerCase()}`;
    bookMap.set(key, book);
  });
  
  // Add/update with CSV books (but preserve existing imageUrl if CSV doesn't have one)
  csvBooks.forEach(book => {
    const key = `${book.title.toLowerCase()}_${book.author.toLowerCase()}`;
    const existing = bookMap.get(key);
    
    if (existing && existing.imageUrl && !book.imageUrl) {
      // Preserve existing Goodreads imageUrl
      book.imageUrl = existing.imageUrl;
    }
    
    bookMap.set(key, book);
  });
  
  // RSS books always take precedence (they have the best data)
  rssBooks.forEach(book => {
    const key = `${book.title.toLowerCase()}_${book.author.toLowerCase()}`;
    bookMap.set(key, book);
  });
  
  // Convert back to array and sort by read date (newest first)
  const mergedBooks = Array.from(bookMap.values());
  
  mergedBooks.sort((a, b) => {
    const dateA = a.readAt ? new Date(a.readAt) : new Date(0);
    const dateB = b.readAt ? new Date(b.readAt) : new Date(0);
    return dateB - dateA; // Newest first
  });
  
  return mergedBooks;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Starting book data collection...');
    
    // Define paths
    const dataDir = path.join(process.cwd(), 'data');
    const outputPath = path.join(dataDir, 'books.json');
    
    // Load existing books.json to preserve imageUrls
    let existingBooks = [];
    if (fs.existsSync(outputPath)) {
      console.log('Loading existing books.json...');
      const existingData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      existingBooks = existingData.books || [];
      console.log(`Found ${existingBooks.length} existing books`);
    }
    
    // Parse CSV file
    console.log('Reading CSV file...');
    const csvBooks = parseCSV(CSV_PATH);
    
    // Fetch RSS feed
    console.log('Fetching Goodreads RSS feed...');
    const xmlData = await fetchRSSFeed(RSS_FEED_URL);
    
    console.log('Parsing RSS feed...');
    const rssBooks = parseRSSFeed(xmlData);
    console.log(`Found ${rssBooks.length} books in RSS feed`);
    
    // Merge the data (preserving existing imageUrls)
    console.log('Merging CSV, RSS, and existing book data...');
    const books = mergeBooks(csvBooks, rssBooks, existingBooks);
    
    console.log(`Total unique books: ${books.length}`);
    console.log(`  - From CSV: ${csvBooks.length}`);
    console.log(`  - From RSS: ${rssBooks.length}`);
    console.log(`  - Merged result: ${books.length}`);
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Write to data/books.json
    fs.writeFileSync(
      outputPath,
      JSON.stringify({ books, lastUpdated: new Date().toISOString() }, null, 2)
    );
    
    console.log(`Successfully wrote ${books.length} books to ${outputPath}`);
    
    // Log date range
    if (books.length > 0) {
      const oldestBook = books[books.length - 1];
      const newestBook = books[0];
      console.log(`\nDate range:`);
      console.log(`  Oldest: ${oldestBook.readAt || 'No date'} - ${oldestBook.title}`);
      console.log(`  Newest: ${newestBook.readAt || 'No date'} - ${newestBook.title}`);
    }
    
  } catch (error) {
    console.error('Error fetching or parsing book data:', error);
    process.exit(1);
  }
}

main();

