document.addEventListener('DOMContentLoaded', async function() {
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');
    const gridCoversContainer = document.getElementById('grid-covers-container');
    const textListContainer = document.getElementById('text-list-container');
    const verticalCoversContainer = document.getElementById('vertical-covers-container');
    const ratingFilter = document.getElementById('rating-filter');

    let booksData = [];
    let currentView = 'cards';
    let showFiveStarBooks = false;

    function bookIdentityKey(book) {
        const normalize = (value) => (value || '')
            .toLowerCase()
            .replace(/\s*\([^)]*\)\s*$/, '')
            .replace(/\s+/g, ' ')
            .trim();

        return `${normalize(book.title)}|${normalize(book.author)}`;
    }

    function dedupeBooks(books) {
        const seen = new Set();

        return books.filter((book) => {
            const key = bookIdentityKey(book);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function getCoverImageUrl(book) {
        if (book.imageUrl) return book.imageUrl;
        if (book.isbn && book.isbn.trim() !== '') {
            return `https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg`;
        }
        return null;
    }

    function getGoodreadsUrl(book) {
        return `https://www.goodreads.com/book/show/${encodeURIComponent(book.bookId)}`;
    }

    function createBookImage(book) {
        const image = document.createElement('img');
        const placeholderSvg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect width="200" height="300" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="14" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3ENo Cover%3C/text%3E%3C/svg%3E';
        let fallbackAttempted = false;

        image.className = 'book-object__image';
        image.alt = `${book.title} by ${book.author}`;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.src = getCoverImageUrl(book) || placeholderSvg;

        image.addEventListener('load', function() {
            if (!fallbackAttempted && (this.naturalWidth === 1 || this.naturalHeight === 1)) {
                fallbackAttempted = true;
                this.src = placeholderSvg;
            }
        });

        image.addEventListener('error', function() {
            if (fallbackAttempted) return;
            fallbackAttempted = true;
            this.src = placeholderSvg;
        });

        return image;
    }

    function createBookObject(book, variant) {
        const object = document.createElement('span');
        object.className = `book-object book-object--${variant}`;

        const bookElement = document.createElement('span');
        bookElement.className = 'book-object__book';

        const spine = document.createElement('span');
        spine.className = 'book-object__spine';
        spine.setAttribute('aria-hidden', 'true');

        bookElement.appendChild(createBookImage(book));
        bookElement.appendChild(spine);
        object.appendChild(bookElement);

        return object;
    }

    function createBookLink(book, className) {
        const link = document.createElement('a');
        link.className = `book-link ${className}`;
        link.href = getGoodreadsUrl(book);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', `${book.title} by ${book.author}`);
        return link;
    }

    function getVisibleBooks() {
        if (!showFiveStarBooks) return booksData;
        return booksData.filter((book) => Number(book.rating) === 5);
    }

    function initializeRatingFilter() {
        ratingFilter.addEventListener('click', function() {
            showFiveStarBooks = !showFiveStarBooks;
            this.setAttribute('aria-pressed', String(showFiveStarBooks));
            switchView(currentView);
        });
    }

    function initializeViewToggles() {
        document.querySelectorAll('.view-toggle').forEach((toggle) => {
            toggle.addEventListener('click', function() {
                switchView(this.dataset.view);
            });
        });

        updateToggleIndicator();
    }

    function updateToggleIndicator() {
        const indicator = document.querySelector('.view-toggle-indicator');
        const activeToggle = document.querySelector('.view-toggle.active');
        const togglesContainer = document.querySelector('.view-toggles');

        if (!indicator || !activeToggle || !togglesContainer) return;

        const containerRect = togglesContainer.getBoundingClientRect();
        const activeRect = activeToggle.getBoundingClientRect();

        indicator.style.left = `${activeRect.left - containerRect.left}px`;
        indicator.style.width = `${activeRect.width}px`;
        indicator.style.height = `${activeRect.height}px`;
        indicator.style.top = '4px';
    }

    function switchView(view) {
        currentView = view;

        document.querySelectorAll('.view-toggle').forEach((toggle) => {
            toggle.classList.toggle('active', toggle.dataset.view === view);
        });

        updateToggleIndicator();

        textListContainer.hidden = true;
        verticalCoversContainer.hidden = true;
        gridCoversContainer.hidden = true;

        if (view === 'list') {
            renderTextList();
            textListContainer.hidden = false;
        } else if (view === 'grid') {
            renderGridCovers();
            gridCoversContainer.hidden = false;
        } else {
            renderVerticalCovers();
            verticalCoversContainer.hidden = false;
        }

        loadingState.hidden = true;
    }

    function showEmptyState() {
        loadingState.hidden = true;
        emptyState.hidden = false;
        gridCoversContainer.hidden = true;
        textListContainer.hidden = true;
        verticalCoversContainer.hidden = true;
    }

    function renderTextList() {
        textListContainer.replaceChildren();
        const booksByYear = new Map();

        getVisibleBooks().forEach((book) => {
            if (!book.readAt) return;
            const year = new Date(book.readAt).getFullYear();
            if (!booksByYear.has(year)) booksByYear.set(year, []);
            booksByYear.get(year).push(book);
        });

        [...booksByYear.keys()].sort((a, b) => b - a).forEach((year) => {
            const section = document.createElement('section');
            section.className = 'text-list-year-section';

            const heading = document.createElement('h2');
            heading.className = 'text-list-year-header';
            heading.textContent = year;
            section.appendChild(heading);

            booksByYear.get(year).forEach((book) => {
                const entry = createBookLink(book, 'text-list-book');

                const title = document.createElement('span');
                title.className = 'text-list-book-title';
                title.textContent = book.title;

                const author = document.createElement('span');
                author.className = 'text-list-book-author';
                author.textContent = ` ${book.author}`;

                entry.appendChild(title);
                entry.appendChild(author);

                if (book.rating > 0) {
                    const rating = document.createElement('span');
                    rating.className = 'text-list-book-rating';
                    rating.textContent = ` ${'★'.repeat(book.rating)}`;
                    entry.appendChild(rating);
                }

                section.appendChild(entry);
            });

            textListContainer.appendChild(section);
        });
    }

    function renderVerticalCovers() {
        verticalCoversContainer.replaceChildren();

        const coversList = document.createElement('div');
        coversList.className = 'vertical-covers-grid';

        getVisibleBooks().forEach((book) => {
            const item = createBookLink(book, 'vertical-cover-item');
            item.appendChild(createBookObject(book, 'card'));

            const info = document.createElement('span');
            info.className = 'vertical-cover-info';

            const title = document.createElement('span');
            title.className = 'vertical-cover-title';
            title.textContent = book.title;

            const author = document.createElement('span');
            author.className = 'vertical-cover-author';
            author.textContent = book.author;

            const meta = document.createElement('span');
            meta.className = 'vertical-cover-meta';

            if (book.rating > 0) {
                const rating = document.createElement('span');
                rating.className = 'vertical-cover-rating';
                rating.textContent = '★'.repeat(book.rating);
                meta.appendChild(rating);
            }

            if (book.readAt) {
                const date = document.createElement('span');
                date.className = 'vertical-cover-date';
                date.textContent = new Date(book.readAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short'
                });
                meta.appendChild(date);
            }

            info.appendChild(title);
            info.appendChild(author);
            info.appendChild(meta);
            item.appendChild(info);
            coversList.appendChild(item);
        });

        verticalCoversContainer.appendChild(coversList);
    }

    function renderGridCovers() {
        gridCoversContainer.replaceChildren();

        const coversGrid = document.createElement('div');
        coversGrid.className = 'grid-covers-grid';

        getVisibleBooks().forEach((book) => {
            const link = createBookLink(book, 'grid-cover-link');
            link.appendChild(createBookObject(book, 'grid'));
            coversGrid.appendChild(link);
        });

        gridCoversContainer.appendChild(coversGrid);
    }

    try {
        const response = await fetch('data/books.json');
        if (!response.ok) throw new Error('Failed to fetch books data');

        const data = await response.json();
        booksData = dedupeBooks(data.books || []);

        if (booksData.length === 0) {
            showEmptyState();
            return;
        }

        initializeViewToggles();
        initializeRatingFilter();
        switchView('cards');
        window.addEventListener('resize', updateToggleIndicator);
    } catch (error) {
        console.error('Error loading bookshelf:', error);
        showEmptyState();
    }
});
