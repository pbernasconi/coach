import Foundation

/// Walks the classified lines, opening sessions at title lines and recording issues.
struct ImportContext {
    let reference: Date
    let calendar: Calendar
    private(set) var sessions: [SessionDraft] = []
    private(set) var issues: [ImportIssue] = []

    init(reference: Date, calendar: Calendar) {
        self.reference = reference
        self.calendar = calendar
    }

    mutating func handle(_ line: NoteLine, number: Int, text: String) {
        switch line {
        case .blank:
            return
        case .title(let title):
            startSession(title, number: number, text: text)
        default:
            guard var session = sessions.popLast() else {
                issues.append(ImportIssue(line: number, kind: .outsideSession, text: text))
                return
            }
            if let kind = Self.apply(line, to: &session, number: number) {
                issues.append(ImportIssue(line: number, kind: kind, text: text))
            }
            sessions.append(session)
        }
    }

    private static func apply(_ line: NoteLine, to session: inout SessionDraft, number: Int) -> ImportIssue.Kind? {
        switch line {
        case .separator: session.closeBlock()
        case .warmUpHeading(let inline): session.beginWarmUp(inline: inline)
        case .supersetHeading: session.beginSuperset()
        case .checklist(let done, let content): return session.checklist(done: done, content: content, line: number)
        case .text(let content): return session.text(content, line: number)
        case .blank, .title: break
        }
        return nil
    }

    private mutating func startSession(_ title: SessionTitle, number: Int, text: String) {
        let today = LocalDay(reference, calendar: calendar)
        let resolved = title.resolve(reference: reference, calendar: calendar)
        if resolved == nil {
            issues.append(ImportIssue(line: number, kind: .invalidDate, text: text))
        }
        let day = resolved ?? today
        sessions.append(SessionDraft(line: number, title: title.title, day: day, isPast: day < today))
    }
}
