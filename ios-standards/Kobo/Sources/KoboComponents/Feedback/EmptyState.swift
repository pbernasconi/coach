import KoboTokens
import SwiftUI

/// A screen or section with nothing to show yet: a glyph, a title, a message and optional actions.
///
///     EmptyState(symbol: "dumbbell", title: "No workouts yet", message: "Start one to see it here.") {
///         Button("Start a workout", action: start).buttonStyle(.glassProminent)
///     }
public struct EmptyState<Actions: View>: View {
    private let symbol: String
    private let title: Text
    private let message: Text?
    private let actions: Actions

    /// An empty state with localized copy.
    public init(
        symbol: String,
        title: LocalizedStringKey,
        message: LocalizedStringKey? = nil,
        @ViewBuilder actions: () -> Actions
    ) {
        self.init(symbol: symbol, title: Text(title), message: message.map { Text($0) }, actions: actions())
    }

    /// An empty state whose copy is shown as is (user data, search terms).
    public init(
        symbol: String,
        verbatim title: String,
        message: String? = nil,
        @ViewBuilder actions: () -> Actions
    ) {
        self.init(
            symbol: symbol,
            title: Text(verbatim: title),
            message: message.map { Text(verbatim: $0) },
            actions: actions()
        )
    }

    private init(symbol: String, title: Text, message: Text?, actions: Actions) {
        self.symbol = symbol
        self.title = title
        self.message = message
        self.actions = actions
    }

    public var body: some View {
        FeedbackStateLayout(symbol: symbol, symbolTone: .neutral, title: title, message: message, actions: actions)
            .accessibilityElement(children: .contain)
    }
}

extension EmptyState where Actions == EmptyView {
    /// An empty state with localized copy and no actions.
    public init(symbol: String, title: LocalizedStringKey, message: LocalizedStringKey? = nil) {
        self.init(symbol: symbol, title: title, message: message) { EmptyView() }
    }

    /// An empty state whose copy is shown as is, with no actions.
    public init(symbol: String, verbatim title: String, message: String? = nil) {
        self.init(symbol: symbol, verbatim: title, message: message) { EmptyView() }
    }
}

#Preview("Empty") {
    EmptyState(symbol: "dumbbell", title: "No workouts yet", message: "Start one and it shows up here.") {
        Button("Start a workout") {}
            .buttonStyle(.glassProminent)
    }
}

#Preview("Empty, dark") {
    EmptyState(symbol: "magnifyingglass", verbatim: "No matches for “bnch”", message: "Try a different search.")
        .preferredColorScheme(.dark)
}

#Preview("Empty, AX3") {
    EmptyState(symbol: "dumbbell", title: "No workouts yet", message: "Start one and it shows up here.") {
        Button("Start a workout") {}
            .buttonStyle(.glassProminent)
    }
    .dynamicTypeSize(.accessibility3)
}
