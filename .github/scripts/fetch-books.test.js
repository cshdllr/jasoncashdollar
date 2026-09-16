const assert = require('node:assert/strict');
const http = require('node:http');
const { after, before, test } = require('node:test');

const {
  fetchRSSFeed,
  parseRSSFeed
} = require('./fetch-books');

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Writers &amp; Lovers</title>
      <author_name> Lily   King </author_name>
      <user_rating>5</user_rating>
      <user_read_at><![CDATA[Fri, 1 May 2026 00:00:00 +0000]]></user_read_at>
      <book_id>1</book_id>
      <isbn>1234567890</isbn>
      <average_rating>4.1</average_rating>
      <book_published>2020</book_published>
      <num_pages>320</num_pages>
      <book_large_image_url><![CDATA[https://example.com/cover.jpg]]></book_large_image_url>
    </item>
  </channel>
</rss>`;

let server;
let baseUrl;

before(async () => {
  server = http.createServer((request, response) => {
    if (request.url === '/redirect') {
      response.writeHead(302, { Location: '/feed' });
      response.end();
      return;
    }

    if (request.url === '/feed') {
      if (!request.headers['user-agent']) {
        response.writeHead(403);
        response.end('Missing user agent');
        return;
      }

      response.writeHead(200, { 'Content-Type': 'application/xml' });
      response.end(SAMPLE_RSS);
      return;
    }

    response.writeHead(503);
    response.end('Unavailable');
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
});

test('fetchRSSFeed identifies itself and follows redirects', async () => {
  const xml = await fetchRSSFeed(`${baseUrl}/redirect`);
  assert.equal(xml, SAMPLE_RSS);
});

test('fetchRSSFeed rejects non-success HTTP responses', async () => {
  await assert.rejects(
    fetchRSSFeed(`${baseUrl}/unavailable`),
    /HTTP 503/
  );
});

test('parseRSSFeed parses fields and normalizes whitespace', () => {
  const books = parseRSSFeed(SAMPLE_RSS);

  assert.equal(books.length, 1);
  assert.equal(books[0].title, 'Writers & Lovers');
  assert.equal(books[0].author, 'Lily King');
  assert.equal(books[0].readAt, 'Fri, 1 May 2026 00:00:00 +0000');
  assert.equal(books[0].imageUrl, 'https://example.com/cover.jpg');
});

const { mergeBooks } = require('./fetch-books');
const { dedupeBooks, groupBooks } = require('../../bookshelf-identity');

test('title and author changes cannot duplicate the same Goodreads book', () => {
  const oldRaja = { bookId: '230400297', title: 'The True True Story of Raja the Gullible (and His Mother): A Novel (National Book Award Winner)', author: 'Rabih Alameddine', imageUrl: 'saved-cover.jpg' };
  const newRaja = { ...oldRaja, title: 'The True True Story of Raja the Gullible (and His Mother)', imageUrl: '', rating: 0 };
  const oldBeowulf = { bookId: '45889029', title: 'Beowulf: A New Translation', author: 'Beowulf Poet' };
  const newBeowulf = { ...oldBeowulf, author: 'Unknown' };
  const result = mergeBooks([], [newRaja, newBeowulf], [oldRaja, oldBeowulf]);
  assert.equal(result.length, 2);
  assert.equal(result[0].title, newRaja.title);
  assert.equal(result[0].imageUrl, 'saved-cover.jpg');
  assert.equal(result[0].rating, 0);
  assert.equal(result[1].author, 'Unknown');
  assert.equal(dedupeBooks([oldRaja, newRaja, oldBeowulf, newBeowulf]).length, 2);
  assert.deepEqual(mergeBooks([], [newRaja, newBeowulf], result), result);
});

test('different editions match normalized titles and authors, including publishing labels', () => {
  const first = { bookId: '1', title: 'Example: A Novel (National Book Award Winner)', author: 'An Author' };
  const second = { bookId: '2', title: ' EXAMPLE ', author: 'an  author' };
  assert.equal(dedupeBooks([first, second]).length, 1);
  assert.equal(dedupeBooks([{ title: 'Writer’s Life', author: 'A' }, { title: "Writer's Life", author: 'A' }]).length, 1);
});

test('distinct authors, subtitles and numbered series volumes are preserved', () => {
  const books = [
    { title: 'Home', author: 'A' }, { title: 'Home', author: 'B' },
    { title: 'Volume (Series #1)', author: 'A' }, { title: 'Volume (Series #2)', author: 'A' },
    { title: 'Study: Part One', author: 'A' }, { title: 'Study: Part Two', author: 'A' },
    { bookId: '', title: '', author: 'A' }, { bookId: '', title: '', author: 'A' }
  ];
  assert.equal(dedupeBooks(books).length, books.length);
});

test('identity links join renamed books and alternate editions without leaving duplicates', () => {
  const books = [
    { bookId: '1', title: 'Old title', author: 'A' },
    { bookId: '2', title: 'New title', author: 'A' },
    { bookId: '1', title: 'New title', author: 'A' }
  ];
  assert.equal(groupBooks(books).length, 1);
  assert.equal(dedupeBooks(books)[0], books[0]);
});

test('source priority and newest-first order survive merging without mutating inputs', () => {
  const saved = { bookId: '1', title: 'Book', author: 'A', rating: 5, readAt: '2026-01-01', imageUrl: 'cover.jpg' };
  const csv = { ...saved, rating: 2, imageUrl: '' };
  const newest = { bookId: '2', title: 'New book', author: 'A', readAt: '2026-09-01' };
  const result = mergeBooks([csv], [newest], [saved]);
  assert.equal(result[0].bookId, '2');
  assert.equal(result[1].rating, 5);
  assert.equal(result[1].imageUrl, 'cover.jpg');
  assert.equal(csv.imageUrl, '');
});
