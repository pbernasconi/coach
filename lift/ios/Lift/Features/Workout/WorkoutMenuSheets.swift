import KoboComponents
import KoboTokens
import SwiftUI

extension View {
    /// The workout menu's two sheets: Reorder exercises and Workout settings.
    func workoutMenuSheets(state: WorkoutState, send: @escaping (WorkoutAction) -> Void) -> some View {
        modifier(WorkoutMenuSheets(state: state, send: send))
    }
}

private struct WorkoutMenuSheets: ViewModifier {
    let state: WorkoutState
    let send: (WorkoutAction) -> Void

    func body(content: Content) -> some View {
        content
            .koboSheet(
                item: Binding<ExerciseReorder?>.action(state.reorder) { if $0 == nil { send(.reorderDismissed) } },
                title: { _ in String(localized: "Reorder exercises") },
                detents: [.large],
                hasChanges: state.reorder?.hasChanges ?? false
            ) { reorder in
                ExerciseReorderList(reorder: reorder, send: send)
            } footer: { _ in
                Button("Done") { send(.reorderDoneTapped) }
                    .buttonStyle(.kobo(.primary, width: .full))
            }
            .koboSheet(
                item: Binding<WorkoutSettingsSheet?>.action(state.settings) {
                    if $0 == nil { send(.settingsDismissed) }
                },
                title: { _ in String(localized: "Workout settings") },
                detents: [.large],
                hasChanges: state.settings?.hasChanges ?? false
            ) { settings in
                WorkoutSettingsFields(settings: settings, send: send)
            } footer: { _ in
                Button("Done") { send(.settingsDoneTapped) }
                    .buttonStyle(.kobo(.primary, width: .full))
            }
    }
}

/// The exercises in order. Drag a row onto another to move it there, or use its arrows. Logged sets stay with their
/// exercise.
private struct ExerciseReorderList: View {
    @Environment(\.koboTheme) private var theme
    let reorder: ExerciseReorder
    let send: (WorkoutAction) -> Void

    var body: some View {
        ListSection(footer: "Hold and drag an exercise onto another to move it there. Logged sets stay with their exercise.") {
            ForEach(Array(reorder.rows.enumerated()), id: \.element.id) { index, row in
                ExerciseReorderRow(row: row, number: index + 1, isFirst: index == 0, isLast: index == reorder.rows.count - 1) {
                    send(.reorderMoved(from: IndexSet(integer: index), to: $0 < 0 ? index - 1 : index + 2))
                }
                .draggable(row.id.uuidString)
                .dropDestination(for: String.self) { items, _ in
                    guard let dragged = items.first.flatMap(UUID.init(uuidString:)),
                        let from = reorder.rows.firstIndex(where: { $0.id == dragged }), from != index
                    else { return false }
                    send(.reorderMoved(from: IndexSet(integer: from), to: from < index ? index + 1 : index))
                    return true
                }
            }
        }
    }
}

/// "2  Dumbbell shoulder press · 3 sets", NOW on the current exercise, and the up and down arrows.
private struct ExerciseReorderRow: View {
    @Environment(\.koboTheme) private var theme
    let row: ExerciseReorder.Row
    let number: Int
    let isFirst: Bool
    let isLast: Bool
    /// -1 moves the exercise up one place, +1 down one place.
    let move: (Int) -> Void

