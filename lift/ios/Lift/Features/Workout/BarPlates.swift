import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// The plate drawing's sizes, from the Kobo scale: the tallest plate, the plates' widths and the bar's thickness.
nonisolated enum PlateDrawing {
    /// The tallest plate (the heaviest the gym has).
    static let height = Size.thumbnail + Space.xxxl
    /// The narrowest plate; a plate grows wider when its label needs it (large text).
    static let width = Space.xl
    /// The lightest plates are this share of the tallest, so a 2.5 still reads as a plate (a maths constant).
    static let minHeightShare: Double = 0.38
    /// How plate height grows with weight; 1 is straight with weight, so a 10 is clearly shorter than a 45 (a maths
    /// constant).
    static let heightCurve: Double = 1
    static let gap = Space.xxs
    static let corner = Space.xs
    static let labelInset = Space.xxs
    /// The sleeve the plates slide onto, the bar between the collars, and the collars.
    static let sleeve = Space.sm
    static let shaft = Space.xs
    static let collarWidth = Space.xs + Space.xxs
    static let collarHeight = Space.xxl + Space.xs
    /// How much bare sleeve shows past the outermost plate.
    static let bareSleeve = Space.lg
}

/// The bar (or one sleeve of a plate-loaded machine) loaded with the editor's weight, heaviest plates first, each
/// plate labelled with its weight. One plain line under it: "45 bar + 105 a side". When the whole bar does not fit
/// (many plates, large text), it draws one side.
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
            // Both lines keep their height when the second is empty, so the stepper under the card doesn't move.
            VStack(spacing: Space.xxs) {
                Text(verbatim: WorkoutText.platesSummary(loading))
                    .font(theme.font(.subheadline).monospacedDigit())
                    .foregroundStyle(theme.palette.textSecondary)
                Text(verbatim: loading.isExact ? " " : WorkoutText.closestLoad(Weight(loading.loaded, unit)))
                    .font(theme.font(.footnote).monospacedDigit())
                    .foregroundStyle(theme.palette.textSecondary)
                    .opacity(loading.isExact ? 0 : 1)
                    .accessibilityHidden(loading.isExact)
            }
            .multilineTextAlignment(.center)
            .padding(.horizontal, Space.md)
            .accessibilityElement(children: .combine)
        }
        .padding(.vertical, Space.md)
        .frame(maxWidth: .infinity)
        .background(theme.palette.canvas, in: .rect(cornerRadius: Radius.md))
        .koboAnimation(.state, value: loading)
    }

    @ViewBuilder private var drawing: some View {
        switch loading.holder {
        case .bar(let bar):
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 0) {
                    // The left sleeve is the right one mirrored; its labels flip back so they read normally.
                    sleeve(mirrored: true).scaleEffect(x: -1)
                    shaft(label: WorkoutText.barLabel(bar, unit: unit))
                    sleeve()
                }
                oneSide
            }
        case .sleeve:
            oneSide
        }
    }

    /// One sleeve from its collar: a plate-loaded machine, or a bar too loaded to draw whole.
    private var oneSide: some View {
        HStack(spacing: 0) {
            Capsule()
                .fill(theme.palette.textTertiary)
                .frame(width: PlateDrawing.collarWidth, height: PlateDrawing.height)
            sleeve()
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
    private func sleeve(mirrored: Bool = false) -> some View {
        HStack(spacing: PlateDrawing.gap) {
            Capsule()
                .fill(theme.palette.textSecondary)
                .frame(width: PlateDrawing.collarWidth, height: PlateDrawing.collarHeight)
            ForEach(Array(loading.perSide.enumerated()), id: \.offset) { _, size in
                plate(size, mirrored: mirrored)
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

    /// A plate with its weight written inside it; the label sets the width when it needs more than the plate.
    private func plate(_ size: Double, mirrored: Bool) -> some View {
        Text(verbatim: WorkoutText.plateLabel(size))
            .font(theme.font(.caption).weight(.bold).monospacedDigit())
            .foregroundStyle(theme.palette.surface)
            .lineLimit(1)
            .fixedSize()
            .scaleEffect(x: mirrored ? -1 : 1)
            .padding(.horizontal, PlateDrawing.labelInset)
            .frame(minWidth: PlateDrawing.width)
            .frame(height: height(of: size))
            .background(theme.palette.textPrimary, in: .rect(cornerRadius: PlateDrawing.corner))
    }

    private func height(of size: Double) -> CGFloat {
        let share = loading.heaviest > 0 ? min(1, max(0, size / loading.heaviest)) : 1
        let grow = pow(share, PlateDrawing.heightCurve)
        return PlateDrawing.height * (PlateDrawing.minHeightShare + (1 - PlateDrawing.minHeightShare) * grow)
    }
}
