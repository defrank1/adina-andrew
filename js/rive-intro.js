/* ===========================================================================
   Rive Metro intro — web integration layer for rsvp.html
   ---------------------------------------------------------------------------
   Loads, plays, and hands off the hand-drawn DC Metro intro animation.
   The .riv asset is built separately in the Rive editor and is expected at:

       assets/rive/metro-intro.riv

   Flow (Option A — animation plays AFTER password unlock):
     password entered -> #password-overlay hides -> this script reveals the
     fullscreen Rive canvas and plays it -> on the state machine's `complete`
     state the canvas fades out (0.8s) and is removed, revealing the RSVP page.

   The animation is gated so it only ever plays once per session, respects
   reduced-motion, and degrades silently if the .riv asset is absent (so the
   page is fully usable during development before the animation exists).
   =========================================================================== */
(function () {
    'use strict';

    var RIVE_SRC = 'assets/rive/metro-intro.riv';
    var RIVE_RUNTIME = 'https://unpkg.com/@rive-app/canvas@latest';
    var FADE_MS = 800;          // must match the CSS opacity transition on #rive-container
    var SAFETY_MS = 20000;      // fallback if the state machine never fires `complete`

    var container = document.getElementById('rive-container');
    var canvas = document.getElementById('rive-canvas');
    var skipBtn = document.getElementById('skip-intro');

    // Nothing to do if the markup isn't present.
    if (!container || !canvas) { return; }

    var prefersReduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var riveInstance = null;
    var safetyTimer = null;
    var resizeHandler = null;
    var started = false;
    var finished = false;

    // ---- teardown helpers --------------------------------------------------

    function removeNow() {
        // Instant removal — no fade. Used when the intro never visibly played
        // (reduced motion, return visit, or missing asset).
        if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
        cleanupRive();
        if (container && container.parentNode) { container.parentNode.removeChild(container); }
        if (skipBtn && skipBtn.parentNode) { skipBtn.parentNode.removeChild(skipBtn); }
    }

    function cleanupRive() {
        if (riveInstance) {
            try { if (typeof riveInstance.cleanup === 'function') { riveInstance.cleanup(); } }
            catch (e) { /* no-op */ }
            riveInstance = null;
        }
    }

    function fadeOutAndRemove() {
        // Visible fade — used when the animation actually played (or the user
        // hit Skip mid-animation).
        if (finished) { return; }
        finished = true;
        if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
        cleanupRive();
        container.classList.add('hidden');
        if (skipBtn) { skipBtn.classList.add('hidden'); }
        setTimeout(removeNow, FADE_MS + 50);
    }

    function markSeen() {
        try { sessionStorage.setItem('intro-seen', 'true'); } catch (e) { /* private mode */ }
    }

    // completeIntro — animation reached its end naturally.
    function completeIntro() { markSeen(); fadeOutAndRemove(); }

    // skipIntro — user pressed Skip, or Rive errored after the canvas was shown.
    function skipIntro() { markSeen(); fadeOutAndRemove(); }

    // bailSilently — never showed the canvas; remove instantly with no flash.
    function bailSilently() { markSeen(); removeNow(); }

    // ---- canvas sizing -----------------------------------------------------

    function resizeCanvas() {
        var dpr = window.devicePixelRatio || 1;
        var w = window.innerWidth;
        var h = window.innerHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        if (riveInstance && typeof riveInstance.resizeToCanvas === 'function') {
            try { riveInstance.resizeToCanvas(); } catch (e) { /* no-op */ }
        }
    }

    // ---- reveal ------------------------------------------------------------

    function revealCanvas() {
        // Show instantly (no fade-in) so the cream RSVP page never peeks through
        // before the dark tunnel scene takes over.
        if (skipBtn) { skipBtn.classList.remove('hidden'); }
        container.style.transition = 'none';
        container.classList.remove('hidden');
        // Force reflow, then restore the transition so the later fade-out animates.
        void container.offsetHeight;
        container.style.transition = '';
    }

    // ---- Rive runtime loading + init --------------------------------------

    function loadRuntime() {
        return new Promise(function (resolve, reject) {
            if (window.rive) { resolve(); return; }
            var s = document.createElement('script');
            s.src = RIVE_RUNTIME;
            s.async = true;
            s.onload = function () { resolve(); };
            s.onerror = function () { reject(new Error('Rive runtime failed to load')); };
            document.head.appendChild(s);
        });
    }

    function initRive() {
        try {
            riveInstance = new rive.Rive({
                src: RIVE_SRC,
                canvas: canvas,
                autoplay: true,
                layout: new rive.Layout({
                    fit: rive.Fit.Cover,
                    alignment: rive.Alignment.Center
                }),
                onStateChange: function (event) {
                    // Rive passes an array of the state names that changed.
                    var data = event && event.data;
                    if (data && typeof data.indexOf === 'function' && data.indexOf('complete') !== -1) {
                        completeIntro();
                        return;
                    }
                    if (typeof data === 'string' && data.indexOf('complete') !== -1) {
                        completeIntro();
                    }
                },
                onLoad: function () {
                    resizeCanvas();
                    resizeHandler = resizeCanvas;
                    window.addEventListener('resize', resizeHandler);
                },
                onLoadError: function () {
                    // Asset present check passed but Rive still couldn't parse it —
                    // hand off rather than trapping the user behind a blank canvas.
                    skipIntro();
                }
            });
        } catch (e) {
            skipIntro();
            return;
        }
        // Safety net: if the state machine never emits `complete`, hand off anyway.
        safetyTimer = setTimeout(completeIntro, SAFETY_MS);
    }

    // ---- entry point -------------------------------------------------------

    function startIntro() {
        if (started) { return; }
        started = true;

        // Skip entirely (no visible canvas) for reduced motion or return visits.
        var seen = false;
        try { seen = sessionStorage.getItem('intro-seen') === 'true'; } catch (e) { /* ignore */ }
        if (prefersReduced || seen) { bailSilently(); return; }

        // Only commit to the animation once we know the asset exists — keeps the
        // page clean and console-error-free while the .riv is still being built.
        assetExists(RIVE_SRC).then(function (exists) {
            if (!exists) { bailSilently(); return; }
            revealCanvas();
            loadRuntime().then(initRive).catch(function () { skipIntro(); });
        });
    }

    function assetExists(url) {
        if (!window.fetch) { return Promise.resolve(true); } // can't check — assume present
        return fetch(url, { method: 'HEAD' })
            .then(function (r) { return r.ok; })
            .catch(function () { return false; });
    }

    // Skip button (keyboard-focusable <button>; Enter/Space fire click natively).
    if (skipBtn) { skipBtn.addEventListener('click', skipIntro); }

    // Option A: start only after the password overlay has been cleared. The inline
    // password script adds `.unlocked` to #protected-content on success (or on load
    // if the session is already unlocked). We watch for that rather than touching
    // the password logic itself.
    var protectedContent = document.getElementById('protected-content');
    if (!protectedContent) {
        startIntro();
    } else if (protectedContent.classList.contains('unlocked')) {
        startIntro();
    } else {
        var obs = new MutationObserver(function () {
            if (protectedContent.classList.contains('unlocked')) {
                obs.disconnect();
                startIntro();
            }
        });
        obs.observe(protectedContent, { attributes: true, attributeFilter: ['class'] });
    }
})();
