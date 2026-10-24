import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// Duration and distance side by side, the effort (without steps), then the TSS with what it is when left empty.
struct WorkoutEditNumbers: View {
    let draft: WorkoutEditDraft
    let change: (WorkoutEditDraft) -> Void

    private var stepsClock: String? {
        draft.form.stepsMinutes.map { PlannedEditText.clock(Int($0.rounded())) }
    }

    private var tssHelper: String? {
        guard draft.tssText.isEmpty else { return nil }
        if let auto = draft.autoTss { return String(localized: "Auto: \(auto)") }
        return draft.hasSteps ? String(localized: "Auto, from the steps") : nil
    }

    var body: some View {
        HStack(alignment: .top, spacing: Space.md) {
            KoboTextField(
                verbatim: String(localized: "Duration"),
                text: binding(\.durationText),
                prompt: stepsClock ?? "1:00",
                helper: String(localized: "h:mm or minutes")
            )
            .keyboardType(.numbersAndPunctuation)
            KoboTextField(
                verbatim: String(localized: "Distance"),
                text: binding(\.distanceText),
                prompt: "–",
                helper: String(localized: "Optional"),
                unit: "km"
            )
            .keyboardType(.decimalPad)
        }
        if !draft.hasSteps, !draft.form.efforts.isEmpty {
            ChipGroup(
                verbatim: String(localized: "Effort"),
                options: draft.form.efforts.map { ChoiceOption($0.id, verbatim: $0.label) },
                selection: binding(\.effort)
            )
        }
        KoboTextField(
            verbatim: String(localized: "TSS"),
            text: binding(\.tssText),
            prompt: draft.autoTss.map(String.init) ?? "–",
            helper: tssHelper
        )
        .keyboardType(.numberPad)
    }

    private func binding<Value>(_ key: WritableKeyPath<WorkoutEditDraft, Value>) -> Binding<Value> {
        .action(draft[keyPath: key]) { value in
            var changed = draft
            changed[keyPath: key] = value
            change(changed)
        }
    }
}

/// A run's or a ride's steps from the coach's bank: the workout, then the step of its progression. Picking either
/// builds the steps again on Save; "None" leaves the description to say what to do.
struct WorkoutEditStructure: View {
    @Environment(\.koboTheme) private var theme
    let draft: WorkoutEditDraft
    let change: (WorkoutEditDraft) -> Void

    var body: some View {
        ListSection(
            "Structure",
            footer: draft.form.otherSteps && draft.bank == nil
                ? "These steps stay until you pick a workout." : nil
        ) {
            Picker("Workout", selection: bankBinding) {
                Text("None").tag(String?.none)
                ForEach(draft.form.bankOptions) { option in
                    Text(verbatim: option.name).tag(String?.some(option.id))
                }
            }
            .pickerStyle(.menu)
            .font(theme.font(.body))
            .padding(.vertical, Space.sm)
            .pageGutter()
            if draft.levels.count > 1 {
                Picker("Step", selection: levelBinding) {
                    ForEach(Array(draft.levels.enumerated()), id: \.offset) { index, name in
                        Text(verbatim: "\(index + 1) · \(name)").tag(index)
                    }
                }
                .pickerStyle(.menu)
                .font(theme.font(.body))
                .padding(.vertical, Space.sm)
                .pageGutter()
            }
        }
    }

    /// A new workout starts at the first step, as on the web.
    private var bankBinding: Binding<String?> {
        .action(draft.bank) { bank in
            var changed = draft
            changed.bank = bank
            changed.level = bank == draft.form.bank ? draft.form.level : 0
            change(changed)
        }
    }

    private var levelBinding: Binding<Int> {
        .action(draft.level) { level in
            var changed = draft
            changed.level = level
            change(changed)
        }
    }
}
