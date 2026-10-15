import Foundation
import UIKit
import UniformTypeIdentifiers

/// Reads a shared note's text from the share sheet's items: plain text first, then formatted text (RTF, RTFD or HTML,
/// which Apple Notes may send for a note with styling), then the item's own attributed text. Nil when none holds any
/// text.
enum SharedNoteReader {
    private static let richTypes: [(UTType, NSAttributedString.DocumentType)] = [
        (.rtf, .rtf),
        (.flatRTFD, .rtfd),
        (.html, .html),
    ]

    static func text(from items: [Any]) async -> String? {
        for item in items.compactMap({ $0 as? NSExtensionItem }) {
            for provider in item.attachments ?? [] {
                if let text = await text(from: provider) { return text }
            }
            if let text = usable(item.attributedContentText?.string) { return text }
        }
        return nil
    }

    private static func text(from provider: NSItemProvider) async -> String? {
        if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
            let text = usable(await plainText(provider))
        {
            return text
        }
        for (type, documentType) in richTypes where provider.hasItemConformingToTypeIdentifier(type.identifier) {
            guard let data = await data(provider, type) else { continue }
            let options: [NSAttributedString.DocumentReadingOptionKey: Any] = [.documentType: documentType]
            let string = try? NSAttributedString(data: data, options: options, documentAttributes: nil).string
            if let text = usable(string) { return text }
        }
        return nil
    }

    /// The completion handlers run on a background queue, so they are `@Sendable` and only resume.
    private static func plainText(_ provider: NSItemProvider) async -> String? {
        await withCheckedContinuation { continuation in
            _ = provider.loadObject(ofClass: String.self) { @Sendable text, _ in
                continuation.resume(returning: text)
            }
        }
    }

    private static func data(_ provider: NSItemProvider, _ type: UTType) async -> Data? {
        await withCheckedContinuation { continuation in
            _ = provider.loadDataRepresentation(forTypeIdentifier: type.identifier) { @Sendable data, _ in
                continuation.resume(returning: data)
            }
        }
    }

    /// `text` with Notes' object-replacement characters removed, or nil when only white space is left.
    private static func usable(_ text: String?) -> String? {
        guard let text else { return nil }
        let cleaned = text.replacingOccurrences(of: "\u{FFFC}", with: "")
        return cleaned.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : cleaned
    }
}
