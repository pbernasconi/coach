import Foundation

/// The links that open Lift (its URL scheme, `lift`, is in `project.yml`):
///
///     lift://import             Import from Notes with the note the Share extension left in the inbox
///     lift://import?text=…      Import from Notes with this text (for Shortcuts and short notes)
///     lift://templates?d=…      Review and add the templates in `d` (base64url JSON; lift/TEMPLATE-LINKS.md)
///     lift://sync?token=…       Store this sync token and sync now (the coach web app's Settings makes the link)
///
/// Compiled into the app, which routes them (`IncomingNoteRouter`), and LiftShare, which builds them.
nonisolated enum AppLink: Equatable, Sendable {
    /// Open Import from Notes with `text`, or with the inbox's note when nil.
    case importNote(text: String?)
    /// Open the template link review with the link's `d` value as written (empty when it has none; the review says
    /// the link cannot be read).
    case templates(payload: String)
    /// Store `token` as the sync token and sync now. A link with no token names nothing.
    case syncToken(String)

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
        let name = host.isEmpty ? path : host
        let items = components.queryItems ?? []
        switch name {
        case "import":
            let text = items.first { $0.name == "text" }?.value
            self = .importNote(text: text?.isEmpty == false ? text : nil)
        case "templates":
            self = .templates(payload: items.first { $0.name == "d" }?.value ?? "")
        case "sync":
            let token = items.first { $0.name == "token" }?.value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !token.isEmpty else { return nil }
            self = .syncToken(token)
        default:
            return nil
        }
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
        case .templates(let payload):
            components.host = "templates"
            let value = payload.addingPercentEncoding(withAllowedCharacters: Self.valueCharacters)
            components.percentEncodedQueryItems = [URLQueryItem(name: "d", value: value)]
        case .syncToken(let token):
            components.host = "sync"
            let value = token.addingPercentEncoding(withAllowedCharacters: Self.valueCharacters)
            components.percentEncodedQueryItems = [URLQueryItem(name: "token", value: value)]
        }
        return components.url
    }
}
