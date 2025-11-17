// RSVP Form Handling with Guest List
document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const form = document.getElementById('rsvpForm');
    const guestSelect = document.getElementById('guestSelect');
    const invitationDetails = document.getElementById('invitationDetails');
    const invitedEventsList = document.getElementById('invitedEventsList');
    const mainForm = document.getElementById('mainForm');
    const attendingRadios = document.querySelectorAll('input[name="attending"]');
    const attendingDetails = document.getElementById('attendingDetails');
    const guestCountSelect = document.getElementById('guestCount');
    const confirmationMessage = document.getElementById('confirmationMessage');

    // Event groups
    const fridayGroup = document.getElementById('fridayGroup');
    const saturdayGroup = document.getElementById('saturdayGroup');
    const sundayGroup = document.getElementById('sundayGroup');

    let selectedGuest = null;

    // Populate guest dropdown
    function populateGuestDropdown() {
        // Sort guests alphabetically by name
        const sortedGuests = [...guestList].sort((a, b) =>
            a.name.localeCompare(b.name)
        );

        sortedGuests.forEach(guest => {
            const option = document.createElement('option');
            option.value = guest.id;
            option.textContent = guest.name;
            guestSelect.appendChild(option);
        });
    }

    // Handle guest selection
    guestSelect.addEventListener('change', function() {
        const guestId = parseInt(this.value);

        if (!guestId) {
            // Reset if no guest selected
            invitationDetails.style.display = 'none';
            mainForm.style.display = 'none';
            selectedGuest = null;
            return;
        }

        // Find selected guest
        selectedGuest = guestList.find(g => g.id === guestId);

        if (selectedGuest) {
            displayInvitationDetails(selectedGuest);
            showMainForm(selectedGuest);
        }
    });

    // Display what events the guest is invited to
    function displayInvitationDetails(guest) {
        invitedEventsList.innerHTML = '';

        guest.invitedTo.forEach(eventKey => {
            const li = document.createElement('li');
            li.textContent = eventNames[eventKey];
            invitedEventsList.appendChild(li);
        });

        invitationDetails.style.display = 'block';
    }

    // Show main form and configure for guest
    function showMainForm(guest) {
        // Pre-fill email if available
        const emailInput = document.getElementById('email');
        if (guest.email) {
            emailInput.value = guest.email;
        } else {
            emailInput.value = '';
        }

        // Populate guest count dropdown
        populateGuestCount(guest.maxGuests);

        mainForm.style.display = 'block';
    }

    // Populate guest count options based on maxGuests
    function populateGuestCount(maxGuests) {
        guestCountSelect.innerHTML = '<option value="">Select number</option>';

        for (let i = 1; i <= maxGuests; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i === 1 ? '1 Guest' : `${i} Guests`;
            guestCountSelect.appendChild(option);
        }
    }

    // Handle overall attendance selection
    attendingRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'yes') {
                showAttendingDetails();
            } else {
                attendingDetails.style.display = 'none';
            }
        });
    });

    // Show attending details and event-specific questions
    function showAttendingDetails() {
        if (!selectedGuest) return;

        attendingDetails.style.display = 'block';

        // Show/hide event groups based on what they're invited to
        fridayGroup.style.display = selectedGuest.invitedTo.includes('friday') ? 'block' : 'none';
        saturdayGroup.style.display = selectedGuest.invitedTo.includes('saturday') ? 'block' : 'none';
        sundayGroup.style.display = selectedGuest.invitedTo.includes('sunday') ? 'block' : 'none';
    }

    // Form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();

        if (!selectedGuest) {
            alert('Please select your name from the dropdown.');
            return;
        }

        // Collect form data
        const formData = {
            guestId: selectedGuest.id,
            guestName: selectedGuest.name,
            email: document.getElementById('email').value,
            attending: document.querySelector('input[name="attending"]:checked').value,
        };

        // If attending, collect additional details
        if (formData.attending === 'yes') {
            formData.guestCount = document.getElementById('guestCount').value;

            // Collect event-specific responses
            formData.events = {};

            if (selectedGuest.invitedTo.includes('friday')) {
                const fridayResponse = document.querySelector('input[name="fridayAttending"]:checked');
                formData.events.friday = fridayResponse ? fridayResponse.value : 'not answered';
            }

            if (selectedGuest.invitedTo.includes('saturday')) {
                const saturdayResponse = document.querySelector('input[name="saturdayAttending"]:checked');
                formData.events.saturday = saturdayResponse ? saturdayResponse.value : 'not answered';
            }

            if (selectedGuest.invitedTo.includes('sunday')) {
                const sundayResponse = document.querySelector('input[name="sundayAttending"]:checked');
                formData.events.sunday = sundayResponse ? sundayResponse.value : 'not answered';
            }

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

    // Initialize: populate dropdown on load
    populateGuestDropdown();
});
