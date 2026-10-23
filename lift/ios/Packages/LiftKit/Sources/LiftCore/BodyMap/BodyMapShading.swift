/// The drawn areas of the body map. `outline` is everything that is not a muscle (head, hands, knees, feet).
public enum BodyRegion: String, CaseIterable, Sendable {
    case chest, deltoids, biceps, triceps, forearm, abs, obliques, quadriceps, adductors, calves, tibialis
    case trapezius, upperBack, lowerBack, gluteal, hamstring
    case outline
}

/// How strongly a muscle is shaded: by the sets that worked it, counted as /lift counts them (1 for a working set's main
/// muscle, 0.5 for a helper).
public enum BodyShade: Int, Comparable, CaseIterable, Sendable {
    case none, light, medium, full

    /// Under 2 sets light, under 4 medium, 4 or more full.
    public init(sets: Double) {
        switch sets {
        case ..<0.25: self = .none
        case ..<2: self = .light
        case ..<4: self = .medium
        default: self = .full
        }
    }

    public static func < (lhs: Self, rhs: Self) -> Bool { lhs.rawValue < rhs.rawValue }
}

extension Muscle {
    /// The drawn areas that show this muscle.
    public var bodyRegions: [BodyRegion] {
        switch self {
        case .chest: [.chest]
        case .back: [.upperBack, .trapezius, .lowerBack]
        case .shoulders: [.deltoids]
        case .biceps: [.biceps]
        case .triceps: [.triceps]
        case .quads: [.quadriceps]
        case .hamstrings: [.hamstring]
        case .glutes: [.gluteal]
        case .calves: [.calves]
        case .core: [.abs, .obliques]
        case .forearms: [.forearm]
        }
    }
}

/// The shade of every drawn area for one session's sets per muscle. Areas no muscle reaches are `.none`; an area two
/// muscles share takes the stronger shade.
public enum BodyMapShading {
    public static func shades(sets: [Muscle: Double]) -> [BodyRegion: BodyShade] {
        var shades: [BodyRegion: BodyShade] = [:]
        for (muscle, count) in sets {
            let shade = BodyShade(sets: count)
            for region in muscle.bodyRegions {
                shades[region] = max(shades[region] ?? .none, shade)
            }
        }
        return shades
    }
}
