import KoboTokens
import SwiftUI

// `KoboTextField` initialisers whose copy is shown as is (user-defined field names, runtime units), one per slot shape.
extension KoboTextField {
    /// A field with leading and trailing slots and copy shown as is.
    public init(
        verbatim label: String,
        text: Binding<String>,
        prompt: String? = nil,
        helper: String? = nil,
        unit: String? = nil,
        error: FieldError = .none,
        clearable: Bool = false,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.init(
            copy: FieldCopy(verbatim: label, prompt: prompt, helper: helper, unit: unit),
            text: text,
            error: error,
            clearable: clearable,
            leading: leading(),
            trailing: trailing()
        )
    }
}

extension KoboTextField where Leading == EmptyView {
    /// A field with a trailing slot and copy shown as is.
    public init(
        verbatim label: String,
        text: Binding<String>,
        prompt: String? = nil,
        helper: String? = nil,
        unit: String? = nil,
        error: FieldError = .none,
        clearable: Bool = false,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.init(
            copy: FieldCopy(verbatim: label, prompt: prompt, helper: helper, unit: unit),
            text: text,
            error: error,
            clearable: clearable,
            leading: EmptyView(),
            trailing: trailing()
        )
    }
}

extension KoboTextField where Leading == EmptyView, Trailing == EmptyView {
    /// A plain field with copy shown as is.
    public init(
        verbatim label: String,
        text: Binding<String>,
        prompt: String? = nil,
        helper: String? = nil,
        unit: String? = nil,
        error: FieldError = .none,
        clearable: Bool = false
    ) {
        self.init(
            copy: FieldCopy(verbatim: label, prompt: prompt, helper: helper, unit: unit),
            text: text,
            error: error,
            clearable: clearable,
            leading: EmptyView(),
            trailing: EmptyView()
        )
    }
}

#if DEBUG
    private struct KoboTextFieldGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var email = "sam@example"
        @State private var name = ""
        @State private var weight = "182.5"
        @State private var member = "0042 7781"
        @FocusState private var focus: Int?

        var body: some View {
            ScrollView {
                VStack(spacing: Space.lg) {
                    KoboTextField("Name", text: $name, prompt: "Your first name", helper: "Shown to your coach")
                        .focused(by: $focus, equals: 0)
                    KoboTextField("Email", text: $email, error: .message("Enter a full email address"), clearable: true)
                        .focused(by: $focus, equals: 1)
                    KoboTextField("Body weight", text: $weight, unit: "lb")
                    KoboTextField("Member number", text: $member) {
                        Image(systemName: "person.text.rectangle").accessibilityHidden(true)
                    } trailing: {
                        Image(systemName: "checkmark.seal.fill").accessibilityHidden(true)
                    }
                    .fieldMonospacedDigits()
                    KoboTextField(verbatim: "Locked", text: .constant("Can't edit")).disabled(true)
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Text field") { KoboTextFieldGallery() }
    #Preview("Text field · dark, Amber") { KoboTextFieldGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Text field · AX3") { KoboTextFieldGallery().dynamicTypeSize(.accessibility3) }
#endif
