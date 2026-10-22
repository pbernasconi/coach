import Foundation
import LiftSync
import UIKit
import UserNotifications

extension CompositionRoot {
    /// Push notifications for the person's own log when this build syncs (lift/PUSH.md): the device token goes to the
    /// coach with the sync token. Demo, `-fresh` and practice data never register.
    static func makePush(source: AppInfo.DataSource, sync: any Syncing) -> PushNotifications? {
        let baseURL = SyncServer.baseURL(from: Bundle.main.object(forInfoDictionaryKey: SyncServer.infoKey))
        guard source.isSaved, sync.isConfigured, let baseURL else { return nil }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.httpCookieStorage = nil
        configuration.timeoutIntervalForRequest = 30
        configuration.waitsForConnectivity = false
        let devices = URLSessionPushDevices(
            session: URLSession(configuration: configuration),
            baseURL: baseURL,
            tokens: syncTokenStore()
        )
        let bundle = Bundle.main
        let version = bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        let build = bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String
        let install = PushInstall(
            environment: ApnsEnvironmentResolver.current(bundle: bundle),
            topic: bundle.bundleIdentifier ?? "com.pbernasconi.lift",
            installId: PushInstallSettings.standard().installID(makeID: { UUID() }),
            appVersion: [version, build.map { "(" + $0 + ")" }].compactMap(\.self).joined(separator: " "),
            deviceName: UIDevice.current.model
        )
        let registrar = PushRegistrar(
            system: LivePushSystem(center: .current()),
            devices: devices,
            install: install,
            isConnected: { await sync.hasToken() },
            clock: ContinuousClock()
        )
        return PushNotifications(registrar: registrar, devices: devices)
    }
}
