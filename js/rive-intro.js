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
    var RIVE_RUNTIME = 'https://unpkg.com/@rive-app/canvas@2.38.3';  // PINNED — not @latest, which can pull a breaking runtime silently
    // Linear timeline to scrub. The task spec named this 'Timeline 19', but the
    // committed metro-intro.riv exposes its single linear timeline as 'Timeline 1'
    // (verified via animationNames + contents.artboards[0].animations). scrub()
    // needs the exact name, so this uses the real one. If a future export renames
    // the timeline, update this one constant.
    var ANIMATION_NAME = 'Timeline 1';
    var DURATION_S = 22.22;       // handoff moment — end of the in-Rive cream cover fade
    var FADE_SYNC_START = 21.0;   // when the in-Rive cover fade begins (21.00 -> 22.22)
    var FADE_SYNC_MS = 1220;      // letterbox fade duration, synced to the cover fade
    var STEP_HZ = 15;             // stepped cadence; set 0 for smooth playback
    var SETTLE_DELAY_MS = 150;    // pause on the matched frame before settling
    var SETTLE_MS = 450;          // settle transition length (0 = instant brand page)
    var COVER_CREAM = '#F1EDEA';  // matches the in-Rive cover rect exactly
    var SAFETY_MS = 26000;        // backstop only — DURATION_S plus margin

    var container = document.getElementById('rive-container');
    var canvas = document.getElementById('rive-canvas');
    var skipBtn = document.getElementById('skip-intro');
    // The static invitation that the intro hard-cuts to. It sits beneath the canvas
    // (same matte + final frame) and is revealed at teardown so the swap is invisible.
    var endState = document.getElementById('invitation-endstate');

    // SETTLE_MS is the single source of truth for the settle length — the CSS
    // transitions read it via var(--settle-ms). Bail paths zero it (settleInstant)
    // so return visits land on the brand page with no transition.
    document.body.style.setProperty('--settle-ms', SETTLE_MS + 'ms');

    // Nothing to do if the markup isn't present. Still land on the settled brand
    // page so it's usable even if the animation layer is absent.
    if (!container || !canvas) {
        if (endState) { endState.classList.remove('pre-reveal'); }
        settleInstant();
        return;
    }

    var prefersReduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var riveInstance = null;
    var safetyTimer = null;
    var resizeHandler = null;
    var started = false;
    var finished = false;
    var rafId = null;           // owned playback loop handle
    var elapsed = 0;            // accumulated play time (seconds), from RAF deltas
    var lastTs = null;          // previous RAF timestamp; null resets the delta
    var lastScrubT = -1;        // last quantized time actually scrubbed (dedup)
    var fadeSynced = false;     // letterbox fade fired once at FADE_SYNC_START

    // ---- teardown helpers --------------------------------------------------

    function revealEndState() {
        // Show the static invitation sitting beneath the canvas. It shares the same
        // green matte and reproduces the final frame, so revealing it under the canvas
        // and then removing the canvas is a seamless swap.
        if (endState) { endState.classList.remove('pre-reveal'); }
    }

    // resetThemeToLight — the animation's final frames are effectively light mode
    // (cream cover + light card), so exiting the animation always lands the page in
    // light mode; a dark settle would snap awkwardly. Runs while the canvas still
    // covers the page, so nothing visibly flips. Mirrors site-init.js's toggle logic
    // (class + localStorage + image swap + footer symbol) so the toggle keeps
    // working normally afterward. The user's preference is intentionally
    // overridden, once per animation viewing (see docs/decisions.md, July 11, 2026).
    function resetThemeToLight() {
        document.documentElement.classList.remove('dark-mode');
        document.body.classList.remove('dark-mode');
        try { localStorage.setItem('darkMode', 'disabled'); } catch (e) { /* private mode */ }
        if (typeof updateImages === 'function') {
            updateImages(false);   // site-init.js's swap loop, reused
        } else {
            document.querySelectorAll('[data-light][data-dark]').forEach(function (img) {
                img.src = img.dataset.light;
            });
        }
        var sym = document.getElementById('toggle-sym');
        if (sym && sym.childNodes[0]) {
            sym.childNodes[0].textContent = '☀';
            sym.style.fontSize = '36px';
        }
    }

    // hardCut — the seamless swap: reveal the pixel-registered end-state and hide the
    // canvas in the SAME frame (display, not an opacity fade — no dissolve, no hold).
    // The canvas NODE is removed only after the settle completes; removing it
    // mid-transition caused a one-frame glitch flash in the previous model.
    // Idempotent via the `finished` guard.
    function hardCut() {
        if (finished) { return; }
        finished = true;
        if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        // Light-mode reset fires ONLY on the animation path — the canvas was actually
        // shown (revealCanvas removed .hidden), i.e. real-time completion, Skip, or a
        // post-reveal Rive error. Bail paths (return visit / reduced-motion / missing
        // asset) never reveal the canvas and land settled with the user's theme intact.
        if (!container.classList.contains('hidden')) { resetThemeToLight(); }
        revealEndState();
        container.style.display = 'none';
        if (skipBtn) { skipBtn.classList.add('hidden'); }
        setTimeout(destroyIntro, SETTLE_DELAY_MS + SETTLE_MS + 100);
    }

    // destroyIntro — final teardown once nothing can still be transitioning.
    function destroyIntro() {
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

    function markSeen() {
        try { sessionStorage.setItem('intro-seen', 'true'); } catch (e) { /* private mode */ }
    }

    // ---- stage 2: the settle ------------------------------------------------
    // The hard cut lands on the Rive-matched flat state (stage 1). Shortly after,
    // `intro-complete` on <body> transitions the page into the normal brand page —
    // textured cream, nav/footer/replay fade in, card gains the illustration emboss.
    // All animation is CSS, driven by the class; JS only schedules it.

    function settle() {
        setTimeout(function () {
            document.body.classList.add('intro-complete');
        }, SETTLE_DELAY_MS);
    }

    // settleInstant — bail paths (return visit, reduced motion, missing asset) must
    // land directly on the brand page: zero the transition length, then settle.
    function settleInstant() {
        document.body.style.setProperty('--settle-ms', '0ms');
        document.body.classList.add('intro-complete');
    }

    // completeIntro — the loop reached DURATION_S (end of the in-Rive cream fade).
    // Hard cut in the same frame — no hold timer (the old stacked timeouts caused a
    // measured ~3.6s frozen stall) — then the settle after SETTLE_DELAY_MS.
    function completeIntro() { markSeen(); hardCut(); settle(); }

    // skipIntro — user pressed Skip, or Rive errored after the canvas was shown.
    // Lands DIRECTLY on the settled state (no transition).
    function skipIntro() { markSeen(); hardCut(); settleInstant(); }

    // bailSilently — never showed the canvas (reduced motion, return visit, missing
    // asset); land settled immediately and tear down now (double-destroy is safe).
    function bailSilently() { markSeen(); hardCut(); settleInstant(); destroyIntro(); }

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

    // ---- owned playback loop ----------------------------------------------
    // The intro is a single linear timeline, not a state machine, so we drive it
    // ourselves: accumulate elapsed time from RAF timestamps (NOT wall-clock, so a
    // backgrounded tab pauses instead of jumping), quantize to STEP_HZ steps/sec,
    // and scrub the timeline. Completion is detected by elapsed reaching DURATION_S.

    function tick(ts) {
        if (finished) { return; }
        if (lastTs === null) { lastTs = ts; }
        elapsed += (ts - lastTs) / 1000;
        lastTs = ts;

        // Synced letterbox fade: the in-Rive cream cover only fills the 16:9 artboard;
        // the container background (the letterbox bars on non-16:9 viewports) fades
        // green -> cream in step with it, so by DURATION_S the whole viewport is flat
        // #F1EDEA at any window shape. Fires exactly once.
        if (!fadeSynced && elapsed >= FADE_SYNC_START) {
            fadeSynced = true;
            container.style.transition = 'background-color ' + FADE_SYNC_MS + 'ms ease-in-out';
            container.style.backgroundColor = COVER_CREAM;
        }

        var t = (STEP_HZ === 0)
            ? elapsed
            : Math.floor(elapsed * STEP_HZ) / STEP_HZ;   // quantize to STEP_HZ steps/sec
        var clamped = Math.min(t, DURATION_S);

        // Scrub only when the quantized time advances — at 15 steps/s a 60Hz loop
        // would otherwise redraw the identical frame 3 extra times per step.
        if (clamped !== lastScrubT) {
            lastScrubT = clamped;
            try { riveInstance.scrub(ANIMATION_NAME, clamped); } catch (e) { /* no-op */ }
        }

        if (clamped >= DURATION_S) {
            completeIntro();          // hard cut in this same frame — no hold, no fade
            return;
        }
        rafId = requestAnimationFrame(tick);
    }

    function initRive() {
        try {
            riveInstance = new rive.Rive({
                src: RIVE_SRC,
                canvas: canvas,
                autoplay: false,
                animations: ANIMATION_NAME,   // target the linear timeline, NOT a state machine
                layout: new rive.Layout({
                    // Contain (not Cover) so the 16:9 artboard is never cropped — the
                    // full invitation always fits. #rive-container's green matte fills the
                    // letterbox (top/bottom on tall/mobile viewports, sides on wide ones).
                    fit: rive.Fit.Contain,
                    alignment: rive.Alignment.Center
                }),
                onLoad: function () {
                    resizeCanvas();
                    resizeHandler = resizeCanvas;
                    window.addEventListener('resize', resizeHandler);
                    // Start the owned loop from a clean slate.
                    elapsed = 0;
                    lastTs = null;
                    rafId = requestAnimationFrame(tick);
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
        // Backstop only: if the loop somehow never reaches DURATION_S, hand off anyway.
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

    // Replay icon — clear the once-per-session gate and reload. One playback
    // pipeline: the reloaded page runs the normal fresh-visit flow (intro -> cut ->
    // settle). Hidden under prefers-reduced-motion via CSS.
    var replayBtn = document.getElementById('replay-intro');
    if (replayBtn) {
        replayBtn.addEventListener('click', function () {
            try { sessionStorage.removeItem('intro-seen'); } catch (e) { /* private mode */ }
            location.reload();
        });
    }

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
