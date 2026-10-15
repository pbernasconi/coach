import KoboTokens
import SwiftUI

/// The presentation settings every Kobo sheet shares, applied to the root of the sheet's content: the detents (a
/// fitted detent uses the caller's measured height), the grabber, the background, `Radius.sheet` corners, and the
/// swipe lock while there are unsaved changes.
struct SheetChrome: ViewModifier {
    @Environment(\.koboTheme) private var theme
    let detents: [SheetDetent]
    let fittedHeight: CGFloat?
    let grabber: Visibility
    let background: SheetBackground
    let isDismissDisabled: Bool

    func body(content: Content) -> some View {
        let resolved = SheetSizing.resolved(detents, fittedHeight: fittedHeight)
        content
            .presentationDetents(Set(resolved.map(\.presentationDetent)))
            .presentationDragIndicator(grabber)
            .presentationCornerRadius(Radius.sheet)
            .modifier(SheetBackgroundFill(color: backgroundColor))
            .interactiveDismissDisabled(isDismissDisabled)
    }

    /// `nil` keeps the system sheet material (Liquid Glass at partial heights).
    private var backgroundColor: Color? {
        switch background {
        case .automatic: theme.surfaceStyle == .solid ? theme.palette.surface : nil
        case .surface: theme.palette.surface
        case .canvas: theme.palette.canvas
        }
    }
}

private struct SheetBackgroundFill: ViewModifier {
    let color: Color?

    func body(content: Content) -> some View {
        if let color {
            content.presentationBackground(color)
        } else {
            content
        }
    }
}

extension SheetSizing.Resolved {
    nonisolated var presentationDetent: PresentationDetent {
        switch self {
        case .medium: .medium
        case .large: .large
        case .fraction(let share): .fraction(share)
        case .height(let points): .height(points)
        }
    }
}

extension View {
    /// The "Discard changes?" confirmation of a sheet or page with unsaved edits. Same shape as `koboConfirm`
    /// (which lives in KoboPatterns): a question, a consequence, a destructive verb and "Keep editing".
    func discardChangesDialog(isPresented: Binding<Bool>, onDiscard: @escaping () -> Void) -> some View {
        confirmationDialog(
            Text("Discard changes?", bundle: .module),
            isPresented: isPresented,
            titleVisibility: .visible
        ) {
            Button(role: .destructive, action: onDiscard) {
                Text("Discard", bundle: .module)
            }
            Button(role: .cancel) {
            } label: {
                Text("Keep editing", bundle: .module)
            }
        } message: {
            Text("Your edits will be lost.", bundle: .module)
        }
    }
}
