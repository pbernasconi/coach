#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct WorkoutSummaryPreview: View {
        let state: WorkoutSummaryState

        var body: some View {
            NavigationStack {
                WorkoutSummaryContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { WorkoutSummaryPreview(state: .fixtureDefault) }
    #Preview("Dark") { WorkoutSummaryPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("Health prompt") { WorkoutSummaryPreview(state: .fixtureHealthPrompt) }
    #Preview("Health prompt, AX3") {
        WorkoutSummaryPreview(state: .fixtureHealthPrompt)
            .dynamicTypeSize(.accessibility3)
    }
    #Preview("Loading") { WorkoutSummaryPreview(state: .fixtureLoading) }
    #Preview("Empty") { WorkoutSummaryPreview(state: .fixtureEmpty) }
    #Preview("Failed") { WorkoutSummaryPreview(state: .fixtureFailed) }
    #Preview("No bests") { WorkoutSummaryPreview(state: .fixtureNoBests) }
    #Preview("Long text, AX3") {
        WorkoutSummaryPreview(state: .fixtureLongText)
            .dynamicTypeSize(.accessibility3)
    }
#endif

#if DEBUG
    import LiftSync

    private struct WorkoutCheckInPreview: View {
        @State var checkIn: WorkoutCheckIn

        var body: some View {
            WorkoutCheckInSheet(checkIn: checkIn) { action in
                switch action {
                case .effortChanged(let value): checkIn.feedback.rpe = value
                case .feelTapped(let value): checkIn.feedback = checkIn.feedback.applying(.feel(value))
                case .nextTapped: checkIn.step = .feel
                case .backTapped: checkIn.step = .effort
                case .saveTapped, .skipTapped: break
                }
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Check-in") {
        WorkoutCheckInPreview(checkIn: WorkoutCheckIn(feedback: .blank(item: "lift:preview", date: "2026-03-02", title: "Lower A")))
    }
#endif
