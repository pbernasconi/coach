import Foundation

/// A movement in the user's library. Persisted, so it carries the row stamps (DATA-2).
public struct Exercise: Codable, Hashable, Sendable, Identifiable {
    public var id: UUID
    public var name: String
    public var aliases: [String]
    public var equipment: Equipment
    public var loadMode: LoadMode
    public var primary: [Muscle]
    public var secondary: [Muscle]
    public var videoURL: URL?
    /// The bundled catalog entry this exercise came from or shows media for (`CatalogExercise.id`); nil for an
    /// exercise the person made up.
    public var catalogID: String?
    public var isArchived: Bool
    public var createdAt: Date
    public var updatedAt: Date
    public var deletedAt: Date?

    public init(
        id: UUID,
        name: String,
        aliases: [String] = [],
        equipment: Equipment,
        loadMode: LoadMode,
        primary: [Muscle],
        secondary: [Muscle] = [],
        videoURL: URL? = nil,
        catalogID: String? = nil,
        isArchived: Bool = false,
        createdAt: Date,
        updatedAt: Date,
        deletedAt: Date? = nil
    ) {
        self.id = id
        self.name = name
        self.aliases = aliases
        self.equipment = equipment
        self.loadMode = loadMode
        self.primary = primary
        self.secondary = secondary
        self.videoURL = videoURL
        self.catalogID = catalogID
        self.isArchived = isArchived
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
    }
}
