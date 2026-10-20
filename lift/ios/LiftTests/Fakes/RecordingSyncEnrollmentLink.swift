import Foundation

@testable import Lift

/// A `SyncEnrolling` that records the codes the router passed on.
final class RecordingSyncEnrollmentLink: SyncEnrolling {
    private(set) var codes: [String] = []

    @discardableResult
    func enroll(code: String) -> Task<Void, Never> {
        codes.append(code)
        return Task {}
    }
}
