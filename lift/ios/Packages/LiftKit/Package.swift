// swift-tools-version: 6.2
// LiftKit: the local package for Lift (LAY-2). Core is the pure domain; Store is GRDB persistence;
// Testing holds fakes and fixtures for tests. Strict settings applied to every target from one helper (CONC-2).
import PackageDescription

let strict: [SwiftSetting] = [
    .enableUpcomingFeature("NonisolatedNonsendingByDefault"),
    .enableUpcomingFeature("InferIsolatedConformances"),
    .enableUpcomingFeature("ExistentialAny"),
    .enableUpcomingFeature("MemberImportVisibility"),
    .treatAllWarnings(as: .error),
]
let logic: [SwiftSetting] = strict + [.defaultIsolation(nil)]  // CONC-1: Core and Store are not tied to the main actor
let grdb: Target.Dependency = .product(name: "GRDB", package: "GRDB.swift")

let package = Package(
    name: "LiftKit",
    platforms: [.iOS(.v26), .macOS(.v26)],  // macOS so `swift test` runs without a simulator (LAY-3)
    products: [
        .library(name: "LiftCore", targets: ["LiftCore"]),
        .library(name: "LiftStore", targets: ["LiftStore"]),
        .library(name: "LiftTesting", targets: ["LiftTesting"]),
    ],
    dependencies: [
        // Pinned exactly (STACK-1). Bump on purpose, never with a range.
        .package(url: "https://github.com/groue/GRDB.swift", exact: "7.11.1")
    ],
    targets: [
        .target(name: "LiftCore", swiftSettings: logic),
        .target(name: "LiftStore", dependencies: ["LiftCore", grdb], swiftSettings: logic),
        .target(name: "LiftTesting", dependencies: ["LiftCore", "LiftStore"], swiftSettings: logic),
        .testTarget(name: "LiftCoreTests", dependencies: ["LiftCore"], swiftSettings: logic),
        .testTarget(
            name: "LiftStoreTests",
            dependencies: ["LiftCore", "LiftStore", "LiftTesting", grdb],
            swiftSettings: logic
        ),
    ]
)
