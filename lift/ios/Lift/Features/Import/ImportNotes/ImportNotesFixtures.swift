#if DEBUG
    import Foundation
    import LiftCore

    /// Named states for previews and snapshots. Fake data only: the made-up `ImportSample` note (TEST-8).
    extension ImportNotesState {
        private static let calendar: Calendar = {
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
            calendar.locale = Locale(identifier: "en_GB")
            return calendar
        }()

        /// 2026-10-15T12:00:00Z, a made-up "now" after the sample's dates.
        private static let reference = Date(timeIntervalSince1970: 1_792_065_600)

        /// The sample note, read, with Workout B already in the database.
        static let sampleReview: ImportReview = {
            let result = NotesImporter.parse(
                ImportSample.note,
                reference: reference,
                calendar: calendar,
                makeID: ImportReviewBuilder.localIDs()
            )
            let existing = result.sessions.suffix(1).map {
                ImportReviewBuilder.SessionKey(day: $0.date, title: $0.title)
            }
            return ImportReviewBuilder.review(of: result, existing: existing, days: DayCalendar(calendar: calendar))
        }()

        static let fixtureEmpty = ImportNotesState()
        static let fixtureFilled = ImportNotesState(text: ImportSample.note)
        static let fixtureReading = ImportNotesState(text: ImportSample.note, step: .paste(.reading))
        static let fixtureNothingParsed = ImportNotesState(
            text: "Squats felt good today",
            step: .paste(.failed(.nothingParsed))
        )
        static let fixtureReview = ImportNotesState(text: ImportSample.note, step: .review(sampleReview))
        static let fixtureImporting = ImportNotesState(
            text: ImportSample.note,
            step: .importing(
                ImportProgress(tally: ImportTally(sessions: 1, sets: 7, loggedSets: 6), sessionTotal: 2, setTotal: 11)
            )
        )
        static let fixtureFinished = ImportNotesState(
            step: .outcome(
                ImportOutcome(
                    ending: .finished,
                    tally: ImportTally(sessions: 2, sets: 11, loggedSets: 10, newExercises: 1),
                    sessionTotal: 2
                )
            )
        )
        static let fixturePartialFailure = ImportNotesState(
            step: .outcome(
                ImportOutcome(
                    ending: .failed(.unknown),
                    tally: ImportTally(
                        sessions: 1,
                        sets: 9,
                        loggedSets: 8,
                        newExercises: 1,
                        incompleteSession: "Workout B"
                    ),
                    sessionTotal: 2
                )
            )
        )
        static let fixtureLongText = ImportNotesState(
            text: ImportSample.note,
            step: .review(
                ImportReview(
                    days: sampleReview.days.map { day in
                        var day = day
                        day.sessions = day.sessions.map { candidate in
                            var candidate = candidate
                            candidate.session.title = "Upper body strength with extra accessory work"
                            return candidate
                        }
                        return day
                    },
                    issues: sampleReview.issues
                )
            )
        )
    }
#endif
