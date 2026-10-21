import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Dumb view: the session's hero, then one card per exercise, with the older and newer sessions in the bar (SCR-2).
/// Pull to refresh is on the Screen.
struct LiftSessionContent: View {
    let state: LiftSessionState
    let send: (LiftSessionAction) -> Void

    var body: some View {
        ScrollView {
            AppResourcePage(state.detail, onRetry: { send(.retryTapped) }) { detail in
                LiftSessionSections(detail: detail, state: state, send: send)
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .navigationTitle(Text(verbatim: title))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let detail = state.detail.content.value {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button("Older session", systemImage: "chevron.left") { send(.olderTapped) }
                        .disabled(detail.olderId == nil)
                    Button("Newer session", systemImage: "chevron.right") { send(.newerTapped) }
                        .disabled(detail.newerId == nil)
                }
            }
        }
    }

    private var title: String {
        state.detail.content.value?.hero.value?.title ?? String(localized: "Session")
    }
}

/// The loaded session: the hero, then the exercises in the session's order. Each part fails alone.
private struct LiftSessionSections: View {
    let detail: LiftSessionDetail
    let state: LiftSessionState
    let send: (LiftSessionAction) -> Void

    var body: some View {
        AppSectionView(nil, section: detail.hero) { hero in
            LiftSessionHeroView(hero: hero)
        }
        AppSectionView("Exercises", section: detail.exercises) { exercises in
            if exercises.items.isEmpty {
                SectionEmptyCard(verbatim: exercises.emptyText, systemImage: "dumbbell")
            } else {
                VStack(alignment: .leading, spacing: Space.lg) {
                    ForEach(exercises.items) { exercise in
                        LiftSessionExerciseCard(
                            exercise: exercise,
                            media: state.media[exercise.id],
                            isStepsExpanded: state.expandedSteps.contains(exercise.id),
                            send: { send($0) }
                        )
                    }
                }
            }
        }
    }
}
