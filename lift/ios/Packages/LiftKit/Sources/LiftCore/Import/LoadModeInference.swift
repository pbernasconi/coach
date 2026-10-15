import Foundation

/// Works out how the logged numbers map to load for an imported exercise.
enum LoadModeInference {
    /// Per hand for `2x`, `*2`, `each hand` or `both arms`; per side for `per side`; otherwise the library's
    /// mode when matched. Bodyweight when no weight appears anywhere (or the library says bodyweight, in
    /// which case the first weight written is the added load).
    static func loadMode(for draft: ExerciseDraft, libraryMode: LoadMode?) -> LoadMode {
        if draft.header.perHand || draft.sets.contains(where: \.parsed.perHand) { return .perHand }
        if draft.sets.contains(where: \.parsed.perSide) { return .perSide }
        let unit = draft.header.unit ?? .lb
        let firstWeight =
            draft.header.weight
            ?? draft.sets.lazy.compactMap { set in set.parsed.weightValue.map { Weight($0, set.parsed.unit ?? unit) } }
            .first
        if libraryMode?.isBodyweight ?? false || firstWeight == nil {
            return .bodyweight(added: firstWeight)
        }
        return libraryMode ?? .total
    }
}
