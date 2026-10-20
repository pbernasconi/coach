import Foundation
import LiftCore

/// Trades a one-time enrollment code for the sync token (POST `/api/lift/enroll`, coach repo
/// `src/app/api/lift/enroll`). `URLSessionEnrollment` is the live one; tests use a fake.
nonisolated protocol Enrolling: Sendable {
    func token(for code: String) async throws -> String
}

nonisolated struct URLSessionEnrollment: Enrolling {
    let session: URLSession
    let baseURL: URL

    func token(for code: String) async throws -> String {
        var request = URLRequest(url: baseURL.appending(path: "api/lift/enroll"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["code": code])
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            throw AppError(.invalidInput, detail: "enrollment refused (HTTP \(status))")
        }
        let body = try JSONDecoder().decode(EnrollmentResponse.self, from: data)
        guard !body.token.isEmpty else { throw AppError(.invalidInput, detail: "enrollment returned no token") }
        return body.token
    }
}

nonisolated private struct EnrollmentResponse: Decodable {
    let token: String
}
