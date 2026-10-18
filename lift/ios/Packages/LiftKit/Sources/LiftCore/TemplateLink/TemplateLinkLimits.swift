import Foundation

/// The limits a template link must keep, and the defaults for the keys it leaves out. Names and notes are trimmed;
/// a blank note counts as none.
public enum TemplateLinkLimits {
    public static let templates = 1...20
    public static let exercisesPerTemplate = 1...30
    public static let templateNameLength = 1...60
    public static let exerciseNameLength = 1...80
    public static let noteLength = 0...280
    public static let sets = 1...20
    public static let reps = 1...100
    /// The heaviest load, in either unit.
    public static let weight = 0.0...1_500
    /// Rest, in seconds (up to 30 minutes).
    public static let rest = 0...1_800

    /// The templates `payload` describes, or the first field that breaks a limit.
    static func validate(_ payload: TemplateLinkPayload) throws(TemplateLinkError) -> [LinkedTemplate] {
        guard !payload.templates.isEmpty else { throw .empty }
        guard payload.templates.count <= templates.upperBound else { throw .invalid(field: "templates") }
        let fallback = try unit(payload.unit, field: "unit")
        var names = Set<String>()
        var result: [LinkedTemplate] = []
        for (index, template) in payload.templates.enumerated() {
            let field = "templates[\(index)]"
            let linked = try validate(template, field: field, fallback: fallback)
            guard names.insert(ExerciseMatcher.normalizedName(linked.name)).inserted else {
                throw .invalid(field: "\(field).name")
            }
            result.append(linked)
        }
        return result
    }

    private static func validate(
        _ template: TemplateLinkPayload.Template,
        field: String,
        fallback: WeightUnit?
    ) throws(TemplateLinkError) -> LinkedTemplate {
        let name = try text(template.name, limit: templateNameLength, field: "\(field).name")
        guard !template.exercises.isEmpty else { throw .empty }
        guard template.exercises.count <= exercisesPerTemplate.upperBound else {
            throw .invalid(field: "\(field).exercises")
        }
        let unit = try unit(template.unit, field: "\(field).unit") ?? fallback
        var exercises: [LinkedExercise] = []
        for (index, exercise) in template.exercises.enumerated() {
            exercises.append(try validate(exercise, field: "\(field).exercises[\(index)]", unit: unit))
        }
        let weighs = template.exercises.contains { $0.weight != nil }
        guard !weighs || unit != nil else { throw .invalid(field: "\(field).unit") }
        return LinkedTemplate(name: name, unit: weighs ? unit : nil, exercises: exercises)
    }

    private static func validate(
        _ exercise: TemplateLinkPayload.Exercise,
        field: String,
        unit: WeightUnit?
    ) throws(TemplateLinkError) -> LinkedExercise {
        let name = try text(exercise.name, limit: exerciseNameLength, field: "\(field).name")
        let sets = exercise.sets ?? TemplateExercise.defaultSets
        guard Self.sets.contains(sets) else { throw .invalid(field: "\(field).sets") }
        let repRange = try repRange(reps: exercise.reps, repMax: exercise.repMax, field: field)
        var weight: Weight?
        if let value = exercise.weight {
            guard value.isFinite, Self.weight.contains(value) else { throw .invalid(field: "\(field).weight") }
            weight = unit.map { Weight(value, $0) }
        }
        let rest = exercise.rest ?? TemplateExercise.defaultRestSeconds
        guard Self.rest.contains(rest) else { throw .invalid(field: "\(field).rest") }
        var note: String?
        if let raw = exercise.note { note = try text(raw, limit: noteLength, field: "\(field).note") }
        var load: LinkedLoad?
        if let raw = exercise.load {
            guard let known = LinkedLoad(rawValue: raw) else { throw .invalid(field: "\(field).load") }
            load = known
        }
        return LinkedExercise(
            name: name,
            sets: sets,
            repRange: repRange,
            weight: weight,
            restSeconds: rest,
            note: note?.isEmpty == false ? note : nil,
            load: load
        )
    }

    private static func repRange(reps: Int?, repMax: Int?, field: String) throws(TemplateLinkError)
        -> ClosedRange<Int>
    {
        guard let reps else {
            guard repMax == nil else { throw .invalid(field: "\(field).reps") }
            return TemplateExercise.defaultRepRange
        }
        guard Self.reps.contains(reps) else { throw .invalid(field: "\(field).reps") }
        let upper = repMax ?? reps
        guard Self.reps.contains(upper), upper >= reps else { throw .invalid(field: "\(field).repMax") }
        return reps...upper
    }

    private static func unit(_ raw: String?, field: String) throws(TemplateLinkError) -> WeightUnit? {
        guard let raw else { return nil }
        guard let unit = WeightUnit(rawValue: raw.lowercased()) else { throw .invalid(field: field) }
        return unit
    }

    private static func text(_ raw: String, limit: ClosedRange<Int>, field: String) throws(TemplateLinkError)
        -> String
    {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard limit.contains(trimmed.count), !trimmed.contains(where: \.isNewline) || field.hasSuffix(".note") else {
            throw .invalid(field: field)
        }
        return trimmed
    }
}
