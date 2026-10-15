import KoboTokens
import SwiftUI

/// Two pieces of content side by side on a wide window (`WideWindowReader`) and stacked on a phone or a narrow window.
/// The switch keeps both children's identity (one `AnyLayout`), so state survives a rotation or a Split View resize.
///
///     AdaptiveColumns {
///         SummaryCard()
///     } secondary: {
///         HistoryList()
///     }
public struct AdaptiveColumns<Primary: View, Secondary: View>: View {
    private let spacing: CGFloat
    private let primary: Primary
    private let secondary: Secondary

    /// - Parameter spacing: the gap between the columns, or between the stacked pieces.
    public init(
        spacing: CGFloat = Space.xxl,
        @ViewBuilder primary: () -> Primary,
        @ViewBuilder secondary: () -> Secondary
    ) {
        self.spacing = spacing
        self.primary = primary()
        self.secondary = secondary()
    }

    public var body: some View {
        WideWindowReader { isWide in
            let layout =
                isWide
                ? AnyLayout(HStackLayout(alignment: .top, spacing: spacing))
                : AnyLayout(VStackLayout(alignment: .leading, spacing: spacing))
            layout {
                primary.frame(maxWidth: .infinity, alignment: .topLeading)
                secondary.frame(maxWidth: .infinity, alignment: .topLeading)
            }
        }
    }
}

#if DEBUG
    private struct AdaptiveColumnsPreview: View {
        var body: some View {
            ScrollView {
                AdaptiveColumns {
                    Text("Primary column").koboCard()
                } secondary: {
                    Text("Secondary column").koboCard()
                }
                .pageGutter()
                .readableWidth()
            }
            .screenCanvas()
        }
    }

    #Preview("Adaptive columns") { AdaptiveColumnsPreview() }
    #Preview("Adaptive columns · dark, Lift") { AdaptiveColumnsPreview().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Adaptive columns · AX3") { AdaptiveColumnsPreview().dynamicTypeSize(.accessibility3) }
#endif
