import KoboTokens
import SwiftUI

/// A small phone drawn in one theme and appearance, for a `ThemePicker`: the canvas, a title bar, a card with two lines
/// and an accent button. `.system` draws light on the leading half and dark on the trailing half. The palette's colours
/// resolve for the forced scheme, so a dark phone shows in a light app. Decorative.
struct AppearancePreview: View {
    @ScaledMetric(relativeTo: .body) private var width = Size.thumbnail + Space.lg
    let theme: Theme
    let mode: AppearanceMode

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
        Group {
            switch mode {
            case .light: phone(.light)
            case .dark: phone(.dark)
            case .system:
                phone(.light)
                    .overlay(alignment: .trailing) {
                        phone(.dark).mask(alignment: .trailing) { Rectangle().frame(width: width / 2) }
                    }
            }
        }
        .frame(width: width, height: width * Self.aspect)
        .clipShape(shape)
        .overlay { shape.strokeBorder(theme.palette.separator, lineWidth: Size.hairline) }
        .accessibilityHidden(true)
    }

    /// Height over width of the phone.
    static let aspect: CGFloat = 1.5

    private func phone(_ scheme: ColorScheme) -> some View {
        let palette = theme.palette
        return VStack(alignment: .leading, spacing: Space.xs) {
            Capsule().fill(palette.textPrimary).frame(width: width * 0.4, height: Space.xs)
            VStack(alignment: .leading, spacing: Space.xs) {
                Capsule().fill(palette.textSecondary).frame(width: width * 0.5, height: Space.xs)
                Capsule().fill(palette.textTertiary).frame(width: width * 0.35, height: Space.xs)
            }
            .padding(Space.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(palette.surface, in: RoundedRectangle(cornerRadius: Radius.xs, style: .continuous))
            Spacer(minLength: 0)
            Capsule().fill(palette.accent).frame(height: Space.md)
        }
        .padding(Space.sm)
        .frame(width: width, height: width * Self.aspect, alignment: .topLeading)
        .background(palette.canvas)
        .environment(\.colorScheme, scheme)
    }
}
