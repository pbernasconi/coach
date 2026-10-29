import KoboTokens
import SwiftUI

/// The folded summary of an assistant's thinking, above its reply: a small mark, "Thought" and a chevron, in the
/// secondary colour. A tap unfolds the summary in small secondary text under it, and folds it again. The mark is a
/// sparkle unless the caller passes its own (an app's brand mark).
///
///     ChatThoughtRow(verbatim: reply.thought)
///     ChatThoughtRow(verbatim: reply.thought) { BrandMark(size: 14) }
public struct ChatThoughtRow<Mark: View>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isExpanded = false
    private let text: String
    private let mark: Mark

    /// A row with the caller's mark before "Thought".
    public init(verbatim text: String, @ViewBuilder mark: () -> Mark) {
        self.text = text
        self.mark = mark()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Button {
                withKoboAnimation(isExpanded ? .exit : .enter, reduceMotion: reduceMotion) { isExpanded.toggle() }
            } label: {
                HStack(spacing: Space.xs) {
                    mark.accessibilityHidden(true)
                    Text("Thought", bundle: .module)
                    Image(systemName: "chevron.right")
                        .font(theme.font(.caption).weight(.semibold))
                        .rotationEffect(isExpanded ? .degrees(90) : .zero)
                        .accessibilityHidden(true)
                }
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textSecondary)
                .frame(minHeight: Size.minTouch - Space.md)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityValue(isExpanded ? Text("Expanded", bundle: .module) : Text("Collapsed", bundle: .module))
            .accessibilityHint(
                isExpanded ? Text("Hides the content", bundle: .module) : Text("Shows the content", bundle: .module)
            )
            if isExpanded {
                Text(verbatim: text)
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.leading, Space.md)
                    .overlay(alignment: .leading) {
                        Rectangle().fill(theme.palette.separator).frame(width: Size.hairline * 4)
                    }
                    .textSelection(.enabled)
                    .transition(Motion.fade(reduceMotion: reduceMotion))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

extension ChatThoughtRow where Mark == ChatSparkle {
    /// A row with the default sparkle before "Thought".
    public init(verbatim text: String) {
        self.init(verbatim: text) { ChatSparkle() }
    }
}

/// The default mark of an assistant's row: a small sparkle in the secondary colour.
public struct ChatSparkle: View {
    @Environment(\.koboTheme) private var theme

    public init() {}

    public var body: some View {
        Image(systemName: "sparkle")
            .font(theme.font(.caption).weight(.semibold))
            .foregroundStyle(theme.palette.textSecondary)
            .accessibilityHidden(true)
    }
}

#if DEBUG
    private struct ChatThoughtRowPreview: View {
        var body: some View {
            VStack(alignment: .leading, spacing: Space.lg) {
                ChatThoughtRow(verbatim: "The trip starts Friday, so the review fits best on Thursday morning.")
                ChatReply(verbatim: "Moved the review to **Thursday 09:00**.")
            }
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Thought row") { ChatThoughtRowPreview() }
    #Preview("Thought row · dark") { ChatThoughtRowPreview().preferredColorScheme(.dark) }
    #Preview("Thought row · AX3") { ChatThoughtRowPreview().dynamicTypeSize(.accessibility3) }
#endif
