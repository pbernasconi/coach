import Foundation

/// A resting height of a Kobo sheet. Pass several to let people drag between them.
///
///     .koboSheet(isPresented: $showsFilters, title: "Filters", detents: [.medium, .large]) { … }
nonisolated public enum SheetDetent: Hashable, Sendable {
    /// Fits the sheet to its header, content and footer. Content taller than the screen scrolls.
    case fitted
    /// About half the screen.
    case medium
    /// The full sheet height.
    case large
    /// A share of the screen height, from 0.1 to 1.
    case fraction(CGFloat)
    /// A fixed height in points.
    case height(CGFloat)
}

/// What is drawn behind a Kobo sheet.
nonisolated public enum SheetBackground: Sendable, Equatable, CaseIterable {
    /// The system Liquid Glass sheet under a glass theme; the theme's `surface` under a solid theme.
    case automatic
    /// The theme's `surface` colour.
    case surface
    /// The theme's `canvas` colour, for a sheet that holds cards or grouped lists.
    case canvas
}

/// The sizing rules of a Kobo sheet, apart from SwiftUI so they can be tested.
nonisolated enum SheetSizing {
    /// A detent as the system sheet takes it: `fitted` is already a measured height.
    enum Resolved: Hashable, Sendable {
        case medium
        case large
        case fraction(CGFloat)
        case height(CGFloat)
    }

    /// The smallest share a `fraction` detent may take, so a sheet never opens as a sliver.
    static let minimumFraction: CGFloat = 0.1

    /// The detents handed to the system, in the caller's order and without repeats. An empty list means `large`.
    /// `fitted` uses the measured height, or `medium` until the content has been measured once.
    static func resolved(_ detents: [SheetDetent], fittedHeight: CGFloat?) -> [Resolved] {
        var result: [Resolved] = []
        for detent in detents {
            let next = resolve(detent, fittedHeight: fittedHeight)
            if !result.contains(next) { result.append(next) }
        }
        return result.isEmpty ? [.large] : result
    }

    private static func resolve(_ detent: SheetDetent, fittedHeight: CGFloat?) -> Resolved {
        switch detent {
        case .medium: .medium
        case .large: .large
        case .fraction(let share): .fraction(min(max(share, minimumFraction), 1))
        case .height(let points): points > 0 ? .height(points) : .medium
        case .fitted:
            if let fittedHeight, fittedHeight > 0 { .height(fittedHeight) } else { .medium }
        }
    }

    /// The ideal height, never taller than the offered height (`FittedHeightLayout`).
    static func fittedHeight(ideal: CGFloat, offered: CGFloat?) -> CGFloat {
        guard let offered, offered.isFinite else { return ideal }
        return min(ideal, offered)
    }
}

/// The measured parts of a fitted sheet: its header, its scrolling content and its footer.
nonisolated struct SheetMeasurements: Equatable, Sendable {
    var header: CGFloat = 0
    var content: CGFloat = 0
    var footer: CGFloat = 0

    /// The height that shows every part without scrolling, rounded up to a whole point so sub-point layout noise
    /// never resizes the sheet. `nil` until the content has been measured.
    var fittedHeight: CGFloat? {
        guard content > 0 else { return nil }
        return (header + content + footer).rounded(.up)
    }
}
