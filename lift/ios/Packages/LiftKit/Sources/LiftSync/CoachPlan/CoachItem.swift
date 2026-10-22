import Foundation
import LiftCore

/// One planned activity (lift/WEEK-API.md). Every text is display-ready. Optional fields are nil when the server
/// sends `null`; lists are empty when it sends none.
public struct CoachItem: Decodable, Equatable, Sendable, Identifiable {
    /// The plan activity id: a string, not always a UUID.
    public var id: String
    public var date: LocalDay
    public var startTime: String?
    public var endTime: String?
    public var title: String
    /// An id from `design/sports.json`; the app maps an unknown one to "other".
    public var sport: String
    public var workoutType: String?
    public var intensity: String?
    public var durationMinutes: Double?
    public var tss: Double?
    /// "13:30 · 60 min · 45 TSS".
    public var subtitle: String
    public var state: CoachItemState
    /// "Today", "Done", "Missed"…
    public var stateLabel: String
    /// `good | partial | off`, only for done items.
    public var compliance: String?
    public var adapted: Bool
    /// A completed activity that no planned workout matched (`id` is "activity-<Strava id>").
    public var unplanned: Bool
    public var why: String?
    public var notes: String?
    public var keyTargets: [String]
    public var steps: [CoachStep]
    /// The workout as bars for a small interval chart; empty without structured steps.
    public var profile: [CoachProfileBar]
    /// The row's numbers as text: what was done, or what is planned.
    public var stats: CoachStats
    /// The Lift session this item plans, lower-case; compare it case-insensitively.
    public var liftSessionId: String?
    public var done: CoachDone?

    public init(
        id: String,
        date: LocalDay,
        title: String,
        sport: String,
        subtitle: String,
        state: CoachItemState,
        stateLabel: String,
        adapted: Bool = false,
        unplanned: Bool = false,
        why: String? = nil,
        notes: String? = nil,
        keyTargets: [String] = [],
        steps: [CoachStep] = [],
        profile: [CoachProfileBar] = [],
        stats: CoachStats = CoachStats(),
        liftSessionId: String? = nil
    ) {
        self.id = id
        self.date = date
        self.title = title
        self.sport = sport
        self.subtitle = subtitle
        self.state = state
        self.stateLabel = stateLabel
        self.adapted = adapted
        self.unplanned = unplanned
        self.why = why
        self.notes = notes
        self.keyTargets = keyTargets
        self.steps = steps
        self.profile = profile
        self.stats = stats
        self.liftSessionId = liftSessionId
    }

    private enum CodingKeys: String, CodingKey {
        case id, date, startTime, endTime, title, sport, workoutType, intensity, durationMinutes, tss, subtitle
        case state, stateLabel, compliance, adapted, unplanned, why, notes, keyTargets, steps, profile, stats
        case liftSessionId, done
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        date = try container.plainDay(forKey: .date)
        title = try container.decode(String.self, forKey: .title)
        sport = try container.decodeIfPresent(String.self, forKey: .sport) ?? "other"
        subtitle = try container.decodeIfPresent(String.self, forKey: .subtitle) ?? ""
        state = try container.decodeIfPresent(CoachItemState.self, forKey: .state) ?? .planned
        stateLabel = try container.decodeIfPresent(String.self, forKey: .stateLabel) ?? ""
        adapted = try container.decodeIfPresent(Bool.self, forKey: .adapted) ?? false
        unplanned = try container.decodeIfPresent(Bool.self, forKey: .unplanned) ?? false
        keyTargets = try container.decodeIfPresent([String].self, forKey: .keyTargets) ?? []
        steps = try container.decodeIfPresent([CoachStep].self, forKey: .steps) ?? []
        profile = try container.decodeIfPresent([CoachProfileBar].self, forKey: .profile) ?? []
        stats = try container.decodeIfPresent(CoachStats.self, forKey: .stats) ?? CoachStats()
        try decodeOptionals(container)
    }

    private mutating func decodeOptionals(_ container: KeyedDecodingContainer<CodingKeys>) throws {
        startTime = try container.decodeIfPresent(String.self, forKey: .startTime)
        endTime = try container.decodeIfPresent(String.self, forKey: .endTime)
        workoutType = try container.decodeIfPresent(String.self, forKey: .workoutType)
        intensity = try container.decodeIfPresent(String.self, forKey: .intensity)
        durationMinutes = try container.decodeIfPresent(Double.self, forKey: .durationMinutes)
        tss = try container.decodeIfPresent(Double.self, forKey: .tss)
        compliance = try container.decodeIfPresent(String.self, forKey: .compliance)
        why = try container.decodeIfPresent(String.self, forKey: .why)
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        liftSessionId = try container.decodeIfPresent(String.self, forKey: .liftSessionId)
        done = try container.decodeIfPresent(CoachDone.self, forKey: .done)
    }

    /// Whether this item plans the Lift session `id` (the server sends lower case, LiftStore writes upper case).
    public func links(_ id: UUID) -> Bool {
        guard let liftSessionId else { return false }
        return liftSessionId.caseInsensitiveCompare(id.uuidString) == .orderedSame
    }
}
