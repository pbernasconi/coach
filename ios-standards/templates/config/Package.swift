// swift-tools-version: 6.2
// One local package, a few targets (LAY-2). Strict settings applied to every target (CONC-2).
import PackageDescription

let strict: [SwiftSetting] = [
    .enableUpcomingFeature("NonisolatedNonsendingByDefault"),
    .enableUpcomingFeature("InferIsolatedConformances"),
    .enableUpcomingFeature("ExistentialAny"),
    .enableUpcomingFeature("MemberImportVisibility"),
    .enableUpcomingFeature("InternalImportsByDefault"),
    .treatAllWarnings(as: .error),
]
let logic: [SwiftSetting] = strict + [.defaultIsolation(nil)]           // Core, Store, Sync
let ui: [SwiftSetting] = strict + [.defaultIsolation(MainActor.self)]   // Design

let package = Package(
    name: "AppKit",
    platforms: [.iOS(.v26), .macOS(.v15)],   // macOS so `swift test` runs without a simulator (LAY-3)
    products: [
        .library(name: "Core", targets: ["Core"]),
        .library(name: "Store", targets: ["Store"]),
        .library(name: "Sync", targets: ["Sync"]),
        .library(name: "Design", targets: ["Design"]),
        .library(name: "TestingSupport", targets: ["TestingSupport"]),
    ],
    dependencies: [
        .package(url: "https://github.com/groue/GRDB.swift", exact: "7.6.1"),   // pin exact; bump to the current release when starting (STACK-1)
    ],
    targets: [
        .target(name: "Core", swiftSettings: logic),
        .target(name: "Store", dependencies: ["Core", .product(name: "GRDB", package: "GRDB.swift")], swiftSettings: logic),
        .target(name: "Sync", dependencies: ["Core", "Store"], swiftSettings: logic),
        .target(name: "Design", swiftSettings: ui),
        .target(name: "TestingSupport", dependencies: ["Core", "Store"], path: "Sources/Testing", swiftSettings: logic),
        .testTarget(name: "CoreTests", dependencies: ["Core", "TestingSupport"], swiftSettings: logic),
        .testTarget(name: "StoreTests", dependencies: ["Store", "TestingSupport"], swiftSettings: logic),
        .testTarget(name: "SyncTests", dependencies: ["Sync", "TestingSupport"], swiftSettings: logic),
    ]
)
