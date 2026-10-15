import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// Muscles (primary and secondary tags) and equipment.
struct ExerciseFactsSections: View {
    @Environment(\.koboTheme) private var theme
    let item: ExerciseDetailItem

    var body: some View {
        CardSection("Muscles") {
            tags("Primary", item.primary, style: .tonal)
            if !item.secondary.isEmpty {
                tags("Secondary", item.secondary, style: .outline)
            }
        }
        CardSection("Equipment") {
            BodyText(item.equipment)
        }
    }

    private func tags(_ title: LocalizedStringKey, _ muscles: [String], style: KoboTag.Style) -> some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text(title)
                .font(theme.font(.footnote).weight(.semibold))
                .foregroundStyle(theme.palette.textSecondary)
            FlowLayout {
                // Fixed labels from the library; the offset is a stable identity for them.
                ForEach(Array(muscles.enumerated()), id: \.offset) { _, muscle in
                    KoboTag(verbatim: muscle, tone: .accent, style: style)
                }
            }
        }
    }
}

/// Setup, numbered steps, form cues, common mistakes and breathing from the exercise's guide.
struct ExerciseGuideSections: View {
    let guide: ExerciseGuide

    var body: some View {
        CardSection("Setup") {
            GuideList(lines: guide.setup, marker: .symbol("circle.fill", .neutral))
        }
        CardSection("Steps") {
            GuideList(lines: guide.steps, marker: .number)
        }
        CardSection("Form cues") {
            GuideList(lines: guide.cues, marker: .symbol("checkmark.circle.fill", .success))
        }
        CardSection("Common mistakes") {
            GuideList(lines: guide.mistakes, marker: .symbol("xmark.circle.fill", .danger))
        }
        if let breathing = guide.breathing {
            CardSection("Breathing") {
                BodyText(breathing)
            }
        }
    }
}

/// A list of guide lines, each behind a number or a symbol.
private struct GuideList: View {
    enum Marker {
        case number
        case symbol(String, Tone)
    }

    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .footnote) private var badge: CGFloat = 24
    let lines: [String]
    let marker: Marker

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            // Fixed text from the guide; the offset is a stable identity and the step number.
            ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
                HStack(alignment: .firstTextBaseline, spacing: Space.md) {
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
                .font(theme.font(.footnote).weight(.bold).monospacedDigit())
                .foregroundStyle(theme.palette.onAccent)
                .frame(minWidth: badge, minHeight: badge)
                .background(theme.palette.accent, in: Circle())
                .accessibilityLabel(Text("Step \(number)"))
        case .symbol(let name, let tone):
            Image(systemName: name)
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.status(tone).ink)
                .frame(minWidth: badge)
                .accessibilityHidden(true)
        }
    }
}

/// Body text that wraps instead of truncating.
struct BodyText: View {
    @Environment(\.koboTheme) private var theme
    private let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(verbatim: text)
            .font(theme.font(.body))
            .foregroundStyle(theme.palette.textPrimary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
    }
}
