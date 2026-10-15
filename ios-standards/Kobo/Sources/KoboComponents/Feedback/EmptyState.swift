import KoboTokens
import SwiftUI

/// A screen or section with nothing to show yet: art, a title, a message and optional actions.
///
/// The `symbol:` initialisers draw the standard disc (`EmptyStateArt`). The `art:` slot takes anything else: a large
/// first-run disc, or an app's own illustration (mark it decorative; the title carries the meaning).
///
///     EmptyState(symbol: "dumbbell", title: "No workouts yet", message: "Start one to see it here.") {
///         Button("Start a workout", action: start).buttonStyle(.kobo(.primary))
///     }
///     EmptyState(title: "Plan your first week") {
///         EmptyStateArt(systemImage: "calendar.badge.plus", tone: .accent, scale: .large)
///     } actions: {
///         Button("Plan a week", action: plan).buttonStyle(.kobo(.primary))
///     }
public struct EmptyState<Art: View, Actions: View>: View {
    private let art: Art
    private let title: Text
    private let message: Text?
    private let actions: Actions

    /// An empty state with localized copy, custom art and actions.
    public init(
        title: LocalizedStringKey,
        message: LocalizedStringKey? = nil,
        @ViewBuilder art: () -> Art,
        @ViewBuilder actions: () -> Actions
    ) {
        self.init(art: art(), title: Text(title), message: message.map { Text($0) }, actions: actions())
    }

    /// An empty state whose copy is shown as is (user data, search terms), with custom art and actions.
    public init(
        verbatim title: String,
        message: String? = nil,
        @ViewBuilder art: () -> Art,
        @ViewBuilder actions: () -> Actions
    ) {
        self.init(
            art: art(),
            title: Text(verbatim: title),
            message: message.map { Text(verbatim: $0) },
            actions: actions()
        )
    }

    init(art: Art, title: Text, message: Text?, actions: Actions) {
        self.art = art
        self.title = title
        self.message = message
        self.actions = actions
    }

    public var body: some View {
        FeedbackStateLayout(art: art, title: title, message: message, actions: actions)
            .accessibilityElement(children: .contain)
    }
}

extension EmptyState where Art == EmptyStateArt {
    /// An empty state with localized copy, the standard disc and actions.
    public init(
        symbol: String,
        title: LocalizedStringKey,
        message: LocalizedStringKey? = nil,
        @ViewBuilder actions: () -> Actions
    ) {
        self.init(title: title, message: message, art: { EmptyStateArt(systemImage: symbol) }, actions: actions)
    }

    /// An empty state whose copy is shown as is, with the standard disc and actions.
    public init(
        symbol: String,
        verbatim title: String,
        message: String? = nil,
        @ViewBuilder actions: () -> Actions
    ) {
        self.init(verbatim: title, message: message, art: { EmptyStateArt(systemImage: symbol) }, actions: actions)
    }
}

extension EmptyState where Art == EmptyStateArt, Actions == EmptyView {
    /// An empty state with localized copy and no actions.
    public init(symbol: String, title: LocalizedStringKey, message: LocalizedStringKey? = nil) {
        self.init(symbol: symbol, title: title, message: message) { EmptyView() }
    }

    /// An empty state whose copy is shown as is, with no actions.
    public init(symbol: String, verbatim title: String, message: String? = nil) {
        self.init(symbol: symbol, verbatim: title, message: message) { EmptyView() }
    }
}

extension EmptyState where Actions == EmptyView {
    /// An empty state with localized copy, custom art and no actions.
    public init(title: LocalizedStringKey, message: LocalizedStringKey? = nil, @ViewBuilder art: () -> Art) {
        self.init(title: title, message: message, art: art) { EmptyView() }
    }

    /// An empty state whose copy is shown as is, with custom art and no actions.
    public init(verbatim title: String, message: String? = nil, @ViewBuilder art: () -> Art) {
        self.init(verbatim: title, message: message, art: art) { EmptyView() }
    }
}

#if DEBUG
    #Preview("Empty") {
        EmptyState(symbol: "dumbbell", title: "No workouts yet", message: "Start one and it shows up here.") {
            Button("Start a workout") {}
                .buttonStyle(.kobo(.primary))
        }
    }

    #Preview("Empty, first run, dark") {
        EmptyState(title: "Plan your first week", message: "Pick the days you train and we'll fill them in.") {
            EmptyStateArt(systemImage: "calendar.badge.plus", tone: .accent, scale: .large)
        } actions: {
            Button("Plan a week") {}
                .buttonStyle(.kobo(.primary))
        }
        .koboTheme(.amber)
        .preferredColorScheme(.dark)
    }

    #Preview("Empty, search, dark") {
        EmptyState(symbol: "magnifyingglass", verbatim: "No matches for “bnch”", message: "Try a different search.")
            .preferredColorScheme(.dark)
    }

    #Preview("Empty, AX3") {
        EmptyState(symbol: "dumbbell", title: "No workouts yet", message: "Start one and it shows up here.") {
            Button("Start a workout") {}
                .buttonStyle(.kobo(.primary))
        }
        .dynamicTypeSize(.accessibility3)
    }
#endif
