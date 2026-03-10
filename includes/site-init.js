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

    const darkModeBtn = document.getElementById('dark-mode-btn');
    if (!darkModeBtn) return;

    darkModeBtn.addEventListener('click', function () {
        document.body.classList.add('theme-transitioning');
        document.body.classList.toggle('dark-mode');
        document.documentElement.classList.toggle('dark-mode');
        const isDarkNow = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDarkNow ? 'enabled' : 'disabled');
        updateImages(isDarkNow);
        const label = document.getElementById('toggle-label');
        if (label) label.textContent = isDarkNow ? 'Light Mode' : 'Dark Mode';
        requestAnimationFrame(() => requestAnimationFrame(() => {
            document.body.classList.remove('theme-transitioning');
        }));
    });
}

// ===========================
// Menu Toggle
// ===========================

function initMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');

    if (!menuToggle || !navLinks) return;

    function closeMenu() {
        navLinks.style.transform = 'scale(0)';
        navLinks.style.opacity = '0';
        setTimeout(() => {
            navLinks.classList.remove('open');
            navLinks.style.transform = '';
            navLinks.style.opacity = '';
        }, 300);
        menuToggle.textContent = 'Menu';
        menuToggle.setAttribute('aria-expanded', 'false');
        document.querySelectorAll('main.menu-open, .site-footer.menu-open').forEach(el => {
            el.classList.remove('menu-open');
        });
    }

    menuToggle.addEventListener('click', function () {
        if (navLinks.classList.contains('open')) {
            closeMenu();
        } else {
            navLinks.classList.add('open');
            menuToggle.textContent = 'Close';
            menuToggle.setAttribute('aria-expanded', 'true');
            document.querySelectorAll('main, .site-footer').forEach(el => {
                el.classList.add('menu-open');
            });
        }
    });

    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    document.addEventListener('click', function (e) {
        if (navLinks.classList.contains('open') &&
            !navLinks.contains(e.target) &&
            !menuToggle.contains(e.target)) {
            closeMenu();
        }
    });
}

loadIncludes();
