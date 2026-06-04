/* ===========================================================================
   RSVP form — front-end logic (rsvp-internal.html)
   ---------------------------------------------------------------------------
   Adapted from rsvp-workflow/rsvp-script.js. Two seams isolate the backend so
   this whole file works front-end-only today and flips to the live private
   backend later with no structural change:

     searchGuests(query)  -> Promise<[{ name, invitedTo, maxGuests }]>
     submitRsvp(formData) -> Promise<void>

   THIS VERSION (staging): searchGuests resolves from a small PLACEHOLDER list
   below, and submitRsvp is a no-op stub that just resolves. The real guest
   list NEVER lives in the browser — in the backend session these two functions
   call the Google Apps Script (JSONP search + POST submit) and the placeholder
   data is deleted.
   =========================================================================== */
(function () {
    'use strict';

    // ---- CONFIG ------------------------------------------------------------
    var MIN_QUERY = 3;       // minimum characters before searching (limits enumeration)
    var DEBOUNCE_MS = 180;

    // Display names for the three weekend events.
    var EVENT_NAMES = {
        friday: 'Friday Welcome Drinks',
        saturday: 'Saturday Wedding',
        sunday: 'Sunday Brunch'
    };

    // ---- PLACEHOLDER DATA (staging only — NOT real guests) -----------------
    // Same shape the backend search will return. No emails, no ids.
    var PLACEHOLDER_GUESTS = [
        { name: 'John Smith', invitedTo: ['friday', 'saturday', 'sunday'], maxGuests: 2 },
        { name: 'Jane Doe', invitedTo: ['saturday'], maxGuests: 1 },
        { name: 'The Johnson Family', invitedTo: ['friday', 'saturday', 'sunday'], maxGuests: 4 },
        { name: 'Sarah Williams', invitedTo: ['saturday', 'sunday'], maxGuests: 2 },
        { name: 'Michael Chen', invitedTo: ['friday', 'saturday', 'sunday'], maxGuests: 1 },
        { name: 'Emily and David Martinez', invitedTo: ['saturday'], maxGuests: 2 },
        { name: 'Laura Nelson', invitedTo: ['friday', 'saturday', 'sunday'], maxGuests: 2 }
    ];

    // ---- BACKEND SEAMS -----------------------------------------------------

    // Returns guests whose name contains the query. Async on purpose so the
    // call site already behaves like a network request.
    function searchGuests(query) {
        var q = query.trim().toLowerCase();
        var matches = PLACEHOLDER_GUESTS.filter(function (g) {
            return g.name.toLowerCase().indexOf(q) !== -1;
        });
        return Promise.resolve(matches);
    }

    // Staging stub: pretend the submission succeeded. The backend session
    // replaces the body with a POST to the Apps Script web app.
    function submitRsvp(formData) {
        console.log('RSVP (staging — not sent):', formData);
        return Promise.resolve();
    }

    // ---- BOOT --------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', function () {
        var form = document.getElementById('rsvpForm');
        if (!form) { return; }

        var guestSearchInput = document.getElementById('guestSearch');
        var guestSuggestions = document.getElementById('guestSuggestions');
        var selectedGuestIdInput = document.getElementById('selectedGuestId');
        var mainForm = document.getElementById('mainForm');
        var attendingDetails = document.getElementById('attendingDetails');
        var guestCountSelect = document.getElementById('guestCount');
        var confirmationMessage = document.getElementById('confirmationMessage');

        var fridayGroup = document.getElementById('fridayGroup');
        var saturdayGroup = document.getElementById('saturdayGroup');
        var sundayGroup = document.getElementById('sundayGroup');
        var eventRadios = document.querySelectorAll('.event-radio');

        var selectedGuest = null;
        var debounceTimer = null;

        // ====== AUTOCOMPLETE ======

        guestSearchInput.addEventListener('input', function () {
            var term = this.value.trim();

            // Typing a new name invalidates any prior selection.
            if (selectedGuest && term !== selectedGuest.name) {
                clearSelection();
            }

            if (debounceTimer) { clearTimeout(debounceTimer); }

            if (term.length < MIN_QUERY) {
                hideSuggestions();
                return;
            }

            debounceTimer = setTimeout(function () {
                searchGuests(term).then(displaySuggestions);
            }, DEBOUNCE_MS);
        });

        function displaySuggestions(guests) {
            guestSuggestions.innerHTML = '';

            if (!guests || guests.length === 0) {
                guestSuggestions.innerHTML =
                    '<div class="guest-suggestion-item guest-suggestion-empty">No match found — check the spelling on your invitation.</div>';
                guestSuggestions.style.display = 'block';
                return;
            }

            guests.forEach(function (guest) {
                var div = document.createElement('div');
                div.className = 'guest-suggestion-item';
                div.textContent = guest.name;
                div.addEventListener('click', function () { selectGuest(guest); });
                guestSuggestions.appendChild(div);
            });
            guestSuggestions.style.display = 'block';
        }

        function hideSuggestions() {
            guestSuggestions.style.display = 'none';
            guestSuggestions.innerHTML = '';
        }

        function selectGuest(guest) {
            selectedGuest = guest;
            guestSearchInput.value = guest.name;
            if (selectedGuestIdInput) { selectedGuestIdInput.value = guest.name; }
            hideSuggestions();
            showFormForGuest(guest);
        }

        function clearSelection() {
            selectedGuest = null;
            if (selectedGuestIdInput) { selectedGuestIdInput.value = ''; }
            mainForm.style.display = 'none';
            attendingDetails.style.display = 'none';
        }

        // Close suggestions when clicking outside the search field.
        document.addEventListener('click', function (e) {
            if (!guestSearchInput.contains(e.target) && !guestSuggestions.contains(e.target)) {
                hideSuggestions();
            }
        });

        // ====== FORM FOR SELECTED GUEST ======

        function showFormForGuest(guest) {
            var invited = guest.invitedTo || [];
            fridayGroup.style.display = invited.indexOf('friday') !== -1 ? 'block' : 'none';
            saturdayGroup.style.display = invited.indexOf('saturday') !== -1 ? 'block' : 'none';
            sundayGroup.style.display = invited.indexOf('sunday') !== -1 ? 'block' : 'none';

            populateGuestCount(guest.maxGuests || 1);
            resetEventSelections();
            mainForm.style.display = 'block';
        }

        function populateGuestCount(maxGuests) {
            guestCountSelect.innerHTML = '<option value="">Select number</option>';
            for (var i = 1; i <= maxGuests; i++) {
                var option = document.createElement('option');
                option.value = i;
                option.textContent = i === 1 ? '1 guest' : i + ' guests';
                guestCountSelect.appendChild(option);
            }
        }

        function resetEventSelections() {
            eventRadios.forEach(function (radio) { radio.checked = false; });
            attendingDetails.style.display = 'none';
        }

        // ====== CONDITIONAL DETAILS ======

        eventRadios.forEach(function (radio) {
            radio.addEventListener('change', checkIfAnyEventAccepted);
        });

        function checkIfAnyEventAccepted() {
            var anyYes = Array.prototype.some.call(eventRadios, function (radio) {
                return radio.checked && radio.value === 'yes';
            });
            attendingDetails.style.display = anyYes ? 'block' : 'none';
        }

        // ====== SUBMIT ======

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            if (!selectedGuest) {
                alert('Please find and select your name from the list first.');
                guestSearchInput.focus();
                return;
            }

            var invitedEvents = selectedGuest.invitedTo || [];
            var hasResponded = invitedEvents.some(function (key) {
                return document.querySelector('input[name="' + key + 'Attending"]:checked');
            });
            if (!hasResponded) {
                alert('Please respond to at least one event.');
                return;
            }

            var formData = {
                guestName: selectedGuest.name,
                email: document.getElementById('email').value.trim(),
                events: {}
            };

            invitedEvents.forEach(function (key) {
                var checked = document.querySelector('input[name="' + key + 'Attending"]:checked');
                formData.events[key] = checked ? checked.value : 'not answered';
            });

            var attendingAny = Object.keys(formData.events).some(function (k) {
                return formData.events[k] === 'yes';
            });

            if (attendingAny) {
                var guestCount = document.getElementById('guestCount').value;
                if (!guestCount) {
                    alert('Please select how many guests are attending.');
                    return;
                }
                formData.guestCount = guestCount;
                formData.dietary = document.getElementById('dietary').value.trim();
                formData.songRequest = document.getElementById('songRequest').value.trim();
            }

            formData.message = document.getElementById('message').value.trim();

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
