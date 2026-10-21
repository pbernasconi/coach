import Foundation
import LiftCore
import LiftStore
import LiftSync

/// A made-up plan for demo data (TEST-8), so `-demo` screenshots show a full mixed week: rides, runs, a swim, a rest
/// day, and strength items linked to the demo Lift sessions. Built once from the seeded sessions; never fetched.
final class DemoCoachPlan: CoachPlanProviding {
    private let sessions: any SessionRepository
    private let now: @Sendable () -> Date
    private let days: DayCalendar

    init(sessions: any SessionRepository, now: @escaping @Sendable () -> Date, calendar: Calendar) {
        self.sessions = sessions
        self.now = now
        self.days = DayCalendar(calendar: calendar)
    }

    func snapshots() -> AsyncStream<CoachPlanSnapshot> {
        let (stream, continuation) = AsyncStream.makeStream(of: CoachPlanSnapshot.self)
        let today = days.day(of: now())
        let first = days.weekStart(of: today).adding(days: -7)
        let sessions = sessions
        let now = now
        let task = Task {
            for await details in sessions.observeSessions(from: first, through: first.adding(days: 27)) {
                let made = now().formatted(.iso8601)
                let plan = DemoCoachWeeks(today: today, firstWeek: first, sessions: details, generatedAt: made).plan
                continuation.yield(CoachPlanSnapshot(status: .ready, book: CoachPlanBook([plan])))
                break
            }
            continuation.finish()
        }
        continuation.onTermination = { _ in task.cancel() }
        return stream
    }

    func show(weekStart _: LocalDay) async {}

    func refresh() async {}

    func watchSync() async {}
}

/// Four made-up weeks from `firstWeek`, with "today" states as the server would send them.
nonisolated struct DemoCoachWeeks {
    let today: LocalDay
    let firstWeek: LocalDay
    let sessions: [SessionDetail]
    /// When the made-up plan was "fetched": now, so the header reads "Updated" with today's time.
    let generatedAt: String

    var plan: CoachPlan {
        CoachPlan(
            generatedAt: generatedAt,
            timeZone: "UTC",
            today: today,
            weeks: (0..<4).map { week(firstWeek.adding(days: 7 * $0), number: $0 + 2) }
        )
    }

    private func week(_ start: LocalDay, number: Int) -> CoachWeek {
        let days = (0..<7).map { index in
            let day = start.adding(days: index)
            return CoachDay(date: day, items: lifts(on: day) + otherSports(on: day, weekday: index))
        }
        let items = days.flatMap(\.items).filter { $0.sport != Sport.rest.rawValue }
        let done = items.count(where: { $0.state == .done })
        return CoachWeek(
            start: start,
            title: "Build week \(number)",
            hasPlan: true,
            totals: CoachTotals(
                text: "\(done)/\(items.count) done · \(done) h of \(items.count) h",
                plannedCount: items.count,
                doneCount: done,
                missedCount: items.count(where: { $0.state == .missed })
            ),
            days: days
        )
    }

    /// The day's demo Lift sessions as strength items linked to them.
    private func lifts(on day: LocalDay) -> [CoachItem] {
        sessions.filter { $0.session.day == day }.map { detail in
            item(
                "lift-\(detail.id.uuidString.lowercased())",
                on: day,
                title: detail.session.title,
                sport: .strength,
                subtitle: "17:30 · 45 min · 35 TSS",
                linking: detail.id
            )
        }
    }

    /// The other sports by weekday, Monday first: title, sport and subtitle. Tuesday is the intervals.
    private static let otherSports: [(title: String, sport: Sport, subtitle: String)] = [
        ("Rest day", .rest, "Recover"),
        ("Sweet spot 3 × 12", .ride, "07:00 · 60 min · 70 TSS"),
        ("Easy run", .run, "07:00 · 40 min · 35 TSS"),
        ("Endurance ride", .ride, "07:00 · 75 min · 60 TSS"),
        ("Technique swim", .swim, "12:00 · 30 min · 20 TSS"),
        ("Long ride", .ride, "09:00 · 2:30 · 140 TSS"),
        ("Hike", .hike, "10:00 · 2:00 · 70 TSS"),
    ]

    /// The day's other sport. A Monday with a lift has no rest day.
    private func otherSports(on day: LocalDay, weekday: Int) -> [CoachItem] {
        if weekday == 0 && sessions.contains(where: { $0.session.day == day }) { return [] }
        let sport = Self.otherSports[weekday]
        var other = item(
            "\(sport.sport.rawValue)-\(day.daysSinceEpoch)",
            on: day,
            title: sport.title,
            sport: sport.sport,
            subtitle: sport.subtitle
        )
        switch weekday {
        case 1: describeIntervals(&other)
        case 5:
            other.adapted = true
            other.why = "Shortened from 3:00: Sunday's hike adds time on feet."
        default: break
        }
        return [other]
    }

    private func describeIntervals(_ ride: inout CoachItem) {
        ride.why = "Raises the ceiling for the long climbs in the ski block."
        ride.notes = "Indoor trainer. Keep cadence above 85."
        ride.keyTargets = ["3 × 12:00 at 88–93% FTP"]
        ride.steps = [
            CoachStep(label: "Warm up", detail: "10:00 · 55–75% FTP"),
            CoachStep(label: "3 ×", detail: "12:00 at 88–93% FTP, 4:00 easy"),
            CoachStep(label: "Cool down", detail: "8:00 · 50% FTP"),
        ]
    }

    /// The state the server would send: today, planned ahead, done before, but the last week's run skipped and its
    /// swim missed.
    private func state(on day: LocalDay, sport: Sport) -> CoachItemState {
        if day == today { return .today }
        if day > today { return .planned }
        let lastWeek = today.daysSinceEpoch - day.daysSinceEpoch < 7
        switch sport {
        case .run where lastWeek: return .skipped
        case .swim where lastWeek: return .missed
        default: return .done
        }
    }

    private func item(
        _ id: String,
        on day: LocalDay,
        title: String,
        sport: Sport,
        subtitle: String,
        linking session: UUID? = nil
    ) -> CoachItem {
        let state = state(on: day, sport: sport)
        let labels: [CoachItemState: String] = [
            .today: "Today", .planned: "Planned", .done: "Done", .skipped: "Skipped", .missed: "Missed",
        ]
        var item = CoachItem(
            id: id,
            date: day,
            title: title,
            sport: sport.rawValue,
            subtitle: subtitle,
            state: sport == .rest ? .planned : state,
            stateLabel: sport == .rest ? "Rest" : labels[state] ?? "",
            liftSessionId: session?.uuidString.lowercased()
        )
        if item.state == .done && sport != .strength {
            // A made-up Strava match, so the sheet's "Open activity" opens the demo run (`DemoActivities.run`).
            item.done = CoachDone(
                source: "strava",
                name: title,
                minutes: nil,
                tss: nil,
                text: subtitle,
                activityId: DemoActivities.run
            )
        }
        return item
    }
}
