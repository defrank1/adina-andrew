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

    // Set initial toggle symbol
    var sym = document.getElementById('toggle-sym');
    if (sym && isDark) {
        sym.childNodes[0].textContent = '\u23FE';
        sym.style.fontSize = '28px';
    }

    const darkModeBtn = document.getElementById('dark-mode-toggle');
    if (!darkModeBtn) return;

    darkModeBtn.addEventListener('click', function () {
        document.documentElement.classList.toggle('dark-mode');
        document.body.classList.toggle('dark-mode');
        const isDarkNow = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDarkNow ? 'enabled' : 'disabled');
        updateImages(isDarkNow);
        var sym = document.getElementById('toggle-sym');
        if (sym) {
            if (isDarkNow) {
                sym.childNodes[0].textContent = '\u23FE';
                sym.style.fontSize = '28px';
            } else {
                sym.childNodes[0].textContent = '\u2739';
                sym.style.fontSize = '42px';
            }
        }
    });
}

// ===========================
// Mobile Menu
// ===========================

function initMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const panel = document.getElementById('mobile-menu-panel');
    if (!btn || !panel) return;

    btn.addEventListener('click', function () {
        const isOpen = panel.classList.contains('open');
        panel.classList.toggle('open');
        btn.setAttribute('aria-expanded', !isOpen);
    });

    // Close menu when clicking outside
    document.addEventListener('click', function (e) {
        if (!btn.contains(e.target) && !panel.contains(e.target)) {
            panel.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
        }
    });

    // Close menu when a link is clicked
    panel.querySelectorAll('.mobile-menu-link').forEach(function (link) {
        link.addEventListener('click', function () {
            panel.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
        });
    });
}

loadIncludes();
