import LiftCore

/// Every user intent on the Settings screen, named for what happened (SCR-1).
nonisolated enum SettingsAction: Equatable, Sendable {
    case unitSelected(WeightUnit)
    /// The Acknowledgements row: opens the list of bundled third-party work.
    case acknowledgementsTapped
}
