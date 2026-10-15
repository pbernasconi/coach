import KoboTokens
import SwiftUI

/// The large header at the top of a tab root, drawn in the content rather than in a navigation bar: an optional kicker,
/// a large title, then trailing glass header buttons and an optional profile avatar, grouped in one glass container.
/// Pin it with `.tabRootHeader { … }` so the page scrolls under it, or place it at the top of a scroll view. The title
/// wraps; the controls stop growing at AX2. It caps itself at the readable width on a wide window.
///
///     AppHeader("Today", kicker: "Week 3", profile: .init(name: user.name, action: openProfile)) {
///         Button("Search", systemImage: "magnifyingglass", action: search)
///         Button("Notifications", systemImage: "bell", action: openInbox).countBadge(unread)
///     }
///
/// Buttons in the trailing slot draw as glass circles with their label hidden (VoiceOver still reads it); under a solid
/// theme they draw on the raised fill.
public struct AppHeader<Trailing: View>: View {
    @Environment(\.koboTheme) private var theme
    private let title: Text
    private let kicker: Text?
    private let profile: HeaderProfile?
    private let trailing: Trailing

    /// A header with a localized title and kicker, and trailing header buttons.
    public init(
        _ title: LocalizedStringKey,
        kicker: LocalizedStringKey? = nil,
        profile: HeaderProfile? = nil,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.init(title: Text(title), kicker: kicker.map { Text($0) }, profile: profile, trailing: trailing())
    }

    /// A header whose title and kicker are shown as is (a name, a date), with trailing header buttons.
    public init(
        verbatim title: String,
        kicker: String? = nil,
        profile: HeaderProfile? = nil,
        @ViewBuilder trailing: () -> Trailing
    ) {
        let kicker = kicker.map { Text(verbatim: $0) }
        self.init(title: Text(verbatim: title), kicker: kicker, profile: profile, trailing: trailing())
    }

    init(title: Text, kicker: Text?, profile: HeaderProfile?, trailing: Trailing) {
        self.title = title
        self.kicker = kicker
        self.profile = profile
        self.trailing = trailing
    }

    public var body: some View {
        HStack(alignment: .center, spacing: Space.md) {
            VStack(alignment: .leading, spacing: Space.xxs) {
                if let kicker {
                    kicker
                        .font(theme.font(.footnote).weight(.semibold))
                        .foregroundStyle(theme.palette.accentText)
                }
                title
                    .font(theme.font(.largeTitle))
                    .foregroundStyle(theme.palette.textPrimary)
                    .accessibilityAddTraits(.isHeader)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            controls
        }
        .padding(.horizontal, Space.gutter)
        .padding(.top, Space.sm)
        .padding(.bottom, Space.md)
        .readableWidth()
    }

    private var controls: some View {
        GlassEffectContainer(spacing: Space.sm) {
            HStack(spacing: Space.sm) {
                trailing.modifier(HeaderControlStyle())
                if let profile {
                    HeaderProfileButton(
                        name: profile.name,
                        image: profile.image,
                        showsName: profile.showsName,
                        action: profile.action
                    )
                }
            }
        }
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
    }
}

extension AppHeader where Trailing == EmptyView {
    /// A header with a localized title and kicker and no buttons.
    public init(_ title: LocalizedStringKey, kicker: LocalizedStringKey? = nil, profile: HeaderProfile? = nil) {
        self.init(title: Text(title), kicker: kicker.map { Text($0) }, profile: profile, trailing: EmptyView())
    }

    /// A header whose title and kicker are shown as is, with no buttons.
    public init(verbatim title: String, kicker: String? = nil, profile: HeaderProfile? = nil) {
        let kicker = kicker.map { Text(verbatim: $0) }
        self.init(title: Text(verbatim: title), kicker: kicker, profile: profile, trailing: EmptyView())
    }
}

/// Glass circles with hidden labels under a glass theme; raised icon capsules under a solid one.
private struct HeaderControlStyle: ViewModifier {
    @Environment(\.koboTheme) private var theme

    func body(content: Content) -> some View {
        if theme.surfaceStyle == .glass {
            // Header glyphs use the primary ink, like the system back button beside them (DL-H4: quiet controls).
            content
                .buttonStyle(.glass)
                .tint(theme.palette.textPrimary)
                .buttonBorderShape(.circle)
                .labelStyle(.iconOnly)
                .controlSize(.large)
        } else {
            content
                .buttonStyle(.kobo(.secondary, size: .icon))
                .labelStyle(.iconOnly)
        }
    }
}

extension View {
    /// Pins a tab root's own header (usually an `AppHeader`) above the content and hides the system navigation bar on
    /// this screen only, so the content scrolls under the header and a pushed screen keeps its system bar. The header
    /// is pinned as a bar (`safeAreaBar`), so the scroll view draws the system scroll-edge effect under it.
    ///
    ///     NavigationStack {
    ///         TodayList().tabRootHeader { AppHeader("Today", profile: profile) }
    ///     }
    public func tabRootHeader<Header: View>(@ViewBuilder _ header: () -> Header) -> some View {
        let bar = header()
        return safeAreaBar(edge: .top, spacing: 0) { bar }
            .modifier(HidesNavigationBar())
    }
}

private struct HidesNavigationBar: ViewModifier {
    func body(content: Content) -> some View {
        #if os(iOS)
            content.toolbar(.hidden, for: .navigationBar)
        #else
            content
        #endif
    }
}
