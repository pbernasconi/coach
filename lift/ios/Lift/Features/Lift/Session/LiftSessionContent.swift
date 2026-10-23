import KoboComponents
import KoboPatterns
import KoboTokens
import LiftCore
import SwiftUI

/// Dumb view: one page for a session, as the activity page: the title, the headline numbers, "How did it feel", one
/// row per exercise (each opens its page), then the watch's heart rate. The title fades into the bar on scroll; the
/// bar's menu steps to the older or newer session (SCR-2). Pull to refresh is on the Screen. A finished session shows
/// the muscles it worked on a body map behind the page.
struct LiftSessionContent: View {
    let state: LiftSessionState
    let send: (LiftSessionAction) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// A finished session leads with its body map, as a run leads with its route (`LiftSessionBodyPage`).
    private var bodyMap: (detail: LiftSessionDetail, shades: [BodyRegion: BodyShade])? {
        guard let detail = state.detail.content.value, let shades = detail.bodyShades else { return nil }
        return (detail, shades)
    }

    var body: some View {
        Group {
            if let bodyMap {
                LiftSessionBodyPage(shades: bodyMap.shades, detail: bodyMap.detail, state: state, send: send)
                    .transition(Motion.crossFade(reduceMotion: reduceMotion))
            } else {
                scrollPage
                    .transition(Motion.crossFade(reduceMotion: reduceMotion))
            }
        }
        .koboAnimation(.crossfade, value: bodyMap != nil)
        .workoutNeighbours(
            older: String(localized: "Older session"),
            newer: String(localized: "Newer session"),
            canGoOlder: state.detail.content.value?.olderId != nil,
            canGoNewer: state.detail.content.value?.newerId != nil,
            onOlder: { send(.olderTapped) },
            onNewer: { send(.newerTapped) }
        )
        .navigationDestination(item: .action(state.page) { if $0 == nil { send(.pageClosed) } }) { page in
            switch page {
            case .exercise(let id):
                LiftSessionExercisePage(state: state, exerciseID: id, send: send)
            }
        }
        .workoutFeedbackComment(state.feedback, comment: state.shownFeedback?.comment) { send(.feedback($0)) }
    }

    /// Loading, a session not yet done, or one with no drawn muscle: the page scrolls under the bar.
    private var scrollPage: some View {
        ScrollView {
            AppResourcePage(
                state.detail,
                onRetry: { send(.retryTapped) },
                onConnect: { send(.connectTapped) }
            ) { detail in
                LiftSessionSections(detail: detail, state: state, send: send)
            } placeholder: {
                LiftSessionSkeleton()
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .workoutBarTitle(state.detail.content.value?.hero.value?.title)
    }
}

/// The loaded session, top to bottom. Each part fails alone; "How did it feel" shows once the session is done.
struct LiftSessionSections: View {
    let detail: LiftSessionDetail
    let state: LiftSessionState
    let send: (LiftSessionAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            AppSectionView(nil, section: detail.hero) { hero in
                LiftSessionSummary(hero: hero)
            }
            if detail.hero.value?.state == "done", let feedback = state.shownFeedback {
                WorkoutFeedbackCard(feedback: feedback, save: state.feedback.save) { send(.feedback($0)) }
            }
            AppSectionView("Exercises", section: detail.exercises) { exercises in
                if exercises.items.isEmpty {
                    SectionEmptyCard(verbatim: exercises.emptyText, systemImage: "dumbbell")
                } else {
                    LiftSessionExerciseRows(exercises: exercises.items, media: state.media, send: send)
                }
            }
            if let watch = detail.watch {
                AppSectionView("Heart rate", section: watch) { watch in
                    LiftSessionWatchCard(watch: watch) { send(.watchTapped) }
                }
            }
        }
    }
}
