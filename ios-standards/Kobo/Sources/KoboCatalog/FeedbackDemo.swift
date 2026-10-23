import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Live demos for the Feedback section.
struct FeedbackDemo: View {
    let component: CatalogComponent
    @State private var toasts = ToastCenter()
    @State private var bannerVisible = true
    @State private var live = true
    @State private var replay = 0

    var body: some View {
        switch component {
        case .toast:
            VStack(alignment: .leading, spacing: Space.sm) {
                Button("Show toast") { toasts.show(Toast("Task added", tone: .success)) }
                Button("Show toast with undo") {
                    toasts.show(Toast("Task deleted", action: Toast.Action("Undo") {}))
                }
            }
            .buttonStyle(.kobo(.secondary))
            .frame(maxWidth: .infinity, minHeight: Size.minTouch * 3)
            .toastHost(toasts)
        case .skeleton:
            HStack(spacing: Space.md) {
                Skeleton(.circle).frame(width: Size.minTouch, height: Size.minTouch)
                VStack(alignment: .leading, spacing: Space.xs) {
                    Skeleton(.line)
                    Skeleton(.line).frame(maxWidth: Size.minTouch * 3)
                }
            }
            .skeletonBreath()
        case .shimmer:
            Text("Book flights · Due Friday · 30 min").redacted(reason: .placeholder).shimmering()
        case .skeletonPage:
            VStack(alignment: .leading, spacing: Space.md) {
                VStack(alignment: .leading, spacing: Space.md) {
                    Skeleton(.line, textRole: .headline).frame(maxWidth: Size.minTouch * 4)
                    Skeleton(.block).frame(height: Size.thumbnail)
                }
                .skeletonPage()
                .id(replay)
                Button("Replay") { replay += 1 }.buttonStyle(.kobo(.secondary))
            }
        case .loadingGrace:
            VStack(alignment: .leading, spacing: Space.md) {
                Text("Shown after a short grace").loadingGrace().id(replay)
                Button("Replay") { replay += 1 }.buttonStyle(.kobo(.secondary))
            }
        case .loadingState: LoadingState("Loading history")
        case .emptyState:
            EmptyState(symbol: "checklist", title: "No tasks yet", message: "Plan a day to get started.") {
                Button("Plan a day") {}.buttonStyle(.kobo(.primary))
            }
        case .emptyStateArt:
            HStack(spacing: Space.lg) {
                EmptyStateArt(systemImage: "tray")
                EmptyStateArt(systemImage: "calendar.badge.plus", tone: .accent, scale: .large)
            }
        case .errorState:
            ErrorState(title: "Couldn't sync", message: "Changes are saved on this phone.", retryLabel: "Try again") {}
        case .noticeBanner:
            if bannerVisible {
                NoticeBanner(
                    tone: .info,
                    title: "Quiet week",
                    message: "Reminders are paused until Monday.",
                    action: NoticeBanner.Action("Details") {},
                    onDismiss: { bannerVisible = false }
                )
            } else {
                Button("Show banner again") { bannerVisible = true }
            }
        case .statusPill:
            HStack {
                StatusPill("Synced", tone: .success)
                StatusPill("Offline", tone: .warning)
                StatusPill("Failed", tone: .danger)
            }
        case .pulse:
            Toggle("Live", isOn: $live)
                .padding(Space.sm)
                .pulse(active: live, in: Capsule())
        default: EmptyView()
        }
    }
}
