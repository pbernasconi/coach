import os

/// Static category loggers (ERR-2). `privacy: .public` only for closed values.
public enum Log {
    public static let store = Logger(subsystem: subsystem, category: "store")
    public static let sync = Logger(subsystem: subsystem, category: "sync")
    public static let ui = Logger(subsystem: subsystem, category: "ui")
    public static let health = Logger(subsystem: subsystem, category: "health")
    private static let subsystem = "com.example.app"   // replace per app
}
