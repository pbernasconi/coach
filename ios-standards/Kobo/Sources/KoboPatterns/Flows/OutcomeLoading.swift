import KoboComponents
import KoboTokens
import SwiftUI

/// An outcome whose result has not arrived: skeletons at the settled layout (the hero disc, the title and detail
/// lines, the fact rows), so the first frame never flashes a failure. VoiceOver hears "Loading result".
struct OutcomeLoading: View {
    @ScaledMetric(relativeTo: .largeTitle) private var halo = Size.thumbnail * 2
    private static let factRows = 3

    var body: some View {
        VStack(spacing: Space.xxl) {
            VStack(spacing: Space.md) {
                Skeleton(.circle).frame(width: halo, height: halo)
                Skeleton(.line, textRole: .title).frame(width: halo * 2)
                Skeleton(.line).frame(width: halo * 2.5)
            }
            VStack(spacing: Space.lg) {
                ForEach(Array((0..<Self.factRows).enumerated()), id: \.offset) { _, _ in
                    HStack {
                        Skeleton(.line).frame(width: halo)
                        Spacer(minLength: Space.md)
                        Skeleton(.line).frame(width: halo * 0.75)
                    }
                }
            }
            .padding(Space.lg)
        }
        .frame(maxWidth: .infinity)
        .skeletonBreath()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("Loading result", bundle: .module))
    }
}
