import KoboTokens
import SwiftUI

/// The quiet row under a finished reply: thumbs up, thumbs down and copy, small and in the tertiary colour. A thumb
/// tapped fills (a second tap clears it) and hands the new rating to the caller; copy puts the reply's text on the
/// pasteboard with a light tap of haptics.
///
///     ChatFeedbackRow(rating: message.rating, copying: message.text) { rate(message.id, $0) }
public struct ChatFeedbackRow: View {
    @Environment(\.koboTheme) private var theme
    @State private var copies = 0
    private let rating: ChatFeedbackRating?
    private let text: String
    private let onRate: (ChatFeedbackRating?) -> Void

    /// A row for a reply whose text is `text`; `onRate` gets the rating after a thumb's tap (nil clears it).
    public init(rating: ChatFeedbackRating?, copying text: String, onRate: @escaping (ChatFeedbackRating?) -> Void) {
        self.rating = rating
        self.text = text
        self.onRate = onRate
    }

    public var body: some View {
        HStack(spacing: Space.xs) {
            thumb(.up)
            thumb(.down)
            icon("doc.on.doc", label: Text("Copy", bundle: .module), isOn: false) {
                ChatPasteboard.copy(text)
                copies += 1
            }
            Spacer(minLength: 0)
        }
        .padding(.leading, -Space.sm)  // the first glyph sits on the text's edge; its target reaches into the margin
        .koboFeedback(.tap, trigger: copies)
        .koboFeedback(.selection, trigger: rating)
    }

    private func thumb(_ value: ChatFeedbackRating) -> some View {
        let isOn = rating == value
        let name = value == .up ? "hand.thumbsup" : "hand.thumbsdown"
        let label = value == .up ? Text("Good reply", bundle: .module) : Text("Bad reply", bundle: .module)
        return icon(isOn ? name + ".fill" : name, label: label, isOn: isOn) {
            onRate(ChatFeedbackRating.tapping(value, from: rating))
        }
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }

    private func icon(_ systemImage: String, label: Text, isOn: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(theme.font(.footnote))
                .foregroundStyle(isOn ? theme.palette.textSecondary : theme.palette.textTertiary)
                .frame(width: Size.minTouch - Space.md, height: Size.minTouch)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

#if DEBUG
    private struct ChatFeedbackRowPreview: View {
        @State private var rating: ChatFeedbackRating? = .up

        var body: some View {
            VStack(alignment: .leading, spacing: Space.xs) {
                ChatReply(verbatim: "The review is on **Thursday 09:00** now.")
                ChatFeedbackRow(rating: rating, copying: "The review is on Thursday 09:00 now.") { rating = $0 }
            }
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Feedback row") { ChatFeedbackRowPreview() }
    #Preview("Feedback row · dark") { ChatFeedbackRowPreview().preferredColorScheme(.dark) }
    #Preview("Feedback row · AX3") { ChatFeedbackRowPreview().dynamicTypeSize(.accessibility3) }
#endif
