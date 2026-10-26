import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// One component's page: its summary and a live, interactive demo on a card.
struct CatalogDetail: View {
    let component: CatalogComponent
    @Environment(\.koboTheme) private var theme

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                Text(component.summary)
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.textSecondary)
                demo
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .koboCard()
            }
            .padding(.vertical, Space.lg)
            .pageColumn()
        }
        .background(theme.palette.canvas)
        .navigationTitle(component.title)
    }

    @ViewBuilder private var demo: some View {
        switch component.section {
        case .controls: ControlsDemo(component: component)
        case .selection: SelectionDemo(component: component)
        case .fields: FieldsDemo(component: component)
        case .search: SearchDemo(component: component)
        case .feedback: FeedbackDemo(component: component)
        case .status: StatusDemo(component: component)
        case .display: DisplayDemo(component: component)
        case .charts: ChartsDemo(component: component)
        case .layout: LayoutDemo(component: component)
        case .navigation: NavigationDemo(component: component)
        case .overlays: OverlaysDemo(component: component)
        case .quickActions: QuickActionsDemo(component: component)
        case .utilities: UtilitiesDemo(component: component)
        case .patterns: PatternsDemo(component: component)
        case .lists: ListsDemo(component: component)
        case .flows: FlowsDemo(component: component)
        case .chat: ChatDemo(component: component)
        }
    }
}

#if DEBUG
    #Preview("Detail") {
        NavigationStack { CatalogDetail(component: .stepperField) }.koboTheme(.amber)
    }
    #Preview("Detail · dark") {
        NavigationStack { CatalogDetail(component: .countdownRing) }.preferredColorScheme(.dark)
    }
    #Preview("Detail · AX3") {
        NavigationStack { CatalogDetail(component: .listRow) }.dynamicTypeSize(.accessibility3)
    }
#endif
