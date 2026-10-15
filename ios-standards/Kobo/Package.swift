// swift-tools-version: 6.2
// Kobo: a reusable SwiftUI component library. Tokens → Components → Patterns → Catalog.
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
    name: "Kobo",
    defaultLocalization: "en",
    platforms: [.iOS(.v26), .macOS(.v26)],
    products: [
        .library(name: "KoboTokens", targets: ["KoboTokens"]),
        .library(name: "KoboComponents", targets: ["KoboComponents"]),
        .library(name: "KoboPatterns", targets: ["KoboPatterns"]),
        .library(name: "KoboCatalog", targets: ["KoboCatalog"]),
    ],
    targets: [
        .target(name: "KoboTokens", swiftSettings: strict + [.defaultIsolation(nil)]),
        .target(
            name: "KoboComponents",
            dependencies: ["KoboTokens"],
            resources: [.process("Resources")],  // the library's own strings (Localizable.xcstrings)
            swiftSettings: strict + [.defaultIsolation(MainActor.self)]
        ),
        .target(
            name: "KoboPatterns",
            dependencies: ["KoboTokens", "KoboComponents"],
            resources: [.process("Resources")],  // the library's own strings (Localizable.xcstrings)
            swiftSettings: strict + [.defaultIsolation(MainActor.self)]
        ),
        .target(
            name: "KoboCatalog",
            dependencies: ["KoboTokens", "KoboComponents", "KoboPatterns"],
            swiftSettings: strict + [.defaultIsolation(MainActor.self)]
        ),
        .testTarget(name: "KoboTokensTests", dependencies: ["KoboTokens"], swiftSettings: strict),
        .testTarget(
            name: "KoboComponentsTests",
            dependencies: ["KoboTokens", "KoboComponents"],
            swiftSettings: strict + [.defaultIsolation(MainActor.self)]
        ),
        .testTarget(
            name: "KoboPatternsTests",
            dependencies: ["KoboTokens", "KoboComponents", "KoboPatterns"],
            swiftSettings: strict + [.defaultIsolation(MainActor.self)]
        ),
        .testTarget(
            name: "KoboCatalogTests",
            dependencies: ["KoboCatalog"],
            swiftSettings: strict + [.defaultIsolation(MainActor.self)]
        ),
    ]
)
