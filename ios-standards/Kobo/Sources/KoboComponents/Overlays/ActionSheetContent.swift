import KoboTokens
import SwiftUI

/// The body of a `koboActionSheet`: an optional title and message, then one full-width row per action, with the
/// destructive actions in their own group at the end. Each row is a real `Button` with a leading icon column.
struct ActionSheetContent: View {
    @Environment(\.koboTheme) private var theme
    @State private var measurements = SheetMeasurements()
    @State private var selections = 0
    let title: Text?
    let message: Text?
    let items: [ActionSheetItem]
    let select: (ActionSheetItem) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.xs) {
                if title != nil || message != nil { heading }
                let groups = ActionSheetRules.grouped(items) { $0.role }
                rows(groups.standard)
                if !groups.standard.isEmpty && !groups.destructive.isEmpty {
                    Separator().padding(.vertical, Space.xs)
                }
                rows(groups.destructive)
            }
            .padding(.horizontal, Space.sm)
            .padding(.top, Space.xxl)
            .padding(.bottom, Space.lg)
            .overlayReportsHeight { measurements.content = $0 }
        }
        .scrollBounceBehavior(.basedOnSize)
        .modifier(
            SheetChrome(
                detents: [.fitted],
                fittedHeight: measurements.fittedHeight,
                grabber: .visible,
                background: .automatic,
                isDismissDisabled: false
            )
        )
        .koboFeedback(.selection, trigger: selections)
        .onAppear {
            assert(ActionSheetRules.duplicateIDs(items.map(\.id)).isEmpty, "Action sheet items need unique ids")
        }
    }

    private var heading: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            if let title {
                title
                    .font(theme.font(.subheadline).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                    .accessibilityAddTraits(.isHeader)
            }
            if let message {
                message
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Space.md)
        .padding(.bottom, Space.sm)
    }

    private func rows(_ group: [ActionSheetItem]) -> some View {
        let showsIcons = ActionSheetRules.showsIconColumn(items.map(\.systemImage))
        return ForEach(group) { item in
            Button(role: item.buttonRole) {
                selections += 1
                select(item)
            } label: {
                ActionSheetRowLabel(item: item, showsIcon: showsIcons)
            }
            .buttonStyle(ActionSheetRowStyle())
            .disabled(!item.isEnabled)
        }
    }
}

extension ActionSheetItem {
    fileprivate var buttonRole: ButtonRole? { role == .destructive ? ButtonRole.destructive : nil }
}

/// One row: the icon column (kept empty for an item without an icon, so labels align), then the title.
private struct ActionSheetRowLabel: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    @ScaledMetric(relativeTo: .body) private var iconColumn = Size.iconLg
    let item: ActionSheetItem
    let showsIcon: Bool

    var body: some View {
        HStack(spacing: Space.md) {
            if showsIcon {
                Group {
                    if let systemImage = item.systemImage {
                        Image(systemName: systemImage).font(theme.font(.body))
                    }
                }
                .frame(width: iconColumn)
                .accessibilityHidden(true)
            }
            item.title
                .font(theme.font(.body))
                .multilineTextAlignment(.leading)
            Spacer(minLength: 0)
        }
        .foregroundStyle(ink)
    }

    private var ink: Color {
        guard isEnabled else { return theme.palette.textTertiary }
        return item.role == .destructive ? theme.palette.danger.ink : theme.palette.textPrimary
    }
}

/// The press fill of a row: a rounded veil, in on `Motion.instant`.
private struct ActionSheetRowStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        ActionSheetRowPressLook(label: configuration.label, isPressed: configuration.isPressed)
    }
}

private struct ActionSheetRowPressLook<Label: View>: View {
    @Environment(\.koboTheme) private var theme
    let label: Label
    let isPressed: Bool

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
        label
            .padding(.horizontal, Space.md)
            .padding(.vertical, Space.md)
            .frame(maxWidth: .infinity, minHeight: Size.rowMinHeight, alignment: .leading)
            .background(shape.fill(theme.palette.pressVeil(isPressed)))
            .contentShape(shape)
            .koboAnimation(.instant, value: isPressed)
    }
}
