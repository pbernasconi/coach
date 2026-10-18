import Foundation
import KoboPatterns
import LiftCore
import LiftStore
import Observation

/// Reads a template link, resolves its exercise names against the library and the bundled catalog, lists what will be
/// added, and adds it in one tap (SCR-3). A link is a deliberate add, so it gets a review sheet; what it wrote can be
/// undone from the shell's toast. Same-named templates are skipped unless the person picks Replace, so a link opened
/// twice never touches a template they edited.
@Observable
final class TemplateLinkViewModel {
    private(set) var state = TemplateLinkState()

    private let request: TemplateLinkRequest
    private let templates: any TemplateRepository
    private let exercises: any ExerciseRepository
    private let catalog: any ExerciseCatalogProviding
    private let flow: any TemplateLinkFlow
    @ObservationIgnored private var plan: TemplateLinkPlan?

    init(
        request: TemplateLinkRequest,
        templates: any TemplateRepository,
        exercises: any ExerciseRepository,
        catalog: any ExerciseCatalogProviding,
        flow: any TemplateLinkFlow
    ) {
        self.request = request
        self.templates = templates
        self.exercises = exercises
        self.catalog = catalog
        self.flow = flow
    }

    /// Reads the link, then the library, the templates and the catalog (an unreadable catalog only means names
    /// resolve to the library or to new exercises).
    func run() async {
        guard case .loading = state.phase else { return }
        let linked: [LinkedTemplate]
        do {
            linked = try TemplateLink.decode(request.payload)
        } catch {
            state.phase = .failed(TemplateLinkProblem(error))
            return
        }
        let library = await Self.first(exercises.observeExercises())
        let existing = await Self.first(templates.observeTemplates())
        let entries = (try? await catalog.catalog().entries) ?? []
        let plan = TemplateLinkPlan.make(linked, library: library, catalog: entries, existing: existing)
        self.plan = plan
        state.phase = .review(TemplateLinkReview(plan: plan))
    }

    @discardableResult
    func send(_ action: TemplateLinkAction) -> Task<Void, Never>? {
        switch action {
        case .replaceToggled(let id):
            toggleReplace(id)
            return nil
        case .addTapped:
            return add()
        case .cancelTapped:
            guard state.submit.phase != .loading else { return nil }
            flow.cancel()
            return nil
        }
    }

    private func toggleReplace(_ id: Int) {
        guard case .review(var review) = state.phase, state.submit.phase != .loading,
            let index = review.templates.firstIndex(where: { $0.id == id }), review.templates[index].exists
        else { return }
        review.templates[index].replaces.toggle()
        state.phase = .review(review)
        state.submit.send(.edit)
    }

    private func add() -> Task<Void, Never>? {
        guard let plan, case .review(let review) = state.phase, review.addCount > 0, state.submit.send(.submit) else {
            return nil
        }
        let replacing = Set(review.templates.filter(\.replaces).map(\.id))
        let writer = TemplateLinkWriter(templates: templates, exercises: exercises)
        return Task {
            do {
                let addition = try await writer.add(plan, replacing: replacing)
                state.submit.send(.succeed)
                flow.finish(addition, count: review.addCount)
            } catch is CancellationError {
                state.submit.send(.cancel)
            } catch {
                AppLog.templates.error("Adding a template link failed: \(String(describing: error), privacy: .private)")
                state.submit.send(.fail(message: String(localized: "The templates could not be added. Try again.")))
            }
        }
    }

    private static func first<Value: Sendable>(_ stream: AsyncStream<[Value]>) async -> [Value] {
        for await value in stream { return value }
        return []
    }
}
