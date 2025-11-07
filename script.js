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
    
    // Simple intersection observer for fade-in animations
    if (window.IntersectionObserver) {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);
        
        // Observe project cards for subtle animations
        const projectCards = document.querySelectorAll('.project-card');
        projectCards.forEach((card, index) => {
            // Add initial styles for animation
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
            
            observer.observe(card);
        });
        
        // Observe section headers for subtle animations
        const sectionHeaders = document.querySelectorAll('.section-header');
        sectionHeaders.forEach((header, index) => {
            // Add initial styles for animation
            header.style.opacity = '0';
            header.style.transition = `opacity 2.2s ease ${index * 0.1}s`;
            
            observer.observe(header);
        });
    }
    
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
