import CraftTokens
import SwiftUI

/// Who draws the capsule behind a `MiniPlayerBar`.
public enum MiniPlayerChrome: Sendable, Equatable {
    /// No background of its own: the system draws the glass inside `.tabViewBottomAccessory`.
    case accessory
    /// Draws its own Liquid Glass capsule, for use as a floating overlay.
    case floating
}

/// A compact "now playing" bar: a leading icon or thumbnail slot, title, subtitle with monospaced digits
/// (a running time), and a trailing button slot. Tapping the body runs `action` (usually "open").
/// Designed for the iOS 26 tab bar accessory:
///
///     TabView { … }
///         .tabViewBottomAccessory {
///             MiniPlayerBar(title: "Push day", subtitle: "12:40 · Bench press", action: open) {
///                 Image(systemName: "dumbbell")
///             } trailing: {
///                 Button("Open", action: open)
///             }
///         }
public struct MiniPlayerBar<Leading: View, Trailing: View>: View {
    @Environment(\.craftTheme) private var theme
    private let title: String
    private let subtitle: String?
    private let chrome: MiniPlayerChrome
    private let action: () -> Void
    private let leading: Leading
    private let trailing: Trailing

    public init(
        title: String,
        subtitle: String? = nil,
        chrome: MiniPlayerChrome = .accessory,
        action: @escaping () -> Void,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.title = title
        self.subtitle = subtitle
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
            bar
                .padding(.vertical, Space.xs)
                .glassEffect(.regular.interactive(), in: .capsule)
        }
    }

    private var bar: some View {
        HStack(spacing: Space.md) {
            Button(action: action) {
                HStack(spacing: Space.md) {
                    leading
                        .foregroundStyle(theme.palette.accentText)
                    VStack(alignment: .leading, spacing: 0) {
                        Text(title)
                            .font(theme.font(.subheadline).weight(.semibold))
                            .foregroundStyle(theme.palette.textPrimary)
                            .lineLimit(1)
                        if let subtitle {
                            Text(subtitle)
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
    /// A bar with a leading slot and no trailing button.
    public init(
        title: String,
        subtitle: String? = nil,
        chrome: MiniPlayerChrome = .accessory,
        action: @escaping () -> Void,
        @ViewBuilder leading: () -> Leading
    ) {
        self.init(
            title: title,
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
            MiniPlayerBar(title: "Push day", subtitle: "12:40 · Bench press, set 3 of 5", chrome: chrome, action: {}) {
                Image(systemName: "dumbbell.fill").accessibilityHidden(true)
            } trailing: {
                Button("Open") {}
                    .buttonStyle(.craft(.plain, size: .compact))  // no glass inside the bar's glass
            }
        }
    }

    private struct MiniPlayerPreview: View {
        var body: some View {
            VStack(spacing: Space.xl) {
                MiniPlayerSample(chrome: .floating)
                MiniPlayerBar(title: "Rest", subtitle: "01:30", chrome: .floating, action: {}) {
                    Image(systemName: "timer").accessibilityHidden(true)
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
