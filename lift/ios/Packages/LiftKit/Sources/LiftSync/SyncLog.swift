#if canImport(os)
    import os
#endif

/// The sync logger (ERR-2): closed values and counts only, never tokens or row contents. A no-op on Linux,
/// where `os` is missing.
enum SyncLog {
    #if canImport(os)
        private static let logger = Logger(subsystem: "app.lift", category: "sync")
    #endif

    static func failed(_ failure: SyncFailure) {
        #if canImport(os)
            logger.error("sync failed: \(String(describing: failure), privacy: .public)")
        #endif
    }

    static func rejected(_ count: Int) {
        #if canImport(os)
            logger.error("server rejected \(count, privacy: .public) changes; removed from the outbox")
        #endif
    }

    static func unreadableEntries(_ count: Int) {
        #if canImport(os)
            logger.error("dropped \(count, privacy: .public) outbox entries whose payload could not be read")
        #endif
    }

    static func droppedChanges(_ count: Int) {
        #if canImport(os)
            logger.error("pull dropped \(count, privacy: .public) changes with an unknown entity or id")
        #endif
    }

    /// A push registration the server refused or that could not be sent; it waits for the next foreground.
    static func pushRegistrationFailed(_ error: any Error) {
        #if canImport(os)
            logger.info("push registration not sent: \(String(describing: error), privacy: .public)")
        #endif
    }
}
