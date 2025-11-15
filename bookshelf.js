// Bookshelf Coverflow Implementation
document.addEventListener('DOMContentLoaded', async function() {
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');
    const coverflowContainer = document.querySelector('.coverflow-container');
    const bookDetails = document.getElementById('book-details');
    const yearNavigation = document.getElementById('year-navigation');
    
    let swiperInstance = null;
    let booksData = [];
    
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
        
        // Initialize the coverflow
        initializeCoverflow(books);
        
    } catch (error) {
        console.error('Error loading bookshelf:', error);
        showEmptyState();
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
            
            const img = document.createElement('img');
            img.src = book.imageUrl;
            img.alt = `${book.title} by ${book.author}`;
            img.loading = 'lazy';
            
            // Add error handling for images
            img.onerror = function() {
                this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect width="200" height="300" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="14" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3ENo Cover%3C/text%3E%3C/svg%3E';
            };
            
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
        
        // Hide loading state and show content
        loadingState.style.display = 'none';
        coverflowContainer.style.display = 'block';
        bookDetails.style.display = 'block';
        yearNavigation.style.display = 'flex';
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
        bookDetails.style.display = 'none';
        yearNavigation.style.display = 'none';
    }
});

