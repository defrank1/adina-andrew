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
        sym.textContent = '\u23FE';
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
            sym.textContent = isDarkNow ? '\u23FE' : '\u2739';
        }
    });

    // Cursor-tracking shimmer on toggle symbol
    var toggleSym = document.getElementById('toggle-sym');
    if (toggleSym) {
        var baseLt = 'rgba(48,78,62,0.75)';
        var baseDk = 'rgba(45,90,74,0.5)';

        toggleSym.addEventListener('mousemove', function(e) {
            var rect = toggleSym.getBoundingClientRect();
            var x = ((e.clientX - rect.left) / rect.width) * 100;
            var y = ((e.clientY - rect.top) / rect.height) * 100;
            var isDark = document.body.classList.contains('dark-mode');
            var bg = isDark ? baseDk : baseLt;
            var hiA = isDark ? 'rgba(241,237,234,0.6)' : 'rgba(255,255,255,0.55)';
            var hiB = isDark ? 'rgba(241,237,234,0.5)' : 'rgba(255,255,255,0.45)';
            var grad = 'radial-gradient(ellipse 18px 8px at ' + x + '% ' + y + '%, ' + hiA + ' 0%, transparent 80%), radial-gradient(ellipse 8px 18px at ' + x + '% ' + y + '%, ' + hiB + ' 0%, transparent 80%), ' + bg;
            toggleSym.style.background = grad;
            toggleSym.style.webkitBackgroundClip = 'text';
            toggleSym.style.backgroundClip = 'text';
            toggleSym.style.webkitTextFillColor = 'transparent';
        });

        toggleSym.addEventListener('mouseleave', function() {
            var isDark = document.body.classList.contains('dark-mode');
            toggleSym.style.background = isDark ? baseDk : baseLt;
            toggleSym.style.webkitBackgroundClip = 'text';
            toggleSym.style.backgroundClip = 'text';
            toggleSym.style.webkitTextFillColor = 'transparent';
        });
    }
}

// ===========================
// Menu (placeholder — mobile uses inline links, no toggle needed)
// ===========================

function initMenu() {
    // Mobile nav now shows all links inside the diamond — no menu toggle required.
    // This function is kept as a no-op so loadIncludes() doesn't error.
}

loadIncludes();
