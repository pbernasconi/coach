import KoboTokens
import SwiftUI

#if DEBUG
    /// Made-up sample content for the Selection previews: a stay's amenities, timer presets and day plans.
    enum SelectionSamples {
        static let amenities: [SelectOption<String>] = [
            SelectOption("wifi", title: "Wi-Fi", subtitle: "Fibre, 500 Mbit/s", systemImage: "wifi"),
            SelectOption("kitchen", title: "Kitchen", subtitle: "Oven and two hobs", keywords: ["cooking"]),
            SelectOption("parking", title: "Parking", subtitle: "One car, on site", keywords: ["car"]),
            SelectOption("desk", title: "Work desk", systemImage: "desktopcomputer"),
            SelectOption("washer", title: "Washing machine", subtitle: "Shared, ground floor"),
            SelectOption("balcony", title: "Balcony", systemImage: "sun.max"),
            SelectOption("bikes", title: "Bike storage", keywords: ["cycle"]),
            SelectOption("pool", title: "Pool", subtitle: "Closed for the season", isEnabled: false),
            SelectOption("garden", title: "Garden", subtitle: "Shared courtyard"),
        ]

        static let timerPresets: [SelectOption<Int>] = [
            SelectOption(60, title: "60 seconds", subtitle: "A quick check-in"),
            SelectOption(90, title: "90 seconds", subtitle: "A short stretch"),
            SelectOption(120, title: "2 minutes", subtitle: "Green tea"),
            SelectOption(180, title: "3 minutes", subtitle: "Black tea"),
        ]

        static let timerChoices: [ChoiceOption<Int>] = [
            ChoiceOption(60, title: "60 s"),
            ChoiceOption(90, title: "90 s"),
            ChoiceOption(120, title: "2 min"),
            ChoiceOption(180, title: "3 min", systemImage: "tortoise"),
        ]

        static let dayPlans: [SelectOption<String>] = [
            SelectOption("focus", title: "Focus", subtitle: "Deep work, no meetings", systemImage: "brain.head.profile"),
            SelectOption("meetings", title: "Meetings", subtitle: "Calls and reviews", systemImage: "person.2"),
            SelectOption("errands", title: "Errands", subtitle: "Shopping, post and bank", systemImage: "cart"),
            SelectOption("off", title: "Day off", subtitle: "Not in a holiday week", isEnabled: false),
        ]
    }
#endif
