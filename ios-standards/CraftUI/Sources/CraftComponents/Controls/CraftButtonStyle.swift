import CraftTokens
import SwiftUI

/// The button look of CraftUI: a capsule in one of six variants and three sizes. It keeps the system `Button`, so
/// accessibility, keyboard and pointer behaviour stay native.
///
///     Button("Start workout", action: start).buttonStyle(.craft(.primary, width: .full))
///     Button("Skip", action: skip).buttonStyle(.craft(.glass, size: .compact))
///
/// A press shrinks the capsule a little and veils its fill on `Motion.instant`. While `isLoading`, a spinner replaces
/// the label, which stays laid out (hidden) so the width never changes, and presses are ignored.
public struct CraftButtonStyle: ButtonStyle {
    @Environment(\.craftTheme) private var theme
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
            .modifier(ButtonSurface(look: look, usesGlass: variant == .glass, isPressed: isPressed))
            .contentShape(Capsule())
            .scaleEffect(isPressed ? PressMetrics.scale : 1)
            .craftAnimation(.instant, value: isPressed)
            .craftAnimation(.state, value: isLoading)
            .padding(.vertical, size.targetInset)
            .contentShape(Rectangle())
            .allowsHitTesting(!isLoading)
            .accessibilityValue(isLoading ? Text("In progress") : Text(verbatim: ""))
    }
}

extension ButtonStyle where Self == CraftButtonStyle {
    /// The CraftUI button look. See `CraftButtonStyle`.
    public static func craft(
        _ variant: CraftButtonStyle.Variant = .primary,
        size: CraftButtonStyle.Size = .regular,
        width: CraftButtonStyle.Width = .hug,
        isLoading: Bool = false
    ) -> CraftButtonStyle {
        CraftButtonStyle(variant, size: size, width: width, isLoading: isLoading)
    }
}

/// The capsule behind the label: Liquid Glass for `.glass`, otherwise the variant fill with the press veil on top.
private struct ButtonSurface: ViewModifier {
    @Environment(\.craftTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    let look: ButtonLook
    let usesGlass: Bool
    let isPressed: Bool

    func body(content: Content) -> some View {
        if usesGlass && theme.surfaceStyle == .glass {
            let glass: Glass = isEnabled ? Glass.regular.interactive() : Glass.regular
            content.glassEffect(glass, in: Capsule())
        } else {
            content.background {
                ZStack {
                    Capsule().fill(usesGlass ? theme.palette.surfaceRaised : look.fill)
                    Capsule().fill(theme.palette.pressVeil(isPressed))
                }
            }
        }
    }
}

#if DEBUG
    private struct CraftButtonGallery: View {
        @Environment(\.craftTheme) private var theme

        var body: some View {
            ScrollView {
                VStack(spacing: Space.md) {
                    Button("Primary") {}.buttonStyle(.craft(.primary, width: .full))
                    Button("Secondary") {}.buttonStyle(.craft(.secondary, width: .full))
                    Button("Tonal") {}.buttonStyle(.craft(.tonal, width: .full))
                    Button("Glass") {}.buttonStyle(.craft(.glass, width: .full))
                    Button("Delete set") {}.buttonStyle(.craft(.destructive, width: .full))
                    Button("Plain") {}.buttonStyle(.craft(.plain))
                    Button("Saving") {}.buttonStyle(.craft(.primary, width: .full, isLoading: true))
                    Button("Disabled") {}.buttonStyle(.craft(.primary, width: .full)).disabled(true)
                    HStack(spacing: Space.sm) {
                        Button("Compact") {}.buttonStyle(.craft(.secondary, size: .compact))
                        Button("Glass") {}.buttonStyle(.craft(.glass, size: .compact))
                        Button {
                        } label: {
                            Image(systemName: "plus")
                        }
                        .buttonStyle(.craft(.primary, size: .icon))
                        .accessibilityLabel("Add")
                    }
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Button") { CraftButtonGallery() }
    #Preview("Button · dark, Lift") { CraftButtonGallery().craftTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Button · AX3") { CraftButtonGallery().dynamicTypeSize(.accessibility3) }
#endif
