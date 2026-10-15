import KoboTokens
import SwiftUI

/// A round, icon-only button. The label is required because VoiceOver has nothing else to read. The visible circle
/// can be smaller than 44pt, but the target never is. While `isLoading`, a spinner takes the glyph's place in the same
/// circle, presses are ignored and VoiceOver hears "In progress".
///
///     IconButton("pause.fill", accessibilityLabel: "Pause timer", style: .solid, size: .large) { pause() }
///     IconButton("pencil", verbatimAccessibilityLabel: "Rename \(list.name)", style: .plain) { rename() }
public struct IconButton: View {
    /// The fill of the circle.
    public enum Style: Sendable, Equatable, CaseIterable {
        /// Liquid Glass, for controls over content (falls back to a raised fill under a solid theme).
        case glass
        /// The accent fill with on-accent ink.
        case solid
        /// A neutral raised fill.
        case tonal
        /// No fill at rest; a soft veil while pressed.
        case plain
    }

    /// The diameter of the visible circle.
    public enum Size: Sendable, Equatable, CaseIterable {
        /// 36pt circle inside a 44pt target.
        case small
        /// 44pt circle.
        case regular
        /// 56pt circle: big, primary controls such as a stepper's − and +.
        case large

        var diameter: CGFloat {
            switch self {
            case .small: KoboTokens.Size.buttonHeightCompact
            case .regular: KoboTokens.Size.minTouch
            case .large: KoboTokens.Size.thumbnail
            }
        }

        var iconSize: CGFloat {
            switch self {
            case .small: KoboTokens.Size.iconSm
            case .regular: KoboTokens.Size.iconMd
            case .large: KoboTokens.Size.iconLg
            }
        }
    }

    @ScaledMetric private var diameter: CGFloat
    @ScaledMetric private var iconSize: CGFloat
    private let systemImage: String
    private let label: Text
    private let style: Style
    private let isLoading: Bool
    private let action: () -> Void

    public init(
        _ systemImage: String,
        accessibilityLabel: LocalizedStringKey,
        style: Style = .glass,
        size: Size = .regular,
        isLoading: Bool = false,
        action: @escaping () -> Void
    ) {
        let label = Text(accessibilityLabel)
        self.init(systemImage, label: label, style: style, size: size, isLoading: isLoading, action: action)
    }

    /// An icon button whose accessibility label is shown as is, because it names user data ("Rename Push day").
    public init(
        _ systemImage: String,
        verbatimAccessibilityLabel: String,
        style: Style = .glass,
        size: Size = .regular,
        isLoading: Bool = false,
        action: @escaping () -> Void
    ) {
        let label = Text(verbatim: verbatimAccessibilityLabel)
        self.init(systemImage, label: label, style: style, size: size, isLoading: isLoading, action: action)
    }

    /// An icon button labelled with a ready-made `Text`, for the library's own labels ("Close", "Increase").
    init(
        _ systemImage: String,
        label: Text,
        style: Style,
        size: Size,
        isLoading: Bool = false,
        action: @escaping () -> Void
    ) {
        self.systemImage = systemImage
        self.label = label
        self.style = style
        self.isLoading = isLoading
        self.action = action
        _diameter = ScaledMetric(wrappedValue: size.diameter, relativeTo: .body)
        _iconSize = ScaledMetric(wrappedValue: size.iconSize, relativeTo: .body)
    }

    public var body: some View {
        Button(action: action) {
            // The glyph scales with the disc, not with the text style: `iconSize` is a `@ScaledMetric`.
            Image(systemName: systemImage)
                .font(.system(size: iconSize, weight: .semibold))
                .opacity(isLoading ? 0 : 1)
                .overlay {
                    if isLoading { ProgressView().controlSize(.small).accessibilityHidden(true) }
                }
                .frame(width: diameter, height: diameter)
        }
        .buttonStyle(IconButtonStyle(style: style))
        .allowsHitTesting(!isLoading)
        .koboAnimation(.state, value: isLoading)
        .accessibilityLabel(label)
        .accessibilityValue(isLoading ? Text("In progress", bundle: .module) : Text(verbatim: ""))
    }
}

private struct IconButtonStyle: ButtonStyle {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    let style: IconButton.Style

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(foreground)
            .modifier(IconSurface(style: style, fill: fill, isPressed: configuration.isPressed))
            .contentShape(Circle())
            .scaleEffect(configuration.isPressed ? PressMetrics.scale : 1)
            .koboAnimation(.instant, value: configuration.isPressed)
            .frame(minWidth: Size.minTouch, minHeight: Size.minTouch)
            .contentShape(Rectangle())
    }

    private var foreground: Color {
        guard isEnabled else { return theme.palette.textTertiary }
        return style == .solid ? theme.palette.onAccent : theme.palette.textPrimary
    }

    private var fill: Color {
        switch style {
        case .solid: isEnabled ? theme.palette.accent : theme.palette.surfaceRaised
        case .tonal, .glass: theme.palette.surfaceRaised
        case .plain: .clear
        }
    }
}

private struct IconSurface: ViewModifier {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    let style: IconButton.Style
    let fill: Color
    let isPressed: Bool

    func body(content: Content) -> some View {
        if style == .glass && theme.surfaceStyle == .glass {
            let glass: Glass = isEnabled ? Glass.regular.interactive() : Glass.regular
            content.glassEffect(glass, in: Circle())
        } else {
            content.background {
                ZStack {
                    Circle().fill(fill)
                    Circle().fill(theme.palette.pressVeil(isPressed))
                }
            }
        }
    }
}

#if DEBUG
    private struct IconButtonGallery: View {
        @Environment(\.koboTheme) private var theme

        var body: some View {
            VStack(spacing: Space.lg) {
                HStack(spacing: Space.md) {
                    IconButton("pause.fill", accessibilityLabel: "Pause") {}
                    IconButton("plus", accessibilityLabel: "Add", style: .solid) {}
                    IconButton("ellipsis", accessibilityLabel: "More", style: .tonal) {}
                    IconButton("gearshape", accessibilityLabel: "Settings", style: .plain) {}
                }
                HStack(spacing: Space.md) {
                    IconButton("minus", accessibilityLabel: "Less", style: .tonal, size: .large) {}
                    IconButton("chevron.up", accessibilityLabel: "Up", style: .tonal, size: .small) {}
                    IconButton("trash", accessibilityLabel: "Delete", style: .solid) {}.disabled(true)
                    IconButton("arrow.clockwise", verbatimAccessibilityLabel: "Sync Push day", isLoading: true) {}
                    CloseButton {}
                }
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Icon button") { IconButtonGallery() }
    #Preview("Icon button · dark") { IconButtonGallery().preferredColorScheme(.dark) }
    #Preview("Icon button · AX3") { IconButtonGallery().dynamicTypeSize(.accessibility3) }
#endif
