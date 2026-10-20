import Foundation

/// The links that open Lift (its URL scheme, `lift`, is in `project.yml`):
///
///     lift://import             Import from Notes with the note the Share extension left in the inbox
///     lift://import?text=…      Import from Notes with this text (for Shortcuts and short notes)
///     lift://templates?d=…      Review and add the templates in `d` (base64url JSON; lift/TEMPLATE-LINKS.md)
///     lift://sync?code=…        Trade this one-time code for the sync token, then sync (Coach Settings → Lift)
///
/// Compiled into the app, which routes them (`IncomingNoteRouter`), and LiftShare, which builds them.
nonisolated enum AppLink: Equatable, Sendable {
    /// Open Import from Notes with `text`, or with the inbox's note when nil.
    case importNote(text: String?)
    /// Open the template link review with the link's `d` value as written (empty when it has none; the review says
    /// the link cannot be read).
    case templates(payload: String)
    /// Trade the one-time enrollment `code` for the sync token, then sync. The link never carries the token itself:
    /// any app can claim a custom URL scheme. A link with no code names nothing.
    case syncCode(String)

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
            let code = items.first { $0.name == "code" }?.value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !code.isEmpty else { return nil }
            self = .syncCode(code)
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
        case .syncCode(let code):
            components.host = "sync"
            let value = code.addingPercentEncoding(withAllowedCharacters: Self.valueCharacters)
            components.percentEncodedQueryItems = [URLQueryItem(name: "code", value: value)]
        }
        return components.url
    }
}
