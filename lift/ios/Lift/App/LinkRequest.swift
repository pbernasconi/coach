import Foundation

/// A web page a ViewModel wants opened. The Screen opens it with SwiftUI's `openURL` when `serial` changes, so the
/// same link can be opened twice and the ViewModel stays testable without a URL opener.
nonisolated struct LinkRequest: Equatable, Sendable {
    var serial: Int
    var url: URL
}
