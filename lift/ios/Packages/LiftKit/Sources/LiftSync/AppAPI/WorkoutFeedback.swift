import Foundation

/// How a done workout felt (lift/APP-API.md, "Feedback"): the feel (1 very weak … 5 very strong), the perceived effort
/// (RPE 1–10) and a comment, as the web's EffortLog stores them. The session, activity and planned workout bodies carry
/// it; `PUT api/app/feedback` saves it under `item`.
public struct WorkoutFeedback: Decodable, Equatable, Sendable {
    public var item: String
    public var date: String
    public var title: String?
    public var planActivityId: String?
    public var feel: Int?
    public var rpe: Int?
    public var comment: String?
    /// The values came from the Garmin watch and nobody changed them in Coach.
    public var fromWatch: Bool
    /// The five feel words, "Very weak" first.
    public var feelLabels: [String]
    /// RPE 1 to 10, each with its word and what it feels like.
    public var rpeScale: [RPEStep]

    public struct RPEStep: Codable, Equatable, Sendable, Identifiable {
        public var value: Int
        public var label: String
        public var detail: String

        public var id: Int { value }

        public init(value: Int, label: String, detail: String) {
            self.value = value
            self.label = label
            self.detail = detail
        }
    }

    public static let path = "api/app/feedback"

    public init(
        item: String,
        date: String,
        title: String? = nil,
        planActivityId: String? = nil,
        feel: Int? = nil,
        rpe: Int? = nil,
        comment: String? = nil,
        fromWatch: Bool = false,
        feelLabels: [String],
        rpeScale: [RPEStep]
    ) {
        self.item = item
        self.date = date
        self.title = title
        self.planActivityId = planActivityId
        self.feel = feel
        self.rpe = rpe
        self.comment = comment
        self.fromWatch = fromWatch
        self.feelLabels = feelLabels
        self.rpeScale = rpeScale
    }

    private enum Key: String, CodingKey {
        case item, date, title, planActivityId, feel, rpe, comment, fromWatch, feelLabels, rpeScale
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: Key.self)
        item = try container.decode(String.self, forKey: .item)
        date = try container.decode(String.self, forKey: .date)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        planActivityId = try container.decodeIfPresent(String.self, forKey: .planActivityId)
        feel = try container.decodeIfPresent(Int.self, forKey: .feel)
        rpe = try container.decodeIfPresent(Int.self, forKey: .rpe)
        comment = try container.decodeIfPresent(String.self, forKey: .comment)
        fromWatch = try container.decodeIfPresent(Bool.self, forKey: .fromWatch) ?? false
        feelLabels = try container.decode([String].self, forKey: .feelLabels)
        rpeScale = try container.decode([RPEStep].self, forKey: .rpeScale)
    }

    /// Nothing logged yet, with the server's scales (src/lib/plan/feedback.mjs), for a check-in made before the coach
    /// has sent this workout's feedback block: right after a workout finishes in Lift.
    public static func blank(item: String, date: String, title: String?, planActivityId: String? = nil) -> WorkoutFeedback {
        WorkoutFeedback(
            item: item,
            date: date,
            title: title,
            planActivityId: planActivityId,
            feelLabels: standardFeelLabels,
            rpeScale: standardRPEScale
        )
    }

    /// The feel scale, 1 to 5, as the server's FEEL_LABELS.
    public static let standardFeelLabels = ["Very weak", "Weak", "Normal", "Strong", "Very strong"]

    /// The RPE scale (modified Borg CR-10), as the server's RPE_SCALE.
    public static let standardRPEScale: [RPEStep] = [
        ("Very easy", "Barely any effort."),
        ("Easy", "Could go all day."),
        ("Moderate", "Comfortable, full sentences."),
        ("Somewhat hard", "Breathing deeper, still chatty."),
        ("Hard", "Short sentences only."),
        ("Hard", "Steady focus needed."),
        ("Very hard", "A few words at a time."),
        ("Extremely hard", "Very challenging, intense focus."),
        ("Near max", "Could not keep it up much longer."),
        ("Max effort", "Nothing left."),
    ].enumerated().map { RPEStep(value: $0.offset + 1, label: $0.element.0, detail: $0.element.1) }

    /// The word for the logged feel, or nil.
    public var feelLabel: String? {
        guard let feel, feelLabels.indices.contains(feel - 1) else { return nil }
        return feelLabels[feel - 1]
    }

    /// The step of the logged RPE, or nil.
    public var rpeStep: RPEStep? {
        rpeScale.first { $0.value == rpe }
    }

    /// This feedback after one change. A tap on the logged face or effort clears it, as a second tap on the web does.
    public func applying(_ change: WorkoutFeedbackChange) -> WorkoutFeedback {
        var next = self
        next.fromWatch = false
        switch change {
        case .feel(let value): next.feel = feel == value ? nil : value
        case .rpe(let value): next.rpe = rpe == value ? nil : value
        case .comment(let text):
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            next.comment = trimmed.isEmpty ? nil : String(trimmed.prefix(2_000))
        }
        return next
    }

    /// The JSON body of a save: every value, `null` for the empty ones (the server clears them).
    public func saveBody() throws -> Data {
        let body = SaveBody(
            item: item,
            date: date,
            title: title,
            planActivityId: planActivityId,
            feel: feel,
            rpe: rpe,
            comment: comment
        )
        return try JSONEncoder().encode(body)
    }

    private struct SaveBody: Encodable {
        let item: String
        let date: String
        let title: String?
        let planActivityId: String?
        let feel: Int?
        let rpe: Int?
        let comment: String?

        private enum Key: String, CodingKey { case item, date, title, planActivityId, feel, rpe, comment }

        func encode(to encoder: any Encoder) throws {
            var container = encoder.container(keyedBy: Key.self)
            try container.encode(item, forKey: .item)
            try container.encode(date, forKey: .date)
            try container.encode(title, forKey: .title)
            try container.encode(planActivityId, forKey: .planActivityId)
            try container.encode(feel, forKey: .feel)
            try container.encode(rpe, forKey: .rpe)
            try container.encode(comment, forKey: .comment)
        }
    }
}

/// One edit of the "How did it feel" card.
public enum WorkoutFeedbackChange: Equatable, Sendable {
    case feel(Int)
    case rpe(Int)
    case comment(String)
}

/// Where the last save stands, for the card's small status line.
public enum WorkoutFeedbackSaveState: Equatable, Sendable {
    case idle
    case saving
    case saved
    /// Not saved; the card offers to try again.
    case failed
}
