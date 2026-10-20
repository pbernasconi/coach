import KoboTokens
import SwiftUI

// ios-guard: allow hex literals — this is Lift's token file for sports.

/// A sport group, with the same ids, colours and icons as the coach web app. The source is `design/sports.json` at
/// the repo root; `SportStyleTests` fails when this file and that one differ. The case order is the stack order
/// in charts, bottom first.
nonisolated enum Sport: String, CaseIterable, Sendable {
    case ride, run, hike, walk, strength, swim, yoga, other, rest

    /// The English name, the same as the web app shows.
    var label: String {
        switch self {
        case .ride: "Ride"
        case .run: "Run"
        case .hike: "Hike"
        case .walk: "Walk"
        case .strength: "Strength"
        case .swim: "Swim"
        case .yoga: "Yoga"
        case .other: "Other"
        case .rest: "Rest"
        }
    }

    /// The SF Symbol. The web app uses the lucide icon that is closest to it.
    var symbol: String {
        switch self {
        case .ride: "figure.outdoor.cycle"
        case .run: "figure.run"
        case .hike: "figure.hiking"
        case .walk: "figure.walk"
        case .strength: "dumbbell.fill"
        case .swim: "figure.pool.swim"
        case .yoga: "figure.yoga"
        case .other: "figure.mixed.cardio"
        case .rest: "moon.zzz.fill"
        }
    }

    /// The colour as 0xRRGGBB for light and dark mode. Rest and other are neutral grey.
    var hex: (light: UInt32, dark: UInt32) {
        switch self {
        case .ride: (0x2A78D6, 0x3987E5)
        case .run: (0xEB6834, 0xD95926)
        case .hike: (0x1BAF7A, 0x199E70)
        case .walk: (0xEDA100, 0xC98500)
        case .strength: (0x6250D6, 0x9085E9)
        case .swim: (0x008300, 0x008300)
        case .yoga: (0xE87BA4, 0xD55181)
        case .other, .rest: (0xA8A79F, 0x6B6A65)
        }
    }

    /// The colour, which follows the system appearance.
    var color: Color {
        Color(light: Color(hex: hex.light), dark: Color(hex: hex.dark))
    }

    /// The icon in the sport's colour. Decorative: show the sport's name next to it.
    var icon: some View {
        Image(systemName: symbol)
            .foregroundStyle(color)
            .accessibilityHidden(true)
    }
}
