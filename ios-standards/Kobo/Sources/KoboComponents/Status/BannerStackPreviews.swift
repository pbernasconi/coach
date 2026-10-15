import KoboTokens
import SwiftUI

#if DEBUG
    nonisolated private enum PreviewBanner: String, StackableBanner, CaseIterable {
        case update, maintenance, tip

        var id: String { rawValue }

        var priority: BannerPriority {
            switch self {
            case .update: .low
            case .maintenance: .critical
            case .tip: .normal
            }
        }
    }

    private struct BannerStackPreview: View {
        @State private var banners = PreviewBanner.allCases
        @State private var isOffline = true

        var body: some View {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.md) {
                    Toggle("Offline", isOn: $isOffline)
                    Button("Reset banners") { banners = PreviewBanner.allCases }
                    ForEach(1..<8) { index in
                        Text("Row \(index)").koboCard()
                    }
                }
                .padding(Space.gutter)
            }
            .background(Theme.system.palette.canvas)
            .bannerStack(banners, isOffline: isOffline, maxVisible: 3) { banner in
                switch banner {
                case .update:
                    NudgeBanner("A new version is available.", action: .init("Update") {}) { dismiss(banner) }
                case .maintenance:
                    SystemNotice("Sync is paused for maintenance.", symbol: "wrench.and.screwdriver") {
                        dismiss(banner)
                    }
                case .tip:
                    NudgeBanner("Swipe a row to log it.", symbol: "hand.draw") { dismiss(banner) }
                }
            }
        }

        private func dismiss(_ banner: PreviewBanner) {
            banners.removeAll { $0 == banner }
        }
    }

    #Preview("Banner stack") { BannerStackPreview() }
    #Preview("Banner stack · dark, Lift") { BannerStackPreview().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Banner stack · AX3") { BannerStackPreview().dynamicTypeSize(.accessibility3) }
#endif
