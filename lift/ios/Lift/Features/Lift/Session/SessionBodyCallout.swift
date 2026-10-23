import KoboComponents
import KoboPatterns
import KoboTokens
import LiftCore
import SwiftUI

/// What a picked muscle's card says: its name, its sets this session, and the exercises that worked it.
nonisolated struct BodyMuscleInfo: Equatable, Sendable {
    var name: String
    var setsText: String
    /// "Back squat", then "Leg press · helped" for an exercise where the muscle only helped.
    var exercises: [Line]

    struct Line: Equatable, Sendable, Identifiable {
        /// The exercise item's id.
        var id: String
        var text: String
    }
}

extension LiftSessionDetail {
    /// Every tracked muscle's card, by muscle. Exercises match by the muscle's name, as the server labels both.
    var bodyMuscles: [Muscle: BodyMuscleInfo] {
        let rows = hero.value?.muscles ?? []
        let items = exercises.value?.items ?? []
        var out: [Muscle: BodyMuscleInfo] = [:]
        for muscle in Muscle.allCases {
            let row = rows.first { $0.muscle == muscle.rawValue }
            let name = row?.name ?? muscle.rawValue.capitalized
            let worked = items.compactMap { item -> BodyMuscleInfo.Line? in
                if item.muscles.contains(name) { return .init(id: item.id, text: item.name) }
                if item.secondaryMuscles.contains(name) { return .init(id: item.id, text: "\(item.name) · helped") }
                return nil
            }
            out[muscle] = BodyMuscleInfo(name: name, setsText: row?.setsText ?? "0", exercises: worked)
        }
        return out
    }
}

/// The picked muscle's card over the body: name and sets, then each exercise that worked it.
struct BodyMuscleCallout: View {
    let info: BodyMuscleInfo
    let onClose: () -> Void
    @Environment(\.koboTheme) private var theme

    var body: some View {
        HStack(alignment: .top, spacing: Space.md) {
            VStack(alignment: .leading, spacing: Space.xs) {
                HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                    Text(verbatim: info.name)
                        .font(theme.font(.headline))
                        .foregroundStyle(theme.palette.textPrimary)
                    Text(setsLabel)
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.accentText)
                }
                if info.exercises.isEmpty {
                    Text("No exercise in this session worked it.")
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textSecondary)
                } else {
                    ForEach(info.exercises) { exercise in
                        Text(verbatim: exercise.text)
                            .font(theme.font(.footnote))
                            .foregroundStyle(theme.palette.textSecondary)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(theme.font(.footnote).weight(.semibold))
                    .frame(width: Size.minTouch, height: Size.minTouch)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(theme.palette.textSecondary)
            .accessibilityLabel(Text("Close"))
            .padding(.top, -Space.md)
            .padding(.trailing, -Space.md)
        }
        .koboCard()
        .accessibilityElement(children: .combine)
    }

    private var setsLabel: String {
        info.setsText == "1" ? String(localized: "1 set") : String(localized: "\(info.setsText) sets")
    }
}

/// What the shades mean, in sets; with the sheet down, also that a muscle can be tapped.
struct BodyShadeLegend: View {
    let showsHint: Bool
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(spacing: Space.xs) {
            HStack(spacing: Space.lg) {
                swatch(theme.palette.accent.opacity(0.42), "Under 2")
                swatch(theme.palette.accent.opacity(0.7), "2–3.5")
                swatch(theme.palette.accent, "4+ sets")
            }
            if showsHint {
                Text("Tap a muscle")
                    .foregroundStyle(theme.palette.textTertiary)
            }
        }
        .font(theme.font(.caption))
        .foregroundStyle(theme.palette.textSecondary)
    }

    private func swatch(_ color: Color, _ label: LocalizedStringKey) -> some View {
        HStack(spacing: Space.xs) {
            RoundedRectangle(cornerRadius: Space.xxs, style: .continuous)
                .fill(color)
                .frame(width: Space.md, height: Space.md)
            Text(label)
        }
    }
}
