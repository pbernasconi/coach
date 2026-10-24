import KoboTokens
import SwiftUI

/// The button look of Kobo: a capsule in one of six variants and three sizes. It keeps the system `Button`, so
/// accessibility, keyboard and pointer behaviour stay native.
///
///     Button("Get started", action: start).buttonStyle(.kobo(.primary, width: .full))
///     Button("Skip", action: skip).buttonStyle(.kobo(.glass, size: .compact))
///
/// A press shrinks the capsule a little and veils its fill on `Motion.instant`. While `isLoading`, a spinner replaces
/// the label, which stays laid out (hidden) so the width never changes, the enabled fill stays (a red destructive
/// confirm never turns grey while it works), and presses are ignored. A disabled button draws the palette's disabled
/// roles, never an opacity, and the fill and ink change together in one `Motion.instant` step when it wakes up.
public struct KoboButtonStyle: ButtonStyle {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private let variant: Variant
    private let size: Size
    private let width: Width
    private let isLoading: Bool

    public init(_ variant: Variant = .primary, size: Size = .regular, width: Width = .hug, isLoading: Bool = false) {
        self.variant = variant
        self.size = size
        self.width = width
        self.isLoading = isLoading
    }

    public func makeBody(configuration: Configuration) -> some View {
        let look = ButtonLook.resolve(variant, palette: theme.palette, isEnabled: isEnabled)
        let isPressed = configuration.isPressed && !isLoading
        configuration.label
            .font(theme.font(size.fontRole).weight(.semibold))
            .multilineTextAlignment(.center)
            .opacity(isLoading ? 0 : 1)
            .overlay {
                if isLoading {
                    ProgressView().tint(look.foreground).accessibilityHidden(true)
                }
            }
            .foregroundStyle(look.foreground)
            .padding(.horizontal, size.horizontalPadding)
            // A wrapped label at an accessibility size grows past the height, so it keeps an inset.
            .padding(.vertical, dynamicTypeSize.isAccessibilitySize ? Space.sm : 0)
            .frame(
                minWidth: size == .icon ? size.height : nil,
                maxWidth: width == .full ? .infinity : nil,
                minHeight: size.height
            )
            .modifier(ButtonSurface(variant: variant, look: look, isPressed: isPressed))
            .contentShape(Capsule())
            .scaleEffect(isPressed ? PressMetrics.scale : 1)
            .koboAnimation(.instant, value: isPressed)
            .koboAnimation(.state, value: isLoading)
            .koboAnimation(.instant, value: isEnabled)
            .padding(.vertical, size.targetInset)
            .contentShape(Rectangle())
            // An inline button keeps its capsule but lays out at its label's width, on the keyline.
            .padding(.horizontal, width == .inline ? -size.horizontalPadding : 0)
            .allowsHitTesting(!isLoading)
            .accessibilityValue(isLoading ? Text("In progress", bundle: .module) : Text(verbatim: ""))
    }
}

extension ButtonStyle where Self == KoboButtonStyle {
    /// The Kobo button look. See `KoboButtonStyle`.
    public static func kobo(
        _ variant: KoboButtonStyle.Variant = .primary,
        size: KoboButtonStyle.Size = .regular,
        width: KoboButtonStyle.Width = .hug,
        isLoading: Bool = false
    ) -> KoboButtonStyle {
        KoboButtonStyle(variant, size: size, width: width, isLoading: isLoading)
    }
}

/// The capsule behind the label. Under a glass theme every filled variant is Liquid Glass, as iOS 26 draws its own
/// buttons: primary is glass tinted the accent (the system's `.glassProminent`), tonal is glass tinted the soft accent,
/// secondary and glass are clear glass, destructive tonal is glass tinted the soft danger. The destructive fill stays
/// solid, so a delete never looks like a lesser action, and plain stays ink only. A solid theme, and a disabled filled
/// variant, draw the flat fill.
private struct ButtonSurface: ViewModifier {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    let variant: KoboButtonStyle.Variant
    let look: ButtonLook
    let isPressed: Bool

    func body(content: Content) -> some View {
        let glass = ButtonGlass.resolve(variant, palette: theme.palette, isEnabled: isEnabled)
        if theme.surfaceStyle == .glass, let glass {
            content.glassEffect(glass, in: Capsule())
        } else {
            content.background {
                ZStack {
                    Capsule().fill(variant == .glass ? theme.palette.surfaceRaised : look.fill)
                    Capsule().fill(theme.palette.pressVeil(isPressed))
                }
            }
        }
    }
}

/// The Liquid Glass of a variant under a glass theme, or `nil` for a variant that keeps its flat fill.
private enum ButtonGlass {
    static func resolve(_ variant: KoboButtonStyle.Variant, palette: Palette, isEnabled: Bool) -> Glass? {
        // A disabled filled button keeps the flat disabled fill: an untinted glass pill would still read as enabled.
        switch variant {
        case .glass: return isEnabled ? Glass.regular.interactive() : Glass.regular
        case .primary: return isEnabled ? Glass.regular.tint(palette.accent).interactive() : nil
        case .tonal: return isEnabled ? Glass.regular.tint(palette.accentSoft).interactive() : nil
        case .secondary: return isEnabled ? Glass.regular.interactive() : nil
        case .destructiveTonal: return isEnabled ? Glass.regular.tint(palette.danger.soft).interactive() : nil
        case .destructive, .plain: return nil
        }
    }
}

#if DEBUG
    private struct KoboButtonGallery: View {
        @Environment(\.koboTheme) private var theme

        var body: some View {
            ScrollView {
                VStack(spacing: Space.md) {
                    Button("Primary") {}.buttonStyle(.kobo(.primary, width: .full))
                    Button("Secondary") {}.buttonStyle(.kobo(.secondary, width: .full))
                    Button("Tonal") {}.buttonStyle(.kobo(.tonal, width: .full))
                    Button("Glass") {}.buttonStyle(.kobo(.glass, width: .full))
                    Button("Delete set") {}.buttonStyle(.kobo(.destructive, width: .full))
                    Button("Plain") {}.buttonStyle(.kobo(.plain))
                    Button("Inline, on the keyline") {}
                        .buttonStyle(.kobo(.plain, size: .compact, width: .inline))
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Button("Saving") {}.buttonStyle(.kobo(.primary, width: .full, isLoading: true))
                    Button("Disabled") {}.buttonStyle(.kobo(.primary, width: .full)).disabled(true)
                    HStack(spacing: Space.sm) {
                        Button("Compact") {}.buttonStyle(.kobo(.secondary, size: .compact))
                        Button("Glass") {}.buttonStyle(.kobo(.glass, size: .compact))
                        Button {
                        } label: {
                            Image(systemName: "plus")
                        }
                        .buttonStyle(.kobo(.primary, size: .icon))
                        .accessibilityLabel("Add")
                    }
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Button") { KoboButtonGallery() }
    #Preview("Button · dark, Amber") { KoboButtonGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Button · AX3") { KoboButtonGallery().dynamicTypeSize(.accessibility3) }
#endif
