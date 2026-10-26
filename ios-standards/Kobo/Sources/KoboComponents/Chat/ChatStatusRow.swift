import KoboTokens
import SwiftUI

/// A quiet line in a reply that says what the assistant is doing or did: "Reading your calendar", "Checked 3 days".
/// Name the step, never "Processing". Working shows a spinner, done a check, failed a warning glyph, so the state never
/// rests on colour alone.
///
///     ChatStatusRow(verbatim: "Reading the guest list", state: .working)
public struct ChatStatusRow: View {
    /// Where the step is.
    public enum State: Sendable, Equatable {
        case working, done, failed
    }

    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .footnote) private var glyph = Size.iconSm
    private let title: Text
    private let state: State

    public init(_ title: LocalizedStringKey, state: State) {
        self.title = Text(title)
        self.state = state
    }

    /// A row whose step is shown as is (written by the model or the server).
    public init(verbatim title: String, state: State) {
        self.title = Text(verbatim: title)
        self.state = state
    }

    public var body: some View {
        HStack(spacing: Space.sm) {
            icon.frame(width: glyph, height: glyph).accessibilityHidden(true)
            title
                .font(theme.font(.footnote))
                .foregroundStyle(state == .failed ? theme.palette.danger.ink : theme.palette.textSecondary)
        }
        .frame(minHeight: Size.iconLg)
        .accessibilityElement(children: .combine)
        .accessibilityValue(stateLabel)
    }

    @ViewBuilder private var icon: some View {
        switch state {
        case .working:
            ProgressView().controlSize(.mini).tint(theme.palette.textSecondary)
        case .done:
            Image(systemName: "checkmark.circle.fill").foregroundStyle(theme.palette.success.ink)
        case .failed:
            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(theme.palette.danger.ink)
        }
    }

    private var stateLabel: Text {
        switch state {
        case .working: Text("In progress", bundle: .module)
        case .done: Text("Done", bundle: .module)
        case .failed: Text("Failed", bundle: .module)
        }
    }
}

#if DEBUG
    private struct ChatStatusRowPreview: View {
        @Environment(\.koboTheme) private var theme
        var body: some View {
            VStack(alignment: .leading, spacing: Space.sm) {
                ChatStatusRow("Reading the guest list", state: .working)
                ChatStatusRow(verbatim: "Checked 3 venues", state: .done)
                ChatStatusRow("Couldn't reach the calendar", state: .failed)
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("ChatStatusRow") { ChatStatusRowPreview() }
    #Preview("ChatStatusRow · dark") { ChatStatusRowPreview().preferredColorScheme(.dark) }
    #Preview("ChatStatusRow · AX3") { ChatStatusRowPreview().dynamicTypeSize(.accessibility3) }
#endif
