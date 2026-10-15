import LiftCore

/// Every user intent on the Plates and bars screen, named for what happened (SCR-1). Each change is saved at once.
nonisolated enum PlatesAction: Equatable, Sendable {
    /// The kg | lb picker: which unit's kit is shown.
    case unitShown(WeightUnit)
    /// A bar row: the bar loads start from.
    case barSelected(Double)
    /// A collar row: none, or the weight of each collar.
    case collarSelected(Double)
    /// A plate row: opens its sheet.
    case plateTapped(Double)
    /// The sheet's switch: whether the gym has this plate.
    case plateAvailabilityToggled(Bool)
    /// The sheet's stepper: how many pairs.
    case platePairsChanged(Int)
    /// The plate sheet was closed.
    case plateEditorDismissed
    /// "Reset to defaults": the shown unit's kit goes back to the defaults, with Undo in a toast (product rule).
    case resetTapped
    /// Undo on the "Reset to defaults" toast: puts the kit back as it was.
    case resetUndoTapped(BarbellSetup)
}
