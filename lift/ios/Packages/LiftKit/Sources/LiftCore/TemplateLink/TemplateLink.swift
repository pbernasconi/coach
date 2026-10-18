import Foundation

/// Reads the `d` value of a `lift://templates?d=<payload>` link: base64url (padding optional) of UTF-8 JSON in the
/// shape of `TemplateLinkPayload`. Pure and size-capped, so a link from anywhere can be read safely before anything
/// is shown or written.
public enum TemplateLink {
    /// The only format version.
    public static let version = 1
    /// The most JSON bytes read (12 KB: about twenty full templates).
    public static let maximumJSONBytes = 12_288
    /// The longest `d` value read, in characters: a little over the base64 of `maximumJSONBytes`, so a link just
    /// past the JSON cap is still reported as too large rather than as unreadable.
    public static let maximumEncodedLength = 16_500

    /// The templates `encoded` holds, checked against `TemplateLinkLimits`.
    public static func decode(_ encoded: String) throws(TemplateLinkError) -> [LinkedTemplate] {
        let data = try bytes(of: encoded)
        let payload = try payload(from: data)
        return try TemplateLinkLimits.validate(payload)
    }

    /// The `d` value for `payload`: compact JSON, base64url without padding.
    public static func encode(_ payload: TemplateLinkPayload) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        let base64 = try encoder.encode(payload).base64EncodedString()
        return
            base64
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func bytes(of encoded: String) throws(TemplateLinkError) -> Data {
        let trimmed = encoded.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw .notBase64 }
        guard trimmed.count <= maximumEncodedLength else { throw .tooLarge }
        let alphabet = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=")
        guard trimmed.unicodeScalars.allSatisfy(alphabet.contains) else { throw .notBase64 }
        let unpadded = trimmed.prefix { $0 != "=" }
        guard trimmed.dropFirst(unpadded.count).allSatisfy({ $0 == "=" }) else { throw .notBase64 }
        var base64 =
            String(unpadded)
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        guard base64.count % 4 != 1 else { throw .notBase64 }
        base64 += String(repeating: "=", count: (4 - base64.count % 4) % 4)
        guard let data = Data(base64Encoded: base64) else { throw .notBase64 }
        guard data.count <= maximumJSONBytes else { throw .tooLarge }
        return data
    }

    static func payload(from data: Data) throws(TemplateLinkError) -> TemplateLinkPayload {
        let decoder = JSONDecoder()
        let probe: VersionProbe
        do {
            probe = try decoder.decode(VersionProbe.self, from: data)
        } catch {
            throw .notJSON
        }
        guard let version = probe.version else { throw .invalid(field: "v") }
        guard version == Self.version else { throw .unsupportedVersion(version) }
        do {
            return try decoder.decode(TemplateLinkPayload.self, from: data)
        } catch let DecodingError.keyNotFound(key, context) {
            throw .invalid(field: path(context.codingPath + [key]))
        } catch let DecodingError.typeMismatch(_, context), let DecodingError.valueNotFound(_, context) {
            throw .invalid(field: path(context.codingPath))
        } catch {
            throw .notJSON
        }
    }

    /// "templates[0].exercises[2].sets" for a decoding path.
    static func path(_ keys: [any CodingKey]) -> String {
        keys.reduce(into: "") { text, key in
            if let index = key.intValue {
                text += "[\(index)]"
            } else {
                text += text.isEmpty ? key.stringValue : ".\(key.stringValue)"
            }
        }
    }

    /// Reads `v` alone, so an unknown version is reported as such rather than as a shape error.
    private struct VersionProbe: Decodable {
        var version: Int?

        enum CodingKeys: String, CodingKey {
            case version = "v"
        }
    }
}
