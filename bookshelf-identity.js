// The importer and both browser views use the same identity rules.
(function(root, factory) {
    const identity = factory();
    if (typeof module === 'object' && module.exports) module.exports = identity;
    else root.BookshelfIdentity = identity;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    function normalize(value) {
        return String(value || '').normalize('NFKC').toLowerCase()
            .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
            .replace(/\s+/g, ' ').trim();
    }

    function bookMergeKey(book) {
        // Strip only known publishing labels, not meaningful subtitles or
        // series numbers (which can distinguish different books).
        const title = normalize(book.title)
            .replace(/\s*\((?:national book award winner|pulitzer prize winner|a novel|paperback|hardcover|kindle edition|ebook)\)\s*$/g, '')
            .replace(/:\s*a novel\s*$/, '').trim();
        const author = normalize(book.author);
        return title && author ? JSON.stringify([title, author]) : null;
    }

    function groupBooks(books) {
        const parents = books.map((_, i) => i);
        const keys = new Map();
        function find(i) {
            if (parents[i] !== i) parents[i] = find(parents[i]);
            return parents[i];
        }
        books.forEach((book, i) => {
            const id = String(book.bookId || '').trim();
            const titleKey = bookMergeKey(book);
            const matches = [];
            if (id && id !== '0') matches.push(`id:${id}`);
            if (titleKey) matches.push(`title:${titleKey}`);
            matches.forEach(key => {
                if (keys.has(key)) {
                    const a = find(i), b = find(keys.get(key));
                    parents[Math.max(a, b)] = Math.min(a, b);
                }
                keys.set(key, i);
            });
        });
        const groups = new Map();
        books.forEach((book, i) => {
            const key = find(i);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(book);
        });
        return [...groups.values()];
    }

    function dedupeBooks(books) {
        return groupBooks(books).map(group => group[0]);
    }

    return { bookMergeKey, groupBooks, dedupeBooks };
});
