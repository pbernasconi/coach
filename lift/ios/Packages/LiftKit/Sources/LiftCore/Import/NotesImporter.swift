import Foundation

/// Imports workouts pasted from Apple Notes. Never throws and never drops text silently: every line becomes
/// data, part of a session or exercise note, or an `ImportIssue`.
public enum NotesImporter {
    /// Parses `text` into sessions.
    /// - Parameters:
    ///   - reference: "now" for the import: a title without a year resolves to the latest such date on or
    ///     before it, sets left unchecked before its day count as skipped, and it stamps `createdAt`.
    ///   - calendar: the calendar dates are read in.
    ///   - library: exercises to match names against.
    ///   - makeID: id source, called in reading order; pass a deterministic one in tests.
    public static func parse(
        _ text: String,
        reference: Date,
        calendar: Calendar,
        library: [Exercise] = ExerciseLibrary.seed,
        makeID: @escaping () -> UUID = UUID.init
    ) -> NotesImport {
        var context = ImportContext(reference: reference, calendar: calendar)
        let lines = text.split(omittingEmptySubsequences: false, whereSeparator: \.isNewline)
        for (offset, raw) in lines.enumerated() {
            let line = LineCleaner.clean(raw)
            context.handle(NoteLine.classify(line), number: offset + 1, text: line)
        }
        let assembler = SessionAssembler(library: library, reference: reference, makeID: makeID)
        var issues = context.issues
        let sessions = context.sessions.map { assembler.session(from: $0, issues: &issues) }
        return NotesImport(sessions: sessions, issues: issues.sorted { $0.line < $1.line })
    }
}
