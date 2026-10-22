import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

extension View {
    /// The note sheet of the "How did it feel" card: a text area that starts with the note; Save sends the text.
    func workoutFeedbackComment(
        _ edit: WorkoutFeedbackEdit,
        comment: String?,
        send: @escaping (WorkoutFeedbackAction) -> Void
    ) -> some View {
        modifier(
            WorkoutCommentSheet(
                isPresented: edit.isCommentOpen,
                comment: comment,
                onClose: { send(.commentClosed) },
                onSave: { send(.commentSaved($0)) }
            )
        )
    }
}

private struct WorkoutCommentSheet: ViewModifier {
    let isPresented: Bool
    let comment: String?
    let onClose: () -> Void
    let onSave: (String) -> Void
    @State private var draft = ""
    @FocusState private var isFocused: Bool

    func body(content: Content) -> some View {
        content
            .inputModal(
                isPresented: .action(isPresented) { if !$0 { onClose() } },
                title: "Note",
                hasChanges: draft != (comment ?? ""),
                onSave: { onSave(draft) }
            ) {
                KoboTextArea("Note", text: $draft, prompt: "Legs heavy, slept badly…", lines: 3...8, characterLimit: 2_000)
                    .focused($isFocused)
                    .onAppear { isFocused = true }
            }
            .onChange(of: isPresented, initial: true) { _, open in
                if open { draft = comment ?? "" }
            }
    }
}
