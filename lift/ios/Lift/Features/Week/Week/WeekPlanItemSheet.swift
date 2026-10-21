import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

extension View {
    /// The read-only detail sheet of a coach plan item: its state, why, notes, key targets and steps, all as the server
    /// sent them. Nothing here can change the plan; the web app owns it.
    func weekPlanItemSheet(item: WeekPlanItem?, send: @escaping (WeekAction) -> Void) -> some View {
        koboSheet(
            item: .action(item) { if $0 == nil { send(.destinationDismissed) } },
            title: \.title,
            subtitle: { $0.dayTitle },
            detents: [.medium, .large]
        ) { item in
            WeekPlanItemDetail(item: item)
        }
    }
}

/// The sheet's content. Sections without text are left out.
struct WeekPlanItemDetail: View {
    @Environment(\.koboTheme) private var theme
    let item: WeekPlanItem

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            HStack(spacing: Space.sm) {
                item.sport.icon.font(theme.font(.headline))
                Text(verbatim: item.subtitle.isEmpty ? item.sport.label : item.subtitle)
                    .font(theme.font(.subheadline).monospacedDigit())
                    .foregroundStyle(theme.palette.textSecondary)
                Spacer(minLength: 0)
                WeekPlanStatePill(item: item)
            }
            if item.isAdapted {
                KoboTag("Adapted by the coach", tone: .info, systemImage: "arrow.triangle.2.circlepath")
            }
            if let done = item.doneText { textSection("Done", done) }
            if let why = item.why { textSection("Why", why) }
            if let notes = item.notes { textSection("Notes", notes) }
            if !item.keyTargets.isEmpty {
                textSection("Key targets", item.keyTargets.map { "• \($0)" }.joined(separator: "\n"))
            }
            if !item.steps.isEmpty {
                KeyValueList(
                    "Steps",
                    items: item.steps.enumerated().map { index, step in
                        KeyValueItem(verbatim: step.label, value: step.detail, id: "\(index)")
                    }
                )
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func textSection(_ title: LocalizedStringKey, _ text: String) -> some View {
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
