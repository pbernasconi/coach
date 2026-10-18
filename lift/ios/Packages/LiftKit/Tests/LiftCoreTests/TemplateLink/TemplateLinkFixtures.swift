import Foundation

@testable import LiftCore

/// Made-up template links (TEST-8): no real person's workouts.
enum TemplateLinkFixtures {
    /// Two fabricated templates in pounds, one exercise of each kind of source.
    static let json = """
        {"v":1,"unit":"lb","templates":[
          {"name":"Test day A","exercises":[
            {"name":"Back squat","sets":3,"reps":8,"repMax":null,"weight":135,"rest":180,"note":"Made-up cue"},
            {"name":"Romanian deadlift","sets":3,"reps":8,"repMax":10,"weight":95}
          ]},
          {"name":"Test day B","unit":"kg","exercises":[
            {"name":"Sample carry","sets":2,"reps":1,"rest":60,"load":"hand","weight":20},
            {"name":"Plank"}
          ]}
        ]}
        """

    /// `json` as a link's `d` value.
    static var encoded: String { base64url(json) }

    /// `text`'s UTF-8 bytes as base64url without padding.
    static func base64url(_ text: String) -> String {
        Data(text.utf8).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    /// A one-template link whose only exercise has the given JSON fields (`"name":"Back squat"` is added).
    static func exercise(_ fields: String, unit: String = "\"kg\"") -> String {
        base64url(#"{"v":1,"unit":\#(unit),"templates":[{"name":"T","exercises":[{"name":"Back squat"\#(fields)}]}]}"#)
    }

    /// The error `decode` throws for `encoded`, or nil when it reads.
    static func error(_ encoded: String) -> TemplateLinkError? {
        do {
            _ = try TemplateLink.decode(encoded)
            return nil
        } catch {
            return error
        }
    }
}
