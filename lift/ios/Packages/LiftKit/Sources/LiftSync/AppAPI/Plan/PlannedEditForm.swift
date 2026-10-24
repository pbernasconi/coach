import Foundation

/// `edit` in `GET /api/app/plan/{id}` (lift/APP-API.md, "Planned workout"): the form of the workout page's Edit,
/// filled in as the web's Edit fills it, with its choices. Nil once the workout is done.
public struct PlannedEditForm: Decodable, Equatable, Sendable {
    /// An id from `design/sports.json`; the edit keeps it.
    public var sport: String
    /// "2026-10-22".
    public var date: String
    /// "07:00", or nil for none.
    public var startTime: String?
    public var title: String
    /// Minutes.
    public var duration: Double?
    public var distanceKm: Double?
    /// A TSS typed by hand; nil when it is automatic.
    public var tss: Double?
    /// One of `efforts`' ids.
    public var effort: String
    public var description: String
    /// The coach's bank workout (one of `bankOptions`' ids), or nil for none.
    public var bank: String?
    /// The step of its progression, 0 first.
    public var level: Int
    /// Steps that are not from the bank: they stay until a bank workout is picked.
    public var otherSteps: Bool
    /// The time and TSS the stored steps give, nil without steps.
    public var stepsMinutes: Double?
    public var stepsTss: Double?
    public var efforts: [PlannedEffort]
    /// The bank's workouts; empty but for runs and rides.
    public var bankOptions: [PlannedBankOption]

    public init(
        sport: String,
        date: String,
        startTime: String? = nil,
        title: String,
        duration: Double? = nil,
        distanceKm: Double? = nil,
        tss: Double? = nil,
        effort: String = "easy",
        description: String = "",
        bank: String? = nil,
        level: Int = 0,
        otherSteps: Bool = false,
        stepsMinutes: Double? = nil,
        stepsTss: Double? = nil,
        efforts: [PlannedEffort] = [],
        bankOptions: [PlannedBankOption] = []
    ) {
        self.sport = sport
        self.date = date
        self.startTime = startTime
        self.title = title
        self.duration = duration
        self.distanceKm = distanceKm
        self.tss = tss
        self.effort = effort
        self.description = description
        self.bank = bank
        self.level = level
        self.otherSteps = otherSteps
        self.stepsMinutes = stepsMinutes
        self.stepsTss = stepsTss
        self.efforts = efforts
        self.bankOptions = bankOptions
    }
}

/// An effort for a workout without steps: "Moderate", with the IF that estimates its TSS.
public struct PlannedEffort: Decodable, Equatable, Sendable, Identifiable {
    public var id: String
    public var label: String
    public var intensityFactor: Double

    enum CodingKeys: String, CodingKey {
        case id, label
        case intensityFactor = "if"
    }

    public init(id: String, label: String, intensityFactor: Double) {
        self.id = id
        self.label = label
        self.intensityFactor = intensityFactor
    }
}

/// One of the coach's bank workouts: "Threshold A", and the name of each step of its progression.
public struct PlannedBankOption: Decodable, Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String
    public var levels: [String]

    public init(id: String, name: String, levels: [String]) {
        self.id = id
        self.name = name
        self.levels = levels
    }
}

/// The body of `PUT /api/app/plan/{id}` ("Edit a workout"). A nil field is sent as missing, which the server reads as
/// empty: no start time, an automatic TSS, the stored distance, no bank workout.
public struct PlannedWorkoutEdit: Encodable, Equatable, Sendable {
    public var title: String
    public var date: String
    public var startTime: String?
    public var duration: Double?
    public var distanceKm: Double?
    public var tss: Double?
    public var effort: String
    public var description: String
    public var bank: String?
    public var level: Int

    public init(
        title: String,
        date: String,
        startTime: String?,
        duration: Double?,
        distanceKm: Double?,
        tss: Double?,
        effort: String,
        description: String,
        bank: String?,
        level: Int
    ) {
        self.title = title
        self.date = date
        self.startTime = startTime
        self.duration = duration
        self.distanceKm = distanceKm
        self.tss = tss
        self.effort = effort
        self.description = description
        self.bank = bank
        self.level = level
    }
}
