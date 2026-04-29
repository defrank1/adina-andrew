// ===========================
// carousel.js — Photo carousels for Our Story
// ===========================

function initCarousels() {
    const carousels = document.querySelectorAll('[data-carousel]');
    carousels.forEach(initCarousel);
}

function initCarousel(carousel) {
    const track = carousel.querySelector('.story-carousel-track');
    const slides = Array.from(carousel.querySelectorAll('.story-carousel-slide'));
    const dotsContainer = carousel.querySelector('[data-carousel-dots]');
    const prevBtn = carousel.querySelector('.story-carousel-arrow-prev');
    const nextBtn = carousel.querySelector('.story-carousel-arrow-next');

    if (!track || slides.length === 0) return;

    // Find the per-photo caption element within the same .story-moment, if present
    const moment = carousel.closest('.story-moment');
    const captionEl = moment ? moment.querySelector('[data-photo-caption]') : null;
    const fadeMs = 180;

    // Build dots
    const dots = slides.map(function (_, i) {
        const dot = document.createElement('button');
        dot.className = 'story-carousel-dot';
        dot.type = 'button';
        dot.setAttribute('aria-label', 'Go to photo ' + (i + 1));
        if (i === 0) dot.classList.add('active');
        dot.addEventListener('click', function () { scrollToSlide(i); });
        dotsContainer.appendChild(dot);
        return dot;
    });

    let currentIndex = 0;
    let scrollRaf = null;

    // Initialize caption to slide 0's text immediately (no fade)
    if (captionEl) {
        captionEl.textContent = slides[0].getAttribute('data-caption') || '';
    }

    function updateCaption(index) {
        if (!captionEl) return;
        const text = slides[index].getAttribute('data-caption') || '';
        if (captionEl.textContent === text) return;
        captionEl.classList.add('is-fading');
        setTimeout(function () {
            captionEl.textContent = text;
            captionEl.classList.remove('is-fading');
        }, fadeMs);
    }

    function scrollToSlide(index) {
        const clamped = Math.max(0, Math.min(slides.length - 1, index));
        const slide = slides[clamped];
        track.scrollTo({
            left: slide.offsetLeft - track.offsetLeft,
            behavior: 'smooth',
        });
    }

    function updateActive() {
        const trackRect = track.getBoundingClientRect();
        const trackCenter = trackRect.left + trackRect.width / 2;
        let nearest = 0;
        let minDist = Infinity;
        slides.forEach(function (slide, i) {
            const rect = slide.getBoundingClientRect();
            const slideCenter = rect.left + rect.width / 2;
            const dist = Math.abs(slideCenter - trackCenter);
            if (dist < minDist) {
                minDist = dist;
                nearest = i;
            }
        });
        if (nearest !== currentIndex) {
            currentIndex = nearest;
            dots.forEach(function (dot, i) {
                dot.classList.toggle('active', i === currentIndex);
            });
            updateCaption(currentIndex);
        }
        updateArrowState();
    }

    function updateArrowState() {
        if (prevBtn) {
            const atStart = currentIndex === 0;
            prevBtn.classList.toggle('disabled', atStart);
            prevBtn.setAttribute('aria-disabled', atStart ? 'true' : 'false');
        }
        if (nextBtn) {
            const atEnd = currentIndex === slides.length - 1;
            nextBtn.classList.toggle('disabled', atEnd);
            nextBtn.setAttribute('aria-disabled', atEnd ? 'true' : 'false');
        }
    }

    track.addEventListener('scroll', function () {
        if (scrollRaf) return;
        scrollRaf = requestAnimationFrame(function () {
            scrollRaf = null;
            updateActive();
        });
    });

    if (prevBtn) {
        prevBtn.addEventListener('click', function () {
            if (prevBtn.classList.contains('disabled')) return;
            scrollToSlide(currentIndex - 1);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', function () {
            if (nextBtn.classList.contains('disabled')) return;
            scrollToSlide(currentIndex + 1);
        });
    }

    track.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            scrollToSlide(currentIndex - 1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            scrollToSlide(currentIndex + 1);
        }
    });

    updateArrowState();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCarousels);
} else {
    initCarousels();
}
