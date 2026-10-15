import KoboComponents
import SwiftUI

/// The credit every view that shows catalog media carries: "© Gym visual", which opens https://gymvisual.com/.
struct MediaAttribution: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        TextLink(verbatim: "© Gym visual") {
            if let url = ExerciseMediaSource.creditURL { openURL(url) }
        }
        .accessibilityLabel(Text("Media © Gym visual"))
        .accessibilityHint(Text("Opens gymvisual.com"))
    }
}
