import SwiftUI

// `ListRow` initialisers whose title and subtitle are shown as is (exercise names, user data), one per slot shape.
extension ListRow {
    /// A static row with leading and trailing slots and a title shown as is.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        value: String? = nil,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.init(
            title: Text(verbatim: title),
            subtitle: subtitle.map { Text(verbatim: $0) },
            value: value,
            action: nil,
            leading: leading(),
            trailing: trailing()
        )
    }

    /// A tappable row with leading and trailing slots and a title shown as is.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        value: String? = nil,
        action: @escaping () -> Void,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.init(
            title: Text(verbatim: title),
            subtitle: subtitle.map { Text(verbatim: $0) },
            value: value,
            action: action,
            leading: leading(),
            trailing: trailing()
        )
    }
}

extension ListRow where Trailing == EmptyView {
    /// A static row with a leading slot and a title shown as is.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        value: String? = nil,
        @ViewBuilder leading: () -> Leading
    ) {
        self.init(verbatim: title, subtitle: subtitle, value: value, leading: leading, trailing: { EmptyView() })
    }

    /// A tappable row with a leading slot, a chevron and a title shown as is.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        value: String? = nil,
        action: @escaping () -> Void,
        @ViewBuilder leading: () -> Leading
    ) {
        self.init(
            verbatim: title,
            subtitle: subtitle,
            value: value,
            action: action,
            leading: leading,
            trailing: { EmptyView() }
        )
    }
}

extension ListRow where Leading == EmptyView, Trailing == EmptyView {
    /// A static text row with a title shown as is.
    public init(verbatim title: String, subtitle: String? = nil, value: String? = nil) {
        self.init(
            verbatim: title,
            subtitle: subtitle,
            value: value,
            leading: { EmptyView() },
            trailing: { EmptyView() }
        )
    }

    /// A tappable text row with a chevron and a title shown as is.
    public init(verbatim title: String, subtitle: String? = nil, value: String? = nil, action: @escaping () -> Void) {
        self.init(
            verbatim: title,
            subtitle: subtitle,
            value: value,
            action: action,
            leading: { EmptyView() },
            trailing: { EmptyView() }
        )
    }
}
