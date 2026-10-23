import KoboTokens
import SwiftUI

extension View {
    /// Keeps a placeholder invisible for its first `Motion.Duration.loadingGrace` (0.4 s), then fades it in, so a load
    /// that answers quickly shows no placeholder at all. While invisible it is hidden from VoiceOver too. Shows at once
    /// under `koboFreezesMotion` (snapshots). `LoadingState` and `.skeletonPage()` use it.
    ///
    ///     NoteListSkeleton().loadingGrace()
    ///
    /// - Parameter clock: the time source; tests pass a manual clock.
    public func loadingGrace(clock: any Clock<Duration> = ContinuousClock()) -> some View {
        modifier(LoadingGraceModifier(clock: clock))
    }
}

/// The `task` of `.loadingGrace`, inside a modifier on purpose (see `SlowWaitModifier`).
private struct LoadingGraceModifier: ViewModifier {
    let clock: any Clock<Duration>
    @Environment(\.koboFreezesMotion) private var freezesMotion
    @State private var stage = LoadingGrace.waiting

    func body(content: Content) -> some View {
        let isVisible = stage.isVisible || freezesMotion
        content
            .opacity(isVisible ? 1 : 0)
            .accessibilityHidden(!isVisible)
            .koboAnimation(.enter, value: isVisible)
            .task {
                guard !stage.isVisible else { return }
                await LoadingGrace.timer(clock: clock) { next in
                    if next == .shown { stage = next }
                }
            }
    }
}

#if DEBUG
    private struct LoadingGracePreview: View {
        var body: some View {
            VStack(alignment: .leading, spacing: Space.sm) {
                Text(verbatim: "The bars appear after the grace period.")
                Skeleton(.line).frame(maxWidth: Size.minTouch * 4)
                Skeleton(.block).frame(height: Size.thumbnail)
            }
            .loadingGrace()
            .padding()
        }
    }

    #Preview("Loading grace") { LoadingGracePreview() }
    #Preview("Loading grace, dark") { LoadingGracePreview().preferredColorScheme(.dark) }
    #Preview("Loading grace, AX3") { LoadingGracePreview().dynamicTypeSize(.accessibility3) }
#endif
