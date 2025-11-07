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
        
        // Get all project sections
        const projectSections = document.querySelectorAll('.projects');
        
        projectSections.forEach((section) => {
            // Get section header and project cards within this section
            const sectionHeader = section.querySelector('.section-header');
            const projectCards = section.querySelectorAll('.project-card');
            
            // Set initial styles for section header
            if (sectionHeader) {
                sectionHeader.style.opacity = '0';
                sectionHeader.style.transform = 'translateY(20px)';
                sectionHeader.style.transition = 'opacity 0.6s ease 0s, transform 0.6s ease 0s';
            }
            
            // Set initial styles for project cards in this section
            projectCards.forEach((card, cardIndex) => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                // Use cardIndex within this section for stagger delay, starting after header
                card.style.transition = `opacity 0.6s ease ${(cardIndex + 1) * 0.1}s, transform 0.6s ease ${(cardIndex + 1) * 0.1}s`;
            });
            
            // Create observer for this section
            const sectionObserver = new IntersectionObserver(function(entries) {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Animate section header first (0s delay)
                        if (sectionHeader) {
                            sectionHeader.style.opacity = '1';
                            sectionHeader.style.transform = 'translateY(0)';
                        }
                        
                        // Animate all project cards in this section with staggered delays
                        projectCards.forEach((card) => {
                            card.style.opacity = '1';
                            card.style.transform = 'translateY(0)';
                        });
                        
                        // Stop observing once animated
                        sectionObserver.unobserve(entry.target);
                    }
                });
            }, observerOptions);
            
            // Observe the section (or header if available)
            sectionObserver.observe(sectionHeader || section);
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
