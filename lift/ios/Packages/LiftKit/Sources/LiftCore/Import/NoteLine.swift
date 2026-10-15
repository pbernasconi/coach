import Foundation

/// One cleaned line of a note, classified by shape only (no context).
enum NoteLine: Equatable {
    case blank
    /// Dashes or em-dashes only (`—`, `—-`, `---`). Not a session boundary by itself.
    case separator
    case title(SessionTitle)
    /// `Warmup`, optionally with inline text (`Warmup: 10 min bike`).
    case warmUpHeading(inline: String?)
    case supersetHeading
    /// `- [x] …` (done) or `- [ ] …`.
    case checklist(done: Bool, content: String)
    case text(String)

    static func classify(_ line: String) -> NoteLine {
        if line.isEmpty { return .blank }
        if isSeparator(line) { return .separator }
        if let checklist = checklist(line) { return checklist }
        if let title = SessionTitle.parse(line) { return .title(title) }
        if let match = line.wholeMatch(of: /warm[\s-]?ups?\s*(?:[:\-–—]\s*(?<inline>.*))?/.ignoresCase()) {
            let inline = match.output.inline.map(String.init) ?? ""
            return .warmUpHeading(inline: inline.isEmpty ? nil : inline)
        }
        if line.wholeMatch(of: /super\s*-?\s*sets?\s*\d*\s*:?/.ignoresCase()) != nil { return .supersetHeading }
        return .text(line)
    }

    private static func isSeparator(_ line: String) -> Bool {
        line.allSatisfy { "-—–_=~".contains($0) }
    }

    private static func checklist(_ line: String) -> NoteLine? {
        guard let match = line.wholeMatch(of: /(?:[-*•]\s*)?\[(?<mark>[ xX✓✔]?)\]\s*(?<content>.*)/) else {
            return nil
        }
        let done = !match.output.mark.trimmingCharacters(in: .whitespaces).isEmpty
        return .checklist(done: done, content: String(match.output.content).trimmingCharacters(in: .whitespaces))
    }
}
