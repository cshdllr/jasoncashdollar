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
