import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// The plate drawing's sizes, from the Kobo scale: the tallest plate, the plates' widths and the bar's thickness.
nonisolated enum PlateDrawing {
    /// The tallest plate (the heaviest the gym has).
    static let height = Size.thumbnail + Space.xxxl
    /// The heaviest plate's width; lighter plates are narrower, down to `minWidth`.
    static let width = Space.lg
    static let minWidth = Space.sm
    /// The lightest plates are this share of the tallest, so a 2.5 still reads as a plate (a maths constant).
    static let minHeightShare: Double = 0.3
    /// How plate height grows with weight; 1 is straight with weight, so a 10 is clearly shorter than a 45 (a maths
    /// constant).
    static let heightCurve: Double = 1
    static let gap = Space.xxs
    static let corner = Space.xxs
    /// The sleeve the plates slide onto, the bar between the collars, and the collars.
    static let sleeve = Space.sm
    static let shaft = Space.xs
    static let collarWidth = Space.xs + Space.xxs
    static let collarHeight = Space.xxl + Space.xs
    /// How much bare sleeve shows past the outermost plate.
    static let bareSleeve = Space.xxxl
    static let dash: [CGFloat] = [Space.xs, Space.xxs]
    static let strokeWidth = Space.xxs
}

/// One plate in the drawing: on the bar and staying, going on, or coming off.
private struct PlateMark: Identifiable {
    enum Role { case kept, added, removed }
    var id: Int
    var size: Double
    var role: Role
}

/// The bar (or one sleeve of a plate-loaded machine) with the plates the editor's weight needs. Plates already on stay
/// dark, new plates are in the accent colour, and plates to take off show as dashed outlines. Two plain lines under it:
/// the change from what is loaded now ("Add 10 + 5 a side · from 225 lb"), then the plates a side.
struct BarPlates: View {
    @Environment(\.koboTheme) private var theme
    let loading: PlateLoading
    let unit: WeightUnit

    var body: some View {
        VStack(spacing: Space.sm) {
            drawing
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text(verbatim: WorkoutText.platesAccessibility(loading)))
            // Every line keeps its height when it is empty, so the stepper under the card doesn't move while tapping.
            VStack(spacing: Space.xxs) {
                let change = loading.change.flatMap(WorkoutText.plateChange)
                changeLine(change ?? " ")
                    .opacity(change == nil ? 0 : 1)
                    .accessibilityHidden(change == nil)
                Text(verbatim: WorkoutText.platesPerSide(loading))
                    .font(theme.font(.subheadline).monospacedDigit())
                    .foregroundStyle(theme.palette.textSecondary)
                Text(verbatim: loading.isExact ? " " : WorkoutText.closestLoad(Weight(loading.loaded, unit)))
                    .font(theme.font(.footnote).monospacedDigit())
                    .foregroundStyle(theme.palette.textSecondary)
                    .opacity(loading.isExact ? 0 : 1)
                    .accessibilityHidden(loading.isExact)
            }
            .accessibilityElement(children: .combine)
        }
        .padding(.vertical, Space.md)
        .frame(maxWidth: .infinity)
        .background(theme.palette.canvas, in: .rect(cornerRadius: Radius.md))
        .koboAnimation(.state, value: loading)
    }

    private func changeLine(_ change: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
            Text(verbatim: change)
                .font(theme.font(.headline).monospacedDigit())
                .foregroundStyle(theme.palette.accentText)
            if let onBar = loading.onBar {
                Text(verbatim: WorkoutText.plateChangeFrom(Weight(onBar, unit)))
                    .font(theme.font(.footnote).monospacedDigit())
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
    }

    @ViewBuilder private var drawing: some View {
        switch loading.holder {
        case .bar(let bar):
            HStack(spacing: 0) {
                sleeve.scaleEffect(x: -1)
                shaft(label: WorkoutText.barLabel(bar, unit: unit))
                sleeve
            }
        case .sleeve:
            HStack(spacing: 0) {
                Capsule()
                    .fill(theme.palette.textTertiary)
                    .frame(width: PlateDrawing.collarWidth, height: PlateDrawing.height)
                sleeve
            }
        }
    }

    /// The bar between the collars, with its weight under it.
    private func shaft(label: String) -> some View {
        Capsule()
            .fill(theme.palette.textTertiary)
            .frame(height: PlateDrawing.shaft)
            .frame(minWidth: Size.thumbnail, maxWidth: .infinity)
            .overlay(alignment: .center) {
                Text(verbatim: label)
                    .font(theme.font(.caption).monospacedDigit())
                    .foregroundStyle(theme.palette.textSecondary)
                    .lineLimit(1)
                    .fixedSize()
                    .offset(y: Space.lg)
            }
            .frame(height: PlateDrawing.height)
    }

    /// One sleeve from the collar outwards: the collar, then the plates, then bare sleeve.
    private var sleeve: some View {
        HStack(spacing: PlateDrawing.gap) {
            Capsule()
                .fill(theme.palette.textSecondary)
                .frame(width: PlateDrawing.collarWidth, height: PlateDrawing.collarHeight)
            ForEach(marks) { mark in
                plate(mark)
            }
        }
        .padding(.trailing, PlateDrawing.bareSleeve)
        .frame(height: PlateDrawing.height)
        .background(alignment: .leading) {
            Capsule()
                .fill(theme.palette.surfaceSunken)
                .frame(height: PlateDrawing.sleeve)
        }
        .fixedSize()
    }

    @ViewBuilder private func plate(_ mark: PlateMark) -> some View {
        let shape = RoundedRectangle(cornerRadius: PlateDrawing.corner)
        let size = CGSize(width: width(of: mark.size), height: height(of: mark.size))
        switch mark.role {
        case .kept: shape.fill(theme.palette.textPrimary).frame(width: size.width, height: size.height)
        case .added: shape.fill(theme.palette.accent).frame(width: size.width, height: size.height)
        case .removed:
            shape
                .strokeBorder(
                    theme.palette.accentText,
                    style: StrokeStyle(lineWidth: PlateDrawing.strokeWidth, dash: PlateDrawing.dash)
                )
                .frame(width: size.width, height: size.height)
        }
    }

    /// The plates from the collar outwards. With a change: the plates that stay, those going on, then those coming
    /// off as outlines past them.
    private var marks: [PlateMark] {
        guard let change = loading.change else {
            return loading.perSide.enumerated().map { PlateMark(id: $0.offset, size: $0.element, role: .kept) }
        }
        let all: [(Double, PlateMark.Role)] =
            change.kept.map { ($0, .kept) } + change.add.map { ($0, .added) } + change.remove.map { ($0, .removed) }
        return all.enumerated().map { PlateMark(id: $0.offset, size: $0.element.0, role: $0.element.1) }
    }

    private func share(of size: Double) -> Double {
        guard loading.heaviest > 0 else { return 1 }
        return min(1, max(0, size / loading.heaviest))
    }

    private func height(of size: Double) -> CGFloat {
        let grow = pow(share(of: size), PlateDrawing.heightCurve)
        return PlateDrawing.height * (PlateDrawing.minHeightShare + (1 - PlateDrawing.minHeightShare) * grow)
    }

    private func width(of size: Double) -> CGFloat {
        PlateDrawing.minWidth + (PlateDrawing.width - PlateDrawing.minWidth) * sqrt(share(of: size))
    }
}
