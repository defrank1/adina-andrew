/* ===========================================================================
   RSVP card flow — front-end logic (rsvp.html)
   ---------------------------------------------------------------------------
   The sequenced card-based RSVP that grows out of the settled invitation page.
   After the Metro intro settles, the RSVP arrow (built into rsvp.html) slides
   the invitation off-screen left and enters a left-shifting track of floating
   reply cards:

     email lookup -> one card per INVITED event (EVENT_ORDER) -> review & send
     -> thank-you

   steps = ['email', ...invitedEvents, 'review', 'thanks']; cards for
   non-invited events are never built. Responses are per person (an invitation
   covers one or two named people). The email autocomplete keeps the staging
   form's privacy rule: no lookup until the guest has typed past the "@".

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
    var SLIDE_MS = 600;                      // matches the CSS track transition
    var REPLY_BY = 'the first of September'; // September 1, 2026 (confirmed)

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
            venue: 'Willowsong at InterContinental Washington, DC — The Wharf',
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
        var flowEl = document.getElementById('rsvp-flow');
        var track = document.getElementById('rsvp-flow-track');
        var arrowBtn = document.getElementById('rsvp-arrow');
        var endState = document.getElementById('invitation-endstate');
        if (!flowEl || !track || !arrowBtn) { return; }

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
        var steps = ['email'];        // parallel to `panels`
        var panels = [];              // one .rsvp-panel element per step
        var stepIndex = 0;
        var flowStarted = false;
        var submitted = false;

        // ---- email card (panel 0, always present) ----

        var emailInput, emailSuggestions;
        var debounceTimer = null;

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

            emailInput.addEventListener('input', onEmailInput);
            document.addEventListener('click', function (e) {
                if (!emailInput.contains(e.target) && !emailSuggestions.contains(e.target)) {
                    hideSuggestions();
                }
            });

            return appendPanel('email', card);
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
        function selectInvitation(inv) {
            invitation = inv;
            emailInput.value = inv.email;
            hideSuggestions();
            buildInvitationPanels(inv);
            goToStep(1);
        }

        function clearSelection() {
            invitation = null;
            removePanelsAfterEmail();
        }

        // ---- panel plumbing ----

        function appendPanel(stepKey, card) {
            var panel = el('section', 'rsvp-panel');
            panel.dataset.step = stepKey;
            panel.appendChild(card);
            track.appendChild(panel);
            steps[panels.length] = stepKey;
            panels.push(panel);
            return panel;
        }

        function removePanelsAfterEmail() {
            while (panels.length > 1) {
                var panel = panels.pop();
                if (panel.parentNode) { panel.parentNode.removeChild(panel); }
            }
            steps = ['email'];
            stepIndex = 0;
        }

        function buildInvitationPanels(inv) {
            removePanelsAfterEmail();
            var invited = EVENT_ORDER.filter(function (key) {
                return (inv.invitedTo || []).indexOf(key) !== -1;
            });
            invited.forEach(function (key, i) {
                buildEventPanel(inv, key, i === invited.length - 1);
            });
            buildReviewPanel(inv);
            buildThanksPanel();
        }

        function backButton() {
            var btn = el('button', 'rsvp-card-back');
            btn.type = 'button';
            btn.setAttribute('aria-label', 'Back');
            btn.innerHTML = ARROW_LEFT;
            btn.addEventListener('click', function () {
                if (stepIndex > 0) { goToStep(stepIndex - 1); }
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

        // ---- event cards ----

        function buildEventPanel(inv, eventKey, isLast) {
            var detail = EVENT_DETAILS[eventKey];
            var card = el('div', 'rsvp-card');
            card.tabIndex = -1;
            card.dataset.event = eventKey;

            card.appendChild(backButton());
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

            card.appendChild(nextButton(isLast ? 'Review' : 'Next', function () {
                if (validateEventCard(card, eventKey)) {
                    error.classList.remove('show');
                    goToStep(stepIndex + 1);
                }
            }));

            return appendPanel(eventKey, card);
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

            card.appendChild(backButton());
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

            return appendPanel('review', card);
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
                    submitted = true;
                    buildSummaryInto(thanksSummary, data);
                    goToStep(steps.indexOf('thanks'));
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

            return appendPanel('thanks', card);
        }

        // ---- track mechanics ----

        function goToStep(i) {
            if (i < 0 || i >= panels.length) { return; }
            // No sliding back out of the thank-you card.
            if (submitted && steps[i] !== 'thanks') { return; }
            stepIndex = i;

            // The review summary reflects whatever the radios say right now.
            if (steps[i] === 'review') {
                buildSummaryInto(reviewSummary, collectData());
            }

            panels.forEach(function (panel, idx) {
                var active = idx === i;
                panel.classList.toggle('active', active);
                // Keep keyboard focus and readers out of off-screen panels.
                if (active) {
                    panel.removeAttribute('inert');
                    panel.removeAttribute('aria-hidden');
                } else {
                    panel.setAttribute('inert', '');
                    panel.setAttribute('aria-hidden', 'true');
                }
            });

            track.style.transform = 'translateX(-' + (i * 100) + '%)';
            window.scrollTo(0, 0);

            var card = panels[i].querySelector('.rsvp-card');
            if (card) {
                setTimeout(function () {
                    card.focus({ preventScroll: true });
                }, prefersReduced ? 0 : SLIDE_MS + 20);
            }
        }

        // ---- entering the flow ----

        function enterFlow() {
            if (flowStarted) { return; }
            flowStarted = true;

            flowEl.hidden = false;
            document.body.classList.add('rsvp-flow-active');

            // The invitation slides off-screen left (CSS, keyed to
            // .rsvp-flow-active) while the email panel slides in from the right —
            // one continuous leftward shift. Start the track one stage-width
            // right, force a layout, then move it home so the transition runs.
            if (prefersReduced) {
                track.style.transform = 'translateX(0%)';
                if (endState) { endState.classList.add('rsvp-offstage'); }
            } else {
                track.style.transform = 'translateX(100%)';
                void track.offsetWidth;
                requestAnimationFrame(function () {
                    track.style.transform = 'translateX(0%)';
                });
                // Park the end-state once it has fully slid out (fallback timer in
                // case transitionend never fires).
                var parked = false;
                function park() {
                    if (parked || !endState) { return; }
                    parked = true;
                    endState.classList.add('rsvp-offstage');
                }
                if (endState) {
                    endState.addEventListener('transitionend', function handler(e) {
                        if (e.target !== endState || e.propertyName !== 'transform') { return; }
                        endState.removeEventListener('transitionend', handler);
                        park();
                    });
                }
                setTimeout(park, SLIDE_MS + 150);
            }

            goToStep(0);
            setTimeout(function () {
                if (emailInput) { emailInput.focus({ preventScroll: true }); }
            }, prefersReduced ? 0 : SLIDE_MS + 40);
        }

        buildEmailPanel();
        goToStep(0);                 // sets active/inert state without moving anything
        arrowBtn.addEventListener('click', enterFlow);
    });
})();
