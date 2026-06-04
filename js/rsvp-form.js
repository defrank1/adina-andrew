/* ===========================================================================
   RSVP form — front-end logic (rsvp-internal.html)
   ---------------------------------------------------------------------------
   Lookup is by EMAIL. An invitation (one email) covers one or two named people.
   After lookup, the form builds a block PER PERSON. Within each person's block,
   every event they're invited to shows schedule-style details (date/time/
   location/dress/description — matching schedule.html) followed by an
   accept/decline. The Saturday Wedding Afterparty is INFO ONLY (no RSVP) and
   appears right after the Saturday wedding. A meal choice (always shown) closes
   each person's block.

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

    // Full schedule-style detail for each RSVP event. Keep in sync with schedule.html.
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
            dressNote: '',
            description: 'Please arrive early, as the ceremony will begin promptly at 5:30 PM.'
        },
        sunday: {
            name: 'Farewell Brunch',
            when: 'Sunday, October 18th · 9:00–11:00 AM',
            venue: 'Willowsong at InterContinental Washington, DC — The Wharf',
            address: '801 Wharf Street SW',
            mapUrl: 'https://maps.google.com/?q=801+Wharf+Street+SW+Washington+DC',
            dress: 'Come as you are',
            dressNote: '',
            description: "Please join us for breakfast before you leave town. We'll be at the hotel restaurant on the first floor."
        }
    };

    // Info-only block shown after the Saturday wedding (no accept/decline).
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

    // ---- small DOM helpers -------------------------------------------------

    function detailLine(text) {
        var p = document.createElement('p');
        p.className = 'schedule-event-detail';
        p.textContent = text;
        return p;
    }

    function venueLine(venue, address, mapUrl) {
        var p = document.createElement('p');
        p.className = 'schedule-event-detail';
        p.appendChild(document.createTextNode(venue));
        p.appendChild(document.createElement('br'));
        var a = document.createElement('a');
        a.className = 'schedule-link';
        a.href = mapUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = address;
        p.appendChild(a);
        return p;
    }

    function descriptionLine(text) {
        var p = document.createElement('p');
        p.className = 'schedule-event-description';
        p.textContent = text;
        return p;
    }

    // The shared schedule-style detail header for an event (name + when + venue).
    function appendEventDetails(group, detail) {
        var name = document.createElement('h3');
        name.className = 'schedule-event-name';
        name.textContent = detail.name;
        group.appendChild(name);

        group.appendChild(detailLine(detail.when));
        group.appendChild(venueLine(detail.venue, detail.address, detail.mapUrl));
        if (detail.dress) { group.appendChild(detailLine(detail.dress)); }
        if (detail.dressNote) { group.appendChild(descriptionLine(detail.dressNote)); }
        if (detail.description) { group.appendChild(descriptionLine(detail.description)); }
    }

    // An RSVP event: schedule details + accept/decline radios.
    function makeEventBlock(detail, radioName) {
        var group = document.createElement('div');
        group.className = 'event-group';
        appendEventDetails(group, detail);

        var radios = document.createElement('div');
        radios.className = 'radio-group';
        [{ value: 'yes', label: 'Joyfully accepts' }, { value: 'no', label: 'Regretfully declines' }]
            .forEach(function (choice) {
                radios.appendChild(radioLabel(radioName, choice.value, choice.label));
            });
        group.appendChild(radios);
        return group;
    }

    // The info-only afterparty: schedule details + a "no RSVP needed" note.
    function makeInfoBlock(detail) {
        var group = document.createElement('div');
        group.className = 'event-group event-info';
        appendEventDetails(group, detail);
        var note = detailLine('Everyone is welcome — no RSVP needed');
        note.classList.add('event-info-note');
        group.appendChild(note);
        return group;
    }

    // A labelled radio group (used for the meal choice).
    function makeChoiceGroup(labelText, name, choices, extraClass) {
        var group = document.createElement('div');
        group.className = 'event-group' + (extraClass ? ' ' + extraClass : '');

        var label = document.createElement('p');
        label.className = 'event-label';
        label.textContent = labelText;
        group.appendChild(label);

        var radios = document.createElement('div');
        radios.className = 'radio-group';
        choices.forEach(function (choice) {
            radios.appendChild(radioLabel(name, choice.value, choice.label));
        });
        group.appendChild(radios);
        return group;
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
            buildPeople(inv);
            mainForm.style.display = 'block';
        }

        function clearSelection() {
            selectedInvitation = null;
            peopleContainer.innerHTML = '';
            mainForm.style.display = 'none';
        }

        document.addEventListener('click', function (e) {
            if (!emailSearchInput.contains(e.target) && !emailSuggestions.contains(e.target)) {
                hideSuggestions();
            }
        });

        // ====== PER-PERSON BLOCKS ======

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
                    block.appendChild(makeEventBlock(EVENT_DETAILS[key], 'p' + idx + '_' + key));
                    // The afterparty follows the Saturday wedding (info only).
                    if (key === 'saturday') { block.appendChild(makeInfoBlock(AFTERPARTY_DETAILS)); }
                });

                block.appendChild(makeChoiceGroup(
                    'Meal choice',
                    'p' + idx + '_meal',
                    MEAL_OPTIONS.map(function (m) { return { value: m.key, label: m.label }; }),
                    'meal-group'
                ));

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
