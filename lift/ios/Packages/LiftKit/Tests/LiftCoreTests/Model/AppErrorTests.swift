import Foundation
import LiftCore
import Testing

@Suite struct AppErrorTests {
    @Test func kindOfReadsEveryAppErrorKind() {
        for kind in AppError.Kind.allCases {
            #expect(AppError.kind(of: AppError(kind, detail: "x")) == kind)
        }
    }

    @Test func kindOfAnyOtherErrorIsUnknown() {
        #expect(AppError.kind(of: CancellationError()) == .unknown)
        #expect(AppError.kind(of: URLError(.notConnectedToInternet)) == .unknown)
        #expect(AppError.kind(of: NSError(domain: AppError.errorDomain, code: 999)) == .unknown)
    }
}
