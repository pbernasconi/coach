import KoboComponents
import KoboTokens
import SwiftUI

/// Live demos for the Fields section: text, secure, multi-line, number and code entry. Dates, the calendar, copy
/// controls and the keyboard bar live in `FieldsValueDemo`.
struct FieldsDemo: View {
    let component: CatalogComponent
    @State private var title = ""
    @State private var email = "someone@example"
    @State private var secret = ""
    @State private var notes = ""
    @State private var estimate: Double? = 1.5
    @State private var count = 3.0
    @State private var code = "12"

    var body: some View {
        switch component {
        case .textField:
            VStack(spacing: Space.lg) {
                KoboTextField("Task", text: $title, prompt: "What needs doing?", helper: "Keep it short", clearable: true)
                KoboTextField("Email", text: $email, error: .message("Enter a full email address"))
                KoboTextField(verbatim: "Estimate", text: .constant("2"), unit: "h") {
                    Image(systemName: "clock").accessibilityHidden(true)
                }
            }
        case .secureField:
            KoboSecureField(
                "New password",
                text: $secret,
                content: .newPassword,
                rules: [.minimumLength(12), .mixedCase, .digit, .symbol]
            )
        case .textArea:
            KoboTextArea("Notes", text: $notes, prompt: "Anything to remember?", lines: 3...6, characterLimit: 200)
        case .fieldGroup:
            FieldGroup("New task", helper: "Only you can see these") {
                KoboTextField("Title", text: $title, prompt: "Water the plants")
                KoboTextArea("Notes", text: $notes)
            }
        case .numberEntry:
            VStack(spacing: Space.xl) {
                NumberEntry(
                    "Estimate",
                    value: $estimate,
                    in: 0...40,
                    decimalPlaces: 1,
                    step: 0.5,
                    unit: "h",
                    caption: "Most tasks take under 2 h"
                )
                NumberEntry(verbatim: "Copies", value: $count, in: 1...20, step: 1, input: .keypad)
            }
        case .codeInput:
            VStack(spacing: Space.xl) {
                CodeInput("Verification code", code: $code)
                CodeInput("Invite code", code: .constant(""), length: 6, mode: .alphanumeric)
            }
        default: FieldsValueDemo(component: component)
        }
    }
}
