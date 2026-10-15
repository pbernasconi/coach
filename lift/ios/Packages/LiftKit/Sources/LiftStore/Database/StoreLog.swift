#if canImport(os)
    import os
#endif

/// The store's logger (ERR-2). Only the error's type name is logged, never row contents. On Linux, where
/// `os` is missing, logging is a no-op so the package still builds and tests there.
enum StoreLog {
    #if canImport(os)
        private static let logger = Logger(subsystem: "app.lift", category: "store")
    #endif

    static func observationFailed(_ error: any Error) {
        #if canImport(os)
            let name = String(describing: type(of: error))
            logger.error("observation failed: \(name, privacy: .public)")
        #endif
    }
}
