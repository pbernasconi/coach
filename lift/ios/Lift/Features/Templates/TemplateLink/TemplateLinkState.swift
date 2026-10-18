import Foundation
import KoboPatterns
import LiftCore

/// Everything the template link review renders. The phases exclude each other, so they are one enum (SCR-6); the
/// submit is Kobo's step state machine.
nonisolated struct TemplateLinkState: Equatable, Sendable {
    var phase: TemplateLinkPhase = .loading
    var submit = LoadableStepState()
}

nonisolated enum TemplateLinkPhase: Equatable, Sendable {
    /// Reading the link and the library.
    case loading
    /// The link cannot be added; nothing was written.
    case failed(TemplateLinkProblem)
    case review(TemplateLinkReview)
}

/// Why a link cannot be added, in words the person can act on.
nonisolated enum TemplateLinkProblem: Equatable, Sendable {
    /// Not base64url, not JSON, or a field out of its limits.
    case unreadable
    /// Written by a newer Lift.
    case newerVersion
    /// No templates, or a template without exercises.
    case empty
    case tooLarge

    init(_ error: TemplateLinkError) {
        switch error {
        case .notBase64, .notJSON, .invalid: self = .unreadable
        case .unsupportedVersion: self = .newerVersion
        case .empty: self = .empty
        case .tooLarge: self = .tooLarge
        }
    }
}

/// The templates a link holds, as the review lists them.
nonisolated struct TemplateLinkReview: Equatable, Sendable {
    var templates: [TemplateLinkReviewTemplate]
    /// Names that become new library exercises.
    var newExercises: [TemplateLinkNewExercise]

    /// The templates that will be added: new names, and existing ones marked Replace.
    var addCount: Int { templates.filter(\.isAdded).count }
}

/// One template of the link.
nonisolated struct TemplateLinkReviewTemplate: Equatable, Sendable, Identifiable {
    /// The template's position in the link (`TemplateLinkPlan.Item.id`).
    let id: Int
    var name: String
    /// "3 exercises · 9 sets · lb".
    var detail: String
    var exercises: [TemplateLinkReviewExercise]
    /// A template with this name is already in the list.
    var exists: Bool
    /// For an existing name: replace it (true) or skip this one (false, the default).
    var replaces = false

    var isAdded: Bool { !exists || replaces }
}

/// One exercise row: its library name and "3 × 8 @ 135 lb · 3 min rest".
nonisolated struct TemplateLinkReviewExercise: Equatable, Sendable, Identifiable {
    /// The exercise's position in its template.
    let id: Int
    var name: String
    var value: String
}

/// A name that becomes a new library exercise; names are unique within a review.
nonisolated struct TemplateLinkNewExercise: Equatable, Sendable, Identifiable {
    var name: String

    var id: String { name }
}
