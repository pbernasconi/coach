import KoboTokens
import SwiftUI

/// A disclosure header that shows or hides its content. The caret turns and the content fades in on
/// `Motion.enter` and out on the faster `Motion.exit`; with Reduce Motion it changes at once.
/// VoiceOver reads the header as a button with an "Expanded" or "Collapsed" value.
///
///     Collapsible("Hidden exercises (2)", isExpanded: $showHidden) { … }
public struct Collapsible<Content: View>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding private var isExpanded: Bool
    private let title: Text
    private let subtitle: Text?
    private let content: Content

    /// A collapsible section with a localized title.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        isExpanded: Binding<Bool>,
        @ViewBuilder content: () -> Content
    ) {
        self.title = Text(title)
        self.subtitle = subtitle.map { Text($0) }
        self._isExpanded = isExpanded
        self.content = content()
    }

    /// A collapsible section whose title is shown as is (user data).
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        isExpanded: Binding<Bool>,
        @ViewBuilder content: () -> Content
    ) {
        self.title = Text(verbatim: title)
        self.subtitle = subtitle.map { Text(verbatim: $0) }
        self._isExpanded = isExpanded
        self.content = content()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: toggle) { header }
                .buttonStyle(.plain)
                .accessibilityValue(isExpanded ? Text("Expanded", bundle: .module) : Text("Collapsed", bundle: .module))
                .accessibilityHint(
                    isExpanded ? Text("Hides the content", bundle: .module) : Text("Shows the content", bundle: .module)
                )
            if isExpanded {
                VStack(alignment: .leading, spacing: Space.sm) { content }
                    .padding(.top, Space.sm)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .transition(Motion.fade(reduceMotion: reduceMotion))
            }
        }
        .clipped()
    }

    private var header: some View {
        HStack(spacing: Space.sm) {
            VStack(alignment: .leading, spacing: Space.xxs) {
                title
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                if let subtitle {
                    subtitle
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Image(systemName: "chevron.down")
                .font(theme.font(.footnote).weight(.semibold))
                .foregroundStyle(theme.palette.textSecondary)
                .rotationEffect(isExpanded ? .zero : .degrees(-90))
                .koboAnimation(.state, value: isExpanded)
                .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity, minHeight: Size.minTouch)
        .contentShape(Rectangle())
    }

    private func toggle() {
        withKoboAnimation(isExpanded ? .exit : .enter, reduceMotion: reduceMotion) {
            isExpanded.toggle()
        }
    }
}

#if DEBUG
    private struct CollapsiblePreview: View {
        @State private var first = false
        @State private var second = true

        var body: some View {
            VStack(alignment: .leading, spacing: Space.lg) {
                Collapsible("Hidden exercises (2)", isExpanded: $first) {
                    Text("Face pull")
                    Text("Calf raise")
                }
                Collapsible("Notes", subtitle: "Pinned to this workout", isExpanded: $second) {
                    Text("Keep the rest short on the last two sets.")
                }
            }
            .padding(Space.gutter)
            .koboCard()
            .padding(Space.gutter)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Light") { CollapsiblePreview() }
    #Preview("Dark") { CollapsiblePreview().preferredColorScheme(.dark) }
    #Preview("AX3") { CollapsiblePreview().dynamicTypeSize(.accessibility3) }
#endif
