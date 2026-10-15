import KoboComponents
import KoboTokens
import SwiftUI

/// The rest countdown pinned under the Workout screen after a set is logged: time left, a bar, +30s and Skip.
/// It only draws; the ViewModel owns the clock.
struct RestBar: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let rest: RestTimer
    let onExtend: () -> Void
    let onSkip: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            layout {
                HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                    Text("Rest")
                        .font(theme.font(.subheadline).weight(.semibold))
                        .foregroundStyle(theme.palette.textSecondary)
                    Text(verbatim: rest.clockText)
                        .font(theme.font(.title2).monospacedDigit())
                        .foregroundStyle(theme.palette.textPrimary)
                        .accessibilityLabel(Text("\(rest.remaining) seconds left"))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: Space.sm) {
                    Button("+30s", action: onExtend)
                        .buttonStyle(.kobo(.secondary, size: .compact))
                        .accessibilityLabel(Text("Add 30 seconds"))
                    Button("Skip", action: onSkip)
                        .buttonStyle(.kobo(.tonal, size: .compact))
                        .accessibilityLabel(Text("Skip rest"))
                }
            }
            InlineProgress(value: Double(rest.elapsed), total: Double(rest.total), accessibilityLabel: "Rest")
        }
    }

    /// Side by side, or stacked at accessibility sizes so nothing truncates.
    private var layout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Space.sm))
            : AnyLayout(HStackLayout(spacing: Space.md))
    }
}
