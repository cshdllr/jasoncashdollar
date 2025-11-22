// Bookshelf Implementation
document.addEventListener('DOMContentLoaded', async function() {
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');
    const gridCoversContainer = document.getElementById('grid-covers-container');
    const textListContainer = document.getElementById('text-list-container');
    const verticalCoversContainer = document.getElementById('vertical-covers-container');
    
    let booksData = [];
    let currentView = 'cards'; // Default view
    
    /**
     * Get the best available cover image URL for a book
     * Prioritizes Goodreads URLs since they're most reliable
     */
    function getCoverImageUrl(book) {
        // Primary: Use Goodreads imageUrl if available (most reliable)
        if (book.imageUrl) {
            return book.imageUrl;
        }
        
        // Fallback: Try Open Library if we have an ISBN but no Goodreads URL
        if (book.isbn && book.isbn.trim() !== '') {
            return `https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg`;
        }
        
        // Final fallback: placeholder
        return null;
    }
    
    /**
     * Create an image element with proper error handling and fallbacks
     */
    function createBookImage(book, className = '') {
        const img = document.createElement('img');
        img.alt = `${book.title} by ${book.author}`;
        // Removed lazy loading so all covers load immediately
        if (className) {
            img.className = className;
        }
        
        // Get the best available cover URL (Goodreads prioritized)
        const coverUrl = getCoverImageUrl(book);
        const placeholderSvg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect width="200" height="300" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="14" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3ENo Cover%3C/text%3E%3C/svg%3E';
        
        img.src = coverUrl || placeholderSvg;
        
        // Handle load errors with intelligent fallback
        let fallbackAttempted = false;
        
        // If Open Library returns 1x1 pixel placeholder, it means no cover available
        img.onload = function() {
            if (!fallbackAttempted && (this.naturalWidth === 1 || this.naturalHeight === 1)) {
                // This is likely Open Library's "no cover" indicator
                fallbackAttempted = true;
                this.src = placeholderSvg;
            }
        };
        
        // Handle network errors
        img.onerror = function() {
            if (!fallbackAttempted && !book.imageUrl && book.isbn) {
                // We tried Open Library but it failed, show placeholder
                fallbackAttempted = true;
                this.src = placeholderSvg;
            } else if (!fallbackAttempted) {
                // Unexpected error, show placeholder
                this.src = placeholderSvg;
            }
        };
        
        return img;
    }
    
    try {
        // Fetch book data
        const response = await fetch('data/books.json');
        if (!response.ok) {
            throw new Error('Failed to fetch books data');
        }
        
        const data = await response.json();
        const books = data.books;
        
        if (!books || books.length === 0) {
            showEmptyState();
            return;
        }
        
        booksData = books;
        
        // Initialize view toggle buttons
        initializeViewToggles();
        
        // Initialize default view (cards)
        switchView('cards');
        
        // Update indicator on window resize
        window.addEventListener('resize', updateToggleIndicator);
        
    } catch (error) {
        console.error('Error loading bookshelf:', error);
        showEmptyState();
    }
    
    /**
     * Initialize view toggle buttons
     */
    function initializeViewToggles() {
        const viewToggles = document.querySelectorAll('.view-toggle');
        
        viewToggles.forEach(toggle => {
            toggle.addEventListener('click', function() {
                const view = this.dataset.view;
                switchView(view);
            });
        });
        
        // Set initial indicator position
        updateToggleIndicator();
    }
    
    /**
     * Update the sliding toggle indicator position
     */
    function updateToggleIndicator() {
        const indicator = document.querySelector('.view-toggle-indicator');
        const activeToggle = document.querySelector('.view-toggle.active');
        
        if (indicator && activeToggle) {
            const togglesContainer = document.querySelector('.view-toggles');
            const containerRect = togglesContainer.getBoundingClientRect();
            const activeRect = activeToggle.getBoundingClientRect();
            
            // Calculate position relative to container
            const left = activeRect.left - containerRect.left;
            const width = activeRect.width;
            const height = activeRect.height;
            
            indicator.style.left = `${left}px`;
            indicator.style.width = `${width}px`;
            indicator.style.height = `${height}px`;
            indicator.style.top = '4px'; // Match the padding of view-toggles
        }
    }
    
    /**
     * Switch between different views
     */
    function switchView(view) {
        currentView = view;
        
        // Update active toggle button
        const viewToggles = document.querySelectorAll('.view-toggle');
        viewToggles.forEach(toggle => {
            if (toggle.dataset.view === view) {
                toggle.classList.add('active');
            } else {
                toggle.classList.remove('active');
            }
        });
        
        // Update the sliding indicator position
        updateToggleIndicator();
        
        // Hide all containers
        textListContainer.style.display = 'none';
        verticalCoversContainer.style.display = 'none';
        gridCoversContainer.style.display = 'none';
        
        // Show the selected view
        switch(view) {
            case 'list':
                renderTextList();
                textListContainer.style.display = 'block';
                break;
            case 'cards':
                renderVerticalCovers();
                verticalCoversContainer.style.display = 'block';
                break;
            case 'grid':
                renderGridCovers();
                gridCoversContainer.style.display = 'block';
                break;
        }
        
        // Hide loading state
        loadingState.style.display = 'none';
    }
    
    /**
     * Show empty state when no books are found
     */
    function showEmptyState() {
        loadingState.style.display = 'none';
        emptyState.style.display = 'block';
        gridCoversContainer.style.display = 'none';
        textListContainer.style.display = 'none';
        verticalCoversContainer.style.display = 'none';
    }
    
    /**
     * Render text list view grouped by year
     */
    function renderTextList() {
        // Clear existing content
        textListContainer.innerHTML = '';
        
        // Group books by year
        const booksByYear = {};
        booksData.forEach(book => {
            if (book.readAt) {
                const year = new Date(book.readAt).getFullYear();
                if (!booksByYear[year]) {
                    booksByYear[year] = [];
                }
                booksByYear[year].push(book);
            }
        });
        
        // Sort years newest to oldest
        const years = Object.keys(booksByYear).sort((a, b) => b - a);
        
        // Create sections for each year
        years.forEach(year => {
            const yearSection = document.createElement('div');
            yearSection.className = 'text-list-year-section';
            
            const yearHeader = document.createElement('h2');
            yearHeader.className = 'text-list-year-header';
            yearHeader.textContent = year;
            yearSection.appendChild(yearHeader);
            
            booksByYear[year].forEach(book => {
                const bookEntry = document.createElement('div');
                bookEntry.className = 'text-list-book';
                
                const title = document.createElement('span');
                title.className = 'text-list-book-title';
                title.textContent = book.title;
                
                const author = document.createElement('span');
                author.className = 'text-list-book-author';
                author.textContent = ` ${book.author}`;
                
                bookEntry.appendChild(title);
                bookEntry.appendChild(author);
                
                // Add rating if available
                if (book.rating > 0) {
                    const rating = document.createElement('span');
                    rating.className = 'text-list-book-rating';
                    rating.textContent = ' ' + '★'.repeat(book.rating);
                    bookEntry.appendChild(rating);
                }
                
                yearSection.appendChild(bookEntry);
            });
            
            textListContainer.appendChild(yearSection);
        });
    }
    
    /**
     * Render vertical covers view
     */
    function renderVerticalCovers() {
        // Clear existing content
        verticalCoversContainer.innerHTML = '';
        
        const coversGrid = document.createElement('div');
        coversGrid.className = 'vertical-covers-grid';
        
        booksData.forEach(book => {
            const coverItem = document.createElement('div');
            coverItem.className = 'vertical-cover-item';
            
            // Book cover image
            const img = createBookImage(book, 'vertical-cover-image');
            
            // Book info container
            const info = document.createElement('div');
            info.className = 'vertical-cover-info';
            
            const title = document.createElement('div');
            title.className = 'vertical-cover-title';
            title.textContent = book.title;
            
            const author = document.createElement('div');
            author.className = 'vertical-cover-author';
            author.textContent = book.author;
            
            const meta = document.createElement('div');
            meta.className = 'vertical-cover-meta';
            
            // Add rating if available
            if (book.rating > 0) {
                const rating = document.createElement('span');
                rating.className = 'vertical-cover-rating';
                rating.textContent = '★'.repeat(book.rating);
                meta.appendChild(rating);
            }
            
            // Add read date if available
            if (book.readAt) {
                const date = document.createElement('span');
                date.className = 'vertical-cover-date';
                const readDate = new Date(book.readAt);
                date.textContent = readDate.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short'
                });
                meta.appendChild(date);
            }
            
            info.appendChild(title);
            info.appendChild(author);
            info.appendChild(meta);
            
            coverItem.appendChild(img);
            coverItem.appendChild(info);
            
            coversGrid.appendChild(coverItem);
        });
        
        verticalCoversContainer.appendChild(coversGrid);
    }
    
    /**
     * Render grid covers view (covers only, no text)
     */
    function renderGridCovers() {
        // Clear existing content
        gridCoversContainer.innerHTML = '';
        
        const coversGrid = document.createElement('div');
        coversGrid.className = 'grid-covers-grid';
        
        booksData.forEach(book => {
            const coverItem = document.createElement('div');
            coverItem.className = 'grid-cover-item';
            
            const img = createBookImage(book, 'grid-cover-image');
            coverItem.appendChild(img);
            coversGrid.appendChild(coverItem);
        });
        
        gridCoversContainer.appendChild(coversGrid);
    }
});

