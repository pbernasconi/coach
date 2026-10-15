import KoboTokens
import SwiftUI

/// Who draws the capsule behind a `MiniPlayerBar`.
public enum MiniPlayerChrome: Sendable, Equatable {
    /// No background of its own: the system draws the glass inside `.tabViewBottomAccessory`.
    case accessory
    /// Draws its own capsule, for use as a floating overlay: Liquid Glass, or the raised surface under a `.solid`
    /// theme.
    case floating
}

/// A compact "now playing" bar: a leading icon or thumbnail slot, title, subtitle with monospaced digits
/// (a running time), and a trailing button slot. Tapping the body runs `action` (usually "open").
/// Designed for the iOS 26 tab bar accessory:
///
///     TabView { … }
///         .tabViewBottomAccessory {
///             MiniPlayerBar(verbatim: episode.title, subtitle: elapsed, action: open) {
///                 Image(systemName: "waveform")
///             } trailing: {
///                 Button("Open", action: open)
///             }
///         }
public struct MiniPlayerBar<Leading: View, Trailing: View>: View {
    @Environment(\.koboTheme) private var theme
    private let title: Text
    private let subtitle: Text?
    private let chrome: MiniPlayerChrome
    private let action: () -> Void
    private let leading: Leading
    private let trailing: Trailing

    /// A bar with a localized title and subtitle.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        chrome: MiniPlayerChrome = .accessory,
        action: @escaping () -> Void,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.title = Text(title)
        self.subtitle = subtitle.map { Text($0) }
        self.chrome = chrome
        self.action = action
        self.leading = leading()
        self.trailing = trailing()
    }

    /// A bar whose title and subtitle are shown as is (an episode title, a running time).
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        chrome: MiniPlayerChrome = .accessory,
        action: @escaping () -> Void,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.title = Text(verbatim: title)
        self.subtitle = subtitle.map { Text(verbatim: $0) }
        self.chrome = chrome
        self.action = action
        self.leading = leading()
        self.trailing = trailing()
    }

    public var body: some View {
        switch chrome {
        case .accessory:
            bar
        case .floating:
            switch theme.surfaceStyle {
            case .glass:
                bar.padding(.vertical, Space.xs).glassEffect(.regular.interactive(), in: .capsule)
            case .solid:
                bar.padding(.vertical, Space.xs).background(theme.palette.surfaceRaised, in: Capsule())
            }
        }
    }

    private var bar: some View {
        HStack(spacing: Space.md) {
            Button(action: action) {
                HStack(spacing: Space.md) {
                    leading
                        .foregroundStyle(theme.palette.accentText)
                    VStack(alignment: .leading, spacing: 0) {
                        title
                            .font(theme.font(.subheadline).weight(.semibold))
                            .foregroundStyle(theme.palette.textPrimary)
                            .lineLimit(1)
                        if let subtitle {
                            subtitle
                                .font(theme.font(.footnote).monospacedDigit())
                                .foregroundStyle(theme.palette.textSecondary)
                                .lineLimit(1)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(minHeight: Size.minTouch)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            trailing
        }
        .padding(.leading, Space.md)
        .padding(.trailing, Space.sm)
    }
}

extension MiniPlayerBar where Trailing == EmptyView {
    /// A bar with a localized title, a leading slot and no trailing button.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        chrome: MiniPlayerChrome = .accessory,
        action: @escaping () -> Void,
        @ViewBuilder leading: () -> Leading
    ) {
        self.init(
            title,
            subtitle: subtitle,
            chrome: chrome,
            action: action,
            leading: leading,
            trailing: { EmptyView() }
        )
    }

    /// A bar with a title shown as is, a leading slot and no trailing button.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        chrome: MiniPlayerChrome = .accessory,
        action: @escaping () -> Void,
        @ViewBuilder leading: () -> Leading
    ) {
        self.init(
            verbatim: title,
            subtitle: subtitle,
            chrome: chrome,
            action: action,
            leading: leading,
            trailing: { EmptyView() }
        )
    }
}

#if DEBUG
    private struct MiniPlayerSample: View {
        let chrome: MiniPlayerChrome

        var body: some View {
            MiniPlayerBar(
                verbatim: "Focus timer",
                subtitle: "12:40 · Write the report, block 3 of 5",
                chrome: chrome,
                action: {}
            ) {
                Image(systemName: "timer").accessibilityHidden(true)
            } trailing: {
                Button("Open") {}
                    .buttonStyle(.kobo(.plain, size: .compact))  // no glass inside the bar's glass
            }
        }
    }

    private struct MiniPlayerPreview: View {
        var body: some View {
            VStack(spacing: Space.xl) {
                MiniPlayerSample(chrome: .floating)
                MiniPlayerBar("Break", subtitle: "01:30", chrome: .floating, action: {}) {
                    Image(systemName: "cup.and.saucer").accessibilityHidden(true)
                }
            }
            .padding(Space.gutter)
            .frame(maxHeight: .infinity)
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Floating") { MiniPlayerPreview() }
    #Preview("Dark") { MiniPlayerPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { MiniPlayerPreview().dynamicTypeSize(.accessibility3) }
    #if os(iOS)
        #Preview("Tab accessory") {
            TabView {
                Tab("Week", systemImage: "calendar") { Text("Week") }
                Tab("Library", systemImage: "books.vertical") { Text("Library") }
            }
            .tabViewBottomAccessory {
                MiniPlayerSample(chrome: .accessory)
            }
        }
    #endif
#endif
