import Foundation
import LiftCore

/// Made-up template links for store and ViewModel tests (TEST-8): no real person's workouts.
public enum TemplateLinkSamples {
    /// Two fabricated templates: "Test day A" in pounds (Back squat with a note, Romanian deadlift) and "Test day B"
    /// in kilograms (a per-hand "Sample carry" the library does not know, and Plank).
    public static let json = """
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
    public static var encoded: String { base64url(json) }

    /// The templates `json` holds.
    public static var templates: [LinkedTemplate] { (try? TemplateLink.decode(encoded)) ?? [] }

    /// `text`'s UTF-8 bytes as base64url without padding.
    public static func base64url(_ text: String) -> String {
        Data(text.utf8).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
