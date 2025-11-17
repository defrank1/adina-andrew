// RSVP Form with Autocomplete Search and Individual Event RSVPs
document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const form = document.getElementById('rsvpForm');
    const guestSearchInput = document.getElementById('guestSearch');
    const guestSuggestions = document.getElementById('guestSuggestions');
    const selectedGuestIdInput = document.getElementById('selectedGuestId');
    const mainForm = document.getElementById('mainForm');
    const attendingDetails = document.getElementById('attendingDetails');
    const guestCountSelect = document.getElementById('guestCount');
    const confirmationMessage = document.getElementById('confirmationMessage');

    // Event groups
    const fridayGroup = document.getElementById('fridayGroup');
    const saturdayGroup = document.getElementById('saturdayGroup');
    const sundayGroup = document.getElementById('sundayGroup');

    // Event radio buttons
    const eventRadios = document.querySelectorAll('.event-radio');

    let selectedGuest = null;
    let filteredGuests = [];

    // ====== AUTOCOMPLETE FUNCTIONALITY ======

    // Handle typing in search box
    guestSearchInput.addEventListener('input', function() {
        const searchTerm = this.value.trim().toLowerCase();

        // If empty, clear suggestions and hide
        if (searchTerm === '') {
            guestSuggestions.style.display = 'none';
            guestSuggestions.innerHTML = '';
            clearSelection();
            return;
        }

        // Filter guests by search term
        filteredGuests = guestList.filter(guest =>
            guest.name.toLowerCase().includes(searchTerm)
        );

        // Display filtered suggestions
        displaySuggestions(filteredGuests);
    });

    // Display guest suggestions
    function displaySuggestions(guests) {
        guestSuggestions.innerHTML = '';

        if (guests.length === 0) {
            guestSuggestions.style.display = 'none';
            return;
        }

        guests.forEach(guest => {
            const div = document.createElement('div');
            div.className = 'guest-suggestion-item';
            div.textContent = guest.name;
            div.dataset.guestId = guest.id;

            // Click handler for selection
            div.addEventListener('click', function() {
                selectGuest(guest);
            });

            guestSuggestions.appendChild(div);
        });

        guestSuggestions.style.display = 'block';
    }

    // Select a guest from suggestions
    function selectGuest(guest) {
        selectedGuest = guest;
        guestSearchInput.value = guest.name;
        selectedGuestIdInput.value = guest.id;
        guestSuggestions.style.display = 'none';
        guestSuggestions.innerHTML = '';

        // Show the form for this guest
        showFormForGuest(guest);
    }

    // Clear selection
    function clearSelection() {
        selectedGuest = null;
        selectedGuestIdInput.value = '';
        mainForm.style.display = 'none';
        attendingDetails.style.display = 'none';
    }

    // Close suggestions when clicking outside
    document.addEventListener('click', function(e) {
        if (!guestSearchInput.contains(e.target) && !guestSuggestions.contains(e.target)) {
            guestSuggestions.style.display = 'none';
        }
    });

    // ====== FORM DISPLAY FOR SELECTED GUEST ======

    function showFormForGuest(guest) {
        // Pre-fill email if available
        const emailInput = document.getElementById('email');
        if (guest.email) {
            emailInput.value = guest.email;
        } else {
            emailInput.value = '';
        }

        // Show/hide event groups based on invitation
        fridayGroup.style.display = guest.invitedTo.includes('friday') ? 'block' : 'none';
        saturdayGroup.style.display = guest.invitedTo.includes('saturday') ? 'block' : 'none';
        sundayGroup.style.display = guest.invitedTo.includes('sunday') ? 'block' : 'none';

        // Populate guest count dropdown
        populateGuestCount(guest.maxGuests);

        // Reset event selections
        resetEventSelections();

        // Show main form
        mainForm.style.display = 'block';
    }

    // Populate guest count options
    function populateGuestCount(maxGuests) {
        guestCountSelect.innerHTML = '<option value="">Select number</option>';

        for (let i = 1; i <= maxGuests; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i === 1 ? '1 Guest' : `${i} Guests`;
            guestCountSelect.appendChild(option);
        }
    }

    // Reset all event radio selections
    function resetEventSelections() {
        eventRadios.forEach(radio => {
            radio.checked = false;
        });
        attendingDetails.style.display = 'none';
    }

    // ====== INDIVIDUAL EVENT RSVP LOGIC ======

    // Monitor event radio changes
    eventRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            checkIfAnyEventAccepted();
        });
    });

    // Check if any event has been accepted (yes)
    function checkIfAnyEventAccepted() {
        const anyYes = Array.from(eventRadios).some(radio =>
            radio.checked && radio.value === 'yes'
        );

        // Show attending details (guest count, dietary, etc.) if any event accepted
        if (anyYes) {
            attendingDetails.style.display = 'block';
        } else {
            attendingDetails.style.display = 'none';
        }
    }

    // ====== FORM SUBMISSION ======

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        if (!selectedGuest) {
            alert('Please search for and select your name from the suggestions.');
            return;
        }

        // Check that they've responded to at least one event they're invited to
        const invitedEvents = selectedGuest.invitedTo;
        let hasResponded = false;

        invitedEvents.forEach(eventKey => {
            const radioChecked = document.querySelector(`input[name="${eventKey}Attending"]:checked`);
            if (radioChecked) {
                hasResponded = true;
            }
        });

        if (!hasResponded) {
            alert('Please RSVP to at least one event.');
            return;
        }

        // Collect form data
        const formData = {
            guestId: selectedGuest.id,
            guestName: selectedGuest.name,
            email: document.getElementById('email').value,
            events: {}
        };

        // Collect individual event responses
        invitedEvents.forEach(eventKey => {
            const radioChecked = document.querySelector(`input[name="${eventKey}Attending"]:checked`);
            if (radioChecked) {
                formData.events[eventKey] = radioChecked.value;
            } else {
                formData.events[eventKey] = 'not answered';
            }
        });

        // Check if attending any event
        const attendingAny = Object.values(formData.events).includes('yes');

        if (attendingAny) {
            // Collect guest count
            const guestCount = document.getElementById('guestCount').value;
            if (!guestCount) {
                alert('Please select the number of guests attending.');
                return;
            }
            formData.guestCount = guestCount;
            formData.dietary = document.getElementById('dietary').value;
            formData.songRequest = document.getElementById('songRequest').value;
        }

        formData.message = document.getElementById('message').value;

        // Log form data (in production, send to server/Google Sheets)
        console.log('RSVP Submission:', formData);

        // TODO: In production, integrate with:
        // - Squarespace form submission
        // - Google Sheets via Google Apps Script
        // - A backend API
        // - Email service

        // Example: Sending to Google Sheets
        // fetch('YOUR_GOOGLE_APPS_SCRIPT_URL', {
        //     method: 'POST',
        //     body: JSON.stringify(formData),
        //     headers: {
        //         'Content-Type': 'application/json'
        //     }
        // })
        // .then(response => response.json())
        // .then(data => {
        //     form.style.display = 'none';
        //     confirmationMessage.style.display = 'block';
        // })
        // .catch(error => {
        //     console.error('Error:', error);
        //     alert('There was an error submitting your RSVP. Please try again.');
        // });

        // For now, show confirmation message
        form.style.display = 'none';
        confirmationMessage.style.display = 'block';
        confirmationMessage.scrollIntoView({ behavior: 'smooth' });
    });
});
