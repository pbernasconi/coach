import KoboTokens
import SwiftUI

/// The banner of a pinned flow footer, capped so the primary action always stays on screen: it takes the full height
/// of its text up to `FlowFooterLayout.maxBannerShare` of the step height, and past that its text scrolls inside it.
struct FlowFooterBanner: View {
    @State private var contentHeight: CGFloat = 0
    let banner: FlowStepBanner
    /// The laid-out height of the step; 0 before the first layout.
    let stepHeight: CGFloat

    var body: some View {
        if let cap = FlowFooterLayout.bannerCap(stepHeight: stepHeight) {
            ScrollView { measured }
                .scrollBounceBehavior(.basedOnSize)
                .frame(height: FlowFooterLayout.bannerHeight(contentHeight: contentHeight, cap: cap))
        } else {
            measured
        }
    }

    private var measured: some View {
        FlowStepBannerView(banner: banner)
            .fixedSize(horizontal: false, vertical: true)
            .onGeometryChange(for: CGFloat.self) { proxy in
                proxy.size.height
            } action: { height in
                contentHeight = height
            }
    }
}
