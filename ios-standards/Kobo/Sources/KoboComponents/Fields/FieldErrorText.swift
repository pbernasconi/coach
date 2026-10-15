import KoboTokens
import SwiftUI

/// The inline validation message under a field: an alert glyph and wrapping danger text, read as one element and
/// announced when it appears or changes. The glyph tells it apart from helper text without colour.
struct FieldErrorText: View {
    @Environment(\.koboTheme) private var theme
    let message: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.xs) {
            Image(systemName: "exclamationmark.circle.fill")
                .accessibilityHidden(true)
            Text(verbatim: message)
                .fontWeight(.medium)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .font(theme.font(.footnote))
        .foregroundStyle(theme.palette.danger.ink)
        .accessibilityElement(children: .combine)
        .onAppear { announce(message) }
        .onChange(of: message) { _, new in announce(new) }
    }

    private func announce(_ text: String) {
        AccessibilityNotification.Announcement(text).post()
    }
}

/// A 44pt icon button inside a field box: clear, reveal, open calendar. The glyph lines up with the box's side padding.
struct FieldIconButton: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var iconSize = Size.iconMd
    let systemImage: String
    let label: Text
    var tint: Color?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: iconSize))
                .foregroundStyle(tint ?? theme.palette.textSecondary)
                .frame(minWidth: Size.minTouch, minHeight: Size.minTouch)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}
