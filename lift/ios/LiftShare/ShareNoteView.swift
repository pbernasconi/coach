import SwiftUI

/// The Share extension's sheet: the start of the shared note and Send, which hands it to Lift's Import from Notes.
/// Nothing is written to Lift's data here; Import shows the review step first.
struct ShareNoteView: View {
    @Environment(\.colorScheme) private var colorScheme
    let model: ShareNoteModel

    var body: some View {
        NavigationStack {
            content
                .padding(20)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .navigationTitle(Text("Import to Coach"))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { toolbar }
        }
        .tint(ShareColors.accentText(for: colorScheme))
        .task { await model.load() }
    }

    @ViewBuilder private var content: some View {
        switch model.step {
        case .reading:
            ProgressView()
                .frame(maxWidth: .infinity, minHeight: 120)
        case .ready(let text):
            VStack(alignment: .leading, spacing: 12) {
                Text("Coach opens this note in Import from Notes, where you check the workouts before importing them.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                ShareNotePreview(text: text)
            }
        case .sent:
            message(
                symbol: "checkmark.circle.fill",
                title: Text("Sent to Coach"),
                detail: Text("Open Lift to review the workouts and import them.")
            )
        case .noText:
            message(
                symbol: "doc.questionmark",
                title: Text("No text to import"),
                detail: Text("Share a note with your workouts from Apple Notes.")
            )
        case .unavailable:
            message(
                symbol: "exclamationmark.triangle.fill",
                title: Text("Coach could not receive the note"),
                detail: Text("Copy the note and paste it in Lift: History, then Import from Notes.")
            )
        }
    }

    @ToolbarContentBuilder private var toolbar: some ToolbarContent {
        if case .ready = model.step {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { model.close() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Send") { model.send() }
                    .fontWeight(.semibold)
            }
        } else if model.step != .reading {
            ToolbarItem(placement: .confirmationAction) {
                Button("Done") { model.close() }
            }
        }
    }

    private func message(symbol: String, title: Text, detail: Text) -> some View {
        VStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.largeTitle)
                .foregroundStyle(ShareColors.accentText(for: colorScheme))
                .accessibilityHidden(true)
            title
                .font(.headline)
            detail
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .padding(.top, 24)
    }
}

/// The first lines of the note in a quiet box, with how long it is.
private struct ShareNotePreview: View {
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(verbatim: text)
                .font(.footnote.monospaced())
                .lineLimit(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            Text("^[\(lineCount) line](inflect: true)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var lineCount: Int {
        text.split(whereSeparator: \.isNewline).count
    }
}
