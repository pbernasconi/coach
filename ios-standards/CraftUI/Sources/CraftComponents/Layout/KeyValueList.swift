import CraftTokens
import SwiftUI

/// One entry of a `KeyValueList`.
public nonisolated struct KeyValueItem: Identifiable, Hashable, Sendable {
    public var id: String
    public var key: String
    public var value: String
    public var valueTone: Tone?

    /// `id` defaults to `key`; pass one when keys repeat.
    public init(_ key: String, value: String, valueTone: Tone? = nil, id: String? = nil) {
        self.id = id ?? key
        self.key = key
        self.value = value
        self.valueTone = valueTone
    }
}

/// A grouped list of `KeyValueRow`s, for summaries and detail screens.
///
///     KeyValueList("Summary", items: [KeyValueItem("Duration", value: "1 h 12 min")])
public struct KeyValueList: View {
    private let title: String?
    private let footer: String?
    private let items: [KeyValueItem]

    public init(_ title: String? = nil, items: [KeyValueItem], footer: String? = nil) {
        self.title = title
        self.items = items
        self.footer = footer
    }

    public var body: some View {
        ListSection(title, footer: footer) {
            ForEach(items) { item in
                KeyValueRow(item.key, value: item.value, valueTone: item.valueTone)
            }
        }
    }
}

#if DEBUG
private struct KeyValueListPreview: View {
    private let items = [
        KeyValueItem("Duration", value: "1 h 12 min"),
        KeyValueItem("Sets", value: "18"),
        KeyValueItem("Volume", value: "4,200 kg"),
        KeyValueItem("Personal records", value: "2", valueTone: .success),
    ]

    var body: some View {
        ScrollView {
            KeyValueList("Summary", items: items, footer: "Volume counts working sets only.")
                .padding(Space.gutter)
        }
        .background(Theme.system.palette.canvas)
    }
}

#Preview("Light") { KeyValueListPreview() }
#Preview("Dark") { KeyValueListPreview().preferredColorScheme(.dark) }
#Preview("AX3") { KeyValueListPreview().dynamicTypeSize(.accessibility3) }
#endif