    var body: some View {
        HStack(spacing: Space.md) {
            Image(systemName: "line.3.horizontal")
                .foregroundStyle(theme.palette.textTertiary)
                .accessibilityHidden(true)
            Text(verbatim: "\(number)")
                .font(theme.font(.subheadline).monospacedDigit())
                .foregroundStyle(theme.palette.textSecondary)
            VStack(alignment: .leading, spacing: Space.xxs) {
                Text(verbatim: row.name)
                    .font(theme.font(.body).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                    .lineLimit(1)
                Text(verbatim: row.detail)
                    .font(theme.font(.footnote))
                    .foregroundStyle(row.isCurrent ? theme.palette.accentText : theme.palette.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            IconButton("arrow.up", verbatimAccessibilityLabel: String(localized: "Move \(row.name) up"), style: .glass, size: .small) {
                move(-1)
            }
            .disabled(isFirst)
            IconButton("arrow.down", verbatimAccessibilityLabel: String(localized: "Move \(row.name) down"), style: .glass, size: .small) {
                move(1)
            }
            .disabled(isLast)
        }
        .padding(.vertical, Space.sm)
        .pageGutter()
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// This workout's name, start and paused time, then the defaults for every workout: rest, its alert, the screen.
private struct WorkoutSettingsFields: View {
    @Environment(\.koboTheme) private var theme
    let settings: WorkoutSettingsSheet
    let send: (WorkoutAction) -> Void

    var body: some View {
        KoboTextField(
            verbatim: String(localized: "Name"),
            text: .action(settings.title) { send(.settingsTitleChanged($0)) },
            prompt: String(localized: "Upper A")
        )
        ListSection("This workout", footer: "Forgot to tap Start? Fix the time here. Paused time is left out of the length.") {
            if let startedAt = settings.startedAt {
                DatePicker(
                    "Started",
                    selection: .action(startedAt) { send(.settingsStartChanged($0)) },
                    in: settings.earliestStart...settings.latestStart,
                    displayedComponents: [.hourAndMinute]
                )
                .font(theme.font(.body))
                .padding(.vertical, Space.sm)
                .pageGutter()
            }
            if settings.pausedSeconds > 0 {
                ListRow(verbatim: String(localized: "Paused"), value: settings.pausedText)
            }
        }
        WorkoutRestSettings(preferences: settings.preferences, send: send)
        ListSection("Screen · every workout") {
            ToggleRow("Keep the screen awake", isOn: binding(\.keepsScreenAwake))
            ToggleRow("Lock Screen and Dynamic Island", isOn: binding(\.showsLiveActivity))
        }
    }

    private func binding(_ key: WritableKeyPath<WorkoutPreferences, Bool>) -> Binding<Bool> {
        .action(settings.preferences[keyPath: key]) { value in
            var changed = settings.preferences
            changed[keyPath: key] = value
            send(.settingsPreferencesChanged(changed))
        }
    }
}

/// Rest after each set, the default rest, and what happens when a rest is over.
private struct WorkoutRestSettings: View {
    let preferences: WorkoutPreferences
    let send: (WorkoutAction) -> Void

    var body: some View {
        ListSection(
            "Rest · every workout",
            footer: "Exercises with their own rest keep it. Alert reaches the phone when it is locked."
        ) {
            ToggleRow("Start rest after each set", isOn: .action(preferences.startsRest) { changed { $0.startsRest = $1 }($0) })
            StepperField(
                "Default rest",
                value: .action(Double(preferences.defaultRestSeconds)) { value in
                    changed { $0.defaultRestSeconds = Int($1) }(value)
                },
                in: Double(WorkoutPreferences.restRange.lowerBound)...Double(WorkoutPreferences.restRange.upperBound),
                step: Double(WorkoutPreferences.restStep),
                format: { RestText.clock(Int($0)) }
            )
            .padding(.vertical, Space.sm)
            .pageGutter()
            MenuRow(
                "When rest is over",
                selection: .action(preferences.restAlert) { changed { $0.restAlert = $1 }($0) },
                options: [
                    ChoiceOption(RestAlert.alert, title: "Alert"),
                    ChoiceOption(RestAlert.haptic, title: "Haptic only"),
                    ChoiceOption(RestAlert.off, title: "Off"),
                ]
            )
        }
    }

    /// Sends the preferences with one value changed by `apply`.
    private func changed<Value>(_ apply: @escaping (inout WorkoutPreferences, Value) -> Void) -> (Value) -> Void {
        { value in
            var next = preferences
            apply(&next, value)
            send(.settingsPreferencesChanged(next))
        }
    }
}

/// "1:30": a rest length in minutes and seconds.
nonisolated enum RestText {
    static func clock(_ seconds: Int) -> String {
        let seconds = max(0, seconds)
        let rest = seconds % 60
        return "\(seconds / 60):" + (rest < 10 ? "0\(rest)" : "\(rest)")
    }
}
