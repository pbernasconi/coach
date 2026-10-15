import KoboTokens
import SwiftUI

/// The standard Kobo sheet: a `SheetHeader` on top, scrolling content, an optional pinned footer, and the shared
/// presentation chrome (detents, grabber, background, `Radius.sheet` corners). Present it with `.koboSheet`, or
/// put it at the root of any `.sheet` content.
///
///     let save = SheetHeaderAction(accessibilityLabel: "Save", action: save)
///     KoboSheet("Edit trip", hasChanges: draft != saved, confirm: save) {
///         StepperField("Distance", value: $draft.distance, in: 0...500, step: 2.5, unit: "km")
///     } footer: {
///         Button("Delete trip", role: .destructive, action: delete)
///     }
///
/// With `hasChanges`, the swipe down is locked and the close button asks "Discard changes?" first.
/// `.fitted` (the default) sizes the sheet to everything it shows; content taller than the screen scrolls.
public struct KoboSheet<Content: View, Footer: View>: View {
    @Environment(\.dismiss) private var dismiss
    @State private var measurements = SheetMeasurements()
    @State private var closeGuard = UnsavedChangesGuard()
    private let title: OverlayTitle
    private let detents: [SheetDetent]
    private let grabber: Visibility
    private let background: SheetBackground
    private let hasChanges: Bool
    private let confirm: SheetHeaderAction?
    private let onClose: (() -> Void)?
    private let content: Content
    private let footer: Footer

    /// - Parameters:
    ///   - grabber: `.automatic` lets the system show it when there is more than one detent.
    ///   - hasChanges: true while there are unsaved edits; locks the swipe and makes close ask first.
    ///   - confirm: the prominent checkmark in the header ("Save").
    ///   - onClose: what the close button does once allowed; `nil` dismisses the sheet.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        detents: [SheetDetent] = [.fitted],
        grabber: Visibility = .automatic,
        background: SheetBackground = .automatic,
        hasChanges: Bool = false,
        confirm: SheetHeaderAction? = nil,
        onClose: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content,
        @ViewBuilder footer: () -> Footer
    ) {
        self.init(
            title: .localized(title, subtitle: subtitle),
            detents: detents,
            grabber: grabber,
            background: background,
            hasChanges: hasChanges,
            confirm: confirm,
            onClose: onClose,
            content: content(),
            footer: footer()
        )
    }

    /// A sheet whose title and subtitle are shown as is (a record's name).
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        detents: [SheetDetent] = [.fitted],
        grabber: Visibility = .automatic,
        background: SheetBackground = .automatic,
        hasChanges: Bool = false,
        confirm: SheetHeaderAction? = nil,
        onClose: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content,
        @ViewBuilder footer: () -> Footer
    ) {
        self.init(
            title: .verbatim(title, subtitle: subtitle),
            detents: detents,
            grabber: grabber,
            background: background,
            hasChanges: hasChanges,
            confirm: confirm,
            onClose: onClose,
            content: content(),
            footer: footer()
        )
    }

    /// The one place every initialiser lands.
    init(
        title: OverlayTitle,
        detents: [SheetDetent],
        grabber: Visibility,
        background: SheetBackground,
        hasChanges: Bool,
        confirm: SheetHeaderAction?,
        onClose: (() -> Void)?,
        content: Content,
        footer: Footer
    ) {
        self.title = title
        self.detents = detents
        self.grabber = grabber
        self.background = background
        self.hasChanges = hasChanges
        self.confirm = confirm
        self.onClose = onClose
        self.content = content
        self.footer = footer
    }

    public var body: some View {
        VStack(spacing: 0) {
            OverlaySheetHeader(title: title, onClose: requestClose, confirm: confirm)
                .overlayReportsHeight { measurements.header = $0 }
            FittedHeightLayout {
                ScrollView {
                    VStack(alignment: .leading, spacing: Space.lg) { content }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .pageGutter()
                        // A sheet holds forms and pickers: its sections are grouped cards on the keyline.
                        .listSectionStyle(.grouped)
                        .padding(.top, Space.sm)
                        .padding(.bottom, Space.xxl)
                        .overlayReportsHeight { measurements.content = $0 }
                }
                .scrollBounceBehavior(.basedOnSize)
                .scrollDismissesKeyboard(.interactively)
            }
            if Footer.self != EmptyView.self {
                PinnedFooter { footer }
                    .overlayReportsHeight { measurements.footer = $0 }
            }
        }
        .frame(maxHeight: .infinity, alignment: .top)
        .modifier(
            SheetChrome(
                detents: detents,
                fittedHeight: measurements.fittedHeight,
                grabber: grabber,
                background: background,
                isDismissDisabled: hasChanges
            )
        )
        .discardChangesDialog(isPresented: $closeGuard.isConfirmingDiscard) {
            closeGuard.confirmationAnswered()
            close()
        }
    }

    private func requestClose() {
        if closeGuard.requestClose(hasChanges: hasChanges) { close() }
    }

    private func close() {
        if let onClose { onClose() } else { dismiss() }
    }
}

extension KoboSheet where Footer == EmptyView {
    /// A sheet with no footer.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        detents: [SheetDetent] = [.fitted],
        grabber: Visibility = .automatic,
        background: SheetBackground = .automatic,
        hasChanges: Bool = false,
        confirm: SheetHeaderAction? = nil,
        onClose: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.init(
            title: .localized(title, subtitle: subtitle),
            detents: detents,
            grabber: grabber,
            background: background,
            hasChanges: hasChanges,
            confirm: confirm,
            onClose: onClose,
            content: content(),
            footer: EmptyView()
        )
    }

    /// A sheet with no footer, whose title and subtitle are shown as is.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        detents: [SheetDetent] = [.fitted],
        grabber: Visibility = .automatic,
        background: SheetBackground = .automatic,
        hasChanges: Bool = false,
        confirm: SheetHeaderAction? = nil,
        onClose: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.init(
            title: .verbatim(title, subtitle: subtitle),
            detents: detents,
            grabber: grabber,
            background: background,
            hasChanges: hasChanges,
            confirm: confirm,
            onClose: onClose,
            content: content(),
            footer: EmptyView()
        )
    }
}
