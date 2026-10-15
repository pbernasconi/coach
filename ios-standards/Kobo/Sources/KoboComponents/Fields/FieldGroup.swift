import KoboTokens
import SwiftUI

/// Stacks fields with the shared form spacing, under an optional title and over an optional helper or error line.
/// It also gives a control that is not a text field (a `ChipGroup`, a `SegmentedPicker`) the same label and line as
/// a `KoboTextField`, so it sits in a form like every other field. The title is a header for VoiceOver.
///
///     FieldGroup("Sign in") {
///         KoboTextField("Email", text: $email)
///         KoboSecureField("Password", text: $password)
///     }
///     FieldGroup("Equipment", helper: "Pick everything you have", error: equipmentError) {
///         ChipGroup("Equipment", options: options, selection: $equipment)
///     }
public struct FieldGroup<Content: View>: View {
    @Environment(\.koboTheme) private var theme
    private let title: Text?
    private let helper: Text?
    private let error: FieldError
    private let content: Content

    /// A titled group. `error` shows at once: a group has no typing to wait for.
    public init(
        _ title: LocalizedStringKey,
        helper: LocalizedStringKey? = nil,
        error: FieldError = .none,
        @ViewBuilder content: () -> Content
    ) {
        self.init(title: Text(title), helper: helper.map { Text($0) }, error: error, content: content())
    }

    /// A titled group whose copy is shown as is.
    public init(
        verbatim title: String,
        helper: String? = nil,
        error: FieldError = .none,
        @ViewBuilder content: () -> Content
    ) {
        self.init(
            title: Text(verbatim: title),
            helper: helper.map { Text(verbatim: $0) },
            error: error,
            content: content()
        )
    }

    /// An untitled stack of fields with the shared spacing.
    public init(@ViewBuilder content: () -> Content) {
        self.init(title: nil, helper: nil, error: .none, content: content())
    }

    private init(title: Text?, helper: Text?, error: FieldError, content: Content) {
        self.title = title
        self.helper = helper
        self.error = error
        self.content = content
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let title {
                title
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                    .padding(.bottom, Space.md)
                    .accessibilityAddTraits(.isHeader)
            }
            VStack(alignment: .leading, spacing: Space.lg) { content }
            FieldLine(helper: helper, content: FieldLineContent(hasHelper: helper != nil, error: error))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
    }
}

#if DEBUG
    private struct FieldGroupGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var email = ""
        @State private var password = ""
        @State private var plan = "monthly"

        var body: some View {
            ScrollView {
                VStack(spacing: Space.xxl) {
                    FieldGroup("Sign in", helper: "We never share your email") {
                        KoboTextField("Email", text: $email, prompt: "name@example.com")
                        KoboSecureField("Password", text: $password)
                    }
                    FieldGroup("Plan", error: .message("Pick a plan to continue")) {
                        SegmentedPicker(
                            "Plan",
                            selection: $plan,
                            options: [ChoiceOption("monthly", title: "Monthly"), ChoiceOption("yearly", title: "Yearly")]
                        )
                    }
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Field group") { FieldGroupGallery() }
    #Preview("Field group · dark") { FieldGroupGallery().preferredColorScheme(.dark) }
    #Preview("Field group · AX3") { FieldGroupGallery().dynamicTypeSize(.accessibility3) }
#endif
