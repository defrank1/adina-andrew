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

function initTheme() {
    const isDark = localStorage.getItem('darkMode') === 'enabled';
    if (isDark) updateImages(true);

    const toggleLabel = document.getElementById('toggle-label');
    if (toggleLabel && isDark) toggleLabel.textContent = 'Light Mode';

    // Set initial toggle shape (no animation on load)
    if (isDark) {
        var toggleShape = document.getElementById('toggle-shape');
        if (toggleShape) {
            toggleShape.setAttribute('d', 'M17.5 28C17.5 43.1878 28.5681 55.5 27.5 55.5C12.3122 55.5 0 43.1878 0 28C0 12.8122 12.3122 0.5 27.5 0.5C27.5 0.5 17.5 12.8122 17.5 28Z');
        }
    }

    const darkModeBtn = document.getElementById('dark-mode-btn');
    if (!darkModeBtn) return;

    darkModeBtn.addEventListener('click', function () {
        document.documentElement.classList.toggle('dark-mode');
        document.body.classList.toggle('dark-mode');
        const isDarkNow = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDarkNow ? 'enabled' : 'disabled');
        updateImages(isDarkNow);
        const label = document.getElementById('toggle-label');
        if (label) label.textContent = isDarkNow ? 'Light Mode' : 'Dark Mode';

        // Morph toggle icon
        var toMoon = document.getElementById('to-moon');
        var toSun = document.getElementById('to-sun');
        if (toMoon && toSun) {
            if (isDarkNow) {
                toMoon.beginElement();
            } else {
                toSun.beginElement();
            }
        }
    });
}

// ===========================
// Menu (placeholder — mobile uses inline links, no toggle needed)
// ===========================

function initMenu() {
    // Mobile nav now shows all links inside the diamond — no menu toggle required.
    // This function is kept as a no-op so loadIncludes() doesn't error.
}

loadIncludes();
