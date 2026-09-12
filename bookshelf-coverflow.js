// Shared by the main bookshelf and the experimental bookshelf page.
window.createBookshelfCoverflow = function(container, createBookImage) {
    let books = [];
    let activeIndex = 0;
    let bookPosition = 0;
    let gesture = null;
    let settleTimer = null;
    let displayedBook = null;
    let displayedPosition = '';
    let suppressClickUntil = 0;
    const covers = new Map();

    container.setAttribute('role', 'region');
    container.setAttribute('aria-roledescription', 'carousel');
    container.setAttribute('aria-label', 'Book covers');
    container.innerHTML = `
        <div class="coverflow-stage" tabindex="0" role="group" aria-label="Browse book covers. Drag, scroll horizontally, or use arrow keys. Press Enter to open the selected book."></div>
        <div class="coverflow-details">
            <h2><a class="coverflow-title" target="_blank" rel="noopener noreferrer"></a></h2>
            <p class="coverflow-author"></p>
            <p class="coverflow-meta"></p>
        </div>
        <p class="coverflow-status" role="status" aria-live="polite" aria-atomic="true"></p>
    `;

    const stage = container.querySelector('.coverflow-stage');
    const title = container.querySelector('.coverflow-title');
    const author = container.querySelector('.coverflow-author');
    const meta = container.querySelector('.coverflow-meta');
    const status = container.querySelector('.coverflow-status');

    function update() {
        const book = books[activeIndex];
        // Keep only the surrounding covers in the DOM, even for a large library.
        const first = Math.max(0, Math.floor(bookPosition) - 4);
        const last = Math.min(books.length - 1, Math.ceil(bookPosition) + 4);
        covers.forEach((cover, index) => {
            if (index < first || index > last) {
                cover.remove();
                covers.delete(index);
            }
        });

        for (let index = first; index <= last; index++) {
            let cover = covers.get(index);
            if (!cover) {
                cover = document.createElement('button');
                cover.type = 'button';
                cover.className = 'coverflow-cover';
                // The stage is one keyboard stop; arrows browse all the books.
                cover.tabIndex = -1;
                const image = createBookImage(books[index]);
                image.className = 'coverflow-image';
                image.alt = '';
                image.draggable = false;
                image.loading = 'eager';
                image.decoding = 'async';
                cover.appendChild(image);
                cover.addEventListener('click', () => {
                    stage.focus({ preventScroll: true });
                    if (index === activeIndex && Math.abs(bookPosition - index) < 0.01) title.click();
                    else select(index);
                });
                covers.set(index, cover);
                stage.appendChild(cover);
            }

            const offset = index - bookPosition;
            const selected = index === activeIndex;
            cover.style.setProperty('--offset', offset);
            cover.style.setProperty('--distance', Math.abs(offset));
            cover.style.setProperty('--direction', Math.max(-1, Math.min(1, offset)));
            cover.style.setProperty('--focus', 1 - Math.min(1, Math.abs(offset)));
            cover.style.zIndex = 100 - Math.round(Math.abs(offset) * 10);
            cover.classList.toggle('is-active', selected);
            cover.setAttribute('aria-label', `${selected ? 'Open' : 'Select'} ${books[index].title} by ${books[index].author}${selected ? ' on Goodreads (opens in a new tab)' : ''}`);
            cover.setAttribute('aria-pressed', String(selected));
        }

        // Update details and announcements only when the selected book changes.
        const positionLabel = `${activeIndex + 1} of ${books.length}`;
        if (displayedBook === book && displayedPosition === positionLabel) return;
        displayedBook = book;
        displayedPosition = positionLabel;
        if (!book) {
            title.textContent = 'No books found';
            title.removeAttribute('href');
            author.textContent = '';
            meta.textContent = '';
            status.textContent = 'No books found';
            return;
        }

        title.textContent = book.title;
        title.href = `https://www.goodreads.com/book/show/${encodeURIComponent(book.bookId)}`;
        title.setAttribute('aria-label', `${book.title} on Goodreads (opens in a new tab)`);
        author.textContent = book.author;
        const rating = Math.max(0, Math.min(5, Math.floor(Number(book.rating) || 0)));
        const readDate = book.readAt ? new Date(book.readAt) : null;
        const dateLabel = readDate && !Number.isNaN(readDate.getTime())
            ? `Read ${readDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
            : '';
        meta.textContent = [rating ? '★'.repeat(rating) : '', dateLabel].filter(Boolean).join(' · ');
        meta.setAttribute('aria-label', [rating ? `${rating} out of 5 stars` : '', dateLabel].filter(Boolean).join('. '));
        status.textContent = `${book.title} by ${book.author}. Book ${activeIndex + 1} of ${books.length}.`;
    }

    function pixelsPerBook() {
        return parseFloat(getComputedStyle(stage).getPropertyValue('--cover-width')) * 0.8;
    }

    function moveTo(position) {
        bookPosition = Math.max(0, Math.min(books.length - 1, position));
        activeIndex = Math.round(bookPosition);
        update();
    }

    function select(index) {
        clearTimeout(settleTimer);
        settleTimer = null;
        // Commit the last drag position before enabling the snap transition.
        if (stage.classList.contains('is-interacting')) stage.getBoundingClientRect();
        stage.classList.remove('is-interacting', 'is-dragging');
        moveTo(index);
    }

    function settle() {
        select(Math.round(bookPosition));
    }

    container.addEventListener('keydown', (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const destinations = { ArrowLeft: activeIndex - 1, ArrowRight: activeIndex + 1, Home: 0, End: books.length - 1 };
        if (Object.prototype.hasOwnProperty.call(destinations, event.key)) {
            event.preventDefault();
            // Keep focus stable when a cover leaves the visible window.
            stage.focus({ preventScroll: true });
            select(destinations[event.key]);
        } else if (event.key === 'Enter' && event.target === stage && books.length) {
            event.preventDefault();
            title.click();
        }
    });

    stage.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary || event.button !== 0 || books.length === 0) return;
        settle();
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, dragging: false };
    });
    stage.addEventListener('pointermove', (event) => {
        if (!gesture || gesture.id !== event.pointerId) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        if (!gesture.dragging) {
            if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
            gesture.dragging = true;
            stage.setPointerCapture(event.pointerId);
            stage.focus({ preventScroll: true });
            stage.classList.add('is-interacting', 'is-dragging');
        }
        moveTo(bookPosition - (event.clientX - gesture.lastX) / pixelsPerBook());
        gesture.lastX = event.clientX;
    });

    function finishGesture(event) {
        if (!gesture || gesture.id !== event.pointerId) return;
        const dragged = gesture.dragging;
        gesture = null;
        if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
        if (dragged) {
            suppressClickUntil = performance.now() + 400;
            settle();
        }
    }

    stage.addEventListener('pointerup', finishGesture);
    stage.addEventListener('pointercancel', finishGesture);
    stage.addEventListener('lostpointercapture', (event) => {
        // Touch first captures the cover button; transferring that capture to the
        // stage must not end the drag when the button's loss event bubbles up.
        if (event.target === stage) finishGesture(event);
    });
    stage.addEventListener('pointerleave', () => {
        if (gesture && !gesture.dragging) gesture = null;
    });
    window.addEventListener('blur', () => {
        if (gesture) finishGesture({ pointerId: gesture.id });
    });

    stage.addEventListener('wheel', (event) => {
        if (event.ctrlKey || event.metaKey || gesture || books.length < 2) return;
        // Vertical gestures remain page scrolling; Shift also supports mouse wheels.
        const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
        if (!horizontal && !event.shiftKey) return;
        const delta = horizontal ? event.deltaX : event.deltaY;
        if (!delta) return;
        event.preventDefault();
        clearTimeout(settleTimer);
        stage.classList.add('is-interacting');
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientWidth : 1;
        moveTo(bookPosition + delta * unit / pixelsPerBook());
        settleTimer = setTimeout(settle, 140);
    }, { passive: false });
    stage.addEventListener('click', (event) => {
        if (performance.now() < suppressClickUntil) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, true);

    return {
        render(visibleBooks) {
            if (gesture) finishGesture({ pointerId: gesture.id });
            clearTimeout(settleTimer);
            stage.classList.remove('is-interacting', 'is-dragging');
            const selectedBook = books[activeIndex];
            const changed = books.length !== visibleBooks.length || books.some((book, index) => book !== visibleBooks[index]);
            if (changed) {
                covers.clear();
                stage.replaceChildren();
                books = visibleBooks.slice();
                activeIndex = Math.max(0, books.indexOf(selectedBook));
            }
            bookPosition = activeIndex;
            update();
        }
    };
};
