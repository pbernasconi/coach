import LiftSync

// KeychainTokenStore already has `save(_:)` and `remove()`; it exists wherever Security does (always on iOS).
nonisolated extension KeychainTokenStore: TokenStoring {}
