import Foundation
import KoboPatterns
import LiftSync

/// What a screen shows of one App API path: its content, and how fresh it is.
nonisolated struct AppResourceState<Value: Equatable & Sendable>: Equatable, Sendable {
    /// `.empty` means not connected to the coach (sync off, no token, or a token the coach refused); `.failed` a fetch
    /// failed with nothing kept.
    var content: KoboPatterns.Loadable<Value> = .loading
    var freshness: AppFreshness?
    /// The coach refused the stored token (401): the not-connected state asks to connect again.
    var needsReconnect = false

    /// Not connected to the coach: the screen shows `AppNotConnectedView`.
    var isNotConnected: Bool { content == .empty }
}

/// "Updated 1:05 PM", or "Offline · updated 1:05 PM" while the shown body is a kept one.
nonisolated struct AppFreshness: Equatable, Sendable {
    let text: String
    let isOffline: Bool
}

/// Loads one App API path for a ViewModel: the kept body at once, then a fetch, then the fresh body or an offline
/// line over the kept one. It decodes what the server sent and nothing else.
@MainActor
struct AppResource<Value: Decodable & Equatable & Sendable> {
    let path: String
    let source: any AppDataSource
    let now: @Sendable () -> Date
    let days: DayCalendar

    /// Runs one load and reports each step to `update`. `current` is what the screen shows now, kept on failure.
    func load(current: AppResourceState<Value>, _ update: (AppResourceState<Value>) -> Void) async {
        guard source.isConnected else {
            update(AppResourceState(content: .empty))
            return
        }
        var shown = current
        if shown.content.value == nil, let kept = await source.kept(path), let value = await Self.decode(kept.data) {
            shown = AppResourceState(content: .loaded(value), freshness: freshness(kept.fetchedAt, offline: false))
            update(shown)
        }
        do {
            let fetched = try await source.fetch(path)
            guard let value = await Self.decode(fetched.data) else { throw SyncTransportError.invalidResponse }
            await source.keep(fetched, for: path)
            update(AppResourceState(content: .loaded(value), freshness: freshness(fetched.fetchedAt, offline: false)))
        } catch is CancellationError {
            return
        } catch SyncTransportError.missingToken {
            update(AppResourceState(content: .empty))
        } catch SyncTransportError.unauthorized {
            update(AppResourceState(content: .empty, needsReconnect: true))
        } catch {
            AppLog.sync.error(
                "App API \(path, privacy: .public) failed: \(String(describing: error), privacy: .public)"
            )
            update(failed(shown, error))
        }
    }

    /// Decodes off the main actor: a Today body is about 20 KB, a Lift overview about 66 KB.
    @concurrent
    nonisolated static func decode(_ data: Data) async -> Value? {
        do {
            return try JSONDecoder().decode(Value.self, from: data)
        } catch {
            AppLog.sync.error("App API body not read as \(Value.self): \(String(describing: error), privacy: .public)")
            return nil
        }
    }

    /// The kept content with an offline line, or a failure message when nothing is kept.
    private func failed(_ shown: AppResourceState<Value>, _ error: any Error) -> AppResourceState<Value> {
        guard shown.content.value != nil else {
            return AppResourceState(content: .failed(message: Self.message(for: error)))
        }
        let since = shown.freshness?.text
        return AppResourceState(
            content: shown.content,
            freshness: AppFreshness(
                text: since.map { String(localized: "Offline · \($0.lowercasedFirst)") }
                    ?? String(localized: "Offline"),
                isOffline: true
            )
        )
    }

    private func freshness(_ date: Date, offline: Bool) -> AppFreshness {
        let day = days.day(of: date)
        let when = day == days.day(of: now()) ? days.timeTitle(of: date) : days.shortTitle(of: day)
        return AppFreshness(text: String(localized: "Updated \(when)"), isOffline: offline)
    }

    /// Plain words for a failed fetch (ERR-1).
    nonisolated static func message(for error: any Error) -> String {
        switch error as? SyncTransportError {
        case .unauthorized: String(localized: "Coach refused the sync token. Connect again in Settings.")
        case .rejected(404): String(localized: "Coach has nothing here.")
        case .invalidResponse: String(localized: "Coach sent something this app cannot read.")
        default: String(localized: "Coach could not be reached. Pull down to try again.")
        }
    }
}

extension String {
    /// "Updated 1:05 PM" → "updated 1:05 PM".
    fileprivate var lowercasedFirst: String {
        prefix(1).lowercased() + dropFirst()
    }
}
