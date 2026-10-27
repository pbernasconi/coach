import Foundation

/// A photo or file on a message: in the composer while it uploads, or under a sent message. The picture itself comes
/// from the caller (`ChatAttachmentStrip`'s `preview`), so this stays a plain value.
nonisolated public struct ChatAttachment: Identifiable, Equatable, Sendable {
    /// What the tile shows: the picture, or a page glyph with the name.
    public enum Kind: Equatable, Sendable {
        case image
        case file
    }

    /// Where its upload stands. A sent message's attachments are `.ready`.
    public enum State: Equatable, Sendable {
        case uploading
        case ready
        case failed
    }

    public let id: String
    public var kind: Kind
    public var name: String
    public var state: State

    public init(id: String, kind: Kind, name: String, state: State = .ready) {
        self.id = id
        self.kind = kind
        self.name = name
        self.state = state
    }
}

/// A photo or file the attach picker hands back, ready to upload: a photo is already shrunk and turned into JPEG
/// (`ChatImageFit`), with a small `preview` for the composer's tile.
nonisolated public struct ChatPickedFile: Identifiable, Equatable, Sendable {
    public let id: String
    public let kind: ChatAttachment.Kind
    public let name: String
    /// The MIME type of `data` ("image/jpeg", "application/pdf").
    public let contentType: String
    public let data: Data
    /// A photo's size in pixels after shrinking.
    public let pixelWidth: Int?
    public let pixelHeight: Int?
    /// A small JPEG for the tile, for a photo.
    public let preview: Data?

    public init(
        id: String,
        kind: ChatAttachment.Kind,
        name: String,
        contentType: String,
        data: Data,
        pixelWidth: Int? = nil,
        pixelHeight: Int? = nil,
        preview: Data? = nil
    ) {
        self.id = id
        self.kind = kind
        self.name = name
        self.contentType = contentType
        self.data = data
        self.pixelWidth = pixelWidth
        self.pixelHeight = pixelHeight
        self.preview = preview
    }

    /// The attachment as the composer shows it while it uploads.
    public var attachment: ChatAttachment { ChatAttachment(id: id, kind: kind, name: name, state: .uploading) }
}

/// The rules of attachments in a composer.
nonisolated enum ChatAttachmentLogic {
    /// Whether the composer can send: none attached, all uploaded, or some still on their way (or failed).
    static func readiness(_ items: [ChatAttachment]) -> ChatComposerLogic.Attachments {
        if items.isEmpty { return .none }
        return items.allSatisfy { $0.state == .ready } ? .ready : .pending
    }

    /// How many more the composer takes, at most `limit` in all.
    static func room(for items: [ChatAttachment], limit: Int) -> Int { max(0, limit - items.count) }

    /// A selection with `id` added or taken out, never past `limit`.
    static func toggled(_ id: String, in selection: [String], limit: Int) -> [String] {
        if selection.contains(id) { return selection.filter { $0 != id } }
        return selection.count < limit ? selection + [id] : selection
    }
}

/// The size a photo is shrunk to before upload: its long side at most `maxSide` pixels, the shape kept, never made
/// larger. 1568 px is the most detail a vision model reads (more costs tokens and adds nothing).
nonisolated public enum ChatImageFit {
    public static let maxSide = 1568
    /// The tile preview's long side.
    public static let previewSide = 240

    public static func fitted(
        width: Int,
        height: Int,
        maxSide: Int = ChatImageFit.maxSide
    ) -> (width: Int, height: Int) {
        guard width > 0, height > 0 else { return (0, 0) }
        let long = max(width, height)
        guard long > maxSide else { return (width, height) }
        let scale = Double(maxSide) / Double(long)
        return (max(1, Int((Double(width) * scale).rounded())), max(1, Int((Double(height) * scale).rounded())))
    }
}
