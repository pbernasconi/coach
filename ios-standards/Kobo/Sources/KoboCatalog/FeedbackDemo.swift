import KoboComponents
import KoboTokens
import SwiftUI

/// Live demos for the Feedback section.
struct FeedbackDemo: View {
    let component: CatalogComponent
    @State private var toasts = ToastCenter()
    @State private var bannerVisible = true
    @State private var live = true

    var body: some View {
        switch component {
        case .toast:
            VStack(alignment: .leading, spacing: Space.sm) {
                Button("Show toast") { toasts.show(Toast("Set logged", tone: .success)) }
                Button("Show toast with undo") {
                    toasts.show(Toast("Set deleted", action: Toast.Action("Undo") {}))
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
            Text("Back squat · 3 × 8 · 135 lb").redacted(reason: .placeholder).shimmering()
        case .loadingState: LoadingState("Loading history")
        case .emptyState:
            EmptyState(symbol: "dumbbell", title: "No workouts yet", message: "Plan a day to get started.") {
                Button("Plan a day") {}.buttonStyle(.kobo(.primary))
            }
        case .errorState:
            ErrorState(title: "Couldn't sync", message: "Changes are saved on this phone.", retryLabel: "Try again") {}
        case .noticeBanner:
            if bannerVisible {
                NoticeBanner(
                    tone: .info,
                    title: "Deload week",
                    message: "Weights are 10% lighter this week.",
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
