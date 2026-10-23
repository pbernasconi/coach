import KoboComponents
import KoboTokens
import SwiftUI

/// The `.sheet` style of `koboConfirm`: a sheet as tall as its content, with the question and its consequence
/// centred and two full-width buttons stacked below, the confirm verb on top and cancel under it.
struct ConfirmationSheet: View {
    @Environment(\.koboTheme) private var theme
    let action: ConfirmationAction
    @Binding var isPresented: Bool
    @State private var height: CGFloat = 0

    var body: some View {
        VStack(spacing: Space.lg) {
            VStack(spacing: Space.xs) {
                action.title
                    .font(theme.font(.title2))
                    .foregroundStyle(theme.palette.textPrimary)
                if let message = action.message {
                    message
                        .font(theme.font(.body))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            VStack(spacing: Space.sm) {
                Button(role: action.buttonRole) {
                    action.perform()
                    isPresented = false
                } label: {
                    action.confirmLabel
                }
                .buttonStyle(.kobo(action.role == .destructive ? .destructive : .primary, width: .full))
                Button {
                    isPresented = false
                } label: {
                    action.cancelLabel ?? Text("Cancel", bundle: .module)
                }
                .buttonStyle(.kobo(.secondary, width: .full))
            }
        }
        .padding(.horizontal, Space.lg)
        .padding(.top, Space.xl)
        .padding(.bottom, Space.md)
        .onGeometryChange(for: CGFloat.self) { proxy in
            proxy.size.height
        } action: { newHeight in
            height = newHeight
        }
        .presentationDetents([.height(max(height, Size.minTouch * 4))])
        .presentationDragIndicator(.hidden)
        .presentationCornerRadius(Radius.sheet)
        .presentationBackground(theme.palette.surface)
    }
}

#if DEBUG
    private struct ConfirmationSheetPreview: View {
        @State private var isPresented = true

        var body: some View {
            Button("Close the order") { isPresented = true }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.system.palette.canvas)
                .koboConfirm(
                    isPresented: $isPresented,
                    ConfirmationAction(
                        title: "Close this order?",
                        message: "2 items not packed yet. You can still pack them after.",
                        confirmLabel: "Close order",
                        cancelLabel: "Keep going",
                        perform: {}
                    ),
                    style: .sheet
                )
        }
    }

    #Preview("Light") { ConfirmationSheetPreview() }
    #Preview("Dark") { ConfirmationSheetPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { ConfirmationSheetPreview().dynamicTypeSize(.accessibility3) }
#endif
