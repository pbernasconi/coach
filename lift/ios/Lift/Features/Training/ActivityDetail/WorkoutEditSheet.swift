import KoboComponents
import KoboTokens
import LiftCore
import LiftSync
import SwiftUI

extension View {
    /// The pencil's Edit sheet: a planned workout's details, as the web's Edit (title, when, time, distance, TSS,
    /// effort, the coach's bank workout, description), with Save at the bottom. Closing it with changes asks first.
    func workoutEditSheet(_ draft: WorkoutEditDraft?, send: @escaping (ActivityDetailAction) -> Void) -> some View {
        koboSheet(
            item: .action(draft) { if $0 == nil { send(.destinationDismissed) } },
            title: { _ in String(localized: "Edit workout") },
            subtitle: { $0.form.title },
            detents: [.large],
            hasChanges: draft?.hasChanges ?? false
        ) { draft in
            WorkoutEditFields(draft: draft) { send(.editChanged($0)) }
        } footer: { draft in
            Button("Save") { send(.editSaveTapped) }
                .buttonStyle(.kobo(.primary, width: .full, isLoading: draft.isSaving))
                .disabled(draft.isSaving)
        }
    }
}

/// The fields. Each change goes back as the whole draft; the ViewModel keeps it.
private struct WorkoutEditFields: View {
    @Environment(\.calendar) private var calendar
    let draft: WorkoutEditDraft
    let change: (WorkoutEditDraft) -> Void

    var body: some View {
        if let error = draft.error {
            NoticeBanner(tone: .danger, symbol: "exclamationmark.triangle", verbatim: error)
        }
        KoboTextField(
            verbatim: String(localized: "Title"),
            text: binding(\.title),
            prompt: draft.form.title.isEmpty ? String(localized: "Untitled workout") : draft.form.title
        )
        WorkoutEditWhen(draft: draft, calendar: calendar, change: change)
        if !draft.isRest {
            WorkoutEditNumbers(draft: draft, change: change)
        }
        if draft.offersBank {
            WorkoutEditStructure(draft: draft, change: change)
        }
        KoboTextArea(
            verbatim: draft.hasSteps ? String(localized: "Notes") : String(localized: "Description"),
            text: binding(\.description),
            prompt: draft.isRest
                ? String(localized: "Optional") : String(localized: "What to do: the main set, the targets, the cues."),
            lines: 4...12,
            characterLimit: 4000
        )
    }

    private func binding<Value>(_ key: WritableKeyPath<WorkoutEditDraft, Value>) -> Binding<Value> {
        .action(draft[keyPath: key]) { value in
            var changed = draft
            changed[keyPath: key] = value
            change(changed)
        }
    }
}

/// The day, and the start time when there is one.
private struct WorkoutEditWhen: View {
    @Environment(\.koboTheme) private var theme
    let draft: WorkoutEditDraft
    let calendar: Calendar
    let change: (WorkoutEditDraft) -> Void

    /// A start time switched on starts at 07:00, unless the workout had one.
    static let defaultStart = 7 * 60

    private var days: DayCalendar { DayCalendar(calendar: calendar) }

    var body: some View {
        ListSection("When") {
            DatePicker(
                "Day",
                selection: .action(days.date(of: draft.day) ?? .distantPast) { date in
                    var changed = draft
                    changed.day = days.day(of: date)
                    change(changed)
                },
                displayedComponents: [.date]
            )
            .font(theme.font(.body))
            .padding(.vertical, Space.sm)
            .pageGutter()
            ToggleRow(
                "Start time",
                isOn: .action(draft.startMinute != nil) { on in
                    var changed = draft
                    let stored = draft.form.startTime.flatMap(WorkoutEditDraft.minute(of:))
                    changed.startMinute = on ? stored ?? Self.defaultStart : nil
                    change(changed)
                }
            )
            if let minute = draft.startMinute {
                DatePicker("Starts at", selection: timeBinding(minute), displayedComponents: [.hourAndMinute])
                    .font(theme.font(.body))
                    .padding(.vertical, Space.sm)
                    .pageGutter()
            }
        }
    }

    /// The minute after midnight as a time on the workout's day, for the picker.
    private func timeBinding(_ minute: Int) -> Binding<Date> {
        let day = days.date(of: draft.day) ?? .distantPast
        let time = calendar.date(byAdding: .minute, value: minute, to: calendar.startOfDay(for: day)) ?? day
        return .action(time) { date in
            let parts = calendar.dateComponents([.hour, .minute], from: date)
            var changed = draft
            changed.startMinute = (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
            change(changed)
        }
    }
}
