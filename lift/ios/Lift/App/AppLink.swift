import Foundation

/// The links that open Lift (its URL scheme, `lift`, is in `project.yml`):
///
///     lift://import             Import from Notes with the note the Share extension left in the inbox
///     lift://import?text=…      Import from Notes with this text (for Shortcuts and short notes)
///     lift://templates?d=…      Review and add the templates in `d` (base64url JSON; lift/TEMPLATE-LINKS.md)
///     lift://sync?code=…        Trade this one-time code for the sync token, then sync (Coach Settings → Lift)
///     lift://session/<uuid>     A Lift session as the coach shows it (a workout notice, lift/PUSH.md)
///     lift://activity/<id>      A Strava activity (a workout notice)
///     lift://weigh-in/<day>     A weigh-in, `YYYY-MM-DD` or `latest` (a weigh-in notice)
///     lift://today              The Today tab
///
/// Compiled into the app, which routes them (`IncomingNoteRouter`), and LiftShare, which builds them. A notice's tap
/// opens the same links (`PushTap`), so a screen opens the same way from a notice, Safari or Shortcuts.
nonisolated enum AppLink: Equatable, Sendable {
    /// Open Import from Notes with `text`, or with the inbox's note when nil.
    case importNote(text: String?)
    /// Open the template link review with the link's `d` value as written (empty when it has none; the review says
    /// the link cannot be read).
    case templates(payload: String)
    /// Trade the one-time enrollment `code` for the sync token, then sync. The link never carries the token itself:
    /// any app can claim a custom URL scheme. A link with no code names nothing.
    case syncCode(String)
    /// A Lift session by its lower-case id.
    case session(String)
    /// A Strava activity by its id (digits).
    case activity(String)
    /// The weigh-in of a day (`YYYY-MM-DD`) or the newest one (`latest`).
    case weighIn(String)
    /// The Today tab's root.
    case today

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
        if let screen = Self.screen(name, argument: host.isEmpty ? "" : components.path) {
            self = screen
            return
        }
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

    /// A screen link: its name, and the one path segment after it ("/<id>"), checked so a link never pushes a screen
    /// for an id the coach cannot have.
    private static func screen(_ name: String, argument path: String) -> AppLink? {
        let argument = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        switch name {
        case "session":
            guard let id = UUID(uuidString: argument) else { return nil }
            return .session(id.uuidString.lowercased())
        case "activity":
            guard argument.count <= 20, isDigits(argument) else { return nil }
            return .activity(argument)
        case "weigh-in":
            return isWeighInDay(argument) ? .weighIn(argument) : nil
        case "today":
            return argument.isEmpty ? .today : nil
        default:
            return nil
        }
    }

    /// `latest`, or a day written `YYYY-MM-DD`.
    private static func isWeighInDay(_ text: String) -> Bool {
        if text == "latest" { return true }
        let parts = text.split(separator: "-", omittingEmptySubsequences: false)
        return parts.map(\.count) == [4, 2, 2] && parts.allSatisfy(isDigits)
    }

    /// One or more ASCII digits.
    private static func isDigits(_ text: some StringProtocol) -> Bool {
        !text.isEmpty && text.utf8.allSatisfy { (0x30...0x39).contains($0) }
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
        case .session(let id):
            components.host = "session"
            components.path = "/" + id
        case .activity(let id):
            components.host = "activity"
            components.path = "/" + id
        case .weighIn(let day):
            components.host = "weigh-in"
            components.path = "/" + day
        case .today:
            components.host = "today"
        }
        return components.url
    }
}
