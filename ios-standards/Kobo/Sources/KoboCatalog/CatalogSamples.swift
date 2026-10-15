import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Made-up sample content shared by the catalog demos: task priorities, projects, reminders and views. Nothing here
/// describes a real person or place.
enum CatalogSamples {
    static let priorities: [SelectOption<String>] = [
        SelectOption("low", title: "Low", subtitle: "Whenever there's time", systemImage: "arrow.down"),
        SelectOption("medium", title: "Medium", subtitle: "Sometime this week", systemImage: "equal"),
        SelectOption("high", title: "High", subtitle: "Needs attention today", systemImage: "exclamationmark"),
    ]

    static let projects: [SelectOption<String>] = [
        SelectOption("home", title: "Home", subtitle: "Chores and repairs", systemImage: "house"),
        SelectOption("garden", title: "Garden", subtitle: "Beds, pots and compost", systemImage: "leaf"),
        SelectOption("reading", title: "Reading list", systemImage: "book", keywords: ["books"]),
        SelectOption("trip", title: "Weekend trip", subtitle: "Packing and bookings", systemImage: "suitcase"),
        SelectOption("kitchen", title: "Kitchen refresh", systemImage: "fork.knife"),
        SelectOption("photos", title: "Photo albums", keywords: ["pictures"]),
        SelectOption("archive", title: "Archive", subtitle: "Read only", isEnabled: false),
    ]

    static let reminders: [ChoiceOption<Int>] = [
        ChoiceOption(0, title: "At the due time"),
        ChoiceOption(15, title: "15 minutes before"),
        ChoiceOption(60, title: "1 hour before"),
        ChoiceOption(1_440, title: "1 day before", systemImage: "calendar"),
    ]

    static let views: [ChoiceOption<String>] = [
        ChoiceOption("list", title: "List", systemImage: "list.bullet"),
        ChoiceOption("board", title: "Board", systemImage: "square.grid.2x2"),
        ChoiceOption("calendar", title: "Calendar", systemImage: "calendar"),
    ]

    static let places: [CatalogPlace] = [
        CatalogPlace(id: "library", name: "Riverside library", detail: "Open until 8 pm"),
        CatalogPlace(id: "market", name: "Saturday market", detail: "Town square"),
        CatalogPlace(id: "park", name: "Hilltop park", detail: "2 km away"),
    ]
}

/// A made-up place for list demos.
struct CatalogPlace: Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    let detail: String
}
