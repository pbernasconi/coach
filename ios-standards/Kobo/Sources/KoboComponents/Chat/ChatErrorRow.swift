import KoboTokens
import SwiftUI

/// A reply that failed, in the assistant's place in the chat: a small danger glyph, the reason in the secondary ink and
/// a plain Retry; no fill. The reader's
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
            Image(systemName: "exclamationmark.circle")
                .foregroundStyle(theme.palette.danger.ink)
                .accessibilityHidden(true)
            Text(verbatim: message)
                .foregroundStyle(theme.palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let onRetry {
                Button(action: onRetry) {
                    Text("Retry", bundle: .module)
                        .font(theme.font(.subheadline).weight(.semibold))
                        .foregroundStyle(theme.palette.accentText)
                        .frame(minHeight: Size.minTouch)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .font(theme.font(.subheadline))
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
