import KoboTokens
import SwiftUI

/// An inline, link-styled button: accent text, semibold, not underlined, in a 44 pt tall target. It fades while
/// pressed and dims while disabled (or takes the secondary ink with `disabledLook: .muted`). For a secondary route
/// next to a form ("Use a recovery code", "Forgot password?"); a primary action is a `Button` with `.kobo(.primary)`.
///
///     TextLink("Use a recovery code") { showRecovery() }
public struct TextLink: View {
    /// How a disabled link draws.
    public enum DisabledLook: Sendable, Equatable, CaseIterable {
        /// Half strength: the link is unavailable for now.
        case dimmed
        /// The secondary ink: a countdown such as "Resend code (12 s)".
        case muted
    }

    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    private let label: Text
    private let disabledLook: DisabledLook
    private let action: () -> Void

    public init(_ label: LocalizedStringKey, disabledLook: DisabledLook = .dimmed, action: @escaping () -> Void) {
        self.label = Text(label)
        self.disabledLook = disabledLook
        self.action = action
    }

    /// A link whose label is shown as is.
    public init(verbatim label: String, disabledLook: DisabledLook = .dimmed, action: @escaping () -> Void) {
        self.label = Text(verbatim: label)
        self.disabledLook = disabledLook
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            label
                .font(theme.font(.subheadline).weight(.semibold))
                .foregroundStyle(
                    isEnabled || disabledLook == .dimmed ? theme.palette.accentText : theme.palette.textSecondary
                )
                .multilineTextAlignment(.leading)
                .frame(minHeight: Size.minTouch)
                .contentShape(Rectangle())
        }
        .buttonStyle(.textLink)
        .opacity(isEnabled || disabledLook == .muted ? 1 : TextLinkStyle.disabledOpacity)
    }
}

/// The press look of a text link: no fill; the label fades while pressed. For a link that draws its own label.
///
///     Button(action: open) { Text("Terms").underline() }.buttonStyle(.textLink)
public struct TextLinkStyle: ButtonStyle {
    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        TextLinkPressLook(label: configuration.label, isPressed: configuration.isPressed)
    }

    /// The label's strength while pressed.
    static let pressedOpacity = 0.6
    /// The label's strength while disabled.
    static let disabledOpacity = 0.5
}

private struct TextLinkPressLook<Label: View>: View {
    let label: Label
    let isPressed: Bool

    var body: some View {
        label
            .opacity(isPressed ? TextLinkStyle.pressedOpacity : 1)
            .koboAnimation(isPressed ? .instant : .exit, value: isPressed)
    }
}

extension ButtonStyle where Self == TextLinkStyle {
    /// The text-link press look. See `TextLinkStyle`.
    public static var textLink: TextLinkStyle { TextLinkStyle() }
}

#if DEBUG
    private struct TextLinkPreview: View {
        var body: some View {
            VStack(alignment: .leading, spacing: Space.xs) {
                TextLink("Use a recovery code") {}
                TextLink("Text me a code instead") {}.disabled(true)
                TextLink(verbatim: "Resend code (12 s)", disabledLook: .muted) {}.disabled(true)
            }
            .padding(Space.gutter)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Text link") { TextLinkPreview() }
    #Preview("Text link · dark, Amber") { TextLinkPreview().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Text link · AX3") { TextLinkPreview().dynamicTypeSize(.accessibility3) }
#endif
