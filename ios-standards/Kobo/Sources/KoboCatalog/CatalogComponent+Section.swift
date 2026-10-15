import Foundation

extension CatalogComponent {
    /// The catalog section the component is listed under.
    nonisolated public var section: CatalogSection {
        switch self {
        case .buttonStyle, .asyncButton, .iconButton, .closeButton, .chip, .chipGroup, .tag, .segmentedPicker,
            .toggleRow, .stepperField, .quickPickRow, .flowLayout, .pressFeedback, .shake:
            .controls
        case .checkbox, .radio, .checkRow, .radioRow, .radioGroup, .choiceCard, .choiceCardGroup, .menuRow,
            .menuSelectField, .selectField, .multiSelectField, .selectSheet, .rangeSlider, .accordionGroup,
            .themePicker:
            .selection
        case .textField, .secureField, .textArea, .fieldGroup, .numberEntry, .codeInput, .dateField, .calendar,
            .copyButton, .copyableValue, .keyboardAccessoryBar:
            .fields
        case .searchField, .highlightedText:
            .search
        case .toast, .skeleton, .shimmer, .loadingState, .emptyState, .emptyStateArt, .errorState, .noticeBanner,
            .statusPill, .pulse:
            .feedback
        case .bannerStack, .nudgeBanner, .systemNotice, .offlineBanner, .inlineNotice, .iconNotice, .inlineProgress,
            .sectionState, .slowWaitNote:
            .status
        case .progressRing, .countdownRing, .animatedNumber, .statTile, .avatar, .thumbnail:
            .display
        case .card, .listRow, .listSection, .keyValueList, .sectionHeader, .separator, .collapsible, .pinnedFooter,
            .sheetHeader, .dayStrip, .segmentedProgress, .miniPlayerBar:
            .layout
        case .appHeader, .headerButton, .headerProfileButton, .countBadge, .tabShell, .textLink:
            .navigation
        case .sheet, .modalPage, .inputModal, .infoButton, .infoSheet:
            .overlays
        case .actionChipRow, .actionCircle, .setupChecklistCard, .suggestionCard, .summaryStrip, .tonalCardRow:
            .quickActions
        case .accessibilitySizeReader, .wideWindowReader, .adaptiveColumns, .holdsLastValue, .maskedValue,
            .revealableValue, .deferredRow:
            .utilities
        case .loadableView, .screenScaffold, .confirm:
            .patterns
        case .listRowSkeleton, .loadMoreFooter, .loadableSection, .loadableCaptionSection, .sectionEmptyCard:
            .lists
        case .flowStep, .progressFlowStep, .valueStep, .stepIndicator, .reviewScaffold, .reviewSection, .reviewRow,
            .reviewDisclosure, .outcomeScaffold, .primerPage, .updateGateScreen:
            .flows
        }
    }
}
