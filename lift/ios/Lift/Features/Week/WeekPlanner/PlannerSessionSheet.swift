import KoboComponents
import KoboTokens
import SwiftUI

/// One draft session's sheet: why Coach put it there, then move it to a free slot, make it 15 minutes shorter or
/// longer, remove it, or ask Coach to swap it for something else. Each change goes to the coach, which redraws the
/// draft and its checks.
struct PlannerSessionSheet: View {
    @Environment(\.koboTheme) private var theme
    let session: PlannerWeek.Session
    let isWorking: Bool
    let send: (WeekPlannerAction) -> Void

    /// One tap on − or + changes the length by this many minutes.
    static let lengthStep = 15

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            if let why = session.why { section("Why", why) }
            if let description = session.description { section("Workout", description) }
            if !session.slots.isEmpty {
                VStack(alignment: .leading, spacing: Space.sm) {
                    SectionHeader("Move to")
                    FlowLayout {
                        ForEach(session.slots) { slot in
                            Chip(verbatim: slot.text, systemImage: "calendar", isSelected: false) {
                                send(.slotPicked(slot))
                            }
                        }
                    }
                }
            }
            if let minutes = session.minutes { length(minutes) }
            VStack(spacing: Space.sm) {
                Button("Ask Coach to swap it", systemImage: "arrow.triangle.2.circlepath") { send(.swapTapped) }
                    .buttonStyle(.kobo(.tonal, width: .full))
                Button("Remove from the week", systemImage: "trash", role: .destructive) { send(.removeTapped) }
                    .buttonStyle(.kobo(.destructiveTonal, width: .full))
            }
        }
        .disabled(isWorking)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func length(_ minutes: Int) -> some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            SectionHeader("Length")
            HStack(spacing: Space.md) {
                Button("Shorter", systemImage: "minus") { send(.lengthChanged(minutes - Self.lengthStep)) }
                    .buttonStyle(.kobo(.secondary, width: .full))
                    .disabled(minutes <= Self.lengthStep)
                Text(verbatim: session.lengthText ?? "\(minutes) min")
                    .font(theme.font(.headline).monospacedDigit())
                    .frame(minWidth: Size.iconLg * 3)
                Button("Longer", systemImage: "plus") { send(.lengthChanged(minutes + Self.lengthStep)) }
                    .buttonStyle(.kobo(.secondary, width: .full))
            }
        }
    }

    private func section(_ title: LocalizedStringKey, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text(title)
                .font(theme.font(.headline))
                .foregroundStyle(theme.palette.textPrimary)
                .accessibilityAddTraits(.isHeader)
            Text(verbatim: text)
                .font(theme.font(.body))
                .foregroundStyle(theme.palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
