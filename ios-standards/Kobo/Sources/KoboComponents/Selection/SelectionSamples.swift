import KoboTokens
import SwiftUI

#if DEBUG
    /// Gym sample content for the Selection previews: equipment, rest presets and day templates.
    enum SelectionSamples {
        static let equipment: [SelectOption<String>] = [
            SelectOption("barbell", title: "Barbell", subtitle: "Olympic bar, 20 kg", systemImage: "dumbbell"),
            SelectOption("dumbbells", title: "Dumbbells", subtitle: "Pairs from 2 to 40 kg", keywords: ["DB"]),
            SelectOption("kettlebell", title: "Kettlebell", subtitle: "16 and 24 kg", keywords: ["KB"]),
            SelectOption("bench", title: "Adjustable bench", systemImage: "bed.double"),
            SelectOption("rack", title: "Squat rack", subtitle: "With safety pins"),
            SelectOption("pullup", title: "Pull-up bar", systemImage: "figure.climbing"),
            SelectOption("bands", title: "Resistance bands", keywords: ["loop"]),
            SelectOption("rower", title: "Rowing machine", subtitle: "Booked through the front desk", isEnabled: false),
            SelectOption("sled", title: "Sled", subtitle: "Turf lane only"),
        ]

        static let restPresets: [SelectOption<Int>] = [
            SelectOption(60, title: "60 seconds", subtitle: "Accessories and supersets"),
            SelectOption(90, title: "90 seconds", subtitle: "Most working sets"),
            SelectOption(120, title: "2 minutes", subtitle: "Heavy compound lifts"),
            SelectOption(180, title: "3 minutes", subtitle: "Near-maximal sets"),
        ]

        static let restChoices: [ChoiceOption<Int>] = [
            ChoiceOption(60, title: "60 s"),
            ChoiceOption(90, title: "90 s"),
            ChoiceOption(120, title: "2 min"),
            ChoiceOption(180, title: "3 min", systemImage: "tortoise"),
        ]

        static let dayTemplates: [SelectOption<String>] = [
            SelectOption(
                "push",
                title: "Push",
                subtitle: "Chest, shoulders, triceps",
                systemImage: "figure.strengthtraining.traditional"
            ),
            SelectOption("pull", title: "Pull", subtitle: "Back and biceps", systemImage: "figure.rower"),
            SelectOption("legs", title: "Legs", subtitle: "Squat, hinge, lunge", systemImage: "figure.walk"),
            SelectOption("rest", title: "Rest", subtitle: "Not on a plan week", isEnabled: false),
        ]
    }
#endif
