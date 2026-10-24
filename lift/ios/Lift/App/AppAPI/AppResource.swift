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
    /// The coach answered 404: the thing was deleted (a discarded workout). The kept copy is dropped, `content` is
    /// `.failed`, and a screen can say so instead of showing an old copy as "offline".
    var isGone = false
    /// When the shown body came from the coach, so a failed refresh says "updated 12:13" from it, never from the line
    /// it showed before.
    var shownFetchedAt: Date?

    /// Not connected to the coach: the screen shows `AppNotConnectedView`.
    var isNotConnected: Bool { content == .empty }
}

/// "Updated 1:05 PM", or "Offline · updated 1:05 PM" while the shown body is a kept one. The first words say why the
/// fetch failed: "Offline" only for no network; "Coach had a problem" for a server error; "Update the app" for a body
/// this build cannot read.
nonisolated struct AppFreshness: Equatable, Sendable {
    let text: String
    /// The shown body is an old one: the line shows above the page.
    let isOffline: Bool
    /// The line's glyph: "wifi.slash" with no network, else a warning.
    var symbol = "wifi.slash"
}

/// Loads one App API path for a ViewModel: the kept body at once, then a fetch, then the fresh body or an offline
/// line over the kept one. It decodes what the server sent and nothing else.
@MainActor
struct AppResource<Value: Decodable & Equatable & Sendable> {
    let path: String
    let source: any AppDataSource
    let now: @Sendable () -> Date
    let days: DayCalendar
    /// Query items for the fetch ("days=90"); a body with a query is kept under `appCacheKey(path, query)`.
    var query: [URLQueryItem] = []

    /// Runs one load and reports each step to `update`. `current` is what the screen shows now, kept on failure.
    func load(current: AppResourceState<Value>, _ update: (AppResourceState<Value>) -> Void) async {
        guard source.isConnected else {
            update(AppResourceState(content: .empty))
            return
        }
        var shown = current
        let key = appCacheKey(path, query)
        if shown.content.value == nil, let kept = await source.kept(key), let value = await Self.decode(kept.data) {
            shown = AppResourceState(
                content: .loaded(value),
                freshness: freshness(kept.fetchedAt, offline: false),
                shownFetchedAt: kept.fetchedAt
            )
            update(shown)
        }
        do {
            let fetched = try await source.fetch(path, query: query)
            guard let value = await Self.decode(fetched.data) else { throw SyncTransportError.invalidResponse }
            await source.keep(fetched, for: key)
            update(
                AppResourceState(
                    content: .loaded(value),
                    freshness: freshness(fetched.fetchedAt, offline: false),
                    shownFetchedAt: fetched.fetchedAt
                )
            )
        } catch is CancellationError {
            return
        } catch SyncTransportError.missingToken {
            update(AppResourceState(content: .empty))
        } catch SyncTransportError.unauthorized {
            update(AppResourceState(content: .empty, needsReconnect: true))
        } catch SyncTransportError.rejected(404) {
            // Deleted on the coach: the kept copy would show it for ever, so it goes.
            await source.forget(key)
            let message = Self.message(for: SyncTransportError.rejected(status: 404))
            update(AppResourceState(content: .failed(message: message), isGone: true))
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

    /// The kept content with a line that says why it is old, or a failure message when nothing is kept.
    private func failed(_ shown: AppResourceState<Value>, _ error: any Error) -> AppResourceState<Value> {
        guard shown.content.value != nil else {
            return AppResourceState(content: .failed(message: Self.message(for: error)))
        }
        let reason = Self.staleReason(for: error)
        // Built from when the shown body was fetched, so a second failure never says "Offline · offline · …".
        let since = shown.shownFetchedAt.map { freshness($0, offline: true).text.lowercasedFirst }
        return AppResourceState(
            content: shown.content,
            freshness: AppFreshness(
                text: since.map { "\(reason.text) · \($0)" } ?? reason.text,
                isOffline: true,
                symbol: reason.symbol
            ),
            shownFetchedAt: shown.shownFetchedAt
        )
    }

    /// The first words of the line over an old copy: why this fetch failed.
    nonisolated static func staleReason(for error: any Error) -> (text: String, symbol: String) {
        switch error as? SyncTransportError {
        case .retryable(status: nil), nil:
            (String(localized: "Offline"), "wifi.slash")
        case .retryable:
            (String(localized: "Coach had a problem"), "exclamationmark.triangle")
        case .invalidResponse:
            (String(localized: "Update the app to see the latest"), "exclamationmark.triangle")
        case .rejected, .unauthorized, .missingToken:
            (String(localized: "Coach did not answer"), "exclamationmark.triangle")
        }
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
