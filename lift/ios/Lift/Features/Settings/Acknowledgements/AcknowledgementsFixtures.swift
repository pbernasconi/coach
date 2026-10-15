#if DEBUG
    /// Named states for previews and snapshots.
    extension AcknowledgementsState {
        static let fixtureDefault = AcknowledgementsState(items: Acknowledgement.bundled)
        static let fixtureEmpty = AcknowledgementsState(items: [])
    }
#endif
