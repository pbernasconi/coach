import SwiftUI

// ios-guard: allow hex literals — the widget's token file; the extension does not link Kobo.

/// The Home Screen widget's colours, light and dark. Fitness and fatigue are the web's `--viz-ctl` and `--viz-atl`
/// (src/app/globals.css); form is Coach's orange; the sports are `design/sports.json`. Compiled into the app (the demo
/// gallery) and LiftWidgets.
nonisolated enum HomeWidgetColors {
    static func background(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? rgb(0x1C1C1E) : rgb(0xFFFFFF)
    }

    static func fitness(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? rgb(0x4F98EC) : rgb(0x2A78D6)
    }

    static func form(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? rgb(0xF39069) : rgb(0xD4561F)
    }

    static func fatigue(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? rgb(0xE8709B) : rgb(0xC94F7E)
    }

    /// The tick on a done workout: the Plan calendar's done green.
    static func done(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? rgb(0x34C77B) : rgb(0x16A05A)
    }

    /// The hairline between the numbers and the workouts.
    static func hairline(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color.white.opacity(0.10) : Color.black.opacity(0.08)
    }

    /// The colour of a sport id from `design/sports.json`; grey for any other.
    static func sport(_ id: String, _ scheme: ColorScheme) -> Color {
        let dark = scheme == .dark
        switch id {
        case "ride": return dark ? rgb(0x3987E5) : rgb(0x2A78D6)
        case "run": return dark ? rgb(0xD95926) : rgb(0xEB6834)
        case "hike": return dark ? rgb(0x199E70) : rgb(0x1BAF7A)
        case "walk": return dark ? rgb(0xC98500) : rgb(0xEDA100)
        case "strength": return dark ? rgb(0x9085E9) : rgb(0x6250D6)
        case "swim": return rgb(0x008300)
        case "yoga": return dark ? rgb(0xD55181) : rgb(0xE87BA4)
        default: return dark ? rgb(0x8E8D87) : rgb(0xA8A79F)
        }
    }

    /// The SF Symbol of a sport id, as `design/sports.json` names it.
    static func sportSymbol(_ id: String) -> String {
        switch id {
        case "ride": "figure.outdoor.cycle"
        case "run": "figure.run"
        case "hike": "figure.hiking"
        case "walk": "figure.walk"
        case "strength": "dumbbell.fill"
        case "swim": "figure.pool.swim"
        case "yoga": "figure.yoga"
        case "rest": "moon.zzz.fill"
        default: "figure.mixed.cardio"
        }
    }

    private static func rgb(_ hex: UInt32) -> Color {
        Color(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}
