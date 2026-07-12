// ===========================
// carousel.js — Photo carousels for Our Story
// ===========================

// ===========================
// Lightbox — click any story photo to view it enlarged, page dimmed behind
// ===========================
let lightbox = null;

function ensureLightbox() {
    if (lightbox) return lightbox;
    const overlay = document.createElement('div');
    overlay.className = 'story-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
        '<button class="story-lightbox-close" type="button" aria-label="Close photo">×</button>' +
        '<figure class="story-lightbox-figure">' +
        '<img class="story-lightbox-img" alt="">' +
        '<figcaption class="story-lightbox-caption"></figcaption>' +
        '</figure>';
    const bigImg = overlay.querySelector('.story-lightbox-img');
    const bigCap = overlay.querySelector('.story-lightbox-caption');
    let lastFocus = null;

    function close() {
        if (!overlay.classList.contains('open')) return;
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (lastFocus && lastFocus.focus) lastFocus.focus();
        lastFocus = null;
    }

    function open(src, alt, caption, trigger) {
        lastFocus = trigger || null;
        bigImg.src = src;
        bigImg.alt = alt || '';
        bigCap.textContent = caption || '';
        bigCap.style.display = caption ? '' : 'none';
        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';   // stop the page scrolling behind
        overlay.querySelector('.story-lightbox-close').focus();
    }

    // Click anywhere on the scrim (image, caption, or the × button) dismisses it.
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
    });

    document.body.appendChild(overlay);
    lightbox = { open: open };
    return lightbox;
}

function makePhotoZoomable(img, caption) {
    if (img.dataset.zoomable) return;   // don't double-bind
    img.dataset.zoomable = '1';
    img.addEventListener('click', function () {
        ensureLightbox().open(img.currentSrc || img.src, img.alt, caption, img);
    });
}

function initCarousels() {
    const carousels = document.querySelectorAll('[data-carousel]');
    carousels.forEach(initCarousel);

    // Standalone (non-carousel) story photos are zoomable too
    document.querySelectorAll('.story-photo-single img, .story-photo-pair img').forEach(function (img) {
        makePhotoZoomable(img, img.alt);
    });
}

function initCarousel(carousel) {
    const track = carousel.querySelector('.story-carousel-track');
    const slides = Array.from(carousel.querySelectorAll('.story-carousel-slide'));
    const dotsContainer = carousel.querySelector('[data-carousel-dots]');
    const prevBtn = carousel.querySelector('.story-carousel-arrow-prev');
    const nextBtn = carousel.querySelector('.story-carousel-arrow-next');

    if (!track || slides.length === 0) return;

    // Each slide photo can be clicked to view enlarged (caption follows the slide)
    slides.forEach(function (slide) {
        const img = slide.querySelector('img');
        if (img) makePhotoZoomable(img, slide.getAttribute('data-caption') || img.alt);
    });

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
