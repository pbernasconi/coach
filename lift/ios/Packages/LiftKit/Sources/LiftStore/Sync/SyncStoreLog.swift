#if canImport(os)
    import os
#endif

/// The store's sync logger (ERR-2): counts only, never row contents. A no-op on Linux, where `os` is missing.
enum SyncStoreLog {
    #if canImport(os)
        private static let logger = Logger(subsystem: "app.lift", category: "store.sync")
    #endif

    static func pulledRowsSkipped(invalid: Int) {
        #if canImport(os)
            logger.error("pull skipped \(invalid, privacy: .public) rows that could not be decoded")
        #endif
    }

    static func pulledRowsOrphaned(_ count: Int) {
        #if canImport(os)
            logger.error("pull left \(count, privacy: .public) rows whose parent never arrived")
        #endif
    }
}
