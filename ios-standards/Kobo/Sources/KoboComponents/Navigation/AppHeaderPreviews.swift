import KoboTokens
import SwiftUI

#if DEBUG
    private struct AppHeaderPreview: View {
        var body: some View {
            NavigationStack {
                ScrollView {
                    VStack(spacing: Space.md) {
                        ForEach(1..<12) { index in
                            Text("Card \(index)").koboCard()
                        }
                    }
                    .pageGutter()
                }
                .screenCanvas()
                .tabRootHeader {
                    AppHeader("Today", kicker: "Week 3", profile: .init(name: "Mira Castellan") {}) {
                        Button("Search", systemImage: "magnifyingglass") {}
                        Button("Notifications", systemImage: "bell") {}.countBadge(3)
                    }
                }
            }
        }
    }

    private struct AppHeaderVariants: View {
        var body: some View {
            VStack(spacing: 0) {
                AppHeader("Library")
                AppHeader(verbatim: "Alexandria's very long reading list", kicker: "Shared with you") {
                    Button("Share", systemImage: "square.and.arrow.up") {}
                }
                AppHeader("Profile", profile: .init(name: nil, showsName: true) {})
                Spacer()
            }
            .screenCanvas()
        }
    }

    #Preview("App header") { AppHeaderPreview() }
    #Preview("App header · variants") { AppHeaderVariants() }
    #Preview("App header · dark, Amber") { AppHeaderPreview().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("App header · solid") {
        AppHeaderVariants().koboTheme(Theme(palette: .system, surfaceStyle: .solid))
    }
    #Preview("App header · AX3") { AppHeaderVariants().dynamicTypeSize(.accessibility3) }
#endif
