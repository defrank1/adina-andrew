/* ===========================================================================
   RSVP card flow — front-end logic (rsvp.html)
   ---------------------------------------------------------------------------
   The RSVP paper suite that grows out of the settled invitation page. After
   the Metro intro settles, ~PEEK_DELAY_MS later the invitation's own "RSVP"
   button fades in — its sole entry affordance (no peek; only the current top
   card is ever visible, see .rsvp-stack-hidden / Section A4). Clicking it
   plays a set-aside move (Motion Rework, July 2026): the invitation exits
   left (the first "finished" card) while the lookup card enters from the
   right and becomes the new top — see the "stack engine" section below.

   Every card in the flow — invitation, lookup, one per INVITED event
   (Saturday is a single card covering every invited person, ending with the
   afterparty section — see buildSaturdayPanel/buildAfterpartyInfo), review,
   and the schedule/thank-you card — lives in ONE continuous stack array and
   moves through the SAME fileForward/fileBackward choreography (see "stack
   engine" below). Selecting an invitation doesn't jump to a different stack;
   it splices the personal-stack cards in right behind lookup and plays a
   normal fileForward move. That means Back is symmetric everywhere — from
   the first event card, Back reveals lookup; from lookup, Back reveals the
   invitation; from the invitation, the button swaps forward again — all the
   way through:

     invitation <-> lookup <-> one card per INVITED event
       <-> review & send <-> schedule/thank-you (no Back — "Edit your RSVP"
       loops back into a pre-filled personal stack instead, see
       enterEditFlow)

   Cards for non-invited events are never built; stack depth is entirely
   data-driven. Re-selecting (a different invite, or the same one again after
   going back to lookup) tears down the previous personal-stack cards and
   builds fresh ones — entered answers don't survive a trip back to lookup.
   Responses are per person (an invitation covers one or two named people).
   The email autocomplete keeps the staging form's privacy rule: no lookup
   until the guest has typed past the "@". Once an invitation is selected,
   the backend is also asked whether this guest has a prior response on file
   (fetchLatestResponse) — if so, they land straight on a populated schedule
   card instead of the blank flow; see selectInvitation.

   Three seams are the ONLY functions that touch the network (the first two
   share a contract with js/rsvp-form.js on the staging page; the third is
   RSVP-flow-only):

     searchInvitations(query) -> Promise<[{ email, invitedTo, people }]>
     submitRsvp(formData)     -> Promise<void>
     fetchLatestResponse(email) -> Promise<submission shape | null>

   APPS_SCRIPT_URL empty  -> placeholder invitations/responses + no-op submit
                             (fully testable front-end-only, identical to
                             staging).
   APPS_SCRIPT_URL set    -> live lookup/response-fetch/submit against the
                             deployed rsvp-workflow/google-apps-script.js web
                             app.

   Submission shape (extends the staging shape with meal/kosher):
     { email,
       people: [{ name, events: { friday: 'yes'|'no', ... },
                  meal: 'branzino'|'chicken'|'cauliflower'|'',
                  mealKosher: boolean }],
       message }
   =========================================================================== */
