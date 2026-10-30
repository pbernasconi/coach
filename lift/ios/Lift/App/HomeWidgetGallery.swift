import SwiftUI

/// `-open widgets` with `-demo`: the Coach widget's faces on a made-up Home Screen, at the system's widget sizes, for
/// screenshots in light and dark (the simulator's Home Screen cannot be scripted). The faces are the widget's own
/// views; this only draws the rounded container the system would.
struct HomeWidgetGallery: View {
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        GeometryReader { proxy in
            let size = WidgetSize(screenWidth: proxy.size.width)
            ScrollView {
                VStack(spacing: 22) {
                    labelled {
                        container(width: size.medium, height: size.side) {
                            HomeWidgetMediumView(snapshot: .sample)
                        }
                    }
                    labelled {
                        container(width: size.medium, height: size.side) {
                            HomeWidgetMediumView(snapshot: .restDay)
                        }
                    }
                    HStack(spacing: size.medium - 2 * size.side) {
                        labelled {
                            container(width: size.side, height: size.side) {
                                HomeWidgetSmallView(snapshot: .sample)
                            }
                        }
                        labelled {
                            container(width: size.side, height: size.side) {
                                HomeWidgetSmallView(snapshot: nil, notice: "Open Coach to connect")
                            }
                        }
                    }
                    lockScreen
                }
                .frame(maxWidth: .infinity)
                .padding(.top, 24)
            }
        }
        .background(wallpaper.ignoresSafeArea())
    }

    /// The Lock Screen face, in white as the Lock Screen tints it.
    private var lockScreen: some View {
        HomeWidgetRectangularView(snapshot: .sample)
            .grayscale(1)
            .brightness(0.35)
            .foregroundStyle(.white)
            .environment(\.colorScheme, .dark)
            .frame(width: 170, height: 72)
            .padding(.horizontal, 12)
            .background(.black.opacity(0.25), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func container<Face: View>(width: CGFloat, height: CGFloat, @ViewBuilder face: () -> Face) -> some View {
        face()
            .padding(16)
            .frame(width: width, height: height)
            .background(
                HomeWidgetColors.background(scheme),
                in: RoundedRectangle(cornerRadius: 23, style: .continuous)
            )
    }

    /// The app's name under the widget, as on the Home Screen.
    private func labelled<Face: View>(@ViewBuilder widget: () -> Face) -> some View {
        VStack(spacing: 6) {
            widget()
            Text(verbatim: "Coach")
                .font(.caption.weight(.medium))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.35), radius: 2, y: 1)
        }
    }

    /// A dusk wallpaper, lighter in light mode.
    private var wallpaper: some View {
        let colors: [Color] =
            scheme == .dark
            ? [.init(white: 0.30), .orange.opacity(0.55), .brown.opacity(0.9), .black]
            : [.init(white: 0.72), .orange.opacity(0.65), .pink.opacity(0.55), .brown.opacity(0.6)]
        return LinearGradient(colors: colors, startPoint: .top, endPoint: .bottom)
    }
}

/// The system's widget sizes for a screen width: the larger phones get 170 pt squares and 364 pt medium widgets.
nonisolated private struct WidgetSize {
    let side: CGFloat
    let medium: CGFloat

    init(screenWidth: CGFloat) {
        if screenWidth >= 428 {
            side = 170
            medium = 364
        } else {
            side = 158
            medium = 338
        }
    }
}
