import Foundation

/// The JSON a `lift://templates?d=` link carries, as written (see `lift/TEMPLATE-LINKS.md`). Every key but `v`,
/// `templates`, a template's `name` and `exercises`, and an exercise's `name` may be left out. Unknown keys are
/// ignored, so a newer v1 writer can add optional keys.
public struct TemplateLinkPayload: Codable, Hashable, Sendable {
    /// The format version, `v`; only 1 exists.
    public var version: Int
    /// `unit`: "kg" or "lb", for every template that does not name its own.
    public var unit: String?
    public var templates: [Template]

    public init(version: Int = TemplateLink.version, unit: String?, templates: [Template]) {
        self.version = version
        self.unit = unit
        self.templates = templates
    }

    enum CodingKeys: String, CodingKey {
        case version = "v"
        case unit
        case templates
    }

    /// One template: its name, its own unit if it differs, and its exercises in order.
    public struct Template: Codable, Hashable, Sendable {
        public var name: String
        public var unit: String?
        public var exercises: [Exercise]

        public init(name: String, unit: String? = nil, exercises: [Exercise]) {
            self.name = name
            self.unit = unit
            self.exercises = exercises
        }
    }

    /// One exercise slot. `reps` alone is a fixed target ("8"); with `repMax` it is a range ("8–12").
    public struct Exercise: Codable, Hashable, Sendable {
        public var name: String
        public var sets: Int?
        public var reps: Int?
        public var repMax: Int?
        /// The planned load in the template's unit; added load for bodyweight work.
        public var weight: Double?
        /// Rest between sets, in seconds.
        public var rest: Int?
        public var note: String?
        /// How `weight` counts for an exercise the link creates: "total", "hand", "side" or "bw".
        public var load: String?

        public init(
            name: String,
            sets: Int? = nil,
            reps: Int? = nil,
            repMax: Int? = nil,
            weight: Double? = nil,
            rest: Int? = nil,
            note: String? = nil,
            load: String? = nil
        ) {
            self.name = name
            self.sets = sets
            self.reps = reps
            self.repMax = repMax
            self.weight = weight
            self.rest = rest
            self.note = note
            self.load = load
        }
    }
}

/// Why a template link cannot be read. Each case is something the person can be told plainly.
public enum TemplateLinkError: Error, Hashable, Sendable {
    /// `d` is missing or is not base64url.
    case notBase64
    /// The link is longer than `TemplateLink.maximumEncodedLength`, or its JSON than `maximumJSONBytes`.
    case tooLarge
    /// The bytes are not JSON of the expected shape.
    case notJSON
    /// `v` names a version this build does not know (a newer Lift wrote it).
    case unsupportedVersion(Int)
    /// No templates, or a template with no exercises.
    case empty
    /// A field is missing or outside its limits; `field` is its path ("templates[0].exercises[2].sets").
    case invalid(field: String)
}
