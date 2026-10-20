import Foundation

@testable import Lift

/// An `Enrolling` with a fixed code → token table; any other code is refused. Records the codes it saw.
actor FakeEnrollment: Enrolling {
    private var tokens: [String: String] = [:]
    private(set) var codes: [String] = []

    func set(tokens: [String: String]) {
        self.tokens = tokens
    }

    func token(for code: String) async throws -> String {
        codes.append(code)
        guard let token = tokens[code] else { throw URLError(.userAuthenticationRequired) }
        return token
    }
}
