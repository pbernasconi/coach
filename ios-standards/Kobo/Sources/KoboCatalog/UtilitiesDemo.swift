import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Live demos for the Utilities section: layout readers, value holders and masked values.
struct UtilitiesDemo: View {
    let component: CatalogComponent
    @State private var note: String? = "Draft the project brief"
    @State private var isRevealed = false
    @Environment(\.koboTheme) private var theme

    var body: some View {
        switch component {
        case .accessibilitySizeReader:
            AccessibilitySizeReader { isLarge in
                let layout = isLarge ? AnyLayout(VStackLayout(alignment: .leading)) : AnyLayout(HStackLayout())
                layout {
                    Text("Due")
                    Spacer(minLength: Space.sm)
                    Text(verbatim: isLarge ? "Stacked at accessibility sizes" : "Side by side")
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
        case .wideWindowReader:
            WideWindowReader { isWide in
                if isWide {
                    Label("Wide window: two columns", systemImage: "rectangle.split.2x1")
                } else {
                    Label("Compact window: one column", systemImage: "iphone")
                }
            }
        case .adaptiveColumns:
            AdaptiveColumns {
                Text("Task details").frame(maxWidth: .infinity, alignment: .leading).koboCard()
            } secondary: {
                Text("Activity").frame(maxWidth: .infinity, alignment: .leading).koboCard()
            }
        case .holdsLastValue:
            VStack(alignment: .leading, spacing: Space.md) {
                HoldsLastValue(note) { shown in Text(verbatim: shown).font(theme.font(.headline)) }
                Button("Clear or restore the value") { note = note == nil ? "Draft the project brief" : nil }
                    .buttonStyle(.kobo(.secondary))
            }
        case .maskedValue:
            VStack(alignment: .leading, spacing: Space.sm) {
                MaskedValue(tail: "4821", accessibilityLabel: "Card ending 4821")
                MaskedValue(tail: "42", mask: "•••• ••••", tailSeparator: " ")
            }
        case .revealableValue:
            RevealableValue(verbatim: "lantern-meadow-73", isRevealed: $isRevealed, visibleTail: 2)
        case .deferredRow:
            VStack(spacing: 0) {
                ForEach(
                    CatalogSamples.places,
                    content: DeferredRow.content { (place: CatalogPlace) in
                        ListRow(verbatim: place.name, value: place.detail)
                    }
                )
            }
        default: EmptyView()
        }
    }
}
