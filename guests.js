// Wedding Guest List
// Edit this file to add your actual guests

const guestList = [
    // Example guests - replace with your actual guest list
    {
        id: 1,
        name: "John Smith",
        email: "", // Optional: pre-fill email if you have it
        invitedTo: ["friday", "saturday", "sunday"], // All weekend events
        maxGuests: 2, // Can bring +1
        notes: "" // Internal notes, not shown to guest
    },
    {
        id: 2,
        name: "Jane Doe",
        email: "jane@example.com",
        invitedTo: ["saturday"], // Saturday only
        maxGuests: 1, // Just them
        notes: ""
    },
    {
        id: 3,
        name: "The Johnson Family",
        email: "",
        invitedTo: ["friday", "saturday", "sunday"],
        maxGuests: 4, // Family of 4
        notes: "Kids invited"
    },
    {
        id: 4,
        name: "Sarah Williams",
        email: "",
        invitedTo: ["saturday", "sunday"], // Saturday + Sunday brunch
        maxGuests: 2,
        notes: ""
    },
    {
        id: 5,
        name: "Michael Chen",
        email: "michael@example.com",
        invitedTo: ["friday", "saturday", "sunday"],
        maxGuests: 1,
        notes: ""
    },
    {
        id: 6,
        name: "Emily and David Martinez",
        email: "",
        invitedTo: ["saturday"],
        maxGuests: 2,
        notes: "Couple"
    }
    // Add more guests below...
    // Copy the format above for each guest/party
];

// Event display names (for showing to guests)
const eventNames = {
    friday: "Friday Welcome Drinks",
    saturday: "Saturday Wedding",
    sunday: "Sunday Brunch"
};

// Make available to other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { guestList, eventNames };
}
