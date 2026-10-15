import KoboTokens
import SwiftUI

/// Hands its content whether an accessibility text size (AX1 and up) is active, so a row can restack at the largest
/// sizes without reading the environment itself. Draws nothing of its own.
///
///     AccessibilitySizeReader { isLarge in
///         let layout = isLarge ? AnyLayout(VStackLayout(alignment: .leading)) : AnyLayout(HStackLayout())
///         layout { title; value }
///     }
public struct AccessibilitySizeReader<Content: View>: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private let content: (Bool) -> Content

    public init(@ViewBuilder content: @escaping (_ isAccessibilitySize: Bool) -> Content) {
        self.content = content
    }

    public var body: some View {
        content(dynamicTypeSize.isAccessibilitySize)
    }
}

#if DEBUG
    private struct AccessibilitySizeReaderPreview: View {
        @Environment(\.koboTheme) private var theme

        var body: some View {
            AccessibilitySizeReader { isLarge in
                let layout = isLarge ? AnyLayout(VStackLayout(alignment: .leading)) : AnyLayout(HStackLayout())
                layout {
                    Text("Due date").font(theme.font(.body))
                    Spacer(minLength: Space.sm)
                    Text(verbatim: isLarge ? "Stacked" : "Side by side").foregroundStyle(theme.palette.textSecondary)
                }
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Accessibility size reader") { AccessibilitySizeReaderPreview() }
    #Preview("Accessibility size reader · dark, Amber") {
        AccessibilitySizeReaderPreview().koboTheme(.amber).preferredColorScheme(.dark)
    }
    #Preview("Accessibility size reader · AX3") { AccessibilitySizeReaderPreview().dynamicTypeSize(.accessibility3) }
#endif
