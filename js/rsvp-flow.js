/* ===========================================================================
   RSVP card flow — front-end logic (rsvp.html)
   ---------------------------------------------------------------------------
   The RSVP paper suite that grows out of the settled invitation page. After
   the Metro intro settles, ~PEEK_DELAY_MS later a reskinned "find your
   invitation" card peeks out from behind the invitation (offset lower-right,
   like the next card in a stack); the RSVP arrow appears at the same moment.
   Clicking either plays a file-to-back move: the invitation slides out and
   files behind the lookup card, which becomes the new top ("Back" on the
   lookup card reverses it). On a successful lookup both cards exit left and
   the guest's personal stack deals in — one card per INVITED event
   (EVENT_ORDER) plus a review card as the final sheet:

     email lookup -> one card per INVITED event -> review & send -> thank-you

   Cards for non-invited events are never built; stack depth is entirely
   data-driven (1 + invited.length + 1, thanks added only after submit
   succeeds). Responses are per person (an invitation covers one or two named
   people). The email autocomplete keeps the staging form's privacy rule: no
   lookup until the guest has typed past the "@".

   Two seams are the ONLY functions that touch the network (same contract as
   js/rsvp-form.js on the staging page):

     searchInvitations(query) -> Promise<[{ email, invitedTo, people }]>
     submitRsvp(formData)     -> Promise<void>

   APPS_SCRIPT_URL empty  -> placeholder invitations + no-op submit (fully
                             testable front-end-only, identical to staging).
   APPS_SCRIPT_URL set    -> live lookup + submit against the deployed
                             rsvp-workflow/google-apps-script.js web app.

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
    var APPS_SCRIPT_URL = '';

    var DEBOUNCE_MS = 180;
    var REPLY_BY = 'the first of September'; // September 1, 2026 (confirmed)

    // ---- stack choreography timing -----------------------------------------
    // Two-leg file-to-back move, transform-only. Andrew may retune these —
    // keep them as the single source of truth (nothing else hardcodes them).
    var PEEK_DELAY_MS = 800;    // after the settle completes, before the peek + arrow appear
    var LEG_EXIT_MS = 420;
    var LEG_EXIT_CURVE = 'cubic-bezier(.45,.05,.3,1)';
    var LEG_SETTLE_MS = 400;
    var LEG_SETTLE_CURVE = 'cubic-bezier(.4,0,.2,1)';
    var STACK_MOVE_MS = LEG_EXIT_MS + LEG_SETTLE_MS; // total move time, for focus delays
    var EXIT_STAGGER_MS = 70;   // lookup-success: invitation + lookup card exit, staggered
    var DEPTH_X = 7, DEPTH_Y = 8, DEPTH_ROTATE = 0.9; // px/px/deg per depth level

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
            venue: 'InterContinental Washington, DC — The Wharf',
            address: '801 Wharf Street SW',
            mapUrl: 'https://maps.google.com/?q=801+Wharf+Street+SW+Washington+DC',
            dress: 'Black Tie Preferred',
            dressInfo: 'Tuxedos and full-length gowns are encouraged. Dark suits with a white shirt and dark tie, or formal cocktail dresses, are also welcome.'
        },
        sunday: {
            name: 'Farewell Brunch',
            when: 'Sunday, October 18th · 9:00–11:00 AM',
            venue: 'InterContinental Washington, DC — The Wharf',
            address: '801 Wharf Street SW',
            mapUrl: 'https://maps.google.com/?q=801+Wharf+Street+SW+Washington+DC',
            dress: 'Come as you are',
            dressInfo: 'Wear whatever feels comfortable — no need to dress up.'
        }
    };

    // Info-only block on the Saturday card (no accept/decline).
    var AFTERPARTY_DETAILS = {
        name: 'Wedding Afterparty',
        when: 'Saturday, October 17th · 11:00 PM – 1:00 AM',
        venue: "Kirwan's on the Wharf",
        address: '749 Wharf Street SW, Second Floor',
        mapUrl: 'https://maps.google.com/?q=749+Wharf+Street+SW+Washington+DC',
        note: 'Everyone at the wedding is welcome — no separate RSVP'
    };

    var EVENT_ORDER = ['friday', 'saturday', 'sunday'];

    // The reception dinner. `kosherable` meals carry the small "Kosher?" checkbox.
    var MEAL_OPTIONS = [
        { key: 'branzino', label: 'Branzino', kosherable: true },
        { key: 'chicken', label: 'Chicken', kosherable: true },
        { key: 'cauliflower', label: 'Cauliflower Steak', kosherable: false }
    ];

    // ---- PLACEHOLDER DATA (staging only — NOT real guests) -----------------
    var PLACEHOLDER_INVITATIONS = [
        { email: 'john.smith@example.com', invitedTo: ['friday', 'saturday', 'sunday'], people: ['John Smith', 'Jane Smith'] },
        { email: 'mchen@example.com', invitedTo: ['saturday'], people: ['Michael Chen'] },
        { email: 'the.johnsons@example.com', invitedTo: ['friday', 'saturday', 'sunday'], people: ['Robert Johnson', 'Patricia Johnson'] },
        { email: 'laura.nelson@example.com', invitedTo: ['friday', 'saturday', 'sunday'], people: ['Laura Nelson'] },
        { email: 'williams.party@example.com', invitedTo: ['saturday', 'sunday'], people: ['Sarah Williams', 'Tom Williams'] }
    ];

    // ---- BACKEND SEAMS (the only network code) -------------------------------

    function searchInvitations(query) {
        var q = query.trim().toLowerCase();
        if (!APPS_SCRIPT_URL) {
            return Promise.resolve(PLACEHOLDER_INVITATIONS.filter(function (inv) {
                return inv.email.toLowerCase().indexOf(q) !== -1;
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

    // ---- DOM HELPERS ---------------------------------------------------------

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    var ARROW_RIGHT = '<svg viewBox="0 0 30 14" width="30" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 7 H 27 M 21 1.5 L 27 7 L 21 12.5"/></svg>';
    var ARROW_LEFT = '<svg viewBox="0 0 30 14" width="30" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M29 7 H 3 M 9 1.5 L 3 7 L 9 12.5"/></svg>';

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

    // Condensed event header for a card: when / dress tag / venue + address link.
    function makeCardEventMeta(detail) {
        var wrap = el('div', 'weekend-event');

        wrap.appendChild(el('p', 'weekend-event-when', detail.when));

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
        var invitationCardEl = document.querySelector('.invitation-card');
        var scrollSpacerEl = document.querySelector('.rsvp-flow-scroll-spacer');
        if (!stackEl || !arrowBtn || !invitationCardEl) { return; }

        var MOBILE_BREAKPOINT = 900;

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
        var invitation = null;        // the selected { email, invitedTo, people }
        var preLookupStack = [invitationCardEl];  // [invitation] until the peek adds lookup
        var personalStack = null;     // built after a successful lookup
        var currentStack = preLookupStack;
        var submitted = false;
        var animLock = false;         // true while ANY stack move is in flight

        // ---- stack engine ----------------------------------------------------
        // Generic file-to-back choreography, shared by the 2-card pre-lookup
        // stack (invitation/lookup) and the N-card personal stack dealt in
        // after a successful lookup. A "stack" is a plain array of card
        // elements (each already .paper-card sized/positioned to the
        // invitation's own rect — see .rsvp-stack in styles.css); index 0 is
        // always the current top, increasing index = deeper/further in the
        // future, with filed (past) cards rotated to the END of the array —
        // most recently filed deepest, exactly as the spec describes.

        function restingTransform(depth) {
            return 'translate(' + (depth * DEPTH_X) + 'px, ' + (depth * DEPTH_Y) + 'px) rotate(' + (depth * DEPTH_ROTATE) + 'deg)';
        }

        function depthZ(depth) { return 500 - depth; }

        // Only the top card (depth 0) of any stack is interactive/readable —
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

        // Places an element at its resting depth with no transition — used for
        // initial placement, reduced-motion moves, and pre-positioning a card
        // the instant it's added to a stack (so it's never visible mid-transit
        // or at an unset position before an animated move picks it up).
        function applyRestingInstant(el, depth) {
            el.style.transition = 'none';
            el.style.zIndex = String(depthZ(depth));
            el.style.transform = restingTransform(depth);
            setInert(el, depth !== 0);
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

        // fileForward — "Next": the top card exits left (elevated z-index),
        // then files into the deepest slot while the rest of the stack shifts
        // up one depth. Also used for the initial invitation -> lookup swap.
        function fileForward(stack, onSettled) {
            if (animLock || submitted || stack.length < 2) { return; }
            animLock = true;
            var top = stack[0];

            if (prefersReduced) {
                stack.push(stack.shift());
                stack.forEach(function (el, i) { applyRestingInstant(el, i); });
                animLock = false;
                if (onSettled) { onSettled(); }
                return;
            }

            top.style.transition = 'transform ' + LEG_EXIT_MS + 'ms ' + LEG_EXIT_CURVE;
            top.style.zIndex = '1000';
            void top.offsetWidth; // force reflow so the transition runs from the current position
            top.style.transform = 'translateX(-115%) rotate(-3deg)';

            onceTransition(top, 'transform', LEG_EXIT_MS, function () {
                stack.push(stack.shift());
                stack.forEach(function (el, i) {
                    el.style.transition = 'transform ' + LEG_SETTLE_MS + 'ms ' + LEG_SETTLE_CURVE;
                    el.style.zIndex = String(depthZ(i));
                    el.style.transform = restingTransform(i);
                    setInert(el, i !== 0);
                });
                onceTransition(top, 'transform', LEG_SETTLE_MS, function () {
                    animLock = false;
                    if (onSettled) { onSettled(); }
                });
            });
        }

        // fileBackward — "Back": the exact reverse. The deepest (most recently
        // filed) card exits left from beneath (elevated z-index), then rises
        // onto the top while the rest of the stack shifts down one depth.
        function fileBackward(stack, onSettled) {
            if (animLock || submitted || stack.length < 2) { return; }
            animLock = true;
            var deepest = stack[stack.length - 1];

            if (prefersReduced) {
                stack.unshift(stack.pop());
                stack.forEach(function (el, i) { applyRestingInstant(el, i); });
                animLock = false;
                if (onSettled) { onSettled(); }
                return;
            }

            deepest.style.transition = 'transform ' + LEG_EXIT_MS + 'ms ' + LEG_EXIT_CURVE;
            deepest.style.zIndex = '1000';
            void deepest.offsetWidth;
            deepest.style.transform = 'translateX(-115%) rotate(-3deg)';

            onceTransition(deepest, 'transform', LEG_EXIT_MS, function () {
                stack.unshift(stack.pop());
                stack.forEach(function (el, i) {
                    el.style.transition = 'transform ' + LEG_SETTLE_MS + 'ms ' + LEG_SETTLE_CURVE;
                    el.style.zIndex = String(depthZ(i));
                    el.style.transform = restingTransform(i);
                    setInert(el, i !== 0);
                });
                onceTransition(deepest, 'transform', LEG_SETTLE_MS, function () {
                    animLock = false;
                    if (onSettled) { onSettled(); }
                });
            });
        }

        // The invitation's field/card sizing is built for a 16:9 registration
        // box; on mobile portrait that box is short (~200px), far shorter
        // than the reply-card stack's actual content. Rather than crop it,
        // Andrew's call: the card fills the page width on mobile
        // (rsvp-styles.css) and the guest scrolls to see the rest.
        // .rsvp-flow-scroll-spacer (a dedicated mobile-only element — the
        // settled page's own .invitation-scroll-spacer collapses once the
        // flow starts) supplies that room, grown here to fit whatever the
        // CURRENT top card needs. #invitation-endstate's overflow: visible
        // (rsvp-styles.css, mobile) is the other half of this — nothing
        // clips the card once there's room to scroll to it.
        function ensureMobileScrollRoom() {
            if (!scrollSpacerEl) { return; }
            if (window.innerWidth > MOBILE_BREAKPOINT) {
                scrollSpacerEl.style.height = '';
                return;
            }
            // #invitation-endstate is position:absolute (out of normal
            // flow), so this spacer — a normal-flow sibling — lands at
            // document y:0, not below endstate's own visual 100dvh box; its
            // height doesn't simply ADD to the existing scrollable area, it
            // OVERLAPS the front of it. Reset first so scrollHeight below
            // reflects the true baseline (everything except this spacer's
            // own contribution), then request only the actual deficit.
            scrollSpacerEl.style.height = '';
            var top = currentStack[0];
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
            var deficit = neededDocHeight - baselineDocHeight;
            scrollSpacerEl.style.height = deficit > 0 ? Math.ceil(deficit) + 'px' : '';
        }

        window.addEventListener('resize', ensureMobileScrollRoom);

        // Runs after any stack move settles: refreshes the review summary from
        // the live radios if review just became the top card (matching the
        // old goToStep's "steps[i] === 'review'" rebuild-on-arrival), resets
        // scroll to the top of the new card on mobile (so it and the spacer
        // measurement below start from a predictable, known position), then
        // focuses the new top card (delay = 0 under reduced motion so it
        // doesn't wait for a move that didn't animate). Passed as the
        // onSettled callback to fileForward/fileBackward.
        function afterMove() {
            var top = currentStack[0];
            if (top && top.dataset.step === 'review') {
                buildSummaryInto(reviewSummary, collectData());
            }
            if (window.innerWidth <= MOBILE_BREAKPOINT) {
                window.scrollTo(0, 0);
            }
            ensureMobileScrollRoom();
            var card = top && top.querySelector('.rsvp-card');
            if (!card) { return; }
            setTimeout(function () {
                card.focus({ preventScroll: true });
            }, prefersReduced ? 0 : STACK_MOVE_MS + 20);
        }

        // ---- stack card shell --------------------------------------------

        // A themed <img> with the correct light/dark src set immediately (not
        // just via data-light/data-dark) — new elements are created well after
        // site-init.js's initial swap pass, so they need to start correct on
        // their own; the shared data-light/data-dark attributes still make
        // them participate in any LATER dark-mode toggle normally.
        function themedImg(className, lightSrc, darkSrc, alt) {
            var img = document.createElement('img');
            img.className = className;
            img.dataset.light = lightSrc;
            img.dataset.dark = darkSrc;
            img.alt = alt || '';
            img.src = document.body.classList.contains('dark-mode') ? darkSrc : lightSrc;
            return img;
        }

        // Wraps a .rsvp-card content element in the shared paper-suite shell —
        // .paper-card.paper-card--page (grain + sheet shadow + the invitation's
        // own on-screen rect, see styles.css) + a baked .paper-card__frame
        // overlay, appended into #rsvp-stack. The frame is appended AFTER the
        // content so it paints above it (both are position:absolute with
        // z-index:auto — later in the DOM wins), matching "frame ... above
        // content" in the spec. `stepKey` is tagged on the wrapper (parallel
        // to the old steps[] array) so code can recognize a specific card —
        // e.g. refreshing the review summary only when it becomes the top.
        function makeStackCard(card, stepKey) {
            var wrapper = el('div', 'paper-card paper-card--page');
            if (stepKey) { wrapper.dataset.step = stepKey; }
            wrapper.appendChild(card);
            wrapper.appendChild(themedImg('paper-card__frame',
                'assets/invitation/card-frame-light.png',
                'assets/invitation/card-frame-dark.png', ''));
            stackEl.appendChild(wrapper);
            return wrapper;
        }

        // ---- email / lookup card (the pre-lookup stack's second card) ----

        var emailInput, emailSuggestions;
        var debounceTimer = null;
        var lookupWrapper = null; // the .paper-card wrapper, once built

        function buildEmailPanel() {
            var card = el('div', 'rsvp-card');
            card.tabIndex = -1;

            card.appendChild(el('h1', 'rsvp-card-title', 'Rsvp'));
            // Two-line request block, matching the printed reply card: a Sentient
            // sentence-case line over an uppercased small-caps date line.
            var request = el('p', 'rsvp-card-request');
            request.appendChild(document.createTextNode('The favor of a reply is requested'));
            request.appendChild(document.createElement('br'));
            request.appendChild(el('span', 'rsvp-card-request-by', 'by ' + REPLY_BY));
            card.appendChild(request);

            var group = el('div', 'form-group');
            var label = el('label', null, 'Find your invitation');
            label.htmlFor = 'rsvpFlowEmail';
            group.appendChild(label);

            emailInput = document.createElement('input');
            emailInput.type = 'text';
            emailInput.id = 'rsvpFlowEmail';
            emailInput.autocomplete = 'off';
            emailInput.inputMode = 'email';
            emailInput.placeholder = 'Start typing your email…';
            group.appendChild(emailInput);

            emailSuggestions = el('div', 'guest-suggestions');
            emailSuggestions.id = 'rsvpFlowSuggestions';
            group.appendChild(emailSuggestions);

            group.appendChild(el('p', 'form-hint',
                'Type the email at which you received your invitation.'));
            card.appendChild(group);

            // Back — files the lookup card away and returns the invitation to
            // the top ("file back to re-read the invitation").
            card.appendChild(cardNav(null));

            emailInput.addEventListener('input', onEmailInput);
            document.addEventListener('click', function (e) {
                if (!emailInput.contains(e.target) && !emailSuggestions.contains(e.target)) {
                    hideSuggestions();
                }
            });

            lookupWrapper = makeStackCard(card, 'lookup');
            preLookupStack.push(lookupWrapper);
            return lookupWrapper;
        }

        function onEmailInput() {
            var term = emailInput.value.trim();
            // Editing away from a selected invitation resets the whole step list.
            if (invitation && term !== invitation.email) { clearSelection(); }
            if (debounceTimer) { clearTimeout(debounceTimer); }
            // Privacy rule: only query once the guest has typed past the "@" —
            // you can't fish for other people's emails from a few letters.
            var at = term.indexOf('@');
            if (at === -1 || term.length <= at + 1) { hideSuggestions(); return; }
            debounceTimer = setTimeout(function () {
                searchInvitations(term).then(displaySuggestions).catch(function () {
                    displaySuggestions(null, 'Something went wrong — please try again.');
                });
            }, DEBOUNCE_MS);
        }

        function displaySuggestions(invitations, errorText) {
            emailSuggestions.innerHTML = '';
            if (errorText || !invitations || invitations.length === 0) {
                var empty = el('div', 'guest-suggestion-item guest-suggestion-empty',
                    errorText || 'No match found — check the email on your invitation.');
                emailSuggestions.appendChild(empty);
            } else {
                invitations.forEach(function (inv) {
                    var div = el('div', 'guest-suggestion-item', inv.email);
                    div.addEventListener('click', function () { selectInvitation(inv); });
                    emailSuggestions.appendChild(div);
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

        // Selection advances — no separate Next button on the email card.
        // Lookup success: both pre-lookup cards exit left (staggered), then
        // the guest's personal stack deals in.
        function selectInvitation(inv) {
            invitation = inv;
            emailInput.value = inv.email;
            hideSuggestions();
            exitPreLookupStack(function () {
                dealPersonalStack(inv);
            });
        }

        // Editing the email away from a selected invitation, while the lookup
        // card is still the interactive top (see setInert above — once the
        // personal stack deals in, this input is inert and unreachable
        // anyway), clears the selection so a later selectInvitation() starts
        // clean.
        function clearSelection() {
            invitation = null;
        }

        // ---- pre-lookup stack: invitation <-> lookup card -----------------

        // Both cards exit off-screen left with a small stagger, then hide —
        // this stack is abandoned for the rest of the session (there is no
        // way back to it from the personal stack, matching the spec).
        function exitPreLookupStack(onDone) {
            if (animLock) { return; }
            animLock = true;
            var cards = preLookupStack.slice();

            if (prefersReduced) {
                cards.forEach(function (elCard) {
                    elCard.style.transition = 'none';
                    elCard.style.visibility = 'hidden';
                    elCard.style.pointerEvents = 'none';
                    setInert(elCard, true);
                });
                animLock = false;
                if (onDone) { onDone(); }
                return;
            }

            var remaining = cards.length;
            cards.forEach(function (elCard, i) {
                setTimeout(function () {
                    elCard.style.transition = 'transform ' + LEG_EXIT_MS + 'ms ' + LEG_EXIT_CURVE;
                    elCard.style.zIndex = '1000';
                    void elCard.offsetWidth;
                    elCard.style.transform = 'translateX(-115%) rotate(-3deg)';
                    setInert(elCard, true);
                    onceTransition(elCard, 'transform', LEG_EXIT_MS, function () {
                        elCard.style.visibility = 'hidden';
                        elCard.style.pointerEvents = 'none';
                        remaining--;
                        if (remaining === 0) {
                            animLock = false;
                            if (onDone) { onDone(); }
                        }
                    });
                }, i * EXIT_STAGGER_MS);
            });
        }

        // ---- personal stack: one card per invited event + review ----------

        // Stack depth is entirely data-driven — invited.length event cards
        // plus the review card (thanks is added later, only on submit
        // success, so it's never visible at the stack edges before then).
        function dealPersonalStack(inv) {
            personalStack = [];
            var invited = EVENT_ORDER.filter(function (key) {
                return (inv.invitedTo || []).indexOf(key) !== -1;
            });
            invited.forEach(function (key, i) {
                buildEventPanel(inv, key, i === invited.length - 1);
            });
            buildReviewPanel(inv);

            currentStack = personalStack;
            personalStack.forEach(function (elCard, i) { applyRestingInstant(elCard, i); });
            afterMove();
        }

        function backButton() {
            var btn = el('button', 'rsvp-card-back');
            btn.type = 'button';
            btn.setAttribute('aria-label', 'Back');
            var iconWrap = el('span');
            iconWrap.innerHTML = ARROW_LEFT;
            btn.appendChild(iconWrap.firstChild);
            btn.appendChild(el('span', null, 'Back'));
            btn.addEventListener('click', function () {
                fileBackward(currentStack, afterMove);
            });
            return btn;
        }

        function nextButton(labelText, onClick) {
            var btn = el('button', 'rsvp-card-next');
            btn.type = 'button';
            var span = el('span', null, labelText);
            btn.appendChild(span);
            var iconWrap = el('span');
            iconWrap.innerHTML = ARROW_RIGHT;
            btn.appendChild(iconWrap.firstChild);
            btn.addEventListener('click', onClick);
            return btn;
        }

        // Back + forward as twins: a wrapper transparent to layout on desktop (each
        // button positions absolutely outside the card), a flex row below on mobile.
        function cardNav(forwardEl) {
            var nav = el('div', 'rsvp-card-nav');
            nav.appendChild(backButton());
            if (forwardEl) { nav.appendChild(forwardEl); }
            return nav;
        }

        // ---- event cards ----

        function buildEventPanel(inv, eventKey, isLast) {
            var detail = EVENT_DETAILS[eventKey];
            var card = el('div', 'rsvp-card');
            card.tabIndex = -1;
            card.dataset.event = eventKey;

            card.appendChild(el('h2', 'rsvp-card-title', detail.shortName || detail.name));
            card.appendChild(makeCardEventMeta(detail));

            // Saturday: afterparty info (no RSVP) after the event details.
            if (eventKey === 'saturday') {
                var after = el('div', 'weekend-event rsvp-card-afterparty');
                after.appendChild(el('h3', 'weekend-event-name', AFTERPARTY_DETAILS.name));
                after.appendChild(el('p', 'weekend-event-when', AFTERPARTY_DETAILS.when));
                var where = el('p', 'weekend-event-where');
                where.appendChild(document.createTextNode(AFTERPARTY_DETAILS.venue));
                where.appendChild(document.createElement('br'));
                var a = el('a', 'schedule-link', AFTERPARTY_DETAILS.address);
                a.href = AFTERPARTY_DETAILS.mapUrl;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                where.appendChild(a);
                after.appendChild(where);
                after.appendChild(el('p', 'weekend-event-note', AFTERPARTY_DETAILS.note));
                card.appendChild(after);
            }

            (inv.people || []).forEach(function (name, idx) {
                var person = el('div', 'rsvp-card-person');
                person.appendChild(el('p', 'rsvp-card-person-name', name));

                var choices = el('div', 'rsvp-card-choices');
                choices.appendChild(radioLabel('fp' + idx + '_' + eventKey, 'yes', 'Accepts with pleasure'));
                choices.appendChild(radioLabel('fp' + idx + '_' + eventKey, 'no', 'Declines with regret'));
                person.appendChild(choices);

                if (eventKey === 'saturday') {
                    person.appendChild(buildMealSection(idx));
                    // Declining Saturday collapses/disables that person's meal section.
                    choices.querySelectorAll('input[type="radio"]').forEach(function (input) {
                        input.addEventListener('change', function () {
                            updateMealDisabled(card, idx);
                        });
                    });
                }

                card.appendChild(person);
            });

            var error = el('p', 'rsvp-card-error');
            error.setAttribute('role', 'alert');
            card.appendChild(error);

            card.appendChild(cardNav(nextButton(isLast ? 'Review' : 'Next', function () {
                if (validateEventCard(card, eventKey)) {
                    error.classList.remove('show');
                    fileForward(currentStack, afterMove);
                }
            })));

            var wrapper = makeStackCard(card, eventKey);
            personalStack.push(wrapper);
            return wrapper;
        }

        function buildMealSection(personIdx) {
            var section = el('div', 'rsvp-card-meal');
            section.dataset.person = personIdx;
            section.appendChild(el('p', 'rsvp-card-meal-label', 'Dinner selection'));

            MEAL_OPTIONS.forEach(function (meal) {
                var row = el('div', 'rsvp-meal-option');
                var radio = radioLabel('fp' + personIdx + '_meal', meal.key, meal.label);
                radio.querySelector('input').addEventListener('change', function () {
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
                }

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

        function validateEventCard(card, eventKey) {
            var error = card.querySelector('.rsvp-card-error');
            for (var idx = 0; idx < invitation.people.length; idx++) {
                var name = invitation.people[idx];
                var answer = card.querySelector('input[name="fp' + idx + '_' + eventKey + '"]:checked');
                if (!answer) {
                    error.textContent = 'Please respond for ' + name + '.';
                    error.classList.add('show');
                    return false;
                }
                if (eventKey === 'saturday' && answer.value === 'yes') {
                    var meal = card.querySelector('input[name="fp' + idx + '_meal"]:checked');
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

            card.appendChild(el('h2', 'rsvp-card-title', 'Your response'));

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

            card.appendChild(cardNav(null));

            reviewSubmitBtn = el('button', 'btn-priority rsvp-submit', 'Send RSVP');
            reviewSubmitBtn.type = 'button';
            reviewSubmitBtn.addEventListener('click', onSubmit);
            card.appendChild(reviewSubmitBtn);

            var wrapper = makeStackCard(card, 'review');
            personalStack.push(wrapper);
            return wrapper;
        }

        function mealLabelFor(key) {
            for (var i = 0; i < MEAL_OPTIONS.length; i++) {
                if (MEAL_OPTIONS[i].key === key) { return MEAL_OPTIONS[i].label; }
            }
            return key;
        }

        // Summary grouped by person: each event ✓/✗, plus meal (+ Kosher tag)
        // for Saturday acceptances. Rebuilt from the live radios on every visit.
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
                        line.appendChild(document.createTextNode(' · ' + mealLabelFor(person.meal)));
                        if (person.mealKosher) {
                            line.appendChild(document.createTextNode(' '));
                            line.appendChild(el('span', 'weekend-event-dress', 'Kosher'));
                        }
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
                    // Build thanks now (not pre-built with the rest of the stack)
                    // so it's never visible at the stack edges before the send
                    // actually succeeds. buildThanksPanel pre-positions it at the
                    // deepest slot instantly, so it's correctly hidden the moment
                    // it's added, then this fileForward reveals it.
                    buildThanksPanel();
                    buildSummaryInto(thanksSummary, data);
                    fileForward(currentStack, function () {
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

        // ---- thank-you ----

        var thanksSummary;

        function buildThanksPanel() {
            var card = el('div', 'rsvp-card');
            card.tabIndex = -1;

            card.appendChild(el('h2', 'rsvp-card-title', 'Thank you'));
            card.appendChild(el('p', 'rsvp-card-thanks-line',
                "Your RSVP has been received. We can't wait to celebrate with you."));

            thanksSummary = el('div', 'rsvp-review-summary');
            card.appendChild(thanksSummary);

            var wrapper = makeStackCard(card, 'thanks');
            // Insert at index 1 (the "next" slot), NOT pushed to the end —
            // fileForward always promotes whatever is at index 1 to the new
            // top when it shifts the current top (review) out, so thanks
            // must be sitting right there for the reveal to land on it
            // rather than on the next already-filed event card.
            personalStack.splice(1, 0, wrapper);
            // Pre-position instantly at that slot the moment it's added —
            // never visible in an unset state before the fileForward call
            // (right after this) settles everyone and reveals it.
            applyRestingInstant(wrapper, 1);
            return wrapper;
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

        // Builds the lookup card and places both pre-lookup cards at their
        // resting depths, then reveals the peek (the lookup card's offset
        // corner behind the invitation) and the arrow together via
        // .rsvp-peek-visible (opacity fade, see rsvp-styles.css). The lookup
        // card is deliberately built here, not at boot, so it doesn't exist
        // in the DOM — and so can't be clicked or tabbed into — a moment
        // before it's meant to appear.
        function revealPeek() {
            buildEmailPanel();
            invitationCardEl.classList.add('rsvp-stack-member');
            applyRestingInstant(invitationCardEl, 0);
            applyRestingInstant(lookupWrapper, 1);
            // Exception to "only the top card is interactive": the lookup
            // card's own offset sliver, peeking out behind the invitation,
            // IS the click target that starts the flow (see startFlow) — it
            // can't be inert. The invitation sits above it everywhere the two
            // overlap, so the buried email input/back button are never
            // reachable by mouse regardless; they're technically still
            // keyboard-tabbable for this one moment, a deliberately accepted
            // minor tradeoff (the arrow remains the fully keyboard-operable
            // entry point throughout).
            setInert(lookupWrapper, false);
            // applyRestingInstant sets an inline transition:none (so the
            // transform lands instantly) — clear it so the CSS opacity
            // transition below (the peek fade-in) isn't blocked by it. Force
            // a reflow (flushes that cleared state) before flipping the
            // class, so the fade actually transitions instead of landing
            // pre-applied — the same synchronous forceReflow-then-mutate
            // pattern fileForward/fileBackward use below, deliberately NOT
            // requestAnimationFrame, which browsers suspend in a
            // backgrounded/hidden tab (e.g. the guest alt-tabs away during
            // the settle) and which would then leave the peek never
            // appearing until the tab regains focus.
            lookupWrapper.style.transition = '';
            void lookupWrapper.offsetWidth;
            document.body.classList.add('rsvp-peek-visible');
            lookupWrapper.addEventListener('click', startFlow);
            arrowBtn.addEventListener('click', startFlow);
        }

        // Plays the invitation -> lookup file-to-back swap (arrow or peek,
        // same action). Guards on the lookup card not already being on top,
        // rather than a one-shot flag, so filing back to re-read the
        // invitation (the lookup card's own Back button) and then swapping
        // forward again both work identically to the first time.
        function startFlow() {
            if (preLookupStack[0] === lookupWrapper) { return; }
            document.body.classList.add('rsvp-flow-active');
            window.scrollTo(0, 0);
            fileForward(preLookupStack, afterMove);
        }
    });
})();
