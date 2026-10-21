import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Dumb view: the activity page section by section, and the large map (SCR-2).
struct ActivityDetailContent: View {
    let state: ActivityDetailState
    let send: (ActivityDetailAction) -> Void

    var body: some View {
        ScrollView {
            AppResourcePage(
                state.detail,
                onRetry: { send(.retryTapped) },
                onConnect: { send(.connectTapped) }
            ) { detail in
                ActivitySections(detail: detail, state: state, send: send)
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        // No bar title: the page's header names the activity.
        .navigationBarTitleDisplayMode(.inline)
        .koboSheet(
            isPresented: Binding.action(state.destination == .map) { if !$0 { send(.destinationDismissed) } },
            title: "Route",
            detents: [.large]
        ) {
            if let route = state.detail.content.value?.route?.value {
                KoboRouteMap(
                    points: route.coordinates,
                    interaction: .interactive,
                    height: .tall,
                    accessibilityLabel: "Route map"
                )
            }
        }
    }
}
