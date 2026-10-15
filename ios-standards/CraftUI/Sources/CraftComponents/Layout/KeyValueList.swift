import CraftTokens
import Foundation
import SwiftUI

/// One entry of a `KeyValueList`.
///
/// The key is stored resolved, as `String`, so the item stays `Hashable` and `Sendable`: the localized initialiser
/// takes a `LocalizedStringResource` and resolves it from the app's bundle; runtime keys use `init(verbatim:)`.
public nonisolated struct KeyValueItem: Identifiable, Hashable, Sendable {
    public var id: String
    public var key: String
    public var value: String
    public var valueTone: Tone?

    /// A localized key and a value shown as is. `id` defaults to the key's catalog key; pass one when keys repeat.
    public init(_ key: LocalizedStringResource, value: String, valueTone: Tone? = nil, id: String? = nil) {
        self.init(verbatim: String(localized: key), value: value, valueTone: valueTone, id: id ?? key.key)
    }

    /// A key and a value both shown as is. `id` defaults to `key`; pass one when keys repeat.
    public init(verbatim key: String, value: String, valueTone: Tone? = nil, id: String? = nil) {
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
    private let title: Text?
    private let footer: Text?
    private let items: [KeyValueItem]

    /// A list with an optional localized title and footer.
    public init(_ title: LocalizedStringKey? = nil, items: [KeyValueItem], footer: LocalizedStringKey? = nil) {
        self.title = title.map { Text($0) }
        self.items = items
        self.footer = footer.map { Text($0) }
    }

    /// A list whose title and footer are shown as is (user data).
    public init(verbatim title: String, items: [KeyValueItem], footer: String? = nil) {
        self.title = Text(verbatim: title)
        self.items = items
        self.footer = footer.map { Text(verbatim: $0) }
    }

    public var body: some View {
        ListSection(title: title, footer: footer) {
            ForEach(items) { item in
                KeyValueRow(verbatim: item.key, value: item.value, valueTone: item.valueTone)
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
