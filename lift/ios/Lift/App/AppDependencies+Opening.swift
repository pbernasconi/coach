import Foundation
import LiftCore
import LiftStore

/// The ids the screenshot launch options need (`-open workout|template|summary`), read from the demo data.
extension AppDependencies {
    /// The route `options.opening` pushes, or nil.
    func openingRoute(for options: LaunchOptions) async -> AppRoute? {
        guard let opening = options.opening else { return nil }
        switch opening {
        case .workout: return options.initialRoute(upcomingSessionID: await upcomingSessionID())
        case .template: return options.initialRoute(upcomingSessionID: nil, templateID: await firstTemplateID())
        case .summary:
            return options.initialRoute(upcomingSessionID: nil, loggedSessionID: await latestLoggedSessionID())
        default: return options.initialRoute(upcomingSessionID: nil)
        }
    }

    private func firstTemplateID() async -> UUID? {
        for await list in templates.observeTemplates() {
            return list.first?.id
        }
        return nil
    }

    /// The latest session in the past two weeks with a logged set.
    private func latestLoggedSessionID() async -> UUID? {
        let today = LocalDay(now(), calendar: calendar)
        for await details in sessions.observeSessions(from: today.adding(days: -14), through: today) {
            return details.last { detail in detail.items.contains { $0.sets.contains { $0.status == .done } } }?.id
        }
        return nil
    }
}
