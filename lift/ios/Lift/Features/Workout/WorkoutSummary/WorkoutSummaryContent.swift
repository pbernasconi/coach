import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// Dumb view: the workout's day, its numbers as tiles, the records it beat, and Done (SCR-2). Numbers only.
struct WorkoutSummaryContent: View {
    let state: WorkoutSummaryState
    let send: (WorkoutSummaryAction) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.section) {
                switch state.summary {
                case .loading:
                    LoadingState()
                case .empty:
                    EmptyState(
                        symbol: "figure.strengthtraining.traditional",
                        title: "Workout not found",
                        message: "It may have been removed or moved."
                    )
                case .failed:
                    ErrorState(title: "The summary could not be loaded")
                case .loaded(let summary):
                    SummaryNumbers(summary: summary)
                    SummaryFeedbackRow(feedback: state.feedback, save: state.feedbackSave, send: send)
                    SummaryHealthRow(health: state.health, send: send)
                    SummaryBests(bests: summary.bests)
                }
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .navigationTitle(Text(verbatim: title))
        .navigationBarTitleDisplayMode(.inline)
        .pinnedFooter(isPresented: true) {
            Button("Done") { send(.doneTapped) }
                .buttonStyle(.kobo(.primary, width: .full))
        }
        .sheet(isPresented: .action(state.checkIn != nil) { if !$0 { send(.checkIn(.skipTapped)) } }) {
            if let checkIn = state.checkIn {
                WorkoutCheckInSheet(checkIn: checkIn) { send(.checkIn($0)) }
            }
        }
    }

    private var title: String {
        guard case .loaded(let summary) = state.summary else { return String(localized: "Summary") }
        return summary.title
    }
}

/// The day, then duration (when known) and sets as tiles: in one row while they fit, stacked at large text
/// sizes.
private struct SummaryNumbers: View {
    @Environment(\.koboTheme) private var theme
    let summary: WorkoutSummaryOverview

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            Text(verbatim: summary.dayTitle)
                .font(theme.font(.subheadline).weight(.semibold))
                .foregroundStyle(theme.palette.accentText)
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: Space.sm) { tiles }
                VStack(alignment: .leading, spacing: Space.sm) { tiles }
            }
        }
    }

    @ViewBuilder private var tiles: some View {
        if let duration = summary.duration {
            StatTile(label: "Duration", value: duration)
        }
        StatTile(label: "Sets logged", value: summary.sets)
    }
}

/// The records the workout beat, or "None".
private struct SummaryBests: View {
    let bests: [WorkoutBestItem]

    var body: some View {
        ListSection("New bests") {
            if bests.isEmpty {
                ListRow("None")
                    .listRowEmphasis(.quiet)
            }
            ForEach(bests) { best in
                ListRow(verbatim: best.exercise, subtitle: best.detail, value: best.value) {
                    Thumbnail(systemName: "arrow.up.right", tone: .accent, side: ExerciseThumbnail.compactSide)
                }
            }
        }
        .listRowDensity(.compact)
    }
}

/// "How it felt": the face and effort the check-in logged, with where the save stands; "Add how it felt" when
/// nothing is logged yet. A tap opens the check-in again.
private struct SummaryFeedbackRow: View {
    @Environment(\.koboTheme) private var theme
    let feedback: WorkoutFeedback?
    let save: WorkoutFeedbackSaveState
    let send: (WorkoutSummaryAction) -> Void

    var body: some View {
        ListSection {
            if let feedback, feedback.feel != nil || feedback.rpe != nil {
                ListRow("How it felt", subtitle: subtitle, value: value(feedback), action: { send(save == .failed ? .feedbackRetryTapped : .feedbackTapped) }) {
                    Thumbnail(systemName: "face.smiling", tone: .accent, side: ExerciseThumbnail.compactSide)
                }
            } else {
                ListRow("Add how it felt", action: { send(.feedbackTapped) }) {
                    Thumbnail(systemName: "face.smiling", tone: .accent, side: ExerciseThumbnail.compactSide)
                }
            }
        }
        .listRowDensity(.compact)
    }

    /// "😄 Very strong · Effort 7".
    private func value(_ feedback: WorkoutFeedback) -> String {
        var parts: [String] = []
        if let feel = feedback.feel, let label = feedback.feelLabel, SummaryFaces.faces.indices.contains(feel - 1) {
            parts.append("\(SummaryFaces.faces[feel - 1]) \(label)")
        }
        if let rpe = feedback.rpe { parts.append(String(localized: "Effort \(rpe)")) }
        return parts.joined(separator: " · ")
    }

    private var subtitle: LocalizedStringKey? {
        switch save {
        case .idle, .saved: nil
        case .saving: "Saving…"
        case .failed: "Not saved · Tap to try again"
        }
    }
}

/// The five faces, as the check-in and the "How did it feel" card show them.
nonisolated enum SummaryFaces {
    static let faces = ["😣", "😕", "😐", "🙂", "😄"]
}

/// The first finish asks before the system sheet does (PLAT-5); afterwards a saved workout says so.
private struct SummaryHealthRow: View {
    let health: SummaryHealth?
    let send: (WorkoutSummaryAction) -> Void

    var body: some View {
        switch health {
        case .ask:
            NoticeBanner(
                tone: .accent,
                symbol: "heart",
                title: "Save workouts to Apple Health?",
                message: "Each finished workout is saved as strength training, with its start, end and title.",
                action: .init("Save to Apple Health") { send(.healthAllowTapped) },
                onDismiss: { send(.healthNotNowTapped) }
            )
        case .saved:
            ListSection {
                ListRow("Apple Health", value: String(localized: "Saved")) {
                    Thumbnail(systemName: "heart", tone: .accent, side: ExerciseThumbnail.compactSide)
                }
            }
            .listRowDensity(.compact)
        case nil:
            EmptyView()
        }
    }
}
