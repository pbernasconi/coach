import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// Setup, numbered steps, form cues, common mistakes and breathing from the exercise's guide, as parts of the flat
/// "How to" section.
struct ExerciseGuideSections: View {
    let guide: ExerciseGuide

    var body: some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            GuidePart("Setup") {
                GuideList(lines: guide.setup, marker: .bullet)
            }
            GuidePart("Steps") {
                GuideList(lines: guide.steps, marker: .number)
            }
            GuidePart("Form cues") {
                GuideList(lines: guide.cues, marker: .symbol("checkmark.circle.fill", .success))
            }
            GuidePart("Common mistakes") {
                GuideList(lines: guide.mistakes, marker: .symbol("xmark.circle.fill", .danger))
            }
            if let breathing = guide.breathing {
                GuidePart("Breathing") {
                    BodyText(breathing)
                }
            }
        }
    }
}

/// One titled part of "How to", under a sub-section title (sentence case, a step below the section title).
private struct GuidePart<Content: View>: View {
    private let title: LocalizedStringKey
    private let content: Content

    init(_ title: LocalizedStringKey, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            Text(title)
                .sectionTitleStyle(.subsection)
            content
        }
    }
}

/// A list of guide lines, each behind a number, a text bullet or a status symbol. Bullets and symbols take the line's
/// own text size, so they never outweigh the words beside them.
private struct GuideList: View {
    enum Marker {
        case number
        case bullet
        case symbol(String, Tone)
    }

    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .subheadline) private var badge: CGFloat = 20
    let lines: [String]
    let marker: Marker

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            // Fixed text from the guide; the offset is a stable identity and the step number.
            ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
                HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                    markerView(number: index + 1)
                    BodyText(line)
                }
            }
        }
    }

    @ViewBuilder
    private func markerView(number: Int) -> some View {
        switch marker {
        case .number:
            Text(verbatim: "\(number)")
                .font(theme.font(.caption).weight(.bold).monospacedDigit())
                .foregroundStyle(theme.palette.onAccent)
                .frame(minWidth: badge, minHeight: badge)
                .background(theme.palette.accent, in: Circle())
                .accessibilityLabel(Text("Step \(number)"))
        case .bullet:
            Text(verbatim: "•")
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textSecondary)
                .frame(minWidth: badge)
                .accessibilityHidden(true)
        case .symbol(let name, let tone):
            Image(systemName: name)
                .font(theme.font(.subheadline))
                .imageScale(.small)
                .foregroundStyle(theme.palette.status(tone).ink)
                .frame(minWidth: badge)
                .accessibilityHidden(true)
        }
    }
}

/// Guide text that wraps instead of truncating, a step smaller than body so a guide reads as a compact reference.
struct BodyText: View {
    @Environment(\.koboTheme) private var theme
    private let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(verbatim: text)
            .font(theme.font(.subheadline))
            .foregroundStyle(theme.palette.textPrimary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
    }
}
