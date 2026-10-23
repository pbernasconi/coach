import KoboTokens
import SwiftUI

extension View {
    /// Makes a stack of `Skeleton`s the loading state of a whole page or section: it breathes as one, stays invisible
    /// for `Motion.Duration.loadingGrace` (a fast load shows nothing), takes no touches, fills the width from the top
    /// leading corner, and reads to VoiceOver as one element, "Loading". Draw the skeleton in the geometry of the real
    /// content (same stack spacing, same cards), so the content paints into its place.
    ///
    ///     VStack(alignment: .leading, spacing: Space.section) {
    ///         SkeletonHeader()
    ///         SkeletonCard(lines: 2)
    ///     }
    ///     .skeletonPage()
    ///
    /// - Parameters:
    ///   - waits: `false` shows it at once, for a page whose final layout is already on screen (a sheet that will
    ///     drop to show a map) and would look empty without it.
    ///   - clock: the time source of the grace period; tests pass a manual clock.
    public func skeletonPage(waits: Bool = true, clock: any Clock<Duration> = ContinuousClock()) -> some View {
        modifier(SkeletonPageModifier(waits: waits, clock: clock))
    }
}

private struct SkeletonPageModifier: ViewModifier {
    let waits: Bool
    let clock: any Clock<Duration>

    func body(content: Content) -> some View {
        let page =
            content
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .skeletonBreath()
            .allowsHitTesting(false)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text("Loading", bundle: .module))
            .accessibilityAddTraits(.updatesFrequently)
        if waits {
            page.loadingGrace(clock: clock)
        } else {
            page
        }
    }
}

#if DEBUG
    private struct SkeletonPagePreview: View {
        var body: some View {
            VStack(alignment: .leading, spacing: Space.lg) {
                Skeleton(.line, textRole: .title).frame(maxWidth: Size.minTouch * 5)
                Skeleton(.line).frame(maxWidth: Size.minTouch * 3)
                Skeleton(.block).frame(height: Size.thumbnail * 2)
            }
            .skeletonPage()
            .pageGutter()
        }
    }

    #Preview("Skeleton page") { SkeletonPagePreview() }
    #Preview("Skeleton page, dark") { SkeletonPagePreview().preferredColorScheme(.dark) }
    #Preview("Skeleton page, AX3") { SkeletonPagePreview().dynamicTypeSize(.accessibility3) }
#endif
