import Foundation

/// What adding a link's templates would do: each template with its resolved exercises, and the existing template it
/// would replace when the names match (compared like exercise names, so "Lower A" and "lower a" are one).
public struct TemplateLinkPlan: Hashable, Sendable {
    /// One template of the link, in link order.
    public struct Item: Hashable, Sendable, Identifiable {
        /// The template's position in the link.
        public let id: Int
        public let template: LinkedTemplate
        /// One source per exercise, in order.
        public let sources: [LinkedExerciseSource]
        /// The live template with the same name, if there is one.
        public let existingID: UUID?

        public init(id: Int, template: LinkedTemplate, sources: [LinkedExerciseSource], existingID: UUID?) {
            self.id = id
            self.template = template
            self.sources = sources
            self.existingID = existingID
        }
    }

    public let items: [Item]

    public init(items: [Item]) {
        self.items = items
    }

    /// Resolves every exercise (`TemplateLinkResolver`) and finds the templates whose names already exist.
    public static func make(
        _ templates: [LinkedTemplate],
        library: [Exercise],
        catalog: [CatalogExercise],
        existing: [DayTemplate]
    ) -> TemplateLinkPlan {
        let live = existing.filter { $0.deletedAt == nil }
        let byName = Dictionary(
            live.map { (ExerciseMatcher.normalizedName($0.name), $0.id) },
            uniquingKeysWith: { first, _ in first }
        )
        let items = templates.enumerated().map { index, template in
            Item(
                id: index,
                template: template,
                sources: template.exercises.map {
                    TemplateLinkResolver.resolve($0, library: library, catalog: catalog)
                },
                existingID: byName[ExerciseMatcher.normalizedName(template.name)]
            )
        }
        return TemplateLinkPlan(items: items)
    }

    /// The names that become new library exercises, once each (by normalized name), in link order.
    public var newExerciseNames: [String] {
        var seen = Set<String>()
        return items.flatMap(\.sources).filter(\.isNewToLibrary).map(\.name).filter { name in
            seen.insert(ExerciseMatcher.normalizedName(name)).inserted
        }
    }
}
