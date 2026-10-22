import Foundation
import LiftSync

/// The APNs host of THIS build's tokens, from its signing (lift/PUSH.md).
///
/// - Simulator: sandbox.
/// - `embedded.mobileprovision` present (an Xcode build): its `aps-environment` entitlement.
/// - No profile (TestFlight and the App Store strip it): production.
/// - A profile that does not parse: the build configuration (Debug → sandbox, Release → production).
nonisolated enum ApnsEnvironmentResolver {
    static func current(bundle: Bundle) -> ApnsEnvironment {
        #if targetEnvironment(simulator)
            return .sandbox
        #else
            let profile = bundle.url(forResource: "embedded", withExtension: "mobileprovision")
                .flatMap { try? Data(contentsOf: $0) }
            return resolve(provisioningProfile: profile, isDebugBuild: isDebugBuild)
        #endif
    }

    static func resolve(provisioningProfile: Data?, isDebugBuild: Bool) -> ApnsEnvironment {
        guard let provisioningProfile else { return .production }
        switch apsEnvironment(in: provisioningProfile) {
        case "development": return .sandbox
        case "production": return .production
        default: return isDebugBuild ? .sandbox : .production
        }
    }

    /// The profile is a signed envelope around an XML plist: read the plist between `<?xml` and `</plist>`.
    static func apsEnvironment(in provisioningProfile: Data) -> String? {
        guard let start = provisioningProfile.range(of: Data("<?xml".utf8)),
            let end = provisioningProfile.range(
                of: Data("</plist>".utf8),
                in: start.lowerBound..<provisioningProfile.endIndex
            )
        else { return nil }
        let plist = provisioningProfile[start.lowerBound..<end.upperBound]
        guard let root = try? PropertyListSerialization.propertyList(from: plist, format: nil) as? [String: Any],
            let entitlements = root["Entitlements"] as? [String: Any]
        else { return nil }
        return entitlements["aps-environment"] as? String
    }

    private static var isDebugBuild: Bool {
        #if DEBUG
            return true
        #else
            return false
        #endif
    }
}
