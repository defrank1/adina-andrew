/* ===========================================================================
   RSVP form — front-end logic (rsvp-internal.html)
   ---------------------------------------------------------------------------
   Lookup is by EMAIL. An invitation (one email) covers one or two named people
   (e.g. a couple). After lookup, the form builds a block PER PERSON:
       - the person's name as the heading
       - accept/decline for each event the invitation is invited to
       - a meal choice (always shown)
   No party-size field (it's implied by the named people), no dietary text, no
   song request.

   Two seams isolate the backend so this works front-end-only today and flips to
   the live private backend later with no structural change:

     searchInvitations(query) -> Promise<[{ email, invitedTo, people:[name,...] }]>
     submitRsvp(formData)     -> Promise<void>

   THIS VERSION (staging): searchInvitations resolves from the PLACEHOLDER list
   below; submitRsvp is a no-op stub that just resolves. The real list lives only
   in the private Google Sheet — in the backend session these two functions call
   the Apps Script (JSONP search + POST submit) and the placeholder is deleted.
   =========================================================================== */
(function () {
    'use strict';

    // ---- CONFIG ------------------------------------------------------------
    var MIN_QUERY = 3;       // min characters before searching (limits enumeration)
    var DEBOUNCE_MS = 180;

    var EVENT_NAMES = {
        friday: 'Friday Welcome Drinks',
        saturday: 'Saturday Wedding',
        sunday: 'Sunday Brunch'
    };

    // PLACEHOLDER meal options — replace with the real three entrées.
    var MEAL_OPTIONS = [
        { key: 'beef', label: 'Filet of beef' },
        { key: 'fish', label: 'Pan-seared salmon' },
        { key: 'veg', label: 'Wild mushroom risotto' }
    ];

    // ---- PLACEHOLDER DATA (staging only — NOT real guests) -----------------
    // Same shape the backend search will return: email -> invited events + the
    // one or two named people on that invitation. No real names/emails.
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
        var matches = PLACEHOLDER_INVITATIONS.filter(function (inv) {
            return inv.email.toLowerCase().indexOf(q) !== -1;
        });
        return Promise.resolve(matches);
    }

    function submitRsvp(formData) {
        console.log('RSVP (staging — not sent):', formData);
        return Promise.resolve();
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

            if (selectedInvitation && term !== selectedInvitation.email) {
                clearSelection();
            }

            if (debounceTimer) { clearTimeout(debounceTimer); }

            if (term.length < MIN_QUERY) {
                hideSuggestions();
                return;
            }

            debounceTimer = setTimeout(function () {
                searchInvitations(term).then(displaySuggestions);
            }, DEBOUNCE_MS);
        });

        function displaySuggestions(invitations) {
            emailSuggestions.innerHTML = '';

            if (!invitations || invitations.length === 0) {
                var empty = document.createElement('div');
                empty.className = 'guest-suggestion-item guest-suggestion-empty';
                empty.textContent = "No match found — check the email on your invitation.";
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

                // One accept/decline group per invited event
                invited.forEach(function (eventKey) {
                    block.appendChild(makeChoiceGroup(
                        EVENT_NAMES[eventKey],
                        'p' + idx + '_' + eventKey,
                        [
                            { value: 'yes', label: 'Joyfully accepts' },
                            { value: 'no', label: 'Regretfully declines' }
                        ]
                    ));
                });

                // Meal choice — always shown
                block.appendChild(makeChoiceGroup(
                    'Meal choice',
                    'p' + idx + '_meal',
                    MEAL_OPTIONS.map(function (m) { return { value: m.key, label: m.label }; }),
                    'meal-group'
                ));

                peopleContainer.appendChild(block);
            });
        }

        // Build a labelled radio group (used for events and the meal choice).
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
                var labelEl = document.createElement('label');
                labelEl.className = 'radio-label';

                var input = document.createElement('input');
                input.type = 'radio';
                input.name = name;
                input.value = choice.value;

                var span = document.createElement('span');
                span.textContent = choice.label;

                labelEl.appendChild(input);
                labelEl.appendChild(span);
                radios.appendChild(labelEl);
            });

            group.appendChild(radios);
            return group;
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

                // Every invited event must be answered for every person.
                for (var e2 = 0; e2 < invited.length; e2++) {
                    var key = invited[e2];
                    var checked = document.querySelector('input[name="p' + idx + '_' + key + '"]:checked');
                    if (!checked) {
                        alert('Please respond to ' + EVENT_NAMES[key] + ' for ' + name + '.');
                        return;
                    }
                    events[key] = checked.value;
                }

                // Meal required only when attending the Saturday wedding (the dinner).
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
