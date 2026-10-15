import KoboTokens
import SwiftUI

/// One quick action in a row of round buttons ("Start", "Log", "Plan", "Share"): a disc with an SF Symbol and a short
/// label under it, at most two lines (no limit at accessibility sizes). The whole column is one button read by its
/// label; it shrinks a little when pressed. While `isLoading` a spinner replaces the glyph and taps are ignored. Give
/// a row of them equal widths with an `HStack(alignment: .top, spacing: 0)`.
///
///     HStack(alignment: .top, spacing: 0) {
///         ActionCircle("Start", systemImage: "play.fill", action: start)
///         ActionCircle("Log", systemImage: "plus", action: log)
///     }
public struct ActionCircle: View {
    /// The fill of the disc.
    public enum Style: Sendable, Equatable, CaseIterable {
        /// The accent tint with accent ink: most actions.
        case tonal
        /// The solid accent with on-accent ink: the one primary action of a row.
        case solid
    }

    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .body) private var discSize = Size.thumbnail
    private let title: Text
    private let systemImage: String
    private let style: Style
    private let isLoading: Bool
    private let action: () -> Void

    public init(
        _ title: LocalizedStringKey,
        systemImage: String,
        style: Style = .tonal,
        isLoading: Bool = false,
        action: @escaping () -> Void
    ) {
        self.init(title: Text(title), systemImage: systemImage, style: style, isLoading: isLoading, action: action)
    }

    /// An action whose label is shown as is.
    public init(
        verbatim title: String,
        systemImage: String,
        style: Style = .tonal,
        isLoading: Bool = false,
        action: @escaping () -> Void
    ) {
        self.init(
            title: Text(verbatim: title),
            systemImage: systemImage,
            style: style,
            isLoading: isLoading,
            action: action
        )
    }

    private init(title: Text, systemImage: String, style: Style, isLoading: Bool, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.style = style
        self.isLoading = isLoading
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            VStack(spacing: Space.sm) {
                disc
                title
                    .font(theme.font(.footnote).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                    .multilineTextAlignment(.center)
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
            }
            .frame(minWidth: discSize + Space.lg, maxWidth: .infinity, alignment: .top)
            .contentShape(Rectangle())
        }
        .buttonStyle(.pressFeedback)
        .allowsHitTesting(!isLoading)
        .accessibilityValue(isLoading ? Text("In progress", bundle: .module) : Text(verbatim: ""))
    }

    private var disc: some View {
        ZStack {
            Circle().fill(style == .solid ? theme.palette.accent : theme.palette.accentSoft)
            Image(systemName: systemImage)
                .font(theme.font(.title2).weight(.semibold))
                .foregroundStyle(style == .solid ? theme.palette.onAccent : theme.palette.accentText)
                .opacity(isLoading ? 0 : 1)
            if isLoading {
                ProgressView().tint(style == .solid ? theme.palette.onAccent : theme.palette.accentText)
            }
        }
        .frame(width: discSize, height: discSize)
        .koboAnimation(.state, value: isLoading)
        .accessibilityHidden(true)
    }
}

#if DEBUG
    private struct ActionCirclePreview: View {
        var body: some View {
            HStack(alignment: .top, spacing: 0) {
                ActionCircle("Start", systemImage: "play.fill", style: .solid) {}
                ActionCircle("Log a set", systemImage: "plus") {}
                ActionCircle("Plan week", systemImage: "calendar", isLoading: true) {}
                ActionCircle("Share", systemImage: "square.and.arrow.up") {}.disabled(true)
            }
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Action circle") { ActionCirclePreview() }
    #Preview("Action circle · dark, Lift") { ActionCirclePreview().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Action circle · AX3") { ActionCirclePreview().dynamicTypeSize(.accessibility3) }
#endif
