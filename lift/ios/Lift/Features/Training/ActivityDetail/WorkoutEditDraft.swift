import Foundation
import LiftCore
import LiftSync

/// The workout page's Edit sheet: a planned workout's details as the web's Edit lets you change them (title, day, start
/// time, duration, distance, TSS, effort, the coach's bank workout and its step, description). The fields hold what
/// was typed; `edit` reads them into the body the server takes (lift/APP-API.md, "Edit a workout").
nonisolated struct WorkoutEditDraft: Equatable, Sendable, Identifiable {
    /// The plan activity id.
    let id: String
    /// The form as the server sent it: the choices, and what the fields started as.
    let form: PlannedEditForm
    var title: String
    var day: LocalDay
    /// Minutes after midnight, or nil for no start time.
    var startMinute: Int?
    var durationText: String
    var distanceText: String
    var tssText: String
    var effort: String
    var bank: String?
    var level: Int
    var description: String
    /// What went wrong with the last save, shown in the sheet.
    var error: String?
    var isSaving = false

    /// The form filled in; nil when its day is not a day.
    init?(id: String, form: PlannedEditForm) {
        guard let day = CoachPlanDates.day(fromPlain: form.date) else { return nil }
        self.id = id
        self.form = form
        title = form.title
        self.day = day
        startMinute = form.startTime.flatMap(Self.minute(of:))
        durationText = form.duration.map { PlannedEditText.clock(Int($0.rounded())) } ?? ""
        distanceText = PlannedEditText.text(form.distanceKm)
        tssText = PlannedEditText.text(form.tss)
        effort = form.effort
        bank = form.bank
        level = form.level
        description = form.description
    }

    private static func trim(_ text: String) -> String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    /// "07:00" as minutes after midnight.
    static func minute(of time: String) -> Int? {
        let parts = time.split(separator: ":").compactMap { Int($0) }
        guard parts.count >= 2, (0..<24).contains(parts[0]), (0..<60).contains(parts[1]) else { return nil }
        return parts[0] * 60 + parts[1]
    }

    var isRest: Bool { form.sport == "rest" }

    /// Runs and rides can take their steps from the coach's bank.
    var offersBank: Bool { !form.bankOptions.isEmpty }

    /// The picked bank workout's steps, by name ("6×5 min top of Z4"); empty without one.
    var levels: [String] { form.bankOptions.first { $0.id == bank }?.levels ?? [] }

    /// Steps decide the effort: the effort chips show only without them.
    var hasSteps: Bool { bank != nil || form.otherSteps }

    /// The TSS an empty field saves, when the phone can tell: the stored steps' when they stay as they were, else the
    /// time at the effort's IF. Nil for new steps (the server works it out) or no time.
    var autoTss: Int? {
        let minutes = PlannedEditText.minutes(durationText)
        if hasSteps {
            let same = bank == form.bank && level == form.level && minutes == form.duration.map { Int($0.rounded()) }
            return same ? form.stepsTss.map { Int($0.rounded()) } : nil
        }
        let factor = form.efforts.first { $0.id == effort }?.intensityFactor
        guard let minutes, let factor else { return nil }
        return PlannedEditText.estimatedTss(minutes: minutes, intensityFactor: factor)
    }

    /// The body to send, or the words for the first field that is not right.
    var edit: Result<PlannedWorkoutEdit, EditProblem> {
        let minutes = PlannedEditText.minutes(durationText)
        if !Self.trim(durationText).isEmpty, minutes == nil { return .failure(.duration) }
        let distance = PlannedEditText.number(distanceText)
        if !Self.trim(distanceText).isEmpty, (distance ?? 0) <= 0 { return .failure(.distance) }
        let tss = PlannedEditText.number(tssText)
        if !Self.trim(tssText).isEmpty, tss == nil || (tss ?? 0) < 0 { return .failure(.tss) }
        return .success(
            PlannedWorkoutEdit(
                title: Self.trim(title),
                date: CoachPlanDates.plain(day),
                startTime: startMinute.map { String(format: "%02d:%02d", $0 / 60, $0 % 60) },
                duration: minutes.map(Double.init),
                distanceKm: distance,
                tss: tss,
                effort: effort,
                description: description,
                bank: bank,
                level: bank == nil ? 0 : level
            )
        )
    }

    /// Something was changed: closing the sheet asks first.
    var hasChanges: Bool {
        WorkoutEditDraft(id: id, form: form).map { $0.fields != fields } ?? true
    }

    private var fields: [String] {
        [
            title, CoachPlanDates.plain(day), startMinute.map(String.init) ?? "", durationText, distanceText, tssText,
            effort, bank ?? "", String(level), description,
        ]
    }

    /// A field the server would refuse, with what to type instead.
    enum EditProblem: Error, Equatable {
        case duration, distance, tss

        var message: String {
            switch self {
            case .duration: String(localized: "The duration must be like 1:30 or 90.")
            case .distance: String(localized: "The distance must be a number of km above 0.")
            case .tss: String(localized: "The TSS must be a number.")
            }
        }
    }
}

extension ActivityDetailState {
    /// The pencil: the Edit sheet, filled in, for a planned workout not done yet.
    mutating func openEdit() {
        guard canEdit, let plan, let form = plan.edit else { return }
        destination = WorkoutEditDraft(id: plan.id, form: form).map { .edit($0) }
    }

    /// Save: the body to send and the day it moves to (nil when it stays), with the sheet saving; nil while a save
    /// runs, or when a field is not right, which the sheet then names.
    mutating func beginEditSave() -> (edit: PlannedWorkoutEdit, moving: LocalDay?)? {
        guard var draft = editDraft, !draft.isSaving, let plan else { return nil }
        switch draft.edit {
        case .failure(let problem):
            draft.error = problem.message
            destination = .edit(draft)
            return nil
        case .success(let edit):
            draft.isSaving = true
            draft.error = nil
            destination = .edit(draft)
            return (edit, edit.date == plan.date ? nil : draft.day)
        }
    }

    /// A save that failed: the sheet stays open with what was typed, and says why.
    mutating func failEditSave(_ message: String) {
        guard var draft = editDraft else { return }
        draft.isSaving = false
        draft.error = message
        destination = .edit(draft)
    }
}

