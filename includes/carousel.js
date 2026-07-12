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
    let captionFadeTimeout = null;
    let navLockUntil = 0;   // while > now, ignore scroll-driven sync (a nav click is in control)

    // Initialize caption to slide 0's text immediately (no fade)
    if (captionEl) {
        captionEl.textContent = slides[0].getAttribute('data-caption') || '';
    }

    // Slide 0 starts as the active (undimmed) photo
    slides[0].classList.add('is-active');

    function updateCaption(index) {
        if (!captionEl) return;
        const text = slides[index].getAttribute('data-caption') || '';
        if (captionEl.textContent === text) return;
        if (captionFadeTimeout !== null) {
            clearTimeout(captionFadeTimeout);
        }
        captionEl.classList.add('is-fading');
        captionFadeTimeout = setTimeout(function () {
            captionEl.textContent = text;
            captionEl.classList.remove('is-fading');
            captionFadeTimeout = null;
        }, fadeMs);
    }

    // Apply an active index to dots / slide dimming / caption. The single source of truth.
    function setActive(index) {
        const clamped = Math.max(0, Math.min(slides.length - 1, index));
        if (clamped !== currentIndex) {
            currentIndex = clamped;
            dots.forEach(function (dot, i) {
                dot.classList.toggle('active', i === currentIndex);
            });
            slides.forEach(function (slide, i) {
                slide.classList.toggle('is-active', i === currentIndex);
            });
            updateCaption(currentIndex);
        }
        updateArrowState();
    }

    function scrollToSlide(index) {
        const clamped = Math.max(0, Math.min(slides.length - 1, index));
        const slide = slides[clamped];
        // Nav is authoritative: set the active slide directly. Scroll position can't
        // distinguish slides that share the final screen (their snap targets both clamp
        // to max scroll), so we don't rely on it here.
        navLockUntil = Date.now() + 500;
        setActive(clamped);
        track.scrollTo({
            left: slide.offsetLeft - track.offsetLeft,
            behavior: 'smooth',
        });
    }

    // Free-scroll (swipe/drag): infer the active slide from scroll position.
    function updateActive() {
        if (Date.now() < navLockUntil) {   // a nav click owns the active state right now
            updateArrowState();
            return;
        }
        const maxScroll = track.scrollWidth - track.clientWidth;
        let nearest;
        if (maxScroll > 0 && track.scrollLeft >= maxScroll - 2) {
            nearest = slides.length - 1;   // pinned to the end → last slide is active
        } else if (track.scrollLeft <= 2) {
            nearest = 0;                   // pinned to the start → first slide is active
        } else {
            const trackRect = track.getBoundingClientRect();
            const trackCenter = trackRect.left + trackRect.width / 2;
            nearest = 0;
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
        }
        setActive(nearest);
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
