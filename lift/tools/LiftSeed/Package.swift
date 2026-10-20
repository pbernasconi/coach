// swift-tools-version: 6.2
// Seeds Lift templates on Coach's sync server from a JSON file, with Lift's own
// repositories and sync engine. Not part of the app; it depends on LiftKit by path. See README.md.
import PackageDescription

let package = Package(
    name: "LiftSeed",
    platforms: [.macOS(.v26)],
    dependencies: [.package(path: "../../ios/Packages/LiftKit")],
    targets: [
        .executableTarget(
            name: "LiftSeed",
            dependencies: [
                .product(name: "LiftCore", package: "LiftKit"),
                .product(name: "LiftStore", package: "LiftKit"),
                .product(name: "LiftSync", package: "LiftKit"),
            ]
        )
    ]
)
