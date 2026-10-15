// swift-tools-version: 6.2
// CraftUI: a reusable SwiftUI component library. Tokens → Components → Patterns → Catalog.
// Edges are one-way: Tokens imports nothing; Components imports Tokens; Patterns imports both;
// Catalog (debug galleries/previews) imports everything and is never linked into release code.
import PackageDescription

let strict: [SwiftSetting] = [
    .enableUpcomingFeature("NonisolatedNonsendingByDefault"),
    .enableUpcomingFeature("InferIsolatedConformances"),
    .enableUpcomingFeature("ExistentialAny"),
    .enableUpcomingFeature("MemberImportVisibility"),
    .treatAllWarnings(as: .error),
]

let package = Package(
    name: "CraftUI",
    defaultLocalization: "en",
    platforms: [.iOS(.v26), .macOS(.v26)],
    products: [
        .library(name: "CraftTokens", targets: ["CraftTokens"]),
        .library(name: "CraftComponents", targets: ["CraftComponents"]),
        .library(name: "CraftPatterns", targets: ["CraftPatterns"]),
        .library(name: "CraftCatalog", targets: ["CraftCatalog"]),
    ],
    targets: [
        .target(name: "CraftTokens", swiftSettings: strict + [.defaultIsolation(nil)]),
        .target(name: "CraftComponents", dependencies: ["CraftTokens"], swiftSettings: strict + [.defaultIsolation(MainActor.self)]),
        .target(name: "CraftPatterns", dependencies: ["CraftTokens", "CraftComponents"], swiftSettings: strict + [.defaultIsolation(MainActor.self)]),
        .target(name: "CraftCatalog", dependencies: ["CraftTokens", "CraftComponents", "CraftPatterns"], swiftSettings: strict + [.defaultIsolation(MainActor.self)]),
        .testTarget(name: "CraftTokensTests", dependencies: ["CraftTokens"], swiftSettings: strict),
        .testTarget(name: "CraftComponentsTests", dependencies: ["CraftTokens", "CraftComponents"], swiftSettings: strict + [.defaultIsolation(MainActor.self)]),
        .testTarget(name: "CraftPatternsTests", dependencies: ["CraftTokens", "CraftComponents", "CraftPatterns"], swiftSettings: strict + [.defaultIsolation(MainActor.self)]),
    ]
)
