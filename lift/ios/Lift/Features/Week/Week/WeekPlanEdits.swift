import Foundation
import LiftCore
import LiftStore

/// A Week toast's message and, when the change can be reverted, its Undo.
nonisolated struct WeekNotice: Equatable, Sendable {
    let message: String
    let undo: WeekUndo?

    init(_ message: String, undo: WeekUndo? = nil) {
        self.message = message
        self.undo = undo
    }
}

/// The Week screen's planning writes: a day planned from a template or left blank, Change workout and Plan next week,
/// and their Undo. Each returns the toast to show.
struct WeekPlanEdits {
    let sessions: any SessionRepository
    let plans: any WorkoutPlanRepository
    let templates: any TemplateRepository
    /// The preferred unit, read when a session is made: new sessions are logged in it.
    let units: any UnitPreference
    let days: DayCalendar

    func add(_ template: WeekTemplateChoice, on day: LocalDay) async throws -> WeekNotice {
        _ = try await plans.createSession(from: template.id, on: day, unit: units.unit)
        return WeekNotice(String(localized: "Added \(template.name) on \(days.shortTitle(of: day))"))
    }

    /// An empty session named "Workout" on `day`; returns its id.
    func addBlank(on day: LocalDay) async throws -> UUID {
        try await sessions.createSession(
            on: day,
            title: String(localized: "Workout"),
            unit: units.unit,
            templateID: nil
        ).id
    }

    /// Swaps the session's exercises; a session with a logged set keeps them and says so.
    func change(_ sessionID: UUID, to template: WeekTemplateChoice) async throws -> WeekNotice {
        do {
            let undo = try await plans.changeTemplate(of: sessionID, to: template.id)
            return WeekNotice(String(localized: "Changed to \(template.name)"), undo: .template(undo))
        } catch  where AppError.kind(of: error) == .conflict {
            return WeekNotice(String(localized: "A started workout keeps its exercises"))
        }
    }

    /// A new empty template with a free name; returns its id.
    func newTemplate(taken: [String]) async throws -> UUID {
        try await templates.createTemplate(name: TemplateText.newName(taken: taken)).id
    }

    func planNextWeek(from weekStart: LocalDay) async throws -> WeekNotice {
        let plan = try await plans.planNextWeek(from: weekStart)
        guard !plan.sessionIDs.isEmpty else {
            return WeekNotice(String(localized: "Next week already has those days"))
        }
        let count = plan.sessionIDs.count
        let message =
            count == 1
            ? String(localized: "Planned 1 workout for next week")
            : String(localized: "Planned \(count) workouts for next week")
        return WeekNotice(message, undo: .plan(plan))
    }

    /// Puts a change back; nothing to show after it.
    func undo(_ undo: WeekUndo) async throws -> WeekNotice? {
        switch undo {
        case .reschedule(let change): try await sessions.undo(change)
        case .template(let change): try await plans.undo(change)
        case .plan(let plan): try await plans.undo(plan)
        }
        return nil
    }
}

/// A planning write and the `pending` key that stops a double tap from running it twice (nil: no single session).
struct WeekPlanWrite {
    /// The `pending` key of writes that change no single session.
    static let planKey = UUID(uuid: (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0))

    let key: UUID?
    let body: (WeekPlanEdits) async throws -> WeekNotice?
}

extension WeekPlanEdits {
    /// The write a planning action asks for; nil for any other action or a template that is gone.
    static func write(
        for action: WeekAction,
        templates: [WeekTemplateChoice],
        weekStart: LocalDay?,
        router: any Navigating
    ) -> WeekPlanWrite? {
        let template = { (id: UUID) in templates.first { $0.id == id } }
        switch action {
        case .templatePicked(let id, let day):
            return template(id).map { choice in WeekPlanWrite(key: nil) { try await $0.add(choice, on: day) } }
        case .blankWorkoutPicked(let day):
            return WeekPlanWrite(key: nil) { edits in
                router.open(.workout(try await edits.addBlank(on: day)))
                return nil
            }
        case .changeTemplatePicked(let sessionID, let id):
            return template(id).map { choice in
                WeekPlanWrite(key: sessionID) { try await $0.change(sessionID, to: choice) }
            }
        case .newTemplateTapped:
            let taken = templates.map(\.name)
            return WeekPlanWrite(key: nil) { edits in
                router.open(.template(try await edits.newTemplate(taken: taken)))
                return nil
            }
        case .planNextWeekTapped:
            return weekStart.map { start in WeekPlanWrite(key: nil) { try await $0.planNextWeek(from: start) } }
        case .templateUndoTapped(let undo):
            return WeekPlanWrite(key: undo.sessionID) { try await $0.undo(.template(undo)) }
        case .planUndoTapped(let undo):
            return WeekPlanWrite(key: nil) { try await $0.undo(.plan(undo)) }
        default:
            return nil
        }
    }
}
