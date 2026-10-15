import CraftTokens
import SwiftUI

/// A screen or section with nothing to show yet: a glyph, a title, a message and optional actions.
///
///     EmptyState(symbol: "dumbbell", title: "No workouts yet", message: "Start one to see it here.") {
///         Button("Start a workout", action: start).buttonStyle(.glassProminent)
///     }
public struct EmptyState<Actions: View>: View {
    private let symbol: String
    private let title: String
    private let message: String?
    private let actions: Actions

    public init(
        symbol: String,
        title: String,
        message: String? = nil,
        @ViewBuilder actions: () -> Actions
    ) {
        self.symbol = symbol
        self.title = title
        self.message = message
        self.actions = actions()
    }

    public var body: some View {
        FeedbackStateLayout(symbol: symbol, symbolTone: .neutral, title: title, message: message, actions: actions)
            .accessibilityElement(children: .contain)
    }
}

extension EmptyState where Actions == EmptyView {
    /// An empty state with no actions.
    public init(symbol: String, title: String, message: String? = nil) {
        self.init(symbol: symbol, title: title, message: message) { EmptyView() }
    }
}

#Preview("Empty") {
    EmptyState(symbol: "dumbbell", title: "No workouts yet", message: "Start one and it shows up here.") {
        Button("Start a workout") {}
            .buttonStyle(.glassProminent)
    }
}

#Preview("Empty, dark") {
    EmptyState(symbol: "magnifyingglass", title: "No matches", message: "Try a different search.")
        .preferredColorScheme(.dark)
}

#Preview("Empty, AX3") {
    EmptyState(symbol: "dumbbell", title: "No workouts yet", message: "Start one and it shows up here.") {
        Button("Start a workout") {}
            .buttonStyle(.glassProminent)
    }
    .dynamicTypeSize(.accessibility3)
}
