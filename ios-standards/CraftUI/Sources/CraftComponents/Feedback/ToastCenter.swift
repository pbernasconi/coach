import Foundation
import Observation

/// The toast queue: holds the one toast on screen and dismisses it after its duration.
///
/// A new toast replaces the current one (and restarts the timer). Time comes from the injected clock, so tests drive
/// it with a manual clock. Own one per window and attach it with `.toastHost(_:)`:
///
///     @State private var toasts = ToastCenter()
///     var body: some View { content.toastHost(toasts) }
@Observable
@MainActor
public final class ToastCenter {
    /// The toast on screen, if any.
    public private(set) var current: Toast?

    private let clock: any Clock<Duration>
    @ObservationIgnored private var timer: Task<Void, Never>?

    public init(clock: any Clock<Duration> = ContinuousClock()) {
        self.clock = clock
    }

    /// Shows `toast`, replacing whatever is on screen, and schedules its dismissal.
    public func show(_ toast: Toast) {
        timer?.cancel()
        current = toast
        let clock = clock
        let id = toast.id
        let duration = toast.duration
        timer = Task { [weak self] in
            do {
                try await clock.sleep(for: duration)
            } catch {
                return // Cancelled: a newer toast or a dismiss took over.
            }
            self?.expire(id)
        }
    }

    /// Dismisses the toast with `id`, if it is still the one on screen.
    public func dismiss(_ id: Toast.ID) {
        guard current?.id == id else { return }
        timer?.cancel()
        timer = nil
        current = nil
    }

    /// Dismisses whatever is on screen.
    public func dismissCurrent() {
        guard let current else { return }
        dismiss(current.id)
    }

    /// Runs the toast's action and dismisses it.
    public func performAction(of toast: Toast) {
        dismiss(toast.id)
        toast.action?.perform()
    }

    private func expire(_ id: Toast.ID) {
        guard current?.id == id else { return }
        timer = nil
        current = nil
    }
}
