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

// Portfolio JavaScript
document.addEventListener('DOMContentLoaded', function() {
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
        // Escape key to return to top
        if (e.key === 'Escape') {
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
