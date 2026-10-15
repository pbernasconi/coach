import KoboTokens
import SwiftUI

/// An explicit copy button for a value the user moves to another app (a setup key, a referral link): the copy glyph
/// in the accent ink inside a 44pt target. It copies through `tapToCopy`, so the feedback is the same everywhere.
/// VoiceOver reads "Copy setup key".
///
///     HStack { Text(verbatim: key); CopyButton(value: key, what: "setup key") }
public struct CopyButton: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var iconSize = Size.iconMd
    private let value: String
    private let what: LocalizedStringResource?

    /// - Parameter what: names the value for VoiceOver and the confirmation ("setup key").
    public init(value: String, what: LocalizedStringResource? = nil) {
        self.value = value
        self.what = what
    }

    public var body: some View {
        Image(systemName: "doc.on.doc")
            .font(.system(size: iconSize))
            .foregroundStyle(theme.palette.accentText)
            .frame(minWidth: Size.minTouch, minHeight: Size.minTouch)
            .contentShape(Rectangle())
            // The element and its label come first, so the copy button carries this label and the named action.
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(CopySpeech.actionName(what: what.map { String(localized: $0) }))
            .tapToCopy(value, what: what)
    }
}

#if DEBUG
    private struct CopyButtonGallery: View {
        @Environment(\.koboTheme) private var theme

        var body: some View {
            VStack(alignment: .leading, spacing: Space.lg) {
                HStack {
                    Text(verbatim: "JBSWY3DPEHPK3PXP").fieldMonospacedDigits()
                    CopyButton(value: "JBSWY3DPEHPK3PXP", what: "setup key")
                }
                HStack {
                    Text(verbatim: "kobo.app/r/7Q2PX")
                    CopyButton(value: "https://kobo.app/r/7Q2PX")
                }
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Copy button") { CopyButtonGallery() }
    #Preview("Copy button · dark") { CopyButtonGallery().preferredColorScheme(.dark) }
    #Preview("Copy button · AX3") { CopyButtonGallery().dynamicTypeSize(.accessibility3) }
#endif
