import GRDB

/// A repository stream over a GRDB `ValueObservation` (DATA-1, CONC-8): one continuation per subscriber,
/// newest value only, duplicates dropped, and the observation cancelled when the subscriber goes away.
enum ObservedStream {
    static func make<Value: Equatable & Sendable>(
        in reader: any DatabaseReader,
        _ fetch: @escaping @Sendable (Database) throws -> Value
    ) -> AsyncStream<Value> {
        let (stream, continuation) = AsyncStream.makeStream(of: Value.self, bufferingPolicy: .bufferingNewest(1))
        let observation = ValueObservation.tracking(fetch).removeDuplicates()
        let task = Task {
            do {
                for try await value in observation.values(in: reader) {
                    continuation.yield(value)
                }
            } catch is CancellationError {
                // The subscriber went away (CONC-7): not an error.
            } catch {
                StoreLog.observationFailed(error)
            }
            continuation.finish()
        }
        continuation.onTermination = { _ in task.cancel() }
        return stream
    }
}
