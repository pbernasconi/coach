import CraftTokens
import SwiftUI

/// A disclosure header that shows or hides its content. The caret turns and the content fades in on
/// `Motion.enter` and out on the faster `Motion.exit`; with Reduce Motion it changes at once.
/// VoiceOver reads the header as a button with an "Expanded" or "Collapsed" value.
///
///     Collapsible("Hidden exercises (2)", isExpanded: $showHidden) { … }
public struct Collapsible<Content: View>: View {
    @Environment(\.craftTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding private var isExpanded: Bool
    private let title: String
    private let subtitle: String?
    private let content: Content

    public init(
        _ title: String,
        subtitle: String? = nil,
        isExpanded: Binding<Bool>,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self._isExpanded = isExpanded
        self.content = content()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: toggle) { header }
                .buttonStyle(.plain)
                .accessibilityValue(isExpanded ? Text("Expanded") : Text("Collapsed"))
                .accessibilityHint(isExpanded ? Text("Hides the content") : Text("Shows the content"))
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
                Text(title)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                if let subtitle {
                    Text(subtitle)
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Image(systemName: "chevron.down")
                .font(theme.font(.footnote).weight(.semibold))
                .foregroundStyle(theme.palette.textSecondary)
                .rotationEffect(isExpanded ? .zero : .degrees(-90))
                .craftAnimation(.state, value: isExpanded)
                .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity, minHeight: Size.minTouch)
        .contentShape(Rectangle())
    }

    private func toggle() {
        withCraftAnimation(isExpanded ? .exit : .enter, reduceMotion: reduceMotion) {
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
            .craftCard()
            .padding(Space.gutter)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Light") { CollapsiblePreview() }
    #Preview("Dark") { CollapsiblePreview().preferredColorScheme(.dark) }
    #Preview("AX3") { CollapsiblePreview().dynamicTypeSize(.accessibility3) }
#endif
