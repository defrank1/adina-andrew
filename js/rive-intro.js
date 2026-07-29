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
    var DURATION_S = 18.41;       // handoff moment — the last-motion frame (train
                                   // settled, envelope gone, no card). The cut fires
                                   // here; the baked end-frame layer beneath
                                   // #invitation-endstate takes over from this exact
                                   // frame, so no in-Rive cream-cover beat is needed.
    var STEP_HZ = 15;             // stepped cadence; set 0 for smooth playback
    var SETTLE_DELAY_MS = 1200;   // hold on the matched frame before the dissolve begins
    var SETTLE_MS = 1000;         // settle transition length (0 = instant brand page)
    var SCENE_GREEN = '#183A2B';  // exact background hex of the baked end-frame PNG
                                   // (assets/rive/metro-endframe.png) — used for the
                                   // letterbox and endstate so field and bars are
                                   // pixel-identical, no seam
    var SAFETY_MS = 21000;        // backstop only — DURATION_S plus margin
    var RUNTIME_LOAD_TIMEOUT_MS = 8000; // cellular stall guard — see loadRuntime
    var SKIP_INK_TIMEOUT_MS = 150; // Promise.race bound so an early Skip can't hang
                                    // on the ink-decode gate — see whenInkReady

    var queryParams = new URLSearchParams(location.search);

    // ?debug-registration — a dev-only verification mode (see debugRegistration()
    // below). Fully gated behind this flag; nothing it does can run without the
    // query param, so the normal playback path is unaffected.
    var DEBUG_REGISTRATION = queryParams.has('debug-registration');

    // ?cut= — dev-only override for DURATION_S, so Andrew can find the right
    // handoff moment live in the browser instead of re-exporting the .riv for
    // every guess. Only active when the param is actually present — with none
    // present the constant is used exactly as declared and nothing is logged,
    // so the normal path is unaffected. Once the right number is found,
    // hardcode it back into DURATION_S above and drop the query param.
    (function applyTimingOverrides() {
        if (!queryParams.has('cut')) { return; }
        var cut = parseFloat(queryParams.get('cut'));
        if (!isNaN(cut)) { DURATION_S = cut; }
        console.log('[rive-intro timing] DURATION_S=' + DURATION_S);
    })();

    var container = document.getElementById('rive-container');
    var canvas = document.getElementById('rive-canvas');
    var skipBtn = document.getElementById('skip-intro');
    // The static invitation that the intro hard-cuts to. It sits beneath the canvas
    // (same matte + final frame) and is revealed early — one rAF after the canvas
    // goes up, fully occluded behind it — so the swap at the cut is invisible AND
    // cheap (see revealCanvas()).
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
    var inkDecoded = null;      // Promise kicked off by revealCanvas() — see whenInkReady

    // ---- teardown helpers --------------------------------------------------

    function revealEndState() {
        // Show the static end-frame layer sitting beneath the canvas. It's the baked
        // last-motion frame (green field + tunnel + train, SCENE_GREEN, no card) and
        // matches #rive-container's own background exactly — both are the same scene
        // green for the whole intro, so revealing it under the canvas and then
        // removing the canvas is a seamless swap. The dissolve into textured paper
        // happens entirely in CSS, on the settle.
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
        // The container never changes color during the intro — it's SCENE_GREEN the
        // whole time (see its CSS), matching the baked end-frame layer beneath it —
        // so there's nothing to force here anymore. revealEndState() here is
        // normally a no-op now — revealCanvas() already revealed it one rAF after
        // the canvas went up, occluded, so its layout/paint/raster/layer allocation
        // happened during playback, not in this frame (see its own comment). This
        // call stays as an idempotent (classList.remove) safety net for any path
        // that reaches hardCut() without revealCanvas() having run first.
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

    // addIntroComplete — flips the class that drives the settle. Body's own
    // background-color/-image are ALWAYS hidden behind an opaque layer while
    // `:not(.intro-complete))` is in effect — the password overlay, then the
    // Rive canvas, then the opaque #invitation-endstate — so the green matte
    // never has a reason to be visible when this class flips. The visible
    // green -> cream fade the viewer sees is provided entirely by
    // #invitation-endstate's own alpha fade (keyed to --settle-ms). Body's
    // background nonetheless carries the SITE-WIDE dark-mode transition
    // (color/background-color/text-shadow, hardcoded 400ms, unrelated to
    // --settle-ms), so left alone it independently fades matte -> cream over
    // that same 400ms — a transition with no visual purpose here, since it's
    // always masked, but a real one: if anything ever fails to mask it (a
    // throttled/backgrounded tab, a slow paint), the matte shows through as a
    // green band until it catches up. Bypassing the transition for this one
    // flip (matching how z-index already snaps rather than animates here)
    // removes that window entirely; re-enabling immediately after keeps a
    // later dark-mode toggle on the settled page fading normally.
    function addIntroComplete() {
        document.body.style.transition = 'none';
        document.body.classList.add('intro-complete');
        void document.body.offsetHeight;
        document.body.style.transition = '';
    }

    function settle() {
        setTimeout(addIntroComplete, SETTLE_DELAY_MS);
    }

    // settleInstant — bail paths (return visit, reduced motion, missing asset) must
    // land directly on the brand page: zero the transition length, then settle.
    function settleInstant() {
        document.body.style.setProperty('--settle-ms', '0ms');
        addIntroComplete();
    }

    // completeIntro — the loop reached DURATION_S (the last-motion frame). Waits for
    // the ink decode (see whenInkReady) so the DOM card never flashes blank, then
    // hard-cuts — no hold timer at the cut itself (the old stacked timeouts caused a
    // measured ~3.6s frozen stall) — then a SETTLE_DELAY_MS hold on the matched
    // frame before the settle dissolves it into the textured page. The canvas sits
    // frozen on its last-scrubbed (already-final) frame for this brief gate — in
    // practice near-instant, since decode has had the whole ~18s runway by now.
    function completeIntro() {
        markSeen();
        whenInkReady(false).then(function () { hardCut(); settle(); });
    }

    // skipIntro — user pressed Skip, or Rive errored after the canvas was shown.
    // Lands DIRECTLY on the settled state (no transition). Gates on the same ink
    // decode, but bounded (see whenInkReady) so an early Skip can't hang.
    function skipIntro() {
        markSeen();
        whenInkReady(true).then(function () { hardCut(); settleInstant(); });
    }

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

        // Kick off decoding the DOM card's ink PNG now, using the ~18s of runway
        // before the cut. Rive draws the card WITH its text on the canvas; the DOM
        // card underneath (#invitation-endstate) starts blank until its own ink PNG
        // has decoded. Without this, hardCut() reveals the DOM card the same frame
        // the canvas hides, and the ink hasn't painted yet — a one-frame blank-cream
        // blip (no text). whenInkReady() gates the cut on this promise. The
        // animation always exits to LIGHT mode (resetThemeToLight), so only the
        // light ink needs preloading — same URL string as the DOM
        // <img class="paper-card__ink"> so this decode warms the exact resource the
        // browser paints from (a cache hit, not a separate fetch).
        var inkImg = new Image();
        inkImg.src = 'assets/invitation/invitation-ink-light.png';
        inkDecoded = inkImg.decode ? inkImg.decode().catch(function () {}) : Promise.resolve();

        // Render the end state now, occluded behind the opaque canvas (z-index 2000
        // over #invitation-endstate's 1500), so its first layout, first paint, image
        // raster (metro-endframe.png at full viewport resolution) and composited-
        // layer allocation all happen during the ~18s of tunnel playback instead of
        // landing in the cut frame. hardCut() then only has to hide the canvas — a
        // single cheap operation — which is what makes the swap actually land in one
        // frame instead of dropping one. One rAF of delay so the canvas has
        // definitely painted fully opaque first: before container.classList.remove
        // ('hidden') the container is opacity: 0 (.hidden fades opacity, it does NOT
        // use display), so revealing any earlier would let the invitation show
        // through that transparent window — the entire reason .pre-reveal exists.
        requestAnimationFrame(function () { revealEndState(); });
    }

    // whenInkReady — resolves once the ink decode above has settled. `raceTimeout`
    // (Skip only) bounds the wait with SKIP_INK_TIMEOUT_MS so an early Skip stays
    // responsive instead of blocking on a decode that hasn't had its usual ~18s of
    // runway; a brief blip on an early skip is acceptable, a hang is not. Natural
    // completion (DURATION_S) has had that full runway, so it waits unbounded —
    // inkDecoded always resolves (errors are caught), so this can't hang in
    // practice. If revealCanvas() never ran (bail paths), inkDecoded is still null
    // and there's nothing to gate — those paths never showed a canvas painting a
    // different card, so there's no swap to blip.
    function whenInkReady(raceTimeout) {
        if (!inkDecoded) { return Promise.resolve(); }
        if (!raceTimeout) { return inkDecoded; }
        return Promise.race([
            inkDecoded,
            new Promise(function (resolve) { setTimeout(resolve, SKIP_INK_TIMEOUT_MS); })
        ]);
    }

    // ---- Rive runtime loading + init --------------------------------------

    function loadRuntime() {
        return new Promise(function (resolve, reject) {
            if (window.rive) { resolve(); return; }
            var settled = false;
            var s = document.createElement('script');
            s.src = RIVE_RUNTIME;
            s.async = true;
            // Cellular stall guard: a stalled request never fires onload or onerror,
            // so without this the promise hangs forever and initRive (and its
            // SAFETY_MS backstop) never gets a chance to run. On timeout, reject with
            // the same error path as onerror so the existing .catch(skipIntro) at the
            // call site handles it — no new bail path.
            var loadTimer = setTimeout(function () {
                settled = true;
                if (s.parentNode) { s.parentNode.removeChild(s); }
                reject(new Error('Rive runtime load timed out'));
            }, RUNTIME_LOAD_TIMEOUT_MS);
            s.onload = function () {
                if (settled) { return; }
                settled = true;
                clearTimeout(loadTimer);
                resolve();
            };
            s.onerror = function () {
                if (settled) { return; }
                settled = true;
                clearTimeout(loadTimer);
                reject(new Error('Rive runtime failed to load'));
            };
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
                    if (DEBUG_REGISTRATION) {
                        debugRegistration();
                        return;
                    }
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
        // Debug mode pauses indefinitely on purpose — never arm the backstop for it.
        if (!DEBUG_REGISTRATION) {
            safetyTimer = setTimeout(completeIntro, SAFETY_MS);
        }
    }

    // ---- registration debug overlay ----------------------------------------
    // ?debug-registration scrubs to the final frame and pauses there (no hard
    // cut, no settle) so the DOM invitation card — placed by the CSS values in
    // .invitation-card, which are now authoritative — can be visually compared
    // against the .riv's own final-frame card. The endstate is brought above
    // the paused canvas with its opaque cream fill stripped, and only the card
    // is shown, at 50% opacity, so both are visible at once. Use this to nudge
    // the .riv's final keyframes in the Rive editor until it sits under the
    // ghost; the CSS values themselves do not get adjusted to match.
    function debugRegistration() {
        try { riveInstance.scrub(ANIMATION_NAME, DURATION_S); } catch (e) { /* no-op */ }
        if (endState) {
            endState.classList.remove('pre-reveal');
            endState.style.zIndex = '2001';           // above #rive-container (2000)
            endState.style.backgroundColor = 'transparent';
        }
        var cardEl = document.querySelector('.invitation-card');
        if (cardEl) { cardEl.style.opacity = '0.5'; }
        console.log('[debug-registration] canvas rect', canvas.getBoundingClientRect());
        console.log('[debug-registration] card rect', cardEl ? cardEl.getBoundingClientRect() : null);
    }

    // ---- entry point -------------------------------------------------------

    function startIntro() {
        if (started) { return; }
        started = true;

        // Skip entirely (no visible canvas) for reduced motion or return visits.
        // Debug mode always forces the real animation path so the overlay is
        // reachable without clearing session state first.
        var seen = false;
        try { seen = sessionStorage.getItem('intro-seen') === 'true'; } catch (e) { /* ignore */ }
        if (!DEBUG_REGISTRATION && (prefersReduced || seen)) { bailSilently(); return; }

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
