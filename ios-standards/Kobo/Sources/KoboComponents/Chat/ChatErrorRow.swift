import KoboTokens
import SwiftUI

/// A reply that failed, in the assistant's place in the chat: the danger glyph, a short reason and Retry. The reader's
/// message above it stays. VoiceOver reads the reason, then the button.
///
///     ChatErrorRow(verbatim: "Coach could not answer. Check your connection.", onRetry: retry)
public struct ChatErrorRow: View {
    @Environment(\.koboTheme) private var theme
    private let message: String
    private let onRetry: (() -> Void)?

    /// An error row; without `onRetry` it only explains.
    public init(verbatim message: String, onRetry: (() -> Void)? = nil) {
        self.message = message
        self.onRetry = onRetry
    }

    public var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
            Image(systemName: Tone.danger.feedbackSymbol)
                .foregroundStyle(theme.palette.danger.ink)
                .accessibilityHidden(true)
            Text(verbatim: message)
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let onRetry {
                Button(action: onRetry) {
                    Text("Retry", bundle: .module)
                }
                .buttonStyle(.kobo(.tonal, size: .compact))
            }
        }
        .padding(Space.md)
        .background(theme.palette.danger.soft, in: RoundedRectangle(cornerRadius: Radius.md))
        .accessibilityElement(children: .contain)
    }
}

#if DEBUG
    private struct ChatErrorRowPreview: View {
        var body: some View {
            VStack(spacing: Space.lg) {
                ChatErrorRow(verbatim: "The assistant could not answer. Check your connection.", onRetry: {})
                ChatErrorRow(verbatim: "This month's limit is used. It resets on the 1st.")
            }
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Error row") { ChatErrorRowPreview() }
    #Preview("Error row · dark") { ChatErrorRowPreview().preferredColorScheme(.dark) }
    #Preview("Error row · AX3") { ChatErrorRowPreview().dynamicTypeSize(.accessibility3) }
#endif
