// swift-tools-version: 6.2
// LiftKit: the local package for Lift (LAY-2). For now it holds only the pure domain core.
// Strict settings applied to every target from one helper (CONC-2).
import PackageDescription

let strict: [SwiftSetting] = [
    .enableUpcomingFeature("NonisolatedNonsendingByDefault"),
    .enableUpcomingFeature("InferIsolatedConformances"),
    .enableUpcomingFeature("ExistentialAny"),
    .enableUpcomingFeature("MemberImportVisibility"),
    .treatAllWarnings(as: .error),
]
let logic: [SwiftSetting] = strict + [.defaultIsolation(nil)]  // CONC-1: Core is not tied to the main actor

let package = Package(
    name: "LiftKit",
    platforms: [.iOS(.v26), .macOS(.v26)],  // macOS so `swift test` runs without a simulator (LAY-3)
    products: [
        .library(name: "LiftCore", targets: ["LiftCore"])
    ],
    targets: [
        .target(name: "LiftCore", swiftSettings: logic),
        .testTarget(name: "LiftCoreTests", dependencies: ["LiftCore"], swiftSettings: logic),
    ]
)
