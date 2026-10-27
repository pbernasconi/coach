import KoboTokens
import SwiftUI

/// One thing the assistant did to answer, as a quiet line above its reply: "Read your calendar", "Checked the
/// forecast". Done is plain tertiary text; running adds a spinner, failed a warning glyph. Only real steps belong here;
/// never invent progress.
///
///     ChatToolStatus(verbatim: "Read this week's plan", state: .done)
///     ChatToolStatus(verbatim: "Checking the calendar", state: .running)
public struct ChatToolStatus: View {
    /// Where the step stands.
    public enum State: Equatable, Sendable {
        case running
        case done
        case failed
    }

    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .footnote) private var glyph = Size.iconSm
    private let text: String
    private let state: State

    /// A step line; `text` is shown as it is.
    public init(verbatim text: String, state: State) {
        self.text = text
        self.state = state
    }

    public var body: some View {
        HStack(spacing: Space.xs) {
            if state != .done {
                Group {
                    if state == .running {
                        ProgressView().controlSize(.mini)
                    } else {
                        Image(systemName: Tone.warning.feedbackSymbol).foregroundStyle(theme.palette.warning.ink)
                    }
                }
                .font(.system(size: glyph))
                .frame(width: glyph, height: glyph)
                .accessibilityHidden(true)
            }
            Text(verbatim: text)
                .font(theme.font(.footnote))
                .foregroundStyle(state == .failed ? theme.palette.textSecondary : theme.palette.textTertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityValue(stateText)
    }

    private var stateText: Text {
        switch state {
        case .running: Text("In progress", bundle: .module)
        case .done: Text("Done", bundle: .module)
        case .failed: Text("Failed", bundle: .module)
        }
    }
}

#if DEBUG
    private struct ChatToolStatusPreview: View {
        var body: some View {
            VStack(spacing: Space.sm) {
                ChatToolStatus(verbatim: "Read this week's tasks", state: .done)
                ChatToolStatus(verbatim: "Checking tomorrow's calendar", state: .running)
                ChatToolStatus(verbatim: "Could not read the forecast", state: .failed)
            }
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Tool status") { ChatToolStatusPreview() }
    #Preview("Tool status · dark") { ChatToolStatusPreview().preferredColorScheme(.dark) }
    #Preview("Tool status · AX3") { ChatToolStatusPreview().dynamicTypeSize(.accessibility3) }
#endif
