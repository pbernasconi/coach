import Foundation

/// The links that open Lift (its URL scheme, `lift`, is in `project.yml`):
///
///     lift://import             Import from Notes with the note the Share extension left in the inbox
///     lift://import?text=…      Import from Notes with this text (for Shortcuts and short notes)
///
/// Compiled into the app, which routes them (`IncomingNoteRouter`), and LiftShare, which builds them.
nonisolated enum AppLink: Equatable, Sendable {
    /// Open Import from Notes with `text`, or with the inbox's note when nil.
    case importNote(text: String?)

    static let scheme = "lift"

    /// What a query value may hold unencoded: `&`, `=`, `+`, `?` and `#` are encoded, so any text survives the trip.
    private static let valueCharacters = CharacterSet.urlQueryAllowed.subtracting(CharacterSet(charactersIn: "&=+?#"))

    /// The link `url` names, or nil when it is not a Lift link or names nothing Lift knows.
    init?(url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
            components.scheme?.lowercased() == Self.scheme
        else { return nil }
        let host = components.host?.lowercased() ?? ""
        let path = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")).lowercased()
        guard host == "import" || (host.isEmpty && path == "import") else { return nil }
        let text = components.queryItems?.first { $0.name == "text" }?.value
        self = .importNote(text: text?.isEmpty == false ? text : nil)
    }

    /// The link as a URL.
    var url: URL? {
        var components = URLComponents()
        components.scheme = Self.scheme
        switch self {
        case .importNote(let text):
            components.host = "import"
            components.percentEncodedQueryItems = text.map { text in
                let value = text.addingPercentEncoding(withAllowedCharacters: Self.valueCharacters)
                return [URLQueryItem(name: "text", value: value)]
            }
        }
        return components.url
    }
}
