import CraftTokens
import SwiftUI

/// A centred spinner with an optional caption, for a wait whose result has no known shape.
/// When the shape is known, draw `Skeleton`s instead.
public struct LoadingState: View {
    private let label: Text?
    @Environment(\.craftTheme) private var theme

    /// - Parameter label: a short caption ("Loading your plan"); VoiceOver reads "Loading" without one.
    public init(_ label: LocalizedStringKey? = nil) {
        self.label = label.map { Text($0) }
    }

    /// A caption shown as is (a name from user data); an empty one reads as no caption.
    public init(verbatim label: String) {
        self.label = label.isEmpty ? nil : Text(verbatim: label)
    }

    public var body: some View {
        VStack(spacing: Space.md) {
            ProgressView()
                .controlSize(.large)
                .tint(theme.palette.accent)
            if let label {
                label
                    .font(theme.font(.subheadline))
                    .foregroundStyle(theme.palette.textSecondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(Space.xxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label ?? Text("Loading", bundle: .module))
        .accessibilityAddTraits(.updatesFrequently)
    }
}

#Preview("Loading") {
    VStack {
        LoadingState()
        LoadingState("Loading your plan")
    }
}

#Preview("Loading, dark") {
    LoadingState("Loading your plan").preferredColorScheme(.dark)
}

#Preview("Loading, AX3") {
    LoadingState("Loading your plan").dynamicTypeSize(.accessibility3)
}
