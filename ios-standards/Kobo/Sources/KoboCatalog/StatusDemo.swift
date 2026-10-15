import KoboComponents
import KoboTokens
import SwiftUI

/// Live demos for the Status section: banners, notices, inline progress and section states.
struct StatusDemo: View {
    let component: CatalogComponent
    @State private var banners = DemoBanner.allCases
    @State private var isOffline = false
    @State private var progress = 0.4
    @State private var isRetrying = false

    var body: some View {
        switch component {
        case .bannerStack: bannerStack
        case .nudgeBanner:
            NudgeBanner(
                "Turn on backups to keep your notes safe.",
                symbol: "icloud",
                action: BannerAction("Turn on") {}
            ) {}
        case .systemNotice:
            VStack(spacing: 0) {
                SystemNotice("Sync is paused for maintenance.", symbol: "wrench.and.screwdriver", onDismiss: {})
                Separator()
                SystemNotice(
                    verbatim: "You're viewing a read-only copy.",
                    tone: .info,
                    action: BannerAction("Learn more") {}
                )
            }
        case .offlineBanner:
            VStack(spacing: 0) {
                OfflineBanner()
                Separator()
                OfflineBanner(isBackOnline: true)
            }
        case .inlineNotice:
            VStack(spacing: Space.md) {
                InlineNotice("Due dates use your device's time zone.")
                InlineNotice(verbatim: "Two tasks are overdue.", tone: .warning, action: BannerAction("Review") {})
                InlineNotice(tone: .info, verbatimLines: ["Shared with 2 people.", "They can edit tasks."])
            }
        case .iconNotice:
            IconNotice(
                systemImage: "lock",
                tone: .warning,
                title: "Editing is locked",
                message: "This list is archived."
            )
        case .inlineProgress:
            VStack(alignment: .leading, spacing: Space.md) {
                InlineProgress(value: progress, accessibilityLabel: "Uploading attachment")
                InlineProgress(accessibilityLabel: "Syncing", tone: .info)
                Slider(value: $progress) { Text("Progress") }
            }
        case .sectionState:
            VStack(alignment: .leading, spacing: Space.xl) {
                SectionState(verbatim: "Couldn't load recent notes.", isRetrying: isRetrying) { isRetrying.toggle() }
                SectionState("No tasks due this week", message: "Add one from the Inbox.")
            }
        case .slowWaitNote:
            VStack(alignment: .leading, spacing: Space.md) {
                SlowWaitNote(.slow)
                SlowWaitNote(.verySlow, verySlow: "Large files can take a few minutes.")
            }
        default: EmptyView()
        }
    }

    private var bannerStack: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            BannerStack(banners, isOffline: isOffline, maxVisible: 2) { banner in
                switch banner {
                case .update:
                    NudgeBanner("A new version is available.", action: BannerAction("Update") {}) { dismiss(banner) }
                case .maintenance:
                    SystemNotice("Sync is paused for maintenance.", symbol: "wrench.and.screwdriver") {
                        dismiss(banner)
                    }
                }
            }
            Toggle("Offline", isOn: $isOffline)
            Button("Reset banners") { banners = DemoBanner.allCases }.buttonStyle(.kobo(.secondary))
        }
    }

    private func dismiss(_ banner: DemoBanner) {
        banners.removeAll { $0 == banner }
    }
}

/// Made-up app banners for the banner stack demo.
private enum DemoBanner: String, StackableBanner, CaseIterable {
    case update, maintenance

    var id: String { rawValue }

    var priority: BannerPriority {
        switch self {
        case .update: .low
        case .maintenance: .critical
        }
    }
}
