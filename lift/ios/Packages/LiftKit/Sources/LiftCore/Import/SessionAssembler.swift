import Foundation

/// Turns drafts into model values: matches names to the library, resolves units and load modes, and
/// assigns ids in reading order (session, then each exercise followed by its sets).
struct SessionAssembler {
    let library: [Exercise]
    let reference: Date
    let makeID: () -> UUID

    func session(from draft: SessionDraft, issues: inout [ImportIssue]) -> Session {
        let id = makeID()
        var exercises: [SessionExercise] = []
        var notes = draft.notes
        for item in draft.exercises {
            guard !item.sets.isEmpty else {
                if SessionNoteHeuristic.isSessionNote(item, library: library) {
                    notes += SessionNoteHeuristic.notes(of: item)
                } else {
                    issues.append(ImportIssue(line: item.line, kind: .headerWithoutSets, text: item.text))
                }
                continue
            }
            exercises.append(exercise(from: item, isPast: draft.isPast))
        }
        // Stable, so notes read on one line keep their order.
        let sessionNotes = notes.enumerated().sorted { ($0.element.line, $0.offset) < ($1.element.line, $1.offset) }
        return Session(
            id: id,
            date: draft.day,
            title: draft.title,
            exercises: exercises,
            warmUpNote: Self.joined(draft.warmUpLines),
            note: Self.joined(sessionNotes.map(\.element.text)),
            unitsAtLog: Self.dominantUnit(exercises),
            createdAt: reference,
            updatedAt: reference
        )
    }

    private func exercise(from draft: ExerciseDraft, isPast: Bool) -> SessionExercise {
        let match = ExerciseMatcher.match(name: draft.header.name, in: library)
        let id = makeID()
        let sets = draft.sets.map { loggedSet($0, header: draft.header, isPast: isPast) }
        let mode = LoadModeInference.loadMode(for: draft, libraryMode: match?.exercise.loadMode)
        let equipment =
            draft.header.equipment ?? match?.exercise.equipment ?? EquipmentWord.infer(fromName: draft.header.name)
        return SessionExercise(
            id: id,
            exerciseID: match?.exercise.id,
            displayName: draft.header.name,
            loadMode: mode,
            equipment: equipment ?? (mode == .perHand ? .dumbbell : nil),
            sets: sets,
            restSeconds: draft.restSeconds,
            note: Self.joined(draft.notes),
            supersetGroup: draft.supersetGroup,
            nextTimeHint: draft.nextTimeHint
        )
    }

    private func loggedSet(_ draft: SetDraft, header: ExerciseHeader, isPast: Bool) -> LoggedSet {
        let parsed = draft.parsed
        let lineWeight = parsed.weightValue.map { Weight($0, parsed.unit ?? header.unit ?? .lb) }
        let weight = lineWeight ?? header.weight
        let skipped = NoteHintParser.isSkip(parsed.note)
        var set = LoggedSet(id: makeID(), kind: NoteHintParser.setKind(for: parsed.note), note: parsed.note)
        if draft.done, !skipped {
            set.target = header.target
            set.actual = SetActual(reps: parsed.reps, weight: weight)
        } else {
            set.target = SetTarget(reps: parsed.reps ?? header.reps, repRange: header.repRange, weight: weight)
            set.isSkipped = skipped || isPast
        }
        return set
    }

    private static func joined(_ lines: [String]) -> String? {
        lines.isEmpty ? nil : lines.joined(separator: "\n")
    }

    /// kg when more weights were written in kg than in lb; lb otherwise (the default unit).
    private static func dominantUnit(_ exercises: [SessionExercise]) -> WeightUnit {
        let units = exercises.flatMap(\.sets).compactMap { $0.actual?.weight?.unit ?? $0.target.weight?.unit }
        let kg = units.filter { $0 == .kg }.count
        return kg > units.count - kg ? .kg : .lb
    }
}
