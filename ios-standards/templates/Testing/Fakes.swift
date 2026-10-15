import Core

/// Hand-written fakes and recorders (TEST-2). Tests assert whole call lists.

public final class FakeExampleRepository: ExampleRepository, @unchecked Sendable {  // ios-guard: allow test fake
    public private(set) var created: [String] = []
    public var createError: AppError?
    private var buffered: [[ExampleItem]] = []
    private var finished = false

    public init() {}

    public func emit(_ items: [ExampleItem]) { buffered.append(items) }
    public func finish() { finished = true }

    public func observeAll() -> AsyncStream<[ExampleItem]> {
        let (stream, continuation) = AsyncStream.makeStream(of: [ExampleItem].self)
        for items in buffered { continuation.yield(items) }
        if finished { continuation.finish() }
        return stream
    }

    public func create(name: String) async throws {
        if let createError { throw createError }
        created.append(name)
    }

    public func delete(id _: ExampleItem.ID) async throws {}
}

public final class RecordingRouter: Navigating {
    public enum Call: Equatable { case push(Route), present(Route), dismiss }
    public private(set) var calls: [Call] = []
    public init() {}
    public func push(_ route: Route) { calls.append(.push(route)) }
    public func present(_ route: Route) { calls.append(.present(route)) }
    public func dismiss() { calls.append(.dismiss) }
}

public final class RecordingHaptics: Haptics {
    public private(set) var played: [HapticEvent] = []
    public init() {}
    public func play(_ event: HapticEvent) { played.append(event) }
}

// For time, use a test clock (e.g. swift-clocks' TestClock, test-only) and advance it explicitly:
//   let clock = TestClock(); ... await clock.advance(by: .seconds(90))   // rest timer done, instantly
