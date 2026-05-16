// When opened as a local file, fix links so they resolve correctly
if (window.location.protocol === 'file:') {
    document.querySelectorAll('a[href]').forEach(function(a) {
        var href = a.getAttribute('href');
        if (href === '/') {
            a.setAttribute('href', 'index.html');
        } else if (href && !href.includes('.') && !href.includes('/') && !href.includes(':') && !href.startsWith('#') && href.length > 0) {
            a.setAttribute('href', href + '.html');
        }
    });
}

// Breadcrumb dropdown menu (subpages)
const BREADCRUMB_MENU_SECTIONS = [
    {
        label: 'Work projects',
        items: [
            { slug: 'instagram-fundraisers', label: 'Instagram Fundraisers' },
            { slug: 'facebook-fundraisers', label: 'Facebook Fundraisers' },
            { slug: 'ameelio-mail', label: 'Ameelio Mail' }
        ]
    },
    {
        label: 'Personal projects',
        items: [
            { slug: 'days', label: 'DAYS iOS app' },
            { slug: 'numbercrunch', label: 'Number Crunch' },
            { slug: 'color-research', label: 'Color Research' },
            { slug: 'onemillionrockpaperscissors', label: 'One Million Rock Paper Scissors' },
            { slug: 'chrono', label: 'Chrono' },
            { slug: 'glance', label: 'Glance' }
        ]
    },
    {
        label: 'Personal',
        items: [
            { slug: 'bookshelf', label: 'Bookshelf' },
            { slug: 'running', label: 'Running' }
        ]
    }
];

function initBreadcrumbMenu() {
    const projectSpan = document.querySelector('.breadcrumb-project');
    if (!projectSpan) return;

    const isFile = window.location.protocol === 'file:';
    const path = window.location.pathname.replace(/\/$/, '');
    const currentSlug = path.split('/').pop().replace(/\.html$/, '');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'breadcrumb-project-trigger';
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = `<span class="breadcrumb-project-label">${projectSpan.textContent}</span><svg class="breadcrumb-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    const menu = document.createElement('div');
    menu.className = 'breadcrumb-menu';
    menu.setAttribute('role', 'menu');

    BREADCRUMB_MENU_SECTIONS.forEach((section, sectionIdx) => {
        if (sectionIdx > 0) {
            const divider = document.createElement('div');
            divider.className = 'breadcrumb-menu-divider';
            menu.appendChild(divider);
        }
        const sectionEl = document.createElement('div');
        sectionEl.className = 'breadcrumb-menu-section';
        const heading = document.createElement('div');
        heading.className = 'breadcrumb-menu-heading';
        heading.textContent = section.label;
        sectionEl.appendChild(heading);

        section.items.forEach(item => {
            const link = document.createElement('a');
            link.className = 'breadcrumb-menu-item';
            link.href = isFile ? item.slug + '.html' : item.slug;
            link.textContent = item.label;
            link.setAttribute('role', 'menuitem');
            if (item.slug === currentSlug) {
                link.classList.add('is-current');
                link.setAttribute('aria-current', 'page');
            }
            sectionEl.appendChild(link);
        });
        menu.appendChild(sectionEl);
    });

    const wrapper = document.createElement('span');
    wrapper.className = 'breadcrumb-project';
    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    projectSpan.replaceWith(wrapper);

    function close() {
        wrapper.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        menu.style.left = '';
    }
    function open() {
        wrapper.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        // Clamp horizontally so the menu never overflows the viewport.
        menu.style.left = '0px';
        const rect = menu.getBoundingClientRect();
        const margin = 12;
        const overflowRight = rect.right - (window.innerWidth - margin);
        if (overflowRight > 0) {
            menu.style.left = (-overflowRight) + 'px';
        }
    }

    trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        if (wrapper.classList.contains('is-open')) close(); else open();
    });
    document.addEventListener('click', function(e) {
        if (!wrapper.contains(e.target)) close();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && wrapper.classList.contains('is-open')) {
            close();
            trigger.focus();
        }
    });
}

// Portfolio JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initBreadcrumbMenu();

    // Smooth scrolling for internal links
    const internalLinks = document.querySelectorAll('a[href^="#"]');
    
    internalLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Add loading animation for external links
    const externalLinks = document.querySelectorAll('a[target="_blank"]');
    
    externalLinks.forEach(link => {
        link.addEventListener('click', function() {
            // Optional: Add loading state or analytics tracking
            console.log('External link clicked:', this.href);
        });
    });
    
    // Keyboard navigation enhancement
    document.addEventListener('keydown', function(e) {
        // Escape key to return to top (unless the breadcrumb menu is open)
        if (e.key === 'Escape' && !document.querySelector('.breadcrumb-project.is-open')) {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    });
});

// Optional: Add analytics or tracking
function trackEvent(eventName, properties = {}) {
    // Placeholder for analytics tracking
    console.log('Event tracked:', eventName, properties);
    
    // Example: Google Analytics 4
    // gtag('event', eventName, properties);
    
    // Example: Custom analytics
    // analytics.track(eventName, properties);
}
