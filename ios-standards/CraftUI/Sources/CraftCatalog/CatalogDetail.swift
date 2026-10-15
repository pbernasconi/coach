import CraftComponents
import CraftTokens
import SwiftUI

/// One component's page: its summary and a live, interactive demo on a card.
struct CatalogDetail: View {
    let component: CatalogComponent
    @Environment(\.craftTheme) private var theme

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                Text(component.summary)
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.textSecondary)
                demo
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .craftCard()
            }
            .padding(Space.lg)
        }
        .background(theme.palette.canvas)
        .navigationTitle(component.title)
    }

    @ViewBuilder private var demo: some View {
        switch component.section {
        case .controls: ControlsDemo(component: component)
        case .feedback: FeedbackDemo(component: component)
        case .display: DisplayDemo(component: component)
        case .layout: LayoutDemo(component: component)
        case .patterns: PatternsDemo(component: component)
        }
    }
}

#if DEBUG
    #Preview("Detail") {
        NavigationStack { CatalogDetail(component: .stepperField) }.craftTheme(.lift)
    }
    #Preview("Detail · dark") {
        NavigationStack { CatalogDetail(component: .countdownRing) }.preferredColorScheme(.dark)
    }
    #Preview("Detail · AX3") {
        NavigationStack { CatalogDetail(component: .listRow) }.dynamicTypeSize(.accessibility3)
    }
#endif
