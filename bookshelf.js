// Bookshelf Coverflow Implementation
document.addEventListener('DOMContentLoaded', async function() {
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');
    const coverflowContainer = document.getElementById('coverflow-container');
    const textListContainer = document.getElementById('text-list-container');
    const verticalCoversContainer = document.getElementById('vertical-covers-container');
    const bookDetails = document.getElementById('book-details');
    const yearNavigation = document.getElementById('year-navigation');
    
    let swiperInstance = null;
    let booksData = [];
    let currentView = 'covers'; // Default view
    
    /**
     * Get the best available cover image URL for a book
     * Uses Open Library API with ISBN as primary source, falls back to Goodreads
     */
    function getCoverImageUrl(book) {
        // Primary: Use Open Library API if ISBN is available
        if (book.isbn && book.isbn.trim() !== '') {
            return `https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg`;
        }
        
        // Fallback: Use existing Goodreads imageUrl
        if (book.imageUrl) {
            return book.imageUrl;
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
        img.loading = 'lazy';
        if (className) {
            img.className = className;
        }
        
        // Try primary source first
        const primaryUrl = getCoverImageUrl(book);
        img.src = primaryUrl || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect width="200" height="300" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="14" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3ENo Cover%3C/text%3E%3C/svg%3E';
        
        // Set up error handling with fallback chain
        let fallbackAttempted = false;
        img.onerror = function() {
            // If primary source (Open Library) fails and we have a Goodreads URL, try that
            if (!fallbackAttempted && book.isbn && book.imageUrl) {
                fallbackAttempted = true;
                this.src = book.imageUrl;
            } else {
                // Final fallback: SVG placeholder
                this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect width="200" height="300" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="14" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3ENo Cover%3C/text%3E%3C/svg%3E';
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
        
        // Initialize year navigation
        initializeYearNavigation(books);
        
        // Initialize view toggle buttons
        initializeViewToggles();
        
        // Initialize default view (covers)
        switchView('covers');
        
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
        coverflowContainer.style.display = 'none';
        
        // Show/hide year navigation (only for coverflow)
        if (view === 'coverflow') {
            yearNavigation.style.display = 'flex';
        } else {
            yearNavigation.style.display = 'none';
        }
        
        // Show the selected view
        switch(view) {
            case 'list':
                renderTextList();
                textListContainer.style.display = 'block';
                break;
            case 'covers':
                renderVerticalCovers();
                verticalCoversContainer.style.display = 'block';
                break;
            case 'coverflow':
                if (!swiperInstance) {
                    initializeCoverflow(booksData);
                }
                coverflowContainer.style.display = 'block';
                break;
        }
        
        // Hide loading state
        loadingState.style.display = 'none';
    }
    
    /**
     * Initialize year navigation
     */
    function initializeYearNavigation(books) {
        // Extract unique years from books
        const yearsMap = new Map();
        
        books.forEach((book, index) => {
            if (book.readAt) {
                const year = new Date(book.readAt).getFullYear();
                if (!yearsMap.has(year)) {
                    yearsMap.set(year, index); // Store first book index for each year
                }
            }
        });
        
        // Sort years newest to oldest (left to right, oldest on right)
        const years = Array.from(yearsMap.keys()).sort((a, b) => b - a);
        
        // Create year buttons
        years.forEach(year => {
            const button = document.createElement('button');
            button.className = 'year-button';
            button.textContent = year;
            button.dataset.year = year;
            button.dataset.bookIndex = yearsMap.get(year);
            
            button.addEventListener('click', function() {
                const bookIndex = parseInt(this.dataset.bookIndex);
                if (swiperInstance) {
                    swiperInstance.slideTo(bookIndex);
                }
            });
            
            yearNavigation.appendChild(button);
        });
    }
    
    /**
     * Update active year in navigation
     */
    function updateActiveYear(book) {
        if (!book.readAt) return;
        
        const currentYear = new Date(book.readAt).getFullYear();
        const yearButtons = yearNavigation.querySelectorAll('.year-button');
        
        yearButtons.forEach(button => {
            if (parseInt(button.dataset.year) === currentYear) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }
    
    /**
     * Initialize Swiper coverflow carousel
     */
    function initializeCoverflow(books) {
        const carouselElement = document.getElementById('bookshelf-carousel');
        
        // Populate carousel with book covers
        books.forEach((book, index) => {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            slide.dataset.bookIndex = index;
            
            const bookCover = document.createElement('div');
            bookCover.className = 'book-cover';
            
            const img = createBookImage(book);
            
            bookCover.appendChild(img);
            slide.appendChild(bookCover);
            carouselElement.appendChild(slide);
        });
        
        // Initialize Swiper with coverflow effect
        swiperInstance = new Swiper('.bookshelf-swiper', {
            effect: 'coverflow',
            grabCursor: true,
            centeredSlides: true,
            slidesPerView: 'auto',
            initialSlide: 0,
            coverflowEffect: {
                rotate: 35,        // Less rotation for better side visibility
                stretch: -20,      // Negative stretch brings books closer together
                depth: 150,        // Increased depth for more dramatic perspective
                modifier: 1.5,     // Increased modifier for more pronounced effect
                slideShadows: true,
            },
            keyboard: {
                enabled: true,
                onlyInViewport: true,
            },
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            loop: false,
            speed: 600,
            on: {
                slideChange: function() {
                    const book = books[this.activeIndex];
                    updateBookDetails(book);
                    updateActiveYear(book);
                },
                init: function() {
                    // Show first book details on load
                    const book = books[0];
                    updateBookDetails(book);
                    updateActiveYear(book);
                }
            }
        });
        
        // Show book details for coverflow
        bookDetails.style.display = 'block';
    }
    
    /**
     * Update the book details display
     */
    function updateBookDetails(book) {
        const titleElement = document.getElementById('book-title');
        const authorElement = document.getElementById('book-author');
        const ratingElement = document.getElementById('book-rating');
        const dateElement = document.getElementById('book-date');
        const pagesElement = document.getElementById('book-pages');
        const publishedElement = document.getElementById('book-published');
        
        titleElement.textContent = book.title;
        authorElement.textContent = `by ${book.author}`;
        
        // Format rating with stars
        if (book.rating > 0) {
            const stars = '★'.repeat(book.rating) + '☆'.repeat(5 - book.rating);
            ratingElement.textContent = `${stars} (${book.rating}/5)`;
            ratingElement.style.display = 'inline-block';
        } else {
            ratingElement.style.display = 'none';
        }
        
        // Format read date
        if (book.readAt) {
            const readDate = new Date(book.readAt);
            const formattedDate = readDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long'
            });
            dateElement.textContent = `Read: ${formattedDate}`;
            dateElement.style.display = 'inline-block';
        } else {
            dateElement.style.display = 'none';
        }
        
        // Format page count
        if (book.numPages > 0) {
            pagesElement.textContent = `${book.numPages} pages`;
            pagesElement.style.display = 'inline-block';
        } else {
            pagesElement.style.display = 'none';
        }
        
        // Format published year
        if (book.bookPublished) {
            publishedElement.textContent = `Published: ${book.bookPublished}`;
            publishedElement.style.display = 'inline-block';
        } else {
            publishedElement.style.display = 'none';
        }
    }
    
    /**
     * Show empty state when no books are found
     */
    function showEmptyState() {
        loadingState.style.display = 'none';
        emptyState.style.display = 'block';
        coverflowContainer.style.display = 'none';
        textListContainer.style.display = 'none';
        verticalCoversContainer.style.display = 'none';
        bookDetails.style.display = 'none';
        yearNavigation.style.display = 'none';
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
            const img = document.createElement('img');
            img.src = book.imageUrl;
            img.alt = `${book.title} by ${book.author}`;
            img.className = 'vertical-cover-image';
            img.loading = 'lazy';
            
            // Add error handling for images
            img.onerror = function() {
                this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="120"%3E%3Crect width="80" height="120" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="10" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3ENo Cover%3C/text%3E%3C/svg%3E';
            };
            
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
});

