/* ===========================================================================
   RSVP card flow — front-end logic (rsvp.html)
   ---------------------------------------------------------------------------
   The RSVP paper suite that grows out of the settled invitation page. After
   the Metro intro settles, ~PEEK_DELAY_MS later a reskinned "find your
   invitation" card peeks out from behind the invitation (offset lower-right,
   like the next card in a stack); the RSVP arrow appears at the same moment.
   Clicking either plays a file-to-back move: the invitation slides out and
   files behind the lookup card, which becomes the new top.

   Every card in the flow — invitation, lookup, one per INVITED event
   (Saturday gets one card per person, each carrying an inline afterparty
   FYI block — see buildAfterpartyInfo), review, and thank-you — lives in
   ONE continuous stack array and moves through the SAME
   fileForward/fileBackward choreography (see "stack engine" below).
   Selecting an invitation doesn't jump to a different stack; it splices the
   personal-stack cards in right behind lookup and plays a normal fileForward
   move. That means Back is symmetric everywhere — from the first event card,
   Back reveals lookup; from lookup, Back reveals the invitation; from the
   invitation, the arrow/peek swaps forward again — all the way through:

     invitation <-> lookup <-> one card per INVITED event
       <-> review & send <-> thank-you

   Cards for non-invited events are never built; stack depth is entirely
   data-driven. Re-selecting (a different invite, or the same one again after
   going back to lookup) tears down the previous personal-stack cards and
   builds fresh ones — entered answers don't survive a trip back to lookup.
   Responses are per person (an invitation covers one or two named people).
   The email autocomplete keeps the staging form's privacy rule: no lookup
   until the guest has typed past the "@".

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
        name: 'Wedding Afterparty',
        time: '11:00 PM – 1:00 AM',
        venue: "Kirwan's on the Wharf",
        address: '749 Wharf Street SW, Second Floor',
        mapUrl: 'https://maps.google.com/?q=749+Wharf+Street+SW+Washington+DC',
        note: 'All guests welcome — no need to RSVP!'
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
        // ONE continuous stack spans the whole flow — invitation, lookup,
        // one card per invited event (Saturday's cards each carry an inline
        // afterparty FYI — see buildAfterpartyInfo), review, and (once
        // submitted) thanks.
        // Selecting an invitation doesn't swap to a different stack, it
        // files the personal-stack cards in right behind lookup and plays
        // the SAME fileForward move every Next click uses — so Back is
        // symmetric everywhere, all the way back to the lookup card and the
        // invitation, and the choreography is identical throughout instead
        // of a special-cased dual-exit.
        var invitation = null;        // the selected { email, invitedTo, people }
        var stack = [invitationCardEl];
        // The cards selectInvitation() built and spliced into `stack` for the
        // CURRENTLY selected invitation, tracked so a later re-selection (a
        // different invite, or the same one retyped) can tear them out of
        // both the array and the DOM before building fresh ones.
        var personalCards = [];
        var submitted = false;
        var animLock = false;         // true while ANY stack move is in flight

        // ---- stack engine ----------------------------------------------------
        // Generic file-to-back choreography for the one continuous `stack`
        // array spanning the whole flow. Each element is a card already
        // .paper-card sized/positioned to the invitation's own rect (see
        // .rsvp-stack in styles.css); index 0 is always the current top,
        // increasing index = deeper/further in the future, with filed (past)
        // cards rotated to the END of the array — most recently filed
        // deepest, exactly as the spec describes.

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

        // Gates the per-card Back/Next controls' visibility (see
        // .rsvp-stack-top in rsvp-styles.css) — deliberately a SEPARATE flag
        // from setInert, not derived from [inert]: the peeking lookup card
        // is depth 1 but intentionally NOT inert (its sliver is a click
        // target — see revealPeek), so its own Back button would otherwise
        // stay visibly opacity:1 the moment it's built, ghosting right next
        // to the invitation's own controls. This flag tracks depth alone.
        function setStackTop(el, isTop) {
            el.classList.toggle('rsvp-stack-top', isTop);
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
            setStackTop(el, depth === 0);
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
                    setStackTop(el, i === 0);
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
                    setStackTop(el, i === 0);
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
            var top = stack[0];
            if (top && top.dataset.step === 'review') {
                buildSummaryInto(reviewSummary, collectData());
            }
            updateStackNav();
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

        // ---- persistent stack nav (Back/#rsvp-arrow-as-Next) ------------------

        // What the CURRENT top card wants from the persistent nav: whether a
        // forward action exists at all (lookup advances only by selecting a
        // suggestion; review advances only via its own Send button; thanks
        // is terminal — none of those get a generic forward control), its
        // label, and its validation (omitted/undefined when a card has no
        // fields to check, e.g. the invitation's own "RSVP"). `back`
        // is true for everything except thanks (nothing to reverse from a
        // completed submission) — Back is otherwise always meaningful since
        // the whole flow, invitation included, is one continuous stack.
        function stackNavInfoFor(wrapper) {
            if (!wrapper) { return { forward: false, back: false }; }
            if (wrapper === invitationCardEl) {
                return { forward: true, back: false, label: 'RSVP' };
            }
            var step = wrapper.dataset.step || '';
            if (step === 'lookup') {
                return { forward: false, back: true };
            }
            if (step === 'review' || step === 'thanks') {
                return { forward: false, back: step === 'review' };
            }
            var card = wrapper.querySelector('.rsvp-card');
            var label = isLastPersonalCard(wrapper) ? 'Review' : 'Next';
            if (step.indexOf('saturday_') === 0) {
                var personIdx = parseInt(step.slice('saturday_'.length), 10);
                return {
                    forward: true, back: true, label: label,
                    validate: function () { return validateSaturdayPersonCard(card, personIdx); }
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

        // Shared "advance" logic used by every forward control in the flow —
        // the mobile persistent #rsvp-arrow (via onForwardClick below) and
        // every desktop per-card Next button (see makeCardNavButton).
        // fileForward already self-guards on stack.length < 2, so this only
        // needs to additionally guard against a move already in flight or a
        // completed submission, then run the card's own validation (if any)
        // before actually filing forward.
        function advanceFrom(validate) {
            if (animLock || submitted) { return; }
            if (validate && !validate()) { return; }
            document.body.classList.add('rsvp-flow-active');
            window.scrollTo(0, 0);
            fileForward(stack, afterMove);
        }

        // The click handler for the mobile-only persistent #rsvp-arrow —
        // "Begin RSVP" on the invitation, "Next"/"Review" on every card
        // after (desktop uses per-card Next buttons instead — see
        // makeCardNavButton). Also reused as the peek's click handler (see
        // revealPeek): stackNavInfoFor(lookup) always returns forward:false,
        // so clicking the peek once lookup is already on top correctly
        // no-ops here, with no separate "already swapped" guard needed.
        function onForwardClick() {
            var info = stackNavInfoFor(stack[0]);
            if (!info.forward) { return; }
            advanceFrom(info.validate);
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
        // `nav` — { back: boolean, next: { label, validate } | null } —
        // appends this card's own desktop Back/Next controls (see
        // makeCardNavButton); appended last so they paint above the frame
        // too, though they never geometrically overlap it (they sit above
        // the card's top edge, outside the frame's own inset:0 box).
        function makeStackCard(card, stepKey, nav) {
            var wrapper = el('div', 'paper-card paper-card--page');
            if (stepKey) { wrapper.dataset.step = stepKey; }
            wrapper.appendChild(card);
            wrapper.appendChild(themedImg('paper-card__frame',
                'assets/invitation/card-frame-light.png',
                'assets/invitation/card-frame-dark.png', ''));
            nav = nav || {};
            if (nav.back) { wrapper.appendChild(makeCardNavButton('back')); }
            if (nav.next) { wrapper.appendChild(makeCardNavButton('next', nav.next.label, nav.next.validate)); }
            stackEl.appendChild(wrapper);
            return wrapper;
        }

        // Per-card Back/Next controls (desktop only, >900px — see the CSS
        // media queries in rsvp-styles.css). Positioned above the card's
        // top edge, clear of the down-right-fanning peek stack, and their
        // opacity is gated on the wrapper's [inert] state so only the top
        // card's controls are ever visible. Reuses the exact markup/child
        // order and SVG paths of the mobile-only #rsvp-arrow (label then
        // icon) / #rsvp-stack-back (icon then label).
        function makeCardNavButton(direction, label, validate) {
            var isNext = direction === 'next';
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = isNext ? 'rsvp-card-nav-next' : 'rsvp-card-nav-back';
            if (isNext) {
                btn.setAttribute('aria-label', label || 'Next');
                btn.appendChild(el('span', 'rsvp-card-nav-label', label || 'Next'));
                btn.appendChild(navArrowSvg('next'));
                btn.addEventListener('click', function () { advanceFrom(validate); });
            } else {
                btn.setAttribute('aria-label', 'Back');
                btn.appendChild(navArrowSvg('back'));
                btn.appendChild(el('span', 'rsvp-card-nav-label', 'Back'));
                btn.addEventListener('click', function () { fileBackward(stack, afterMove); });
            }
            return btn;
        }

        // Same two fixed SVG shapes as the mobile #rsvp-arrow/#rsvp-stack-back
        // icons — no user data ever passed in, so building via innerHTML is
        // safe and avoids createElementNS boilerplate for two trusted, fixed
        // markup strings.
        function navArrowSvg(direction) {
            var path = direction === 'next'
                ? 'M1 8 H 31 M 24.5 1.5 L 31 8 L 24.5 14.5'
                : 'M33 8 H 3 M 9.5 1.5 L 3 8 L 9.5 14.5';
            var span = document.createElement('span');
            span.innerHTML = '<svg class="rsvp-card-nav-icon" viewBox="0 0 34 16" width="34" height="16" ' +
                'aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" ' +
                'stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg>';
            return span.firstChild;
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
            card.appendChild(el('p', 'rsvp-card-request',
                'The favor of your reply is requested by ' + REPLY_BY + '.'));

            var group = el('div', 'form-group');
            var label = el('label', 'rsvp-lookup-label', 'Find your invitation');
            label.htmlFor = 'rsvpFlowEmail';
            group.appendChild(label);

            emailInput = document.createElement('input');
            emailInput.type = 'text';
            emailInput.id = 'rsvpFlowEmail';
            emailInput.autocomplete = 'off';
            emailInput.inputMode = 'email';
            emailInput.placeholder = 'Start typing your email…';

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

            group.appendChild(el('p', 'form-hint',
                'Type the email at which you received your invitation.'));
            card.appendChild(group);

            emailInput.addEventListener('input', onEmailInput);
            emailInput.addEventListener('keydown', onEmailInputKeydown);
            emailSuggestions.addEventListener('keydown', onSuggestionsKeydown);
            document.addEventListener('click', function (e) {
                if (!emailInput.contains(e.target) && !emailSuggestions.contains(e.target)) {
                    hideSuggestions();
                }
            });

            lookupWrapper = makeStackCard(card, 'lookup', { back: true, next: null });
            stack.push(lookupWrapper);
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
        // invitation, or the same one re-selected), builds fresh ones for
        // this invitation, splices them into `stack` right behind lookup,
        // and plays the SAME fileForward move every other Next click uses —
        // so this transition is choreographed identically to the rest of
        // the flow (no special-cased dual exit), and Back from the first
        // card naturally reveals lookup again (fileBackward on a unified
        // array — see the stack engine above).
        function selectInvitation(inv) {
            invitation = inv;
            emailInput.value = inv.email;
            hideSuggestions();
            removePersonalCards();
            dealPersonalStack(inv);
            fileForward(stack, afterMove);
        }

        // Editing the email away from a selected invitation, while the lookup
        // card is still the interactive top (see setInert above — once the
        // personal stack deals in, this input is inert and unreachable
        // anyway), clears the selection AND tears down the stale personal
        // stack so a later selectInvitation() starts clean.
        function clearSelection() {
            invitation = null;
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

        // Stack depth is entirely data-driven — one card per invited event
        // (Saturday's meal/kosher content is dense enough that it gets one
        // card PER PERSON instead of a single shared one — see
        // buildSaturdayPersonPanel, which also appends the afterparty FYI
        // block inline), and the review card (thanks is added later, only
        // on submit success, so it's never visible at the stack edges
        // before then). Builds the cards and splices them into `stack`
        // right behind lookup; the caller (selectInvitation) plays the
        // actual fileForward move so this uses the same choreography as
        // every other Next.
        function dealPersonalStack(inv) {
            var invited = EVENT_ORDER.filter(function (key) {
                return (inv.invitedTo || []).indexOf(key) !== -1;
            });
            // Ordered build list. The persistent nav's "Next" vs "Review"
            // label is computed dynamically per current top card (see
            // isLastPersonalCard) against this same personalCards order, not
            // baked in at build time — so it stays correct regardless of
            // EVENT_ORDER position or how many Saturday people there are.
            var steps = [];
            invited.forEach(function (key) {
                if (key === 'saturday') {
                    inv.people.forEach(function (name, personIdx) {
                        steps.push({ type: 'saturday-person', personIdx: personIdx });
                    });
                } else {
                    steps.push({ type: 'event', key: key });
                }
            });
            steps.forEach(function (step, i) {
                // Static, computed once at build time — desktop's per-card
                // Next buttons need their label fixed at construction (see
                // makeCardNavButton); mobile's isLastPersonalCard computes
                // the identical answer dynamically at call time instead.
                var nextLabel = (i === steps.length - 1) ? 'Review' : 'Next';
                var built = step.type === 'saturday-person'
                    ? buildSaturdayPersonPanel(inv, step.personIdx, nextLabel)
                    : buildEventPanel(inv, step.key, nextLabel);
                personalCards.push(built);
            });
            personalCards.push(buildReviewPanel(inv));

            var lookupIdx = stack.indexOf(lookupWrapper);
            var spliceArgs = [lookupIdx + 1, 0].concat(personalCards);
            Array.prototype.splice.apply(stack, spliceArgs);
            // Snap every card (existing ones — a harmless no-op re-apply —
            // and the newly-spliced ones) to its CURRENT pre-move depth
            // instantly, so the new cards have a defined starting
            // position/z-index before the animated fileForward move
            // (selectInvitation) picks them up.
            stack.forEach(function (elCard, i) { applyRestingInstant(elCard, i); });
        }

        // ---- event cards ----

        // Friday/Sunday: one card per event, all invited people on it (they
        // only carry an accept/decline each, light enough to share a card).
        // Saturday is dense enough (meal + kosher per person) that it gets
        // its own per-person function below instead.
        function buildEventPanel(inv, eventKey, nextLabel) {
            var detail = EVENT_DETAILS[eventKey];
            var card = el('div', 'rsvp-card');
            card.tabIndex = -1;
            card.dataset.event = eventKey;

            card.appendChild(el('h2', 'rsvp-card-title', detail.shortName || detail.name));
            card.appendChild(makeCardEventMeta(detail));

            (inv.people || []).forEach(function (name, idx) {
                var person = el('div', 'rsvp-card-person');
                person.appendChild(el('p', 'rsvp-card-person-name', name));

                var choices = el('div', 'rsvp-card-choices');
                choices.appendChild(radioLabel('fp' + idx + '_' + eventKey, 'yes', 'Accepts with pleasure'));
                choices.appendChild(radioLabel('fp' + idx + '_' + eventKey, 'no', 'Declines with regret'));
                person.appendChild(choices);

                card.appendChild(person);
            });

            var error = el('p', 'rsvp-card-error');
            error.setAttribute('role', 'alert');
            card.appendChild(error);

            return makeStackCard(card, eventKey, {
                back: true,
                next: { label: nextLabel, validate: function () { return validateEventCard(card, eventKey); } }
            });
        }

        // Saturday: one card PER PERSON, not one shared card — the
        // meal/kosher content per person overflowed even a single
        // already-slimmed-down shared card (see decisions.md). Same event
        // meta as any other event card, just one person's accept/decline +
        // dinner selection instead of a loop over everyone.
        function buildSaturdayPersonPanel(inv, personIdx, nextLabel) {
            var detail = EVENT_DETAILS.saturday;
            var name = inv.people[personIdx];
            var card = el('div', 'rsvp-card');
            card.tabIndex = -1;
            card.dataset.event = 'saturday';
            card.dataset.person = personIdx;

            card.appendChild(el('h2', 'rsvp-card-title', detail.shortName || detail.name));
            card.appendChild(makeCardEventMeta(detail));

            var person = el('div', 'rsvp-card-person');
            person.appendChild(el('p', 'rsvp-card-person-name', name));

            var choices = el('div', 'rsvp-card-choices');
            choices.appendChild(radioLabel('fp' + personIdx + '_saturday', 'yes', 'Accepts with pleasure'));
            choices.appendChild(radioLabel('fp' + personIdx + '_saturday', 'no', 'Declines with regret'));
            person.appendChild(choices);

            person.appendChild(buildMealSection(personIdx));
            // Declining Saturday collapses/disables this person's meal section.
            choices.querySelectorAll('input[type="radio"]').forEach(function (input) {
                input.addEventListener('change', function () {
                    updateMealDisabled(card, personIdx);
                });
            });

            card.appendChild(person);
            card.appendChild(buildAfterpartyInfo());

            var error = el('p', 'rsvp-card-error');
            error.setAttribute('role', 'alert');
            card.appendChild(error);

            return makeStackCard(card, 'saturday_' + personIdx, {
                back: true,
                next: { label: nextLabel, validate: function () { return validateSaturdayPersonCard(card, personIdx); } }
            });
        }

        // Condensed afterparty FYI, appended to EVERY Saturday person card
        // (not a standalone card of its own, and not tied to that person's
        // accept/decline — it's informational regardless). Hand-built
        // rather than reusing makeCardEventMeta/makeWhenLines, since those
        // render a fuller venue+address+dress-tag+two-line-date block than
        // this 5-line condensed version wants.
        function buildAfterpartyInfo() {
            var wrap = el('div', 'rsvp-card-afterparty');
            wrap.appendChild(el('p', 'rsvp-card-meal-label', 'Afterparty'));
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

            wrap.appendChild(el('p', 'weekend-event-note', AFTERPARTY_DETAILS.note));
            return wrap;
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

        function validateSaturdayPersonCard(card, personIdx) {
            var error = card.querySelector('.rsvp-card-error');
            error.classList.remove('show');
            var name = invitation.people[personIdx];
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

            reviewSubmitBtn = el('button', 'btn-priority rsvp-submit', 'Send RSVP');
            reviewSubmitBtn.type = 'button';
            reviewSubmitBtn.addEventListener('click', onSubmit);
            card.appendChild(reviewSubmitBtn);

            return makeStackCard(card, 'review', { back: true, next: null });
        }

        function mealLabelFor(key) {
            for (var i = 0; i < MEAL_OPTIONS.length; i++) {
                if (MEAL_OPTIONS[i].key === key) { return MEAL_OPTIONS[i].label; }
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
                        var mealText = (person.mealKosher ? 'Kosher ' : '') + mealLabelFor(person.meal);
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
                    // Build thanks now (not pre-built with the rest of the stack)
                    // so it's never visible at the stack edges before the send
                    // actually succeeds. buildThanksPanel pre-positions it at the
                    // deepest slot instantly, so it's correctly hidden the moment
                    // it's added, then this fileForward reveals it.
                    buildThanksPanel();
                    buildSummaryInto(thanksSummary, data);
                    fileForward(stack, function () {
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
                "Your RSVP has been received. We can't wait to celebrate with you!"));

            thanksSummary = el('div', 'rsvp-review-summary');
            card.appendChild(thanksSummary);

            var startOver = el('button', 'schedule-link rsvp-start-over', 'Start Over');
            startOver.type = 'button';
            // The intro is session-gated (intro-seen in sessionStorage,
            // js/rive-intro.js), so reload() lands instantly on the settled
            // invitation with completely fresh flow state (the
            // settleInstant bail path) — no intro replay. The backend is
            // append-only with latest-timestamp-wins reconciliation
            // (docs/decisions.md, "Backend rewrite — lookup endpoint +
            // per-person rows," July 11 2026), so resubmitting is the
            // designed correction path: no stack-teardown code needed, no
            // interaction with `submitted`.
            startOver.addEventListener('click', function () { location.reload(); });
            card.appendChild(startOver);

            var wrapper = makeStackCard(card, 'thanks', { back: false, next: null });
            // Insert at index 1 (the "next" slot), NOT pushed to the end —
            // fileForward always promotes whatever is at index 1 to the new
            // top when it shifts the current top (review) out, so thanks
            // must be sitting right there for the reveal to land on it
            // rather than on the next already-filed event card.
            stack.splice(1, 0, wrapper);
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
            // IS the click target that starts the flow (see onForwardClick)
            // — it can't be inert. The invitation sits above it everywhere the two
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
            lookupWrapper.addEventListener('click', onForwardClick);
            arrowBtn.addEventListener('click', onForwardClick);
            backBtn.addEventListener('click', function () {
                if (!stackNavInfoFor(stack[0]).back) { return; }
                fileBackward(stack, afterMove);
            });
            // Desktop's own per-card control on the invitation itself (see
            // rsvp.html) — not built by makeStackCard since the invitation
            // isn't a stack-built card. Reuses onForwardClick unchanged; it
            // already correctly no-ops once the invitation isn't top.
            var invitationNavNext = document.getElementById('invitation-nav-next');
            if (invitationNavNext) { invitationNavNext.addEventListener('click', onForwardClick); }
        }
    });
})();
