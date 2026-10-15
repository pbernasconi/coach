import Foundation

/// The section a component is filed under in the catalog. Mirrors the source folders.
nonisolated public enum CatalogSection: String, CaseIterable, Identifiable, Sendable {
    case controls = "Controls"
    case feedback = "Feedback"
    case display = "Display"
    case layout = "Layout"
    case patterns = "Patterns"

    public var id: String { rawValue }
}

/// Every public component in CraftUI. Adding a component means adding a case here and a demo in the
/// matching `*Demo` view; `scripts/catalog-coverage.sh` fails CI when a public view is missing.
nonisolated public enum CatalogComponent: String, CaseIterable, Identifiable, Sendable {
    // Controls
    case buttonStyle = "CraftButtonStyle"
    case asyncButton = "AsyncButton"
    case iconButton = "IconButton"
    case closeButton = "CloseButton"
    case chip = "Chip"
    case chipGroup = "ChipGroup"
    case tag = "CraftTag"
    case segmentedPicker = "SegmentedPicker"
    case toggleRow = "ToggleRow"
    case stepperField = "StepperField"
    case quickPickRow = "QuickPickRow"
    case flowLayout = "FlowLayout"
    case pressFeedback = "PressFeedback"
    case shake = "ShakeEffect"
    // Feedback
    case toast = "Toast"
    case skeleton = "Skeleton"
    case shimmer = "Shimmer"
    case loadingState = "LoadingState"
    case emptyState = "EmptyState"
    case errorState = "ErrorState"
    case noticeBanner = "NoticeBanner"
    case statusPill = "StatusPill"
    case pulse = "Pulse"
    // Display
    case progressRing = "ProgressRing"
    case countdownRing = "CountdownRing"
    case animatedNumber = "AnimatedNumber"
    case statTile = "StatTile"
    case avatar = "Avatar"
    case thumbnail = "Thumbnail"
    // Layout
    case card = "CraftCard"
    case listRow = "ListRow"
    case listSection = "ListSection"
    case keyValueList = "KeyValueList"
    case sectionHeader = "SectionHeader"
    case separator = "Separator"
    case collapsible = "Collapsible"
    case pinnedFooter = "PinnedFooter"
    case sheetHeader = "SheetHeader"
    case dayStrip = "DayStrip"
    case segmentedProgress = "SegmentedProgress"
    case miniPlayerBar = "MiniPlayerBar"
    // Patterns
    case loadableView = "LoadableView"
    case screenScaffold = "ScreenScaffold"
    case confirm = "CraftConfirm"

    public var id: String { rawValue }

    /// The type or modifier name, as written in code.
    public var title: String { rawValue }

    public var section: CatalogSection {
        switch self {
        case .buttonStyle, .asyncButton, .iconButton, .closeButton, .chip, .chipGroup, .tag, .segmentedPicker,
            .toggleRow, .stepperField, .quickPickRow, .flowLayout, .pressFeedback, .shake:
            .controls
        case .toast, .skeleton, .shimmer, .loadingState, .emptyState, .errorState, .noticeBanner, .statusPill,
            .pulse:
            .feedback
        case .progressRing, .countdownRing, .animatedNumber, .statTile, .avatar, .thumbnail:
            .display
        case .card, .listRow, .listSection, .keyValueList, .sectionHeader, .separator, .collapsible, .pinnedFooter,
            .sheetHeader, .dayStrip, .segmentedProgress, .miniPlayerBar:
            .layout
        case .loadableView, .screenScaffold, .confirm:
            .patterns
        }
    }

    /// One line on what it is for. Shown under the title and matched by search.
    public var summary: String {
        switch self {
        case .buttonStyle: "Primary, secondary, tonal, glass, destructive and plain buttons"
        case .asyncButton: "Runs an async action with progress, success and failure states"
        case .iconButton: "Icon-only button with a required accessibility label"
        case .closeButton: "Standard close button for sheets"
        case .chip: "Selectable capsule"
        case .chipGroup: "Single, single-or-none or multiple selection from chips"
        case .tag: "Small non-interactive label with a tone"
        case .segmentedPicker: "Animated segmented control backed by a native Picker for VoiceOver"
        case .toggleRow: "Row with title, subtitle, icon and a toggle"
        case .stepperField: "Number with step buttons, repeat on hold and haptics"
        case .quickPickRow: "Row of equal-width quick values"
        case .flowLayout: "Wraps children onto new lines"
        case .pressFeedback: "Scale and highlight on press for any button"
        case .shake: "Shakes a view when a value changes, e.g. on invalid input"
        case .toast: "Transient message with optional undo, hosted at the top"
        case .skeleton: "Placeholder shapes while content loads"
        case .shimmer: "Moving highlight over placeholder content"
        case .loadingState: "Centred spinner with an optional label"
        case .emptyState: "Nothing here yet, with actions"
        case .errorState: "Something failed, with retry"
        case .noticeBanner: "Inline message with tone, action and dismiss"
        case .statusPill: "Tone plus glyph plus text, never colour alone"
        case .pulse: "Breathing halo that draws attention to live state"
        case .progressRing: "Circular progress with an optional centre view"
        case .countdownRing: "Ring and timer text driven by start and end dates"
        case .animatedNumber: "Number that rolls between values"
        case .statTile: "Label, value, unit and a delta"
        case .avatar: "Image or initials in a circle"
        case .thumbnail: "Rounded square image or symbol with an optional badge"
        case .card: "Surface container modifier and titled card section"
        case .listRow: "Title, subtitle, value, leading and trailing slots"
        case .listSection: "Grouped rows with header and footer"
        case .keyValueList: "Label and value pairs that stack at large text sizes"
        case .sectionHeader: "Section title with optional action"
        case .separator: "Hairline divider with insets"
        case .collapsible: "Disclosure section with animated content"
        case .pinnedFooter: "Bottom bar that stays above content, glass or material"
        case .sheetHeader: "Title with close and confirm buttons for sheets"
        case .dayStrip: "Swipeable week calendar with day markers"
        case .segmentedProgress: "Done, planned, required and optional segments toward a goal"
        case .miniPlayerBar: "Compact live-session bar for the tab bar accessory"
        case .loadableView: "Switches between loading, empty, loaded and failed"
        case .screenScaffold: "Screen frame with title, toolbar and footer"
        case .confirm: "Confirmation dialog for destructive actions"
        }
    }
}
