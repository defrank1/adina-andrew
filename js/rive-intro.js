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
    var DURATION_S = 22.14;     // handoff moment (card fully expanded), in seconds
    var STEP_HZ = 15;           // stepped cadence; set 0 for smooth playback
    var END_HOLD_MS = 500;      // sit on the final frame this long, then HARD-CUT (no fade)
    var SAFETY_MS = 26000;      // backstop only — DURATION_S plus margin

    var container = document.getElementById('rive-container');
    var canvas = document.getElementById('rive-canvas');
    var skipBtn = document.getElementById('skip-intro');
    // The static invitation that the intro hard-cuts to. It sits beneath the canvas
    // (same matte + final frame) and is revealed at teardown so the swap is invisible.
    var endState = document.getElementById('invitation-endstate');

    // Nothing to do if the markup isn't present. Still reveal the invitation so the
    // page is usable even if the animation layer is absent.
    if (!container || !canvas) {
        if (endState) { endState.classList.remove('pre-reveal'); }
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

    // ---- teardown helpers --------------------------------------------------

    function revealEndState() {
        // Show the static invitation sitting beneath the canvas. It shares the same
        // green matte and reproduces the final frame, so revealing it under the canvas
        // and then removing the canvas is a seamless swap.
        if (endState) { endState.classList.remove('pre-reveal'); }
    }

    // removeNow — the single teardown + HARD CUT. Reveal the invitation (behind the
    // canvas), then remove the canvas instantly (no fade) so the swap is invisible.
    // Idempotent via the `finished` guard, so double-calls (e.g. Skip during the hold)
    // are safe.
    function removeNow() {
        if (finished) { return; }
        finished = true;
        if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
        revealEndState();
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

    // completeIntro — animation reached its end naturally. Sit on the final frame for
    // END_HOLD_MS, then hard-cut to the static invitation.
    function completeIntro() {
        if (finished) { return; }
        markSeen();
        setTimeout(removeNow, END_HOLD_MS);
    }

    // skipIntro — user pressed Skip, or Rive errored after the canvas was shown.
    // Hard-cut immediately (no hold).
    function skipIntro() { markSeen(); removeNow(); }

    // bailSilently — never showed the canvas (reduced motion, return visit, missing
    // asset); reveal the invitation immediately with no animation.
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

        var t = (STEP_HZ === 0)
            ? elapsed
            : Math.floor(elapsed * STEP_HZ) / STEP_HZ;   // quantize to STEP_HZ steps/sec
        var clamped = Math.min(t, DURATION_S);

        try { riveInstance.scrub(ANIMATION_NAME, clamped); } catch (e) { /* no-op */ }

        if (clamped >= DURATION_S) {
            completeIntro();          // fade + reveal RSVP page
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
