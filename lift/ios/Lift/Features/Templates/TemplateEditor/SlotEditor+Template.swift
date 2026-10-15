import Foundation
import LiftCore

extension SlotEditor {
    /// The editor for `slot`, at `index` of `count` slots, with the load in `unit`.
    init(slot: TemplateExercise, index: Int, count: Int, unit: WeightUnit) {
        let weight = slot.weight.map { $0.converted(to: unit).rounded(toStep: 0.25).value } ?? 0
        let values = Values(
            sets: slot.sets,
            repMin: slot.repRange.lowerBound,
            repMax: slot.repRange.upperBound,
            weight: weight,
            rest: slot.restSeconds ?? 0
        )
        self.init(
            id: slot.id,
            title: slot.displayName,
            subtitle: String(localized: "Exercise \(index + 1) of \(count)"),
            unit: unit,
            step: unit == .kg ? 2.5 : 5,
            values: values,
            saved: values,
            canMoveUp: index > 0,
            canMoveDown: index < count - 1
        )
    }

    /// The editor after a stepper moved. The rep range stays valid: raising the low end past the high end raises both.
    func applying(_ action: TemplateEditorAction) -> SlotEditor {
        var copy = self
        switch action {
        case .editorSetsChanged(let sets): copy.values.sets = sets.clamped(to: Self.setRange)
        case .editorRepMinChanged(let reps):
            copy.values.repMin = reps.clamped(to: Self.repRange)
            copy.values.repMax = max(copy.values.repMax, copy.values.repMin)
        case .editorRepMaxChanged(let reps):
            copy.values.repMax = reps.clamped(to: Self.repRange)
            copy.values.repMin = min(copy.values.repMin, copy.values.repMax)
        case .editorWeightChanged(let weight): copy.values.weight = max(0, weight)
        case .editorRestChanged(let rest): copy.values.rest = rest.clamped(to: Self.restRange)
        default: break
        }
        return copy
    }

    /// `slot` with this editor's values.
    func saving(into slot: TemplateExercise) -> TemplateExercise {
        var saved = slot
        saved.sets = values.sets
        saved.repRange = values.repMin...values.repMax
        saved.weight = values.weight > 0 ? Weight(values.weight, unit) : nil
        saved.restSeconds = values.rest > 0 ? values.rest : nil
        return saved
    }
}

extension Comparable {
    fileprivate func clamped(to range: ClosedRange<Self>) -> Self {
        min(max(self, range.lowerBound), range.upperBound)
    }
}
