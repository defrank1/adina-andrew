/* ===========================================================================
   RSVP form — front-end logic (rsvp-internal.html)
   ---------------------------------------------------------------------------
   Lookup is by EMAIL. An invitation (one email) covers one or two named people.
   After lookup the form renders in two parts:

     Part A — "The Weekend" reference block (ONCE): each invited event's full
              logistics (when / name / where / dress / description). The Saturday
              afterparty appears here as info only (no RSVP). No radios.
     Part B — per-person compact decision rows: one row per invited RSVP event
              (event name + accept/decline) and a meal-choice row. Logistics are
              NOT reprinted per person.

   Two seams isolate the backend so this works front-end-only today and flips to
   the live private backend later with no structural change:

     searchInvitations(query) -> Promise<[{ email, invitedTo, people:[name,...] }]>
     submitRsvp(formData)     -> Promise<void>

   THIS VERSION (staging): searchInvitations resolves from the PLACEHOLDER list;
   submitRsvp is a no-op stub. The real list lives only in the private Google
   Sheet — the backend session points these two functions at the Apps Script.
   =========================================================================== */
(function () {
    'use strict';

    // ---- CONFIG ------------------------------------------------------------
    var MIN_QUERY = 3;
    var DEBOUNCE_MS = 180;

    var EVENT_DETAILS = {
        friday: {
            name: 'Welcome Party',
            when: 'Friday, October 16th · 8:00–10:00 PM',
            venue: 'Sonoma Restaurant & Wine Bar',
            address: '223 Pennsylvania Avenue SE',
            mapUrl: 'https://maps.google.com/?q=223+Pennsylvania+Avenue+SE+Washington+DC',
            dress: 'Semi-Formal',
            dressNote: 'Sport coats and trousers, or dresses, jumpsuits, and blouses',
            description: "Please join us to kick off the weekend! We're hosting a welcome party at a wine bar on Capitol Hill. There will be drinks and light bites, but please make dinner plans beforehand."
        },
        saturday: {
            name: 'Wedding Ceremony and Reception',
            when: 'Saturday, October 17th · 5:30–11:00 PM',
            venue: 'InterContinental Washington, DC — The Wharf',
            address: '801 Wharf Street SW',
            mapUrl: 'https://maps.google.com/?q=801+Wharf+Street+SW+Washington+DC',
            dress: 'Black Tie Preferred',
            description: 'Please arrive early, as the ceremony will begin promptly at 5:30 PM.'
        },
        sunday: {
            name: 'Farewell Brunch',
            when: 'Sunday, October 18th · 9:00–11:00 AM',
            venue: 'Willowsong at InterContinental Washington, DC — The Wharf',
            address: '801 Wharf Street SW',
            mapUrl: 'https://maps.google.com/?q=801+Wharf+Street+SW+Washington+DC',
            dress: 'Come as you are',
            description: "Please join us for breakfast before you leave town. We'll be at the hotel restaurant on the first floor."
        }
    };

    // Info-only block shown after the Saturday wedding (no accept/decline, no dress tag).
    var AFTERPARTY_DETAILS = {
        name: 'Wedding Afterparty',
        when: 'Saturday, October 17th · 11:00 PM – 1:00 AM',
        venue: "Kirwan's on the Wharf",
        address: '749 Wharf Street SW, Second Floor',
        mapUrl: 'https://maps.google.com/?q=749+Wharf+Street+SW+Washington+DC',
        description: "We'll be keeping the party going just across the street at Kirwan's, an Irish pub. The second floor will be reserved for us."
    };

    var EVENT_ORDER = ['friday', 'saturday', 'sunday'];

    // PLACEHOLDER meal options — replace with the real three entrées.
    var MEAL_OPTIONS = [
        { key: 'beef', label: 'Filet of beef' },
        { key: 'fish', label: 'Pan-seared salmon' },
        { key: 'veg', label: 'Wild mushroom risotto' }
    ];

    // ---- PLACEHOLDER DATA (staging only — NOT real guests) -----------------
    var PLACEHOLDER_INVITATIONS = [
        { email: 'john.smith@example.com', invitedTo: ['friday', 'saturday', 'sunday'], people: ['John Smith', 'Jane Smith'] },
        { email: 'mchen@example.com', invitedTo: ['saturday'], people: ['Michael Chen'] },
        { email: 'the.johnsons@example.com', invitedTo: ['friday', 'saturday', 'sunday'], people: ['Robert Johnson', 'Patricia Johnson'] },
        { email: 'laura.nelson@example.com', invitedTo: ['friday', 'saturday', 'sunday'], people: ['Laura Nelson'] },
        { email: 'williams.party@example.com', invitedTo: ['saturday', 'sunday'], people: ['Sarah Williams', 'Tom Williams'] }
    ];

    // ---- BACKEND SEAMS -----------------------------------------------------

    function searchInvitations(query) {
        var q = query.trim().toLowerCase();
        return Promise.resolve(PLACEHOLDER_INVITATIONS.filter(function (inv) {
            return inv.email.toLowerCase().indexOf(q) !== -1;
        }));
    }

    function submitRsvp(formData) {
        console.log('RSVP (staging — not sent):', formData);
        return Promise.resolve();
    }

    // ---- Part A: "The Weekend" reference block -----------------------------

    function makeReferenceEvent(detail, isInfo) {
        var ev = document.createElement('div');
        ev.className = 'weekend-event';

        var when = document.createElement('p');
        when.className = 'weekend-event-when';
        when.textContent = detail.when;
        ev.appendChild(when);

        var name = document.createElement('h3');
        name.className = 'weekend-event-name';
        name.textContent = detail.name;
        ev.appendChild(name);

        var where = document.createElement('p');
        where.className = 'weekend-event-where';
        where.appendChild(document.createTextNode(detail.venue));
        where.appendChild(document.createElement('br'));
        var a = document.createElement('a');
        a.className = 'schedule-link';
        a.href = detail.mapUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = detail.address;
        where.appendChild(a);
        ev.appendChild(where);

        if (!isInfo && detail.dress) {
            var dress = document.createElement('span');
            dress.className = 'weekend-event-dress';
            dress.textContent = detail.dress;
            ev.appendChild(dress);
        }

        // Dress description — Welcome Party (Friday) only; never Saturday/Sunday.
        if (detail.dressNote) {
            var dnote = document.createElement('p');
            dnote.className = 'weekend-event-dress-note';
            dnote.textContent = detail.dressNote;
            ev.appendChild(dnote);
        }

        if (detail.description) {
            var desc = document.createElement('p');
            desc.className = 'schedule-event-description';
            desc.textContent = detail.description;
            ev.appendChild(desc);
        }

        if (isInfo) {
            var note = document.createElement('p');
            note.className = 'weekend-event-note';
            note.textContent = 'Everyone is welcome — no RSVP needed';
            ev.appendChild(note);
        }

        return ev;
    }

    // ---- Part B: compact decision rows -------------------------------------

    function makeChoiceRow(labelText, name, choices) {
        var row = document.createElement('div');
        row.className = 'rsvp-choice-row';

        var label = document.createElement('span');
        label.className = 'rsvp-choice-label';
        label.textContent = labelText;
        row.appendChild(label);

        var options = document.createElement('div');
        options.className = 'rsvp-choice-options';
        choices.forEach(function (choice) {
            options.appendChild(radioLabel(name, choice.value, choice.label));
        });
        row.appendChild(options);
        return row;
    }

    function radioLabel(name, value, labelText) {
        var labelEl = document.createElement('label');
        labelEl.className = 'radio-label';
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = name;
        input.value = value;
        var span = document.createElement('span');
        span.textContent = labelText;
        labelEl.appendChild(input);
        labelEl.appendChild(span);
        return labelEl;
    }

    // ---- BOOT --------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', function () {
        var form = document.getElementById('rsvpForm');
        if (!form) { return; }

        var emailSearchInput = document.getElementById('emailSearch');
        var emailSuggestions = document.getElementById('emailSuggestions');
        var mainForm = document.getElementById('mainForm');
        var weekendContainer = document.getElementById('weekendContainer');
        var peopleContainer = document.getElementById('peopleContainer');
        var confirmationMessage = document.getElementById('confirmationMessage');

        var selectedInvitation = null;
        var debounceTimer = null;

        // ====== EMAIL AUTOCOMPLETE ======

        emailSearchInput.addEventListener('input', function () {
            var term = this.value.trim();
            if (selectedInvitation && term !== selectedInvitation.email) { clearSelection(); }
            if (debounceTimer) { clearTimeout(debounceTimer); }
            if (term.length < MIN_QUERY) { hideSuggestions(); return; }
            debounceTimer = setTimeout(function () {
                searchInvitations(term).then(displaySuggestions);
            }, DEBOUNCE_MS);
        });

        function displaySuggestions(invitations) {
            emailSuggestions.innerHTML = '';
            if (!invitations || invitations.length === 0) {
                var empty = document.createElement('div');
                empty.className = 'guest-suggestion-item guest-suggestion-empty';
                empty.textContent = 'No match found — check the email on your invitation.';
                emailSuggestions.appendChild(empty);
                emailSuggestions.style.display = 'block';
                return;
            }
            invitations.forEach(function (inv) {
                var div = document.createElement('div');
                div.className = 'guest-suggestion-item';
                div.textContent = inv.email;
                div.addEventListener('click', function () { selectInvitation(inv); });
                emailSuggestions.appendChild(div);
            });
            emailSuggestions.style.display = 'block';
        }

        function hideSuggestions() {
            emailSuggestions.style.display = 'none';
            emailSuggestions.innerHTML = '';
        }

        function selectInvitation(inv) {
            selectedInvitation = inv;
            emailSearchInput.value = inv.email;
            hideSuggestions();
            buildWeekend(inv);
            buildPeople(inv);
            mainForm.style.display = 'block';
        }

        function clearSelection() {
            selectedInvitation = null;
            weekendContainer.innerHTML = '';
            peopleContainer.innerHTML = '';
            mainForm.style.display = 'none';
        }

        document.addEventListener('click', function (e) {
            if (!emailSearchInput.contains(e.target) && !emailSuggestions.contains(e.target)) {
                hideSuggestions();
            }
        });

        // ====== PART A: reference block (once) ======

        function buildWeekend(inv) {
            weekendContainer.innerHTML = '';
            var invited = inv.invitedTo || [];

            var eyebrow = document.createElement('p');
            eyebrow.className = 'rsvp-section-label';
            eyebrow.textContent = 'The Weekend';
            weekendContainer.appendChild(eyebrow);

            EVENT_ORDER.forEach(function (key) {
                if (invited.indexOf(key) === -1) { return; }
                weekendContainer.appendChild(makeReferenceEvent(EVENT_DETAILS[key], false));
                // The afterparty follows the Saturday wedding (info only).
                if (key === 'saturday') {
                    weekendContainer.appendChild(makeReferenceEvent(AFTERPARTY_DETAILS, true));
                }
            });
        }

        // ====== PART B: per-person decision rows ======

        function buildPeople(inv) {
            peopleContainer.innerHTML = '';
            var invited = inv.invitedTo || [];

            (inv.people || []).forEach(function (name, idx) {
                var block = document.createElement('div');
                block.className = 'person-block';

                var heading = document.createElement('p');
                heading.className = 'event-rsvp-heading person-name';
                heading.textContent = name;
                block.appendChild(heading);

                EVENT_ORDER.forEach(function (key) {
                    if (invited.indexOf(key) === -1) { return; }
                    block.appendChild(makeChoiceRow(
                        EVENT_DETAILS[key].name,
                        'p' + idx + '_' + key,
                        [{ value: 'yes', label: 'Joyfully accepts' }, { value: 'no', label: 'Regretfully declines' }]
                    ));
                });

                // Meal = the Saturday reception dinner; only shown to Saturday invitees.
                if (invited.indexOf('saturday') !== -1) {
                    block.appendChild(makeChoiceRow(
                        'Meal choice',
                        'p' + idx + '_meal',
                        MEAL_OPTIONS.map(function (m) { return { value: m.key, label: m.label }; })
                    ));
                }

                peopleContainer.appendChild(block);
            });
        }

        // ====== SUBMIT ======

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            if (!selectedInvitation) {
                alert('Please find and select your invitation by email first.');
                emailSearchInput.focus();
                return;
            }

            var invited = selectedInvitation.invitedTo || [];
            var people = [];

            for (var idx = 0; idx < selectedInvitation.people.length; idx++) {
                var name = selectedInvitation.people[idx];
                var events = {};

                for (var e2 = 0; e2 < invited.length; e2++) {
                    var key = invited[e2];
                    var checked = document.querySelector('input[name="p' + idx + '_' + key + '"]:checked');
                    if (!checked) {
                        alert('Please respond to ' + EVENT_DETAILS[key].name + ' for ' + name + '.');
                        return;
                    }
                    events[key] = checked.value;
                }

                var meal = '';
                var mealChecked = document.querySelector('input[name="p' + idx + '_meal"]:checked');
                if (mealChecked) { meal = mealChecked.value; }
                if (events.saturday === 'yes' && !meal) {
                    alert('Please choose a meal for ' + name + '.');
                    return;
                }

                people.push({ name: name, events: events, meal: meal });
            }

            var formData = {
                email: selectedInvitation.email,
                people: people,
                message: document.getElementById('message').value.trim()
            };

            submitRsvp(formData)
                .then(function () {
                    form.style.display = 'none';
                    confirmationMessage.style.display = 'block';
                    confirmationMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                })
                .catch(function (err) {
                    console.error('RSVP submit error:', err);
                    alert('There was a problem submitting your RSVP. Please try again, or contact us directly.');
                });
        });
    });
})();
