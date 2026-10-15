import KoboTokens
import SwiftUI

/// The title and optional subtitle of a sheet or page, kept as the caller wrote them: localized keys or verbatim
/// strings, so the Kobo `SheetHeader` and the toolbar get the right `Text`.
enum OverlayTitle {
    case localized(LocalizedStringKey, subtitle: LocalizedStringKey?)
    case verbatim(String, subtitle: String?)

    var title: Text {
        switch self {
        case .localized(let key, _): Text(key)
        case .verbatim(let string, _): Text(verbatim: string)
        }
    }

    var subtitle: Text? {
        switch self {
        case .localized(_, let key): key.map { Text($0) }
        case .verbatim(_, let string): string.map { Text(verbatim: $0) }
        }
    }
}

/// A Kobo `SheetHeader` for an `OverlayTitle`.
struct OverlaySheetHeader: View {
    let title: OverlayTitle
    let onClose: () -> Void
    let confirm: SheetHeaderAction?

    var body: some View {
        switch title {
        case .localized(let key, let subtitle):
            SheetHeader(key, subtitle: subtitle, onClose: onClose, confirm: confirm)
        case .verbatim(let string, let subtitle):
            SheetHeader(verbatim: string, subtitle: subtitle, onClose: onClose, confirm: confirm)
        }
    }
}