(function () {
    'use strict';

    // ---- CONFIG ------------------------------------------------------------

    // Paste the deployed Apps Script web-app URL here to go live. Empty = staging.
    var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbywSDY5TFjzhHsGgj-G_PZFm_hGR-ot7AJWK_Ul4d9PK6_toReBo2XmIEDEshv1PpGU/exec';

    var DEBOUNCE_MS = 180;
    // Gates the lookup (July 2026 — was "typed past the @"): only query once
    // `term` looks like a COMPLETE email address. The server now requires an
    // exact match (see handleLookup in rsvp-workflow/google-apps-script.js),
    // so a partial string could never return anything there anyway — this
    // just keeps the client from firing a request on every keystroke of an
    // address that isn't finished yet.
    var EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var REPLY_BY = 'the first of September'; // September 1, 2026 (confirmed)

    // ---- stack choreography timing -----------------------------------------
    // Set-aside metaphor (Motion Rework, July 2026 — supersedes file-to-back):
    // unanswered cards wait off-screen RIGHT, finished cards are set aside
    // off-screen LEFT. Two OVERLAPPING legs, transform-only — the enter leg
    // starts ENTER_OVERLAP of the way into the exit leg, so the screen is
    // never fully empty between cards. Andrew may retune any of these — kept
    // as the single source of truth (nothing else hardcodes them).
    var PEEK_DELAY_MS = 800;    // after the settle completes, before the peek + arrow appear
    var EXIT_MS = 420;
    var EXIT_CURVE = 'cubic-bezier(.4, 0, 1, 1)';   // ease-in — accelerate off-screen
    var ENTER_MS = 480;
    var ENTER_CURVE = 'cubic-bezier(0, 0, .2, 1)';  // ease-out — decelerate to rest
    // 0.6 (of EXIT_MS's TIME) reads as a collision, not a conveyor: EXIT_CURVE
    // is effectively ease-in (heavily back-loaded), so at 60% time elapsed the
    // outgoing card has covered only roughly a third of its actual travel
    // DISTANCE — the incoming card (front-loaded ENTER_CURVE) then starts
    // moving fast while the outgoing card is still mostly on-screen. Raised so
    // the enter leg only starts once the outgoing card has cleared most of the
    // screen under its own curve, while still overlapping enough that the
    // screen is never fully empty.
    var ENTER_OVERLAP = 0.85;   // enter leg starts this fraction into the exit leg
    var EXIT_ROTATE = 3;        // deg magnitude; forward exits -3deg, backward exits +3deg
    var ENTER_ROTATE = 3;       // deg magnitude; mirrors EXIT_ROTATE at the entering edge
    var STACK_MOVE_MS = Math.round(EXIT_MS * ENTER_OVERLAP) + ENTER_MS; // total move time, for focus delays

    var Z_HIDDEN = 490;  // resting, non-top cards (invisible via .rsvp-stack-hidden regardless)
    var Z_TOP = 500;     // resting top card — matches .invitation-card.rsvp-stack-member's existing 500
    var Z_EXIT = 1000;   // card actively exiting
    var Z_ENTER = 1001;  // card actively entering — always above Z_EXIT, so it wins if they visibly overlap

    // Wide-screen clipping fix (July 2026): translateX(±115%) is relative to
    // the CARD's own width, not the viewport — on wide/ultrawide screens the
    // field (min(100vw, 100dvh*16/9)) is far narrower than the viewport, so a
    // percentage-of-card-width exit never reached the true screen edge and
    // the card just popped invisible mid-screen. leftClearDX/rightClearDX
    // (near onceTransition) compute the real px distance from the card's
    // actual on-screen rect instead. EDGE_MARGIN_PX is the safety margin past
    // the true edge.
    var EDGE_MARGIN_PX = 40;

    var EVENT_DETAILS = {
        friday: {
            name: 'Welcome Party',
            when: 'Friday, October 16th · 8:00–10:00 PM',
            venue: 'Sonoma Restaurant & Wine Bar',
            address: '223 Pennsylvania Avenue SE',
            mapUrl: 'https://maps.google.com/?q=223+Pennsylvania+Avenue+SE+Washington+DC',
            dress: 'Semi-Formal',
            dressInfo: 'Sport coats and trousers, or dresses, jumpsuits, and blouses.'
        },
        saturday: {
            name: 'Wedding Ceremony and Reception',
            shortName: 'Ceremony and Reception',
            when: 'Saturday, October 17th · 5:30–11:00 PM',
            venue: 'InterContinental — The Wharf',
            address: '801 Wharf Street SW',
            mapUrl: 'https://maps.google.com/?q=801+Wharf+Street+SW+Washington+DC',
            dress: 'Black Tie Preferred',
            dressInfo: 'Tuxedos and full-length gowns are encouraged. Dark suits with a white shirt and dark tie, or formal cocktail dresses, are also welcome.'
        },
        sunday: {
            name: 'Farewell Brunch',
            when: 'Sunday, October 18th · 9:00–11:00 AM',
            venue: 'InterContinental — The Wharf',
            address: '801 Wharf Street SW',
            mapUrl: 'https://maps.google.com/?q=801+Wharf+Street+SW+Washington+DC',
            dress: 'Come as you are',
            dressInfo: 'Wear whatever feels comfortable — no need to dress up.'
        }
    };

    // Info-only block appended to every Saturday person card (no
    // accept/decline of its own — see buildAfterpartyInfo).
    var AFTERPARTY_DETAILS = {
        name: 'Afterparty',
        time: '11:00 PM – 1:00 AM',
        venue: "Kirwan's on the Wharf",
        address: '749 Wharf Street SW, Second Floor',
        mapUrl: 'https://maps.google.com/?q=749+Wharf+Street+SW+Washington+DC',
        note: 'All guests welcome — no need to RSVP!'
    };

    var EVENT_ORDER = ['friday', 'saturday', 'sunday'];

    // The reception dinner. `kosherable` meals carry the small "Kosher?"
    // checkbox. `label` is the full name (used on the radio itself);
    // `shortLabel` is used wherever a kosher selection is summarized
    // elsewhere (review/schedule cards, confirmation email) — "Kosher
    // Branzino," never "Kosher Pan-Seared Herb Branzino."
    var MEAL_OPTIONS = [
        { key: 'branzino', label: 'Pan-Seared Herb Branzino', shortLabel: 'Branzino', kosherable: true },
        { key: 'chicken', label: 'Lemon Thyme-Marinated Chicken', shortLabel: 'Chicken', kosherable: true },
        { key: 'cauliflower', label: 'Cauliflower Steak', shortLabel: 'Cauliflower Steak', kosherable: false }
    ];

    // ---- PLACEHOLDER DATA (staging only — NOT real guests) -----------------
    var PLACEHOLDER_INVITATIONS = [
        { email: 'john.smith@example.com', invitedTo: ['friday', 'saturday', 'sunday'], people: ['John Smith', 'Jane Smith'] },
        { email: 'mchen@example.com', invitedTo: ['saturday'], people: ['Michael Chen'] },
        { email: 'the.johnsons@example.com', invitedTo: ['friday', 'saturday', 'sunday'], people: ['Robert Johnson', 'Patricia Johnson'] },
        { email: 'laura.nelson@example.com', invitedTo: ['friday', 'saturday', 'sunday'], people: ['Laura Nelson'] },
        { email: 'williams.party@example.com', invitedTo: ['saturday', 'sunday'], people: ['Sarah Williams', 'Tom Williams'] },
        // Scale-test fixtures: deepest (4-person/3-event) and shallowest
        // (1-person/2-event) realistic parties.
        {
            email: 'garcia.family@example.com', invitedTo: ['friday', 'saturday', 'sunday'],
            people: ['Elena Garcia', 'Marco Garcia', 'Sofia Garcia', 'Luis Garcia']
        },
        {
            email: 'dpatel@example.com', invitedTo: ['friday', 'saturday'],
            people: ['Dev Patel']
        }
    ];

    // Canned prior responses for the returning-guest fast path (Section G3,
    // staging only). laura.nelson@example.com has one so that path is
    // testable; everyone else (including john.smith@example.com) gets none,
    // exercising the ordinary first-time flow instead.
    var PLACEHOLDER_RESPONSES = {
        'laura.nelson@example.com': {
            people: [{
                name: 'Laura Nelson',
                events: { friday: 'yes', saturday: 'yes', sunday: 'no' },
                meal: 'chicken',
                mealKosher: true
            }],
            message: 'So excited!'
        }
    };

    var RESPONSE_FETCH_TIMEOUT_MS = 6000;

    // ---- BACKEND SEAMS (the only network code) -------------------------------

    function searchInvitations(query) {
        var q = query.trim().toLowerCase();
        if (!APPS_SCRIPT_URL) {
            return Promise.resolve(PLACEHOLDER_INVITATIONS.filter(function (inv) {
                return inv.email.toLowerCase() === q;
            }));
        }
        return fetch(APPS_SCRIPT_URL + '?action=lookup&q=' + encodeURIComponent(q))
            .then(function (r) {
                if (!r.ok) { throw new Error('lookup failed: ' + r.status); }
                return r.json();
            });
    }

    function submitRsvp(formData) {
        if (!APPS_SCRIPT_URL) {
            console.log('RSVP (staging — not sent):', formData);
            return Promise.resolve();
        }
        // Content-Type: text/plain with a JSON string body — the standard Apps
        // Script pattern: avoids the CORS preflight the web app can't answer.
        return fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(formData)
        }).then(function (r) {
            if (!r.ok) { throw new Error('submit failed: ' + r.status); }
            return r.json();
        }).then(function (res) {
            if (!res || res.status !== 'success') {
                throw new Error((res && res.message) || 'submit failed');
            }
        });
    }

    // The guest's latest submitted response, if any, in submission shape —
    // { people, message } — or null if they've never submitted. Resolves,
    // never rejects (a network failure or timeout resolves null too), so
    // callers can treat "no prior response" and "couldn't check" identically
    // and never block an RSVP on this feature (Section G3).
    function fetchLatestResponse(email) {
        if (!APPS_SCRIPT_URL) {
            var placeholder = PLACEHOLDER_RESPONSES[(email || '').trim().toLowerCase()];
            return Promise.resolve(placeholder || null);
        }
        var url = APPS_SCRIPT_URL + '?action=response&email=' + encodeURIComponent(email);
        var timeout = new Promise(function (resolve) {
            setTimeout(function () { resolve(null); }, RESPONSE_FETCH_TIMEOUT_MS);
        });
        var live = fetch(url)
            .then(function (r) {
                if (!r.ok) { throw new Error('response fetch failed: ' + r.status); }
                return r.json();
            })
            .then(function (res) { return (!res || res.none) ? null : res; })
            .catch(function () { return null; });
        return Promise.race([live, timeout]);
    }

    // ---- DOM HELPERS ---------------------------------------------------------

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    function radioLabel(name, value, labelText) {
        var labelEl = el('label', 'radio-label');
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = name;
        input.value = value;
        labelEl.appendChild(input);
        labelEl.appendChild(el('span', null, labelText));
        return labelEl;
    }

    // Dress tag as a popover trigger: the bordered capsule is a button; clicking
    // or hovering it reveals the dress-code definition in a small popover, so the
    // guidance lives on the card (no jump to the FAQ). Hover/focus show it on
    // desktop (CSS); click toggles it (and persists) for touch.
    var dressPopoverId = 0;

    function makeDressTag(detail) {
        // No definition → keep it a plain, non-interactive tag.
        if (!detail.dressInfo) {
            return el('span', 'weekend-event-dress', detail.dress);
        }

        var wrap = el('span', 'weekend-event-dress-wrap');

        var btn = el('button', 'weekend-event-dress weekend-event-dress-btn', detail.dress);
        btn.type = 'button';
        btn.setAttribute('aria-expanded', 'false');

        var pop = el('span', 'dress-popover', detail.dressInfo);
        pop.setAttribute('role', 'tooltip');
        pop.id = 'dress-pop-' + (++dressPopoverId);
        btn.setAttribute('aria-describedby', pop.id);

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var willOpen = !pop.classList.contains('open');
            closeAllDressPopovers();
            if (willOpen) {
                pop.classList.add('open');
                btn.setAttribute('aria-expanded', 'true');
            }
        });

        wrap.appendChild(btn);
        wrap.appendChild(pop);
        return wrap;
    }

    function closeAllDressPopovers() {
        var open = document.querySelectorAll('.dress-popover.open');
        for (var i = 0; i < open.length; i++) {
            open[i].classList.remove('open');
            var wrap = open[i].parentNode;
            var btn = wrap && wrap.querySelector('.weekend-event-dress-btn');
            if (btn) { btn.setAttribute('aria-expanded', 'false'); }
        }
    }

    // "Friday, October 16th · 8:00–10:00 PM" -> two lines (date, then time),
    // the middle-dot separator dropped since the line break now does that job.
    function makeWhenLines(when) {
        var p = el('p', 'weekend-event-when');
        when.split(' · ').forEach(function (part, i) {
            if (i > 0) { p.appendChild(document.createElement('br')); }
            p.appendChild(document.createTextNode(part));
        });
        return p;
    }

    // Condensed event header for a card: when / dress tag / venue + address link.
    function makeCardEventMeta(detail) {
        var wrap = el('div', 'weekend-event');

        wrap.appendChild(makeWhenLines(detail.when));

        if (detail.dress) {
            wrap.appendChild(makeDressTag(detail));
        }

        var where = el('p', 'weekend-event-where');
        where.appendChild(document.createTextNode(detail.venue));
        where.appendChild(document.createElement('br'));
        var a = el('a', 'schedule-link', detail.address);
        a.href = detail.mapUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        where.appendChild(a);
        wrap.appendChild(where);

        return wrap;
    }

    // ---- BOOT ----------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', function () {
        var stackEl = document.getElementById('rsvp-stack');
        var arrowBtn = document.getElementById('rsvp-arrow');
        var backBtn = document.getElementById('rsvp-stack-back');
        var invitationCardEl = document.querySelector('.invitation-card');
        var scrollSpacerEl = document.querySelector('.rsvp-flow-scroll-spacer');
        if (!stackEl || !arrowBtn || !backBtn || !invitationCardEl) { return; }

        var prefersReduced = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Dress-code popovers: any click outside a dress tag, or Escape, closes
        // them (the trigger's own click stops propagation so it can toggle).
        document.addEventListener('click', function (e) {
            if (!e.target.closest || !e.target.closest('.weekend-event-dress-wrap')) {
                closeAllDressPopovers();
            }
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { closeAllDressPopovers(); }
        });

        // ---- flow state ----
        // ONE continuous stack spans the whole flow — invitation, lookup,
        // one card per invited event (Saturday is a single shared card for
        // all its people, ending with the afterparty section — see
        // buildSaturdayPanel/buildAfterpartyInfo), review, and (once
        // submitted, or for a returning guest) the schedule/thank-you card.
        // Selecting an invitation doesn't swap to a different stack, it
        // files the personal-stack cards in right behind lookup and plays
        // the SAME fileForward move every Next click uses — so Back is
        // symmetric everywhere, all the way back to the lookup card and the
        // invitation, and the choreography is identical throughout instead
        // of a special-cased dual-exit.
        var invitation = null;        // the selected { email, invitedTo, people }
        var latestResponse = null;    // the guest's latest known submission — a
        // fresh send's own data, or a fetched
        // prior response (see fetchLatestResponse)
        var stack = [invitationCardEl];
        // The cards selectInvitation() built and spliced into `stack` for the
        // CURRENTLY selected invitation, tracked so a later re-selection (a
        // different invite, or the same one retyped) can tear them out of
        // both the array and the DOM before building fresh ones.
        var personalCards = [];
        var submitted = false;
        var pendingFocusTimer = null; // see afterMove's card-focus scheduling
        var animLock = false;         // true while ANY stack move is in flight

        // ---- stack engine ----------------------------------------------------
        // Set-aside choreography (Motion Rework, July 2026) for the one
        // continuous `stack` array spanning the whole flow. Each element is a
        // card already .paper-card sized/positioned to the invitation's own
        // rect (see .rsvp-stack in styles.css); index 0 is always the current
        // top. Direction is a spatial invariant with no exceptions: forward
        // = current card exits off-screen LEFT (set aside, finished) / next
        // card enters from off-screen RIGHT (still waiting); backward is the
        // exact mirror. This follows navigation semantics (Next vs. Back),
        // never "have I answered this card before" — replacePersonalCards
        // (submit-success, Edit re-deal) always reorders like fileForward and
        // always passes 'forward', even when re-entering already-answered
        // cards. Every non-top card is simply .rsvp-stack-hidden at rest —
        // there's no meaningful resting position for a card nobody can see,
        // only the two actively-transitioning cards ever have a real
        // transform (see fileTransition).

        // Only the top card of any stack is interactive/readable —
        // everything filed behind it is visual-only. Mirrors the old track's
        // inert+aria-hidden pairing on inactive panels, so a buried card's
        // inputs (e.g. the lookup card's email field once it's filed away)
        // can't be tabbed into or read by assistive tech.
        function setInert(el, isInert) {
            if (isInert) {
                el.setAttribute('inert', '');
                el.setAttribute('aria-hidden', 'true');
            } else {
                el.removeAttribute('inert');
                el.removeAttribute('aria-hidden');
            }
        }

        // Places an element at rest with no transition — used for initial
        // placement, reduced-motion moves, and pre-positioning a card the
        // instant it's added to a stack (so it's never visible mid-transit or
        // at an unset position before an animated move picks it up). Also the
        // reduced-motion path's ONLY visibility toggle (fileTransition's
        // animated path handles it separately, timed to each leg — see
        // there) — instant, since there's no animation for it to pop mid-way
        // through. Every card at rest sits at the identity transform; only
        // the top card is ever actually visible (see .rsvp-stack-hidden).
        function applyRestingInstant(el, isTop) {
            el.style.transition = 'none';
            el.style.zIndex = String(isTop ? Z_TOP : Z_HIDDEN);
            el.style.transform = 'none';
            setInert(el, !isTop);
            el.classList.toggle('rsvp-stack-hidden', !isTop);
        }

        // Runs `fn` once, either on the next 'transitionend' matching
        // (el, property) or after a timeout fallback — whichever fires first —
        // matching the transitionend+timeout pattern already used elsewhere in
        // this codebase (js/rive-intro.js) for robustness against a transition
        // that never fires (e.g. a property that didn't actually change).
        function onceTransition(el, property, ms, fn) {
            var done = false;
            function finish() {
                if (done) { return; }
                done = true;
                el.removeEventListener('transitionend', handler);
                fn();
            }
            function handler(e) {
                if (e.target === el && e.propertyName === property) { finish(); }
            }
            el.addEventListener('transitionend', handler);
            setTimeout(finish, ms + 60);
        }

        // Real px distance to clear the TRUE viewport edge from a given
        // on-screen rect (getBoundingClientRect — viewport-relative
        // regardless of the field's own, possibly much narrower, width) —
        // see EDGE_MARGIN_PX's comment above for why this replaced a
        // percentage-of-own-width transform. leftClearDX: how far to
        // translateX so the rect's right edge clears the left screen edge.
        // rightClearDX: how far so the rect's left edge clears the right
        // screen edge. Used by fileTransition.
        function leftClearDX(rect) { return -(rect.right + EDGE_MARGIN_PX); }
        function rightClearDX(rect) { return (window.innerWidth + EDGE_MARGIN_PX) - rect.left; }

        // Shared choreography for every stack transition: `reorder()` (a pure
        // array mutation — safe to run immediately, before any animation)
        // tells us who's exiting and who's arriving, then two OVERLAPPING
        // legs run — the outgoing card exits toward its off-screen side while
        // the incoming card, starting from its own off-screen side, enters
        // ENTER_OVERLAP of the way into the exit leg — so the screen is never
        // fully empty between cards. `direction` ('forward' or 'back') picks
        // which side is which (see the stack-engine comment above). `cleanup`
        // (only used by replacePersonalCards) removes now-superseded DOM
        // nodes, but only once the outgoing card's exit leg has actually
        // finished — removing it any earlier would cut its exit animation
        // short. `legsRemaining` (not "whichever leg finishes last") clears
        // animLock/fires onSettled once BOTH legs report done, so retuning
        // EXIT_MS/ENTER_MS/ENTER_OVERLAP later can never leave animLock stuck
        // or clear it early. Reduced motion skips straight to the reordered
        // resting state, no transition.
        function fileTransition(reorder, direction, onSettled, cleanup) {
            if (animLock || submitted || stack.length < 2) { return; }
            animLock = true;
            setNavInFlight(true);
            // A still-pending focus shift scheduled by the PREVIOUS move's
            // afterMove (see there) could otherwise fire mid-flight during
            // THIS move — its delay runs from that move's settle, not from
            // when this one starts, so it can outlast a fast subsequent move
            // and steal focus onto a card that's already being set aside,
            // right before it goes inert and blurs again. Cancel it the
            // instant a new move begins, not just when this one settles.
            if (pendingFocusTimer) { clearTimeout(pendingFocusTimer); pendingFocusTimer = null; }
            var outgoing = stack[0];
            reorder();
            var incoming = stack[0];

            if (prefersReduced) {
                if (cleanup) { cleanup(); }
                stack.forEach(function (el) { applyRestingInstant(el, el === incoming); });
                animLock = false;
                if (onSettled) { onSettled(); }
                return;
            }

            var forward = direction !== 'back';
            // outgoing & incoming share the identical resting rect — both
            // sit at transform:none at rest (see applyRestingInstant) — so
            // one measurement covers both distances.
            var slotRect = outgoing.getBoundingClientRect();
            var exitDX = forward ? leftClearDX(slotRect) : rightClearDX(slotRect);
            var enterFromDX = forward ? rightClearDX(slotRect) : leftClearDX(slotRect);
            var exitRotate = forward ? -EXIT_ROTATE : EXIT_ROTATE;
            var enterRotate = forward ? ENTER_ROTATE : -ENTER_ROTATE;
            var legsRemaining = 2;

            function legDone() {
                legsRemaining -= 1;
                if (legsRemaining > 0) { return; }
                animLock = false;
                if (onSettled) { onSettled(); }
            }

            // A focused control (the email field is the practical case —
            // its gradient-clipped text fill, -webkit-background-clip:
            // text, is the one exotic bit of render on this page) can be
            // left behind as a static "ghost" by some browsers' compositing
            // when its ancestor starts a transform while it still holds
            // focus, instead of traveling with the rest of the card.
            // Blurring before the transform starts avoids the whole class
            // of problem; will-change below additionally promotes the
            // WHOLE card to its own layer up front so every descendant —
            // ordinary or exotic — composites and travels as one unit
            // rather than the browser deciding mid-animation.
            if (document.activeElement && outgoing.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            outgoing.style.willChange = 'transform';
            incoming.style.willChange = 'transform';

            outgoing.style.transition = 'transform ' + EXIT_MS + 'ms ' + EXIT_CURVE;
            outgoing.style.zIndex = String(Z_EXIT);
            void outgoing.offsetWidth; // force reflow so the transition runs from the current position
            outgoing.style.transform = 'translateX(' + exitDX + 'px) rotate(' + exitRotate + 'deg)';

            onceTransition(outgoing, 'transform', EXIT_MS, function () {
                outgoing.style.transition = 'none';
                outgoing.style.transform = 'none';
                outgoing.style.zIndex = String(Z_HIDDEN);
                outgoing.style.willChange = '';
                setInert(outgoing, true);
                outgoing.classList.add('rsvp-stack-hidden');
                if (cleanup) { cleanup(); }
                legDone();
            });

            setTimeout(function () {
                incoming.style.transition = 'none';
                incoming.style.zIndex = String(Z_ENTER);
                incoming.style.transform = 'translateX(' + enterFromDX + 'px) rotate(' + enterRotate + 'deg)';
                incoming.classList.remove('rsvp-stack-hidden');
                setInert(incoming, false);
                void incoming.offsetWidth;
                incoming.style.transition = 'transform ' + ENTER_MS + 'ms ' + ENTER_CURVE;
                incoming.style.transform = 'none';

                onceTransition(incoming, 'transform', ENTER_MS, function () {
                    incoming.style.zIndex = String(Z_TOP);
                    incoming.style.willChange = '';
                    legDone();
                });
            }, Math.round(EXIT_MS * ENTER_OVERLAP));
        }

        // fileForward — "Next": the top card exits left (set aside, finished)
        // while the next card enters from the right. Also used for the
        // initial invitation -> lookup swap.
        function fileForward(onSettled) {
            fileTransition(function () { stack.push(stack.shift()); }, 'forward', onSettled);
        }

        // fileBackward — "Back": the exact mirror. The most recently set-
        // aside card exits right (back to the waiting pile) while the
        // previous card enters from the left.
        function fileBackward(onSettled) {
            fileTransition(function () { stack.unshift(stack.pop()); }, 'back', onSettled);
        }

        // Swaps out the ENTIRE current personalCards sequence for `newCards`
        // in one transition — the currently-exiting top card is always the
        // last card of the sequence being replaced (review, right after a
        // fresh submit; or the schedule card, when editing), every other
        // surviving member of the old personalCards is pulled from wherever
        // it sits in `stack`, and `newCards` is unshifted to the front so
        // newCards[0] becomes the new top. Always a FORWARD move — Edit and
        // submit-success follow navigation semantics, not "seen this card
        // before," so both enter from the right like any other Next. DOM
        // removal of the superseded cards is deferred to fileTransition's
        // cleanup hook (see there) so the exiting card's animation isn't cut
        // short. Used by onSubmit's success handler (blank flow -> schedule
        // card) and enterEditFlow (schedule card -> pre-filled blank flow).
        function replacePersonalCards(newCards, onSettled) {
            var removed = [];
            fileTransition(function () {
                removed.push(stack.shift());
                personalCards.forEach(function (card) {
                    if (removed.indexOf(card) !== -1) { return; }
                    var idx = stack.indexOf(card);
                    if (idx !== -1) { stack.splice(idx, 1); }
                    removed.push(card);
                });
                personalCards = newCards;
                Array.prototype.unshift.apply(stack, newCards);
                // Every element of newCards is a brand-new DOM node,
                // appended (by makeStackCard, when it was built) with no
                // inline styles at all — unlike dealPersonalStack's own new
                // cards, which all get applyRestingInstant right after
                // splicing. Left alone, ALL of them — including
                // newCards[0], which is about to become `incoming` — sit
                // fully visible at the same absolute rect as the outgoing
                // card from the instant they're appended, well before
                // fileTransition's own (deferred, ENTER_OVERLAP-delayed)
                // enter-leg logic ever touches newCards[0]. That gap is
                // exactly "the next card is already visible underneath" —
                // most visible submit -> schedule/thank-you (a much taller
                // card, built and appended synchronously inside onSubmit
                // before this reorder even runs) and Edit's taller buried
                // cards (Saturday) bleeding past a shorter one on top.
                // Snap every one of them to the same defined non-top
                // resting state dealPersonalStack already gives its own new
                // cards; fileTransition's enter-leg logic fully re-
                // initializes whichever one becomes `incoming` a moment
                // later, so pre-hiding it here doesn't conflict.
                newCards.forEach(function (card) {
                    applyRestingInstant(card, false);
                });
            }, 'forward', onSettled, function () {
                removed.forEach(function (card) {
                    if (card && card.parentNode) { card.parentNode.removeChild(card); }
                });
            });
        }

        // The invitation's field/card sizing is built for a 16:9 registration
        // box; on mobile portrait that box is short (~200px), far shorter
        // than the reply-card stack's actual content, so mobile always
        // needed this. Desktop cards were originally all short enough to fit
        // the settled view (see decisions.md) — the schedule card (July
        // 2026: times/venues for every accepted event, per person) broke
        // that assumption, so this now runs at every width, not just
        // mobile. .rsvp-flow-scroll-spacer (a dedicated element — the
        // settled page's own .invitation-scroll-spacer collapses once the
        // flow starts) supplies the room, grown here to fit whatever the
        // CURRENT top card needs. #invitation-endstate's overflow: visible
        // once .rsvp-flow-active (rsvp-styles.css) is the other half of
        // this — nothing clips the card once there's room to scroll to it.
        function ensureScrollRoom() {
            if (!scrollSpacerEl) { return; }
            // #invitation-endstate is position:absolute (out of normal
            // flow), so this spacer — a normal-flow sibling — lands at
            // document y:0, not below endstate's own visual 100dvh box; its
            // height doesn't simply ADD to the existing scrollable area, it
            // OVERLAPS the front of it. Reset first so scrollHeight below
            // reflects the true baseline (everything except this spacer's
            // own contribution).
            scrollSpacerEl.style.height = '';
            var top = stack[0];
            var card = top && top.querySelector('.rsvp-card');
            if (!card) { return; }
            // .rsvp-card has no overflow:hidden (by design — see its own
            // comment), so content taller than the wrapper's aspect-ratio
            // box paints past it without changing the wrapper's own
            // getBoundingClientRect(). scrollHeight is what actually
            // reflects that overflow; card's own top (converted to a
            // document- rather than viewport-relative position) plus its
            // scrollHeight is the TRUE bottom edge of the rendered content.
            var trueBottom = card.getBoundingClientRect().top + window.scrollY + card.scrollHeight;
            var neededDocHeight = trueBottom + 40;
            var baselineDocHeight = document.documentElement.scrollHeight;
            // baselineDocHeight (spacer reset to '') is #protected-content's
            // min-height: 100vh FLOOR, not real stacked content underneath
            // the spacer — once the flow is active the footer is
            // position: fixed (Section A) and #invitation-endstate is
            // absolute, so the spacer is the ONLY normal-flow content left
            // to establish height. That floor DISAPPEARS the moment the
            // spacer exceeds it — it doesn't stack — so the spacer must be
            // set to the full neededDocHeight, not to a "deficit" added on
            // top of a baseline that's about to stop applying. The old
            // deficit math (neededDocHeight - baselineDocHeight) silently
            // undersized the spacer by ~baselineDocHeight (a full viewport
            // height) on every card that actually needed one — small enough
            // to go unnoticed on shorter cards, but enough on the deepest
            // fixture (Section E) to strand roughly the bottom third of the
            // card, reading as "scrolling stops halfway."
            scrollSpacerEl.style.height = neededDocHeight > baselineDocHeight ? Math.ceil(neededDocHeight) + 'px' : '';
        }

        window.addEventListener('resize', ensureScrollRoom);

        // window.scrollTo(0, 0) alone can leave a stale scroll position
        // behind: this page's overflow chain sets overflow-y on BOTH <html>
        // (via body.page-rsvp.intro-complete, styles.css) and <body>
        // (.rsvp-flow-active, rsvp-styles.css), and in practice a guest who
        // scrolls deep into a tall card (Saturday) can leave <body> itself
        // holding a residual scroll offset that window.scrollTo never
        // touches. Left alone, the NEXT (often shorter) card inherits that
        // offset — the fixed nav/footer/Back/Next stay put (they're
        // genuinely viewport-fixed) while the card content underneath is
        // still scrolled away, reading as "stuck" with the nav overlapping
        // the card. Resetting both axes is the standard cross-browser-safe
        // "scroll to top" — cheap and correct even where only one axis is
        // ever actually in play. Used by both advanceFrom (on the way in)
        // and afterMove (as a final safety once a move settles).
        function resetScroll() {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
        }

        // Runs after any stack move settles: refreshes the review summary from
        // the live radios if review just became the top card (matching the
        // old goToStep's "steps[i] === 'review'" rebuild-on-arrival), resets
        // scroll to the top of the new card (so it and the spacer
        // measurement below start from a predictable, known position —
        // matches advanceFrom's own unconditional reset on the way IN;
        // this covers Back moves and any settle that didn't go through
        // advanceFrom), releases the persistent nav's in-flight lock (see setNavInFlight),
        // then focuses the new top card (delay = 0 under reduced motion so
        // it doesn't wait for a move that didn't animate) — UNLESS focus is
        // already on the persistent Next/Back button that triggered this
        // move (Nav Unification, July 2026): keyboard/mouse activation of
        // that button keeps focus there so Enter-Enter-Enter walks the
        // whole flow, instead of it being stolen away to the new card every
        // time. Any other trigger (email suggestion click, review submit,
        // Edit link) still moves focus to the new card, unchanged. Passed
        // as the onSettled callback to
        // fileForward/fileBackward/replacePersonalCards.
        function afterMove() {
            var top = stack[0];
            if (top && top.dataset.step === 'review') {
                buildSummaryInto(reviewSummary, collectData());
            }
            updateStackNav();
            setNavInFlight(false);
            resetScroll();
            ensureScrollRoom();
            // Belt-and-braces re-measure once webfonts finish swapping in.
            // Discovered on the schedule card's deepest fixture (4 people ×
            // 3 events): its first-ever paint of the larger PP Playground
            // .rsvp-card-event-title (Section B/E) can settle its true text
            // metrics slightly AFTER this synchronous measurement, leaving
            // the spacer undersized by however much the font swap grows the
            // card — enough, on that fixture, to strand the bottom of the
            // card (including "Edit your RSVP") below the reachable scroll
            // range. document.fonts.ready resolves immediately if fonts were
            // already loaded, so this is a harmless no-op in the common case.
            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(ensureScrollRoom);
            }
            if (document.activeElement === arrowBtn || document.activeElement === backBtn) { return; }
            var card = top && top.querySelector('.rsvp-card');
            if (!card) { return; }
            pendingFocusTimer = setTimeout(function () {
                pendingFocusTimer = null;
                // The guest may have already clicked into something on the
                // card (the email field is the common case) during this
                // delay — nothing else cancels this timer just because
                // focus moved, only a brand-new fileTransition does (see
                // there). Blindly calling card.focus() here would silently
                // steal focus back out of whatever they clicked into,
                // discarding the keystrokes that follow with no visible
                // error — this is the "click once, nothing happens, click
                // twice" bug. Only take focus if the guest hasn't already
                // put it somewhere inside the card themselves.
                if (!card.contains(document.activeElement)) {
                    card.focus({ preventScroll: true });
                }
            }, prefersReduced ? 0 : STACK_MOVE_MS + 20);
        }

        // ---- persistent stack nav (Back/#rsvp-arrow-as-Next) ------------------

        // What the CURRENT top card wants from the persistent nav: whether a
        // forward action exists at all (lookup advances only by selecting a
        // suggestion; review advances only via its own Send button; the
        // schedule card advances only via its own "Edit your RSVP" button,
        // see enterEditFlow — none of those get a generic forward control),
        // its label, and its validation (omitted/undefined when a card has
        // no fields to check, e.g. the invitation's own "RSVP"). The
        // schedule card has NO back control — "Edit your RSVP" (see
        // enterEditFlow) is the only path back into the personal stack, which
        // keeps the state machine simple (Section G3).
        function stackNavInfoFor(wrapper) {
            if (!wrapper) { return { forward: false, back: false }; }
            if (wrapper === invitationCardEl) {
                return { forward: true, back: false, label: 'RSVP' };
            }
            var step = wrapper.dataset.step || '';
            if (step === 'lookup') {
                return { forward: false, back: true };
            }
            if (step === 'review') {
                return { forward: false, back: true };
            }
            if (step === 'schedule') {
                return { forward: false, back: false };
            }
            var card = wrapper.querySelector('.rsvp-card');
            var label = isLastPersonalCard(wrapper) ? 'Review' : 'Next';
            if (step === 'saturday') {
                return {
                    forward: true, back: true, label: label,
                    validate: function () { return validateSaturdayCard(card, invitation); }
                };
            }
            // friday / sunday
            return {
                forward: true, back: true, label: label,
                validate: function () { return validateEventCard(card, step); }
            };
        }

        // The card right before review in the currently-dealt personal
        // stack — i.e. whichever one should say "Review" instead of "Next".
        function isLastPersonalCard(wrapper) {
            return personalCards.length >= 2 && wrapper === personalCards[personalCards.length - 2];
        }

        // Reflects the current top of `stack` onto the two persistent nav
        // buttons: label, and whether each is usable at all. Inline styles
        // (not a CSS class) so this always wins regardless of any other
        // opacity rule, and `disabled` so a hidden control is also out of
        // the tab order and unclickable, not just invisible.
        function updateStackNav() {
            var info = stackNavInfoFor(stack[0]);
            var arrowLabel = arrowBtn.querySelector('.rsvp-arrow-label');
            if (info.forward) {
                arrowLabel.textContent = info.label || 'RSVP';
            }
            arrowBtn.disabled = !info.forward;
            arrowBtn.style.opacity = info.forward ? '' : '0';
            arrowBtn.style.pointerEvents = info.forward ? '' : 'none';

            backBtn.disabled = !info.back;
            backBtn.style.opacity = info.back ? '1' : '0';
            backBtn.style.pointerEvents = info.back ? 'auto' : 'none';
        }

        // In-flight lock (Nav Unification, July 2026): the buttons stay
        // visible and stationary during a move rather than vanishing, and
        // get pointer-events:none (see .rsvp-nav-inflight in
        // rsvp-styles.css) so a double-click/double-Enter can't queue a
        // second move — though animLock's own guard in fileTransition is
        // what actually prevents that; this is UX polish + correct ARIA
        // semantics on top of it. No visual dimming (buttons read as inset
        // into the page, cards float above them — dimming the buttons
        // during the card's own flyover fought that model; dropped July
        // 2026). aria-disabled, not the native disabled attribute,
        // specifically so a focused button isn't auto-blurred by the
        // browser mid-flight (see afterMove's focus-preservation note).
        function setNavInFlight(inFlight) {
            [arrowBtn, backBtn].forEach(function (btn) {
                btn.classList.toggle('rsvp-nav-inflight', inFlight);
                btn.setAttribute('aria-disabled', inFlight ? 'true' : 'false');
            });
        }

        // Shared "advance" logic used by the persistent #rsvp-arrow (the
        // sole Next control at every viewport since Nav Unification, July
        // 2026 — see onForwardClick below). fileForward already self-guards
        // on stack.length < 2, so this only needs to additionally guard
        // against a move already in flight or a completed submission, then
        // run the card's own validation (if any) before actually filing
        // forward.
        function advanceFrom(validate) {
            if (animLock || submitted) { return; }
            if (validate && !validate()) { return; }
            document.body.classList.add('rsvp-flow-active');
            resetScroll();
            fileForward(afterMove);
        }

        // The click handler for the persistent #rsvp-arrow — the sole
        // forward control at every viewport (Nav Unification, July 2026) —
        // "Begin RSVP" on the invitation, "Next"/"Review" on every card
        // after. Also reused as the peek's click handler (see revealPeek):
        // stackNavInfoFor(lookup) always returns forward:false, so clicking
        // the peek once lookup is already on top correctly no-ops here,
        // with no separate "already swapped" guard needed.
        function onForwardClick() {
            var info = stackNavInfoFor(stack[0]);
            if (!info.forward) { return; }
            advanceFrom(info.validate);
        }

        // ---- stack card shell --------------------------------------------

        // Wraps a .rsvp-card content element in the shared paper-suite shell —
        // .paper-card.paper-card--page (grain + sheet shadow + the invitation's
        // own on-screen rect, see styles.css), appended into #rsvp-stack. The
        // frame itself is a CSS border-image ::after on the wrapper (see
        // rsvp-styles.css) rather than a baked <img> — a stretched PNG frame
        // can't track variable card heights (see decisions.md, Section A). Its
        // pseudo-element paint order already sits above the card content, so
        // nothing further needs appending for it here. `stepKey` is tagged on
        // the wrapper (parallel to the old steps[] array) so code can recognize
        // a specific card — e.g. refreshing the review summary only when it
        // becomes the top. Cards carry no navigation of their own (Nav
        // Unification, July 2026 — the persistent #rsvp-arrow/#rsvp-stack-back
        // pair is the sole nav at every viewport) so they fly clean.
        function makeStackCard(card, stepKey) {
            var wrapper = el('div', 'paper-card paper-card--page');
            if (stepKey) { wrapper.dataset.step = stepKey; }
            wrapper.appendChild(card);
            stackEl.appendChild(wrapper);
            return wrapper;
        }

        // ---- email / lookup card ----

        var emailInput, emailSuggestions;
        var debounceTimer = null;
        var lookupWrapper = null; // the .paper-card wrapper, once built

        function buildEmailPanel() {
            var card = el('div', 'rsvp-card');
            card.tabIndex = -1;

            card.appendChild(el('h1', 'rsvp-card-title', 'Rsvp'));
            // One flowing Sentient line — no separate PP Watch date treatment.
            // Explicit break before the final clause (not left to natural
            // wrap) for visual balance at the card's width — built from
            // REPLY_BY, not hardcoded, so the date only needs to change in
            // one place.
            var reply = el('p', 'rsvp-card-request');
            reply.appendChild(document.createTextNode('The favor of your reply is requested by'));
            reply.appendChild(document.createElement('br'));
            reply.appendChild(document.createTextNode(REPLY_BY + '.'));
            card.appendChild(reply);

            var group = el('div', 'form-group');
            var label = el('label', 'rsvp-lookup-label', 'Find your invitation');
            label.htmlFor = 'rsvpFlowEmail';
            group.appendChild(label);

            emailInput = document.createElement('input');
            emailInput.type = 'text';
            emailInput.id = 'rsvpFlowEmail';
            emailInput.autocomplete = 'off';
            emailInput.inputMode = 'email';
            emailInput.placeholder = 'Enter your email address';

            emailSuggestions = el('div', 'guest-suggestions');
            emailSuggestions.id = 'rsvpFlowSuggestions';

            // Anchors the dropdown to the INPUT alone — .form-group also
            // contains the label above and the hint below, so positioning
            // .guest-suggestions directly against .form-group (its own
            // position:relative ancestor) opened it 11px below the whole
            // group, far past the input. This wrapper is allowed to overlay
            // the hint text beneath it once open — matches the dress-popover
            // behavior, intentional.
            var anchor = el('div', 'rsvp-email-anchor');
            anchor.appendChild(emailInput);
            anchor.appendChild(emailSuggestions);
            group.appendChild(anchor);

            var hint = el('p', 'form-hint');
            hint.appendChild(document.createTextNode('Type the email at which you'));
            hint.appendChild(document.createElement('br'));
            hint.appendChild(document.createTextNode('received your invitation.'));
            group.appendChild(hint);
            card.appendChild(group);

            emailInput.addEventListener('input', onEmailInput);
            emailInput.addEventListener('keydown', onEmailInputKeydown);
            emailSuggestions.addEventListener('keydown', onSuggestionsKeydown);
            document.addEventListener('click', function (e) {
                if (!emailInput.contains(e.target) && !emailSuggestions.contains(e.target)) {
                    hideSuggestions();
                }
            });

            lookupWrapper = makeStackCard(card, 'lookup');
            stack.push(lookupWrapper);
            return lookupWrapper;
        }

        function onEmailInput() {
            var term = emailInput.value.trim();
            // Editing away from a selected invitation resets the whole step list.
            if (invitation && term !== invitation.email) { clearSelection(); }
            if (debounceTimer) { clearTimeout(debounceTimer); }
            // The privacy rule this used to enforce ("typed past the @") now
            // lives on the server as an exact-match requirement (handleLookup,
            // July 2026) — a partial string can't return anything there
            // either way. This gate just keeps a lookup from firing before
            // the guest has finished typing a complete address; DEBOUNCE_MS
            // below still matters on top of it (e.g. ".co" then ".com" would
            // otherwise fire two requests).
            if (!EMAIL_SHAPE.test(term)) { hideSuggestions(); return; }
            debounceTimer = setTimeout(function () {
                showLookupLoading();
                searchInvitations(term).then(function (invitations) {
                    // The guest kept typing (or cleared the field) while this
                    // was in flight — a newer input event already owns the
                    // dropdown. Same discard-if-superseded shape as
                    // selectInvitation's own guard on fetchLatestResponse.
                    if (emailInput.value.trim() !== term) { return; }
                    displaySuggestions(invitations);
                }).catch(function () {
                    if (emailInput.value.trim() !== term) { return; }
                    displaySuggestions(null, 'Something went wrong — please try again.');
                });
            }, DEBOUNCE_MS);
        }

        // Single non-interactive "Looking…" row shown the instant the one
        // debounced request fires. An exact-match server lookup measures
        // 1.5-6.7s live, and with the client now sending exactly one request
        // per completed address (not one per keystroke), the guest needs
        // some feedback in that gap rather than an unchanged, apparently
        // inert dropdown. Reuses .guest-suggestion-empty — the same
        // non-interactive styling as the "no match" state — rather than
        // adding new CSS.
        function showLookupLoading() {
            emailSuggestions.innerHTML = '';
            emailSuggestions.appendChild(el('div', 'guest-suggestion-item guest-suggestion-empty', 'Looking…'));
            emailSuggestions.style.display = 'block';
            emailInput.classList.add('suggestions-open');
        }

        function displaySuggestions(invitations, errorText) {
            emailSuggestions.innerHTML = '';
            if (errorText || !invitations || invitations.length === 0) {
                // Stays a plain, non-interactive div — nothing to select.
                var empty = el('div', 'guest-suggestion-item guest-suggestion-empty',
                    errorText || 'No match found — check the email on your invitation.');
                emailSuggestions.appendChild(empty);
            } else {
                invitations.forEach(function (inv) {
                    var btn = el('button', 'guest-suggestion-item', inv.email);
                    btn.type = 'button';
                    btn.addEventListener('click', function () { selectInvitation(inv); });
                    emailSuggestions.appendChild(btn);
                });
            }
            emailSuggestions.style.display = 'block';
            emailInput.classList.add('suggestions-open');
        }

        function hideSuggestions() {
            emailSuggestions.style.display = 'none';
            emailSuggestions.innerHTML = '';
            emailInput.classList.remove('suggestions-open');
        }

        // ---- lookup dropdown keyboard access ----
        // The actual suggestion buttons (excludes the non-interactive
        // "no match" empty state, which stays a plain div).
        function focusableSuggestions() {
            return Array.prototype.slice.call(
                emailSuggestions.querySelectorAll('.guest-suggestion-item:not(.guest-suggestion-empty)')
            );
        }

        // ArrowDown from the input focuses the first suggestion. Enter/Space
        // on a focused suggestion need no explicit handling — native
        // <button> elements already fire their own click on both, which is
        // already wired to selectInvitation.
        function onEmailInputKeydown(e) {
            if (e.key !== 'ArrowDown') { return; }
            var items = focusableSuggestions();
            if (!items.length) { return; }
            e.preventDefault();
            items[0].focus();
        }

        // Delegated on the suggestions container rather than per-button, to
        // match this file's existing single-listener style (the outside-
        // click hider above, closeAllDressPopovers). No wraparound at either
        // end of the list; ArrowUp on the first item returns focus to the
        // input instead (standard combobox behavior, not a "wrap").
        function onSuggestionsKeydown(e) {
            var items = focusableSuggestions();
            var idx = items.indexOf(document.activeElement);
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (idx === -1) { if (items[0]) { items[0].focus(); } return; }
                if (idx < items.length - 1) { items[idx + 1].focus(); }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (idx <= 0) { emailInput.focus(); return; }
                items[idx - 1].focus();
            } else if (e.key === 'Escape') {
                hideSuggestions();
                emailInput.focus();
            }
        }

        // Selection advances — no separate Next button on the email card.
        // Tears down any previously-built personal-stack cards (a different
        // invitation, or the same one re-selected), then asks the backend
        // (see fetchLatestResponse) whether this guest has a prior response
        // on file: if so, splices in a single read-only schedule card
        // showing it — "enter your email, land right on your schedule," the
        // returning-guest path (Section G3); if not (or the fetch fails —
        // never block an RSVP on this), builds a fresh blank flow, same as
        // always. Either way, plays the SAME fileForward move every other
        // Next click uses — so this transition is choreographed identically
        // to the rest of the flow (no special-cased dual exit), and Back
        // from the first card naturally reveals lookup again (fileBackward
        // on a unified array — see the stack engine above).
        function selectInvitation(inv) {
            invitation = inv;
            emailInput.value = inv.email;
            hideSuggestions();
            removePersonalCards();
            latestResponse = null;
            fetchLatestResponse(inv.email)
                .then(function (resp) {
                    // A later selection (or a cleared/re-typed email)
                    // superseded this one while the fetch was in flight —
                    // let that newer call own the stack instead.
                    if (invitation !== inv) { return; }
                    if (resp && responseMatchesInvitation(resp, inv)) {
                        latestResponse = resp;
                        dealScheduleStack(inv, resp);
                    } else {
                        dealPersonalStack(inv, null);
                    }
                    fileForward(afterMove);
                })
                .catch(function () {
                    if (invitation !== inv) { return; }
                    dealPersonalStack(inv, null);
                    fileForward(afterMove);
                });
        }

        // Defensive sanity check — if the invitation itself changed (e.g.
        // Andrew added a plus-one) since the fetched response, the people
        // arrays won't line up 1:1 by index anymore. Falls back to the
        // blank flow rather than showing stale/mismatched data.
        function responseMatchesInvitation(resp, inv) {
            return !!(resp && Array.isArray(resp.people) && resp.people.length === (inv.people || []).length);
        }

        // Editing the email away from a selected invitation, while the lookup
        // card is still the interactive top (see setInert above — once the
        // personal stack deals in, this input is inert and unreachable
        // anyway), clears the selection AND tears down the stale personal
        // stack so a later selectInvitation() starts clean.
        function clearSelection() {
            invitation = null;
            latestResponse = null;
            removePersonalCards();
        }

        // Removes any cards selectInvitation() previously spliced into
        // `stack` for a prior selection — from the array AND the DOM — so
        // re-selecting (a different invite, or the same one again after
        // going back to lookup) never leaves stale/duplicate cards behind.
        function removePersonalCards() {
            personalCards.forEach(function (card) {
                var idx = stack.indexOf(card);
                if (idx !== -1) { stack.splice(idx, 1); }
                if (card.parentNode) { card.parentNode.removeChild(card); }
            });
            personalCards = [];
        }

        // ---- personal stack: one card per invited event, review ----

        // Pure builder — one card per invited event (Saturday gets a single
        // shared card for all its people, see buildSaturdayPanel), plus the
        // review card. Does NOT touch `stack` — callers (dealPersonalStack,
        // below, and enterEditFlow, which needs a different splice shape)
        // each own that. `savedData`, if given (the guest's latest known
        // response — see fetchLatestResponse), pre-fills every radio/meal/
        // kosher choice so editing starts from their last answers instead of
        // blank.
        function buildPersonalCards(inv, savedData) {
            var invited = EVENT_ORDER.filter(function (key) {
                return (inv.invitedTo || []).indexOf(key) !== -1;
            });
            var cards = invited.map(function (key) {
                return key === 'saturday'
                    ? buildSaturdayPanel(inv, savedData)
                    : buildEventPanel(inv, key, savedData);
            });
            cards.push(buildReviewPanel(inv));
            return cards;
        }

        // Builds a blank (or pre-filled) personal stack and splices it into
        // `stack` right behind lookup; the caller (selectInvitation) plays
        // the actual fileForward move, so this uses the same choreography
        // as every other Next. Only ever called with lookup as the CURRENT
        // top (see selectInvitation) — enterEditFlow uses
        // replacePersonalCards instead, since it replaces the schedule card
        // as the transition's exiting top.
        function dealPersonalStack(inv, savedData) {
            personalCards = buildPersonalCards(inv, savedData);
            var lookupIdx = stack.indexOf(lookupWrapper);
            var spliceArgs = [lookupIdx + 1, 0].concat(personalCards);
            Array.prototype.splice.apply(stack, spliceArgs);
            // Snap every card (existing ones — a harmless no-op re-apply —
            // and the newly-spliced ones) to a defined resting state
            // instantly, so the new cards have a starting position/z-index
            // before the animated fileForward move (selectInvitation) picks
            // them up.
            stack.forEach(function (elCard, i) { applyRestingInstant(elCard, i === 0); });
        }

        // Returning-guest counterpart to dealPersonalStack: instead of the
        // blank friday/saturday/.../review sequence, splices in a SINGLE
        // schedule card (see buildScheduleCard) built from their prior
        // submission. Same splice-behind-lookup mechanics.
        function dealScheduleStack(inv, saved) {
            personalCards = [buildScheduleCard(inv, { email: inv.email, people: saved.people, message: saved.message }, { justSubmitted: false })];
            var lookupIdx = stack.indexOf(lookupWrapper);
            var spliceArgs = [lookupIdx + 1, 0].concat(personalCards);
            Array.prototype.splice.apply(stack, spliceArgs);
            stack.forEach(function (elCard, i) { applyRestingInstant(elCard, i === 0); });
        }

        // ---- event cards ----

        // Friday/Sunday: one card per event, all invited people on it (they
        // only carry an accept/decline each, light enough to share a card).
        // Saturday is dense enough (meal + kosher per person) that it gets
        // its own per-person function below instead.
        function buildEventPanel(inv, eventKey, savedData) {
            var detail = EVENT_DETAILS[eventKey];
            var card = el('div', 'rsvp-card');
            card.tabIndex = -1;
            card.dataset.event = eventKey;

            card.appendChild(el('h2', 'rsvp-card-event-title', detail.shortName || detail.name));
            card.appendChild(makeCardEventMeta(detail));

            (inv.people || []).forEach(function (name, idx) {
                var person = el('div', 'rsvp-card-person');
                person.appendChild(el('p', 'rsvp-card-person-name', name));

                var choices = el('div', 'rsvp-card-choices');
                choices.appendChild(radioLabel('fp' + idx + '_' + eventKey, 'yes', 'Accepts with pleasure'));
                choices.appendChild(radioLabel('fp' + idx + '_' + eventKey, 'no', 'Declines with regret'));
                person.appendChild(choices);

                var savedPerson = savedData && savedData.people[idx];
                var savedAnswer = savedPerson && savedPerson.events && savedPerson.events[eventKey];
                if (savedAnswer) {
                    var savedInput = choices.querySelector('input[value="' + savedAnswer + '"]');
                    if (savedInput) { savedInput.checked = true; }
                }

                card.appendChild(person);
            });

            var error = el('p', 'rsvp-card-error');
            error.setAttribute('role', 'alert');
            card.appendChild(error);

            return makeStackCard(card, eventKey);
        }

        // Saturday: ONE card for the whole day, all invited people on it —
        // reverting the July "one card per person" split now that variable-
        // height cards (Section A1) remove the fixed 5:7 box that split was
        // working around (see decisions.md). Same event meta as any other
        // event card, then a person block per invited person, then the
        // afterparty section once at the end (see buildAfterpartyInfo).
        function buildSaturdayPanel(inv, savedData) {
            var detail = EVENT_DETAILS.saturday;
            var card = el('div', 'rsvp-card');
            card.tabIndex = -1;
            card.dataset.event = 'saturday';

            card.appendChild(el('h2', 'rsvp-card-event-title', detail.shortName || detail.name));
            card.appendChild(makeCardEventMeta(detail));

            (inv.people || []).forEach(function (name, personIdx) {
                var person = el('div', 'rsvp-card-person');
                person.appendChild(el('p', 'rsvp-card-person-name', name));

                var savedPerson = savedData && savedData.people[personIdx];

                var choices = el('div', 'rsvp-card-choices');
                choices.appendChild(radioLabel('fp' + personIdx + '_saturday', 'yes', 'Accepts with pleasure'));
                choices.appendChild(radioLabel('fp' + personIdx + '_saturday', 'no', 'Declines with regret'));
                person.appendChild(choices);

                var savedAnswer = savedPerson && savedPerson.events && savedPerson.events.saturday;
                if (savedAnswer) {
                    var savedInput = choices.querySelector('input[value="' + savedAnswer + '"]');
                    if (savedInput) { savedInput.checked = true; }
                }

                person.appendChild(buildMealSection(personIdx, savedPerson));
                card.appendChild(person);

                // Declining Saturday collapses/disables THIS person's meal
                // section — updateMealDisabled is scoped by personIdx, so it
                // finds the right section even with multiple people sharing
                // one card.
                choices.querySelectorAll('input[type="radio"]').forEach(function (input) {
                    input.addEventListener('change', function () {
                        updateMealDisabled(card, personIdx);
                    });
                });
                // Reflect a pre-filled decline immediately (no 'change' event
                // fires from the programmatic .checked assignment above) —
                // run only now that `person` is actually inside `card`,
                // which updateMealDisabled queries against.
                updateMealDisabled(card, personIdx);
            });

            card.appendChild(buildAfterpartyInfo());

            var error = el('p', 'rsvp-card-error');
            error.setAttribute('role', 'alert');
            card.appendChild(error);

            return makeStackCard(card, 'saturday');
        }

        // Afterparty as a full event section (Section E) — same visual
        // treatment as a real event's title/when/where, appended once after
        // every person on the Saturday card. Informational only — not tied
        // to anyone's accept/decline, never disabled.
        function buildAfterpartyInfo() {
            var wrap = el('div', 'rsvp-card-afterparty');
            wrap.appendChild(el('p', 'rsvp-card-event-title', AFTERPARTY_DETAILS.name));
            wrap.appendChild(el('p', 'weekend-event-when', AFTERPARTY_DETAILS.time));

            var where = el('p', 'weekend-event-where');
            where.appendChild(document.createTextNode(AFTERPARTY_DETAILS.venue));
            where.appendChild(document.createElement('br'));
            var a = el('a', 'schedule-link', AFTERPARTY_DETAILS.address);
            a.href = AFTERPARTY_DETAILS.mapUrl;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            where.appendChild(a);
            wrap.appendChild(where);

            wrap.appendChild(el('p', 'schedule-event-description', AFTERPARTY_DETAILS.note));
            return wrap;
        }

        function buildMealSection(personIdx, savedPerson) {
            var section = el('div', 'rsvp-card-meal');
            section.dataset.person = personIdx;
            section.appendChild(el('p', 'rsvp-card-meal-label', 'Dinner selection'));

            var savedMeal = savedPerson && savedPerson.meal;
            var savedKosher = !!(savedPerson && savedPerson.mealKosher);

            MEAL_OPTIONS.forEach(function (meal) {
                var row = el('div', 'rsvp-meal-option');
                var radio = radioLabel('fp' + personIdx + '_meal', meal.key, meal.label);
                var radioInput = radio.querySelector('input');
                radioInput.addEventListener('change', function () {
                    updateKosherState(section, personIdx);
                });
                row.appendChild(radio);

                if (meal.kosherable) {
                    var kLabel = el('label', 'kosher-label is-disabled');
                    var kInput = document.createElement('input');
                    kInput.type = 'checkbox';
                    kInput.name = 'fp' + personIdx + '_kosher';
                    kInput.value = meal.key;
                    kInput.disabled = true;
                    kLabel.appendChild(kInput);
                    kLabel.appendChild(el('span', null, 'Kosher?'));
                    row.appendChild(kLabel);

                    // Pre-fill: this meal is the saved selection, so its own
                    // kosher checkbox becomes the interactive one — matches
                    // what updateKosherState would do reactively on change.
                    if (savedMeal === meal.key) {
                        kInput.disabled = false;
                        kLabel.classList.remove('is-disabled');
                        if (savedKosher) { kInput.checked = true; }
                    }
                }

                if (savedMeal === meal.key) { radioInput.checked = true; }

                section.appendChild(row);
            });

            return section;
        }

        // Each person's kosher checkbox is only interactive for the meal that
        // person currently has selected; picking another meal (or Cauliflower
        // Steak) clears and disables it.
        function updateKosherState(section, personIdx) {
            var checked = section.querySelector('input[name="fp' + personIdx + '_meal"]:checked');
            var selected = checked ? checked.value : '';
            section.querySelectorAll('input[name="fp' + personIdx + '_kosher"]').forEach(function (box) {
                var active = box.value === selected;
                box.disabled = !active;
                if (!active) { box.checked = false; }
                box.closest('.kosher-label').classList.toggle('is-disabled', !active);
            });
        }

        function updateMealDisabled(card, personIdx) {
            var section = card.querySelector('.rsvp-card-meal[data-person="' + personIdx + '"]');
            if (!section) { return; }
            var answer = card.querySelector('input[name="fp' + personIdx + '_saturday"]:checked');
            var declined = !!answer && answer.value === 'no';
            section.classList.toggle('is-disabled', declined);
        }

        // Both validate* functions are self-contained: clear any previous
        // error first, then either set a new one and return false, or leave
        // it cleared and return true. The old per-card Next handler used to
        // clear the error itself right before advancing; now that
        // validation runs from the persistent nav's onForwardClick instead
        // (stackNavInfoFor), clearing has to happen in here.
        function validateEventCard(card, eventKey) {
            var error = card.querySelector('.rsvp-card-error');
            error.classList.remove('show');
            for (var idx = 0; idx < invitation.people.length; idx++) {
                var name = invitation.people[idx];
                var answer = card.querySelector('input[name="fp' + idx + '_' + eventKey + '"]:checked');
                if (!answer) {
                    error.textContent = 'Please respond for ' + name + '.';
                    error.classList.add('show');
                    return false;
                }
            }
            return true;
        }

        // Every invited person on the (now shared) Saturday card must answer;
        // an accepting person also needs a meal. First failure wins, same
        // error-message pattern as validateEventCard.
        function validateSaturdayCard(card, inv) {
            var error = card.querySelector('.rsvp-card-error');
            error.classList.remove('show');
            for (var personIdx = 0; personIdx < inv.people.length; personIdx++) {
                var name = inv.people[personIdx];
                var answer = card.querySelector('input[name="fp' + personIdx + '_saturday"]:checked');
                if (!answer) {
                    error.textContent = 'Please respond for ' + name + '.';
                    error.classList.add('show');
                    return false;
                }
                if (answer.value === 'yes') {
                    var meal = card.querySelector('input[name="fp' + personIdx + '_meal"]:checked');
                    if (!meal) {
                        error.textContent = 'Please choose a dinner for ' + name + '.';
                        error.classList.add('show');
                        return false;
                    }
                }
            }
            return true;
        }

        // ---- review & send ----

        var reviewSummary, reviewError, reviewSubmitBtn, messageInput;

        function buildReviewPanel(inv) {
            var card = el('div', 'rsvp-card');
            card.tabIndex = -1;

            card.appendChild(el('h2', 'rsvp-card-event-title', 'Review Rsvp'));

            reviewSummary = el('div', 'rsvp-review-summary');
            card.appendChild(reviewSummary);

            var group = el('div', 'form-group');
            var label = el('label', null, 'A note for us');
            label.htmlFor = 'rsvpFlowMessage';
            group.appendChild(label);
            messageInput = document.createElement('textarea');
            messageInput.id = 'rsvpFlowMessage';
            messageInput.placeholder = 'Optional';
            group.appendChild(messageInput);
            card.appendChild(group);

            reviewError = el('p', 'rsvp-card-error');
            reviewError.setAttribute('role', 'alert');
            card.appendChild(reviewError);

            reviewSubmitBtn = el('button', 'btn-priority rsvp-submit', 'Send RSVP');
            reviewSubmitBtn.type = 'button';
            reviewSubmitBtn.addEventListener('click', onSubmit);
            card.appendChild(reviewSubmitBtn);

            return makeStackCard(card, 'review');
        }

        function mealLabelFor(key) {
            for (var i = 0; i < MEAL_OPTIONS.length; i++) {
                if (MEAL_OPTIONS[i].key === key) { return MEAL_OPTIONS[i].label; }
            }
            return key;
        }

        function mealShortLabelFor(key) {
            for (var i = 0; i < MEAL_OPTIONS.length; i++) {
                if (MEAL_OPTIONS[i].key === key) { return MEAL_OPTIONS[i].shortLabel; }
            }
            return key;
        }

        // Summary grouped by person: each event ✓/✗, plus meal (kosher
        // meals prefixed "Kosher " as plain text, no capsule tag) for
        // Saturday acceptances. Rebuilt from the live radios on every visit.
        function buildSummaryInto(container, data) {
            container.innerHTML = '';
            data.people.forEach(function (person) {
                var block = el('div', 'rsvp-review-person');
                block.appendChild(el('p', 'rsvp-review-person-name', person.name));

                EVENT_ORDER.forEach(function (key) {
                    if (!(key in person.events)) { return; }
                    var detail = EVENT_DETAILS[key];
                    var accepted = person.events[key] === 'yes';
                    var line = el('p', 'rsvp-review-line',
                        (accepted ? '✓ Accepts' : '✗ Declines') + ' — ' +
                        (detail.shortName || detail.name));
                    if (key === 'saturday' && accepted && person.meal) {
                        var mealText = person.mealKosher
                            ? ('Kosher ' + mealShortLabelFor(person.meal))
                            : mealLabelFor(person.meal);
                        line.appendChild(document.createTextNode(' · ' + mealText));
                    }
                    block.appendChild(line);
                });

                container.appendChild(block);
            });
        }

        // Reads the live controls into the submission shape.
        function collectData() {
            var people = invitation.people.map(function (name, idx) {
                var events = {};
                (invitation.invitedTo || []).forEach(function (key) {
                    var checked = document.querySelector('input[name="fp' + idx + '_' + key + '"]:checked');
                    events[key] = checked ? checked.value : '';
                });

                var meal = '';
                var mealKosher = false;
                if (events.saturday === 'yes') {
                    var mealChecked = document.querySelector('input[name="fp' + idx + '_meal"]:checked');
                    if (mealChecked) { meal = mealChecked.value; }
                    var kosherChecked = document.querySelector('input[name="fp' + idx + '_kosher"]:checked');
                    mealKosher = !!(kosherChecked && !kosherChecked.disabled && kosherChecked.value === meal);
                }

                return { name: name, events: events, meal: meal, mealKosher: mealKosher };
            });

            return {
                email: invitation.email,
                people: people,
                message: messageInput ? messageInput.value.trim() : ''
            };
        }

        function onSubmit() {
            var data = collectData();

            // Belt-and-braces validation (the event cards already gate advancing).
            for (var i = 0; i < data.people.length; i++) {
                var p = data.people[i];
                for (var key in p.events) {
                    if (!p.events[key]) {
                        reviewError.textContent = 'Please respond to every event for ' + p.name +
                            ' — use the back arrow to finish up.';
                        reviewError.classList.add('show');
                        return;
                    }
                }
                if (p.events.saturday === 'yes' && !p.meal) {
                    reviewError.textContent = 'Please choose a dinner for ' + p.name +
                        ' — use the back arrow to finish up.';
                    reviewError.classList.add('show');
                    return;
                }
            }

            reviewError.classList.remove('show');
            reviewSubmitBtn.disabled = true;
            reviewSubmitBtn.textContent = 'Sending…';

            submitRsvp(data)
                .then(function () {
                    // Remembered so "Edit your RSVP" (see enterEditFlow) has
                    // something to pre-fill from — the backend itself is the
                    // record a RETURNING visit reads from (fetchLatestResponse),
                    // this is just what's current for the rest of THIS visit.
                    latestResponse = data;
                    // Built now (not pre-built with the rest of the stack) so
                    // it's never visible at the stack edges before the send
                    // actually succeeds. replacePersonalCards swaps the whole
                    // blank flow (review included) out for this one card in
                    // a single transition.
                    replacePersonalCards([buildScheduleCard(invitation, data, { justSubmitted: true })], function () {
                        submitted = true;
                        afterMove();
                    });
                })
                .catch(function (err) {
                    console.error('RSVP submit error:', err);
                    reviewError.textContent =
                        'There was a problem sending your RSVP. Please try again, or reach out to us directly.';
                    reviewError.classList.add('show');
                })
                .then(function () {
                    reviewSubmitBtn.disabled = false;
                    reviewSubmitBtn.textContent = 'Send RSVP';
                });
        }

        // ---- schedule / thank-you ----
        // One card serves both roles: right after a fresh submit ("Thank
        // you" + a confirmation line) and for a returning guest whose email
        // matches a saved submission ("Your RSVP" + a plain intro line —
        // see selectInvitation/dealScheduleStack). Either way it shows the
        // full weekend schedule (date/time + venue per ACCEPTED event, not
        // just an accept/decline checkmark — the "operate as a schedule
        // page" ask) plus an "Edit your RSVP" button that re-enters the
        // (pre-filled) personal stack rather than reloading the page.

        function buildScheduleCard(inv, data, opts) {
            opts = opts || {};
            var card = el('div', 'rsvp-card');
            card.tabIndex = -1;

            card.appendChild(el('h2', 'rsvp-card-event-title', 'Thank you'));
            card.appendChild(el('p', 'rsvp-card-thanks-line', opts.justSubmitted
                ? "Your RSVP has been received. We can't wait to celebrate with you!"
                : "Here's your RSVP — we can't wait to celebrate with you!"));

            var summary = el('div', 'rsvp-review-summary');
            buildScheduleSummaryInto(summary, data);
            card.appendChild(summary);

            var editBtn = el('button', 'btn-normal rsvp-edit-link', 'Edit your RSVP');
            editBtn.type = 'button';
            editBtn.addEventListener('click', enterEditFlow);
            card.appendChild(editBtn);

            // No Back control (mirrors stackNavInfoFor's schedule branch) —
            // "Edit your RSVP" above is the only way back into the personal
            // stack (Section G3).
            return makeStackCard(card, 'schedule');
        }

        // Per-person schedule: a declined event stays a plain accept/decline
        // line (nothing to show — they're not going); an accepted event gets
        // its own block with the event name, date/time, and venue + address
        // link (the same building blocks the personal-stack cards use), plus
        // the meal line (kosher-prefixed plain text, matching the review
        // summary) for Saturday. An accepted Saturday also gets an afterparty
        // entry appended right after it (Section G1) — same shape as
        // buildAfterpartyInfo's event section, since it's informational
        // regardless of anyone's answers.
        function buildScheduleSummaryInto(container, data) {
            container.innerHTML = '';
            data.people.forEach(function (person) {
                var block = el('div', 'rsvp-review-person');
                block.appendChild(el('p', 'rsvp-review-person-name rsvp-card-event-title', person.name));

                EVENT_ORDER.forEach(function (key) {
                    if (!(key in person.events)) { return; }
                    var detail = EVENT_DETAILS[key];
                    var accepted = person.events[key] === 'yes';
                    if (!accepted) {
                        block.appendChild(el('p', 'rsvp-review-line', '✗ Declines — ' + (detail.shortName || detail.name)));
                        return;
                    }

                    var eventBlock = el('div', 'rsvp-schedule-event');
                    eventBlock.appendChild(el('p', 'rsvp-schedule-event-name label-heading', detail.shortName || detail.name));
                    eventBlock.appendChild(makeWhenLines(detail.when));

                    var where = el('p', 'weekend-event-where');
                    where.appendChild(document.createTextNode(detail.venue));
                    where.appendChild(document.createElement('br'));
                    var a = el('a', 'schedule-link', detail.address);
                    a.href = detail.mapUrl;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    where.appendChild(a);
                    eventBlock.appendChild(where);

                    if (key === 'saturday' && person.meal) {
                        var mealText = person.mealKosher
                            ? ('Kosher ' + mealShortLabelFor(person.meal))
                            : mealLabelFor(person.meal);
                        eventBlock.appendChild(el('p', 'rsvp-review-line', mealText));
                    }

                    block.appendChild(eventBlock);

                    if (key === 'saturday') {
                        var apBlock = el('div', 'rsvp-schedule-event');
                        apBlock.appendChild(el('p', 'rsvp-schedule-event-name label-heading', AFTERPARTY_DETAILS.name));
                        apBlock.appendChild(el('p', 'weekend-event-when', AFTERPARTY_DETAILS.time));

                        var apWhere = el('p', 'weekend-event-where');
                        apWhere.appendChild(document.createTextNode(AFTERPARTY_DETAILS.venue));
                        apWhere.appendChild(document.createElement('br'));
                        var apA = el('a', 'schedule-link', AFTERPARTY_DETAILS.address);
                        apA.href = AFTERPARTY_DETAILS.mapUrl;
                        apA.target = '_blank';
                        apA.rel = 'noopener noreferrer';
                        apWhere.appendChild(apA);
                        apBlock.appendChild(apWhere);

                        apBlock.appendChild(el('p', 'rsvp-review-line', AFTERPARTY_DETAILS.note));
                        block.appendChild(apBlock);
                    }
                });

                container.appendChild(block);
            });
        }

        // Re-enters the personal-stack flow from the schedule card, pre-
        // filled from `latestResponse` — NOT a page reload (a reload would
        // land right back on this same card via the returning-guest fetch,
        // an infinite loop). The schedule card is reachable either right
        // after a fresh submit or, for a returning guest, straight from
        // lookup (see selectInvitation) — either way `latestResponse` holds
        // whatever should pre-fill the editable cards. Resets `submitted`
        // first — fileTransition (via replacePersonalCards) refuses to move
        // at all while it's true.
        function enterEditFlow() {
            if (!invitation) { return; }
            submitted = false;
            replacePersonalCards(buildPersonalCards(invitation, latestResponse), afterMove);
        }

        // ---- settle detection -> peek + swap --------------------------------

        // The peek (lookup card behind the invitation) and the RSVP arrow
        // appear together, PEEK_DELAY_MS after the Metro intro's settle
        // completes — rive-intro.js adds `intro-complete` to <body> (see
        // addIntroComplete there). That class can already be present by the
        // time this script runs (bail paths — return visit, reduced motion,
        // an already-unlocked reload — all settle synchronously before this
        // file's DOMContentLoaded handler fires); for a fresh playback, or a
        // page unlocked after load, it lands later, so a MutationObserver
        // picks it up whenever it arrives. ?debug-registration never adds
        // the class — it pauses on the scrubbed final frame instead — so
        // the peek and arrow correctly never appear there.
        function onSettled() {
            setTimeout(revealPeek, PEEK_DELAY_MS);
        }

        if (document.body.classList.contains('intro-complete')) {
            onSettled();
        } else {
            var settleObserver = new MutationObserver(function () {
                if (document.body.classList.contains('intro-complete')) {
                    settleObserver.disconnect();
                    onSettled();
                }
            });
            settleObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        }

        // Builds the lookup card (fully hidden — see .rsvp-stack-hidden,
        // Section A4) and reveals the invitation's RSVP button, its sole
        // entry affordance, via .rsvp-peek-visible (opacity fade, see
        // rsvp-styles.css). The lookup card is deliberately built here, not
        // at boot, so it doesn't exist in the DOM — and so can't be clicked
        // or tabbed into — a moment before the flow can begin.
        function revealPeek() {
            buildEmailPanel();
            invitationCardEl.classList.add('rsvp-stack-member');
            applyRestingInstant(invitationCardEl, true);
            applyRestingInstant(lookupWrapper, false);
            // applyRestingInstant sets an inline transition:none (so the
            // transform lands instantly) — clear it so the CSS opacity
            // transition below (the RSVP button's fade-in) isn't blocked by
            // it. Force a reflow (flushes that cleared state) before
            // flipping the class, so the fade actually transitions instead
            // of landing pre-applied — the same synchronous
            // forceReflow-then-mutate pattern fileForward/fileBackward use
            // below, deliberately NOT requestAnimationFrame, which browsers
            // suspend in a backgrounded/hidden tab (e.g. the guest alt-tabs
            // away during the settle) and which would then leave the button
            // never appearing until the tab regains focus.
            lookupWrapper.style.transition = '';
            void lookupWrapper.offsetWidth;
            document.body.classList.add('rsvp-peek-visible');
            arrowBtn.addEventListener('click', onForwardClick);
            backBtn.addEventListener('click', function () {
                if (!stackNavInfoFor(stack[0]).back) { return; }
                fileBackward(afterMove);
            });
        }
    });
})();
