#if canImport(Security)
    import Foundation
    import LiftCore
    import Security

    /// The sync token in the Keychain (NET-5): one generic-password item, readable after first unlock so a
    /// background sync can use it. Settings saves it; the transport reads it. Never logged.
    public struct KeychainTokenStore: TokenProvider {
        private let service: String
        private let account: String

        public init(service: String = "app.lift.sync", account: String = "token") {
            self.service = service
            self.account = account
        }

        public func token() async throws -> String? {
            var query = baseQuery
            query[kSecReturnData as String] = true
            query[kSecMatchLimit as String] = kSecMatchLimitOne
            var item: CFTypeRef?
            let status = SecItemCopyMatching(query as CFDictionary, &item)
            if status == errSecItemNotFound { return nil }
            guard status == errSecSuccess, let data = item as? Data else {
                throw AppError(.unknown, detail: "keychain read \(status)")
            }
            return String(bytes: data, encoding: .utf8)
        }

        /// Stores `token`, replacing any previous one. An empty token removes it.
        public func save(_ token: String) throws {
            try remove()
            guard !token.isEmpty else { return }
            var item = baseQuery
            item[kSecValueData as String] = Data(token.utf8)
            item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            let status = SecItemAdd(item as CFDictionary, nil)
            guard status == errSecSuccess else { throw AppError(.unknown, detail: "keychain write \(status)") }
        }

        /// Deletes the stored token, if any.
        public func remove() throws {
            let status = SecItemDelete(baseQuery as CFDictionary)
            guard status == errSecSuccess || status == errSecItemNotFound else {
                throw AppError(.unknown, detail: "keychain delete \(status)")
            }
        }

        private var baseQuery: [String: Any] {
            [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: account,
            ]
        }
    }
#endif
