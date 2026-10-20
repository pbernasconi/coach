import os

/// Per-category loggers (ERR-2). Interpolate errors with `privacy: .private`.
nonisolated enum AppLog {
    static let launch = Logger(subsystem: "com.example.lift", category: "launch")
    static let rest = Logger(subsystem: "com.example.lift", category: "rest")
    static let health = Logger(subsystem: "com.example.lift", category: "health")
    static let templates = Logger(subsystem: "com.example.lift", category: "templates")
    static let sync = Logger(subsystem: "com.example.lift", category: "sync")
}
