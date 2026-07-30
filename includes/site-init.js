// ===========================
// site-init.js — Shared includes, theme, and menu
// ===========================

async function loadIncludes() {
    const navPlaceholder = document.getElementById('nav-placeholder');
    const footerPlaceholder = document.getElementById('footer-placeholder');

    const [navText, footerText] = await Promise.all([
        navPlaceholder ? fetch('/includes/nav.html').then(r => r.text()) : Promise.resolve(null),
        footerPlaceholder ? fetch('/includes/footer.html').then(r => r.text()) : Promise.resolve(null),
    ]);

    if (navPlaceholder && navText) navPlaceholder.outerHTML = navText;
    if (footerPlaceholder && footerText) footerPlaceholder.outerHTML = footerText;

    initTheme();
    initMenu();
}

// ===========================
// Dark Mode
// ===========================

function updateImages(isDark) {
    document.querySelectorAll('[data-light][data-dark]').forEach(img => {
        img.src = isDark ? img.dataset.dark : img.dataset.light;
    });
}

// Canonical toggle glyph/size mapping. Sun (\u2739) in dark mode, moon
// (\u23FE) in light \u2014 the icon shows the mode you're IN. Sizes differ because
// the two glyphs have different optical weights at the same point size.
// Exposed globally (like updateImages) so js/rive-intro.js's light-mode reset
// can reuse it instead of keeping its own copy, which had drifted to the wrong
// glyph AND the wrong size.
function setToggleSymbol(isDark) {
    var sym = document.getElementById('toggle-sym');
    if (!sym || !sym.childNodes[0]) { return; }
    sym.childNodes[0].textContent = isDark ? '\u2739' : '\u23FE';
    sym.style.fontSize = isDark ? '36px' : '28px';
}

function initTheme() {
    const isDark = localStorage.getItem('darkMode') === 'enabled';
    if (isDark) updateImages(true);

    // Set initial toggle symbol \u2014 only for dark; the light case is already
    // correct from the HTML's static default glyph (includes/footer.html).
    if (isDark) setToggleSymbol(true);

    const darkModeBtn = document.getElementById('dark-mode-toggle');
    if (!darkModeBtn) return;

    darkModeBtn.addEventListener('click', function () {
        document.documentElement.classList.toggle('dark-mode');
        document.body.classList.toggle('dark-mode');
        const isDarkNow = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDarkNow ? 'enabled' : 'disabled');
        updateImages(isDarkNow);
        setToggleSymbol(isDarkNow);
    });
}

// ===========================
// Mobile Menu
// ===========================

function initMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const panel = document.getElementById('mobile-menu-panel');
    if (!btn || !panel) return;

    const mainEl = document.querySelector('main');
    const footerEl = document.querySelector('.site-footer');

    function setBackdropFade(open) {
        if (mainEl) mainEl.classList.toggle('menu-open', open);
        if (footerEl) footerEl.classList.toggle('menu-open', open);
    }

    btn.addEventListener('click', function () {
        const isOpen = panel.classList.contains('open');
        panel.classList.toggle('open');
        btn.setAttribute('aria-expanded', !isOpen);
        setBackdropFade(!isOpen);
    });

    // Close menu when clicking outside
    document.addEventListener('click', function (e) {
        if (!btn.contains(e.target) && !panel.contains(e.target)) {
            panel.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
            setBackdropFade(false);
        }
    });

    // Close menu when a link is clicked
    panel.querySelectorAll('.mobile-menu-link').forEach(function (link) {
        link.addEventListener('click', function () {
            panel.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
            setBackdropFade(false);
        });
    });
}

loadIncludes();
