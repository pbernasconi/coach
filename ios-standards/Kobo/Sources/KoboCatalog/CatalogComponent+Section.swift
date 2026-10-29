import Foundation

extension CatalogComponent {
    /// The catalog section the component is listed under.
    nonisolated public var section: CatalogSection {
        switch self {
        case .buttonStyle, .asyncButton, .iconButton, .closeButton, .chip, .chipGroup, .filterBar,
            .filterChip, .tag,
            .segmentedPicker, .toggleRow, .stepperField, .quickPickRow, .flowLayout, .pressFeedback,
            .shake:
            .controls
        case .checkbox, .radio, .checkRow, .radioRow, .radioGroup, .choiceCard, .choiceCardGroup,
            .menuRow,
            .menuSelectField, .selectField, .multiSelectField, .selectSheet, .rangeSlider,
            .accordionGroup,
            .themePicker:
            .selection
        case .textField, .secureField, .textArea, .fieldGroup, .numberEntry, .codeInput, .dateField,
            .calendar,
            .copyButton, .copyableValue, .keyboardAccessoryBar:
            .fields
        case .searchField, .highlightedText:
            .search
        case .toast, .skeleton, .shimmer, .skeletonPage, .loadingGrace, .loadingState, .emptyState, .emptyStateArt,
            .errorState,
            .noticeBanner,
            .statusPill, .pulse:
            .feedback
        case .bannerStack, .nudgeBanner, .systemNotice, .offlineBanner, .inlineNotice, .iconNotice,
            .inlineProgress,
            .sectionState, .slowWaitNote:
            .status
        case .progressRing, .countdownRing, .animatedNumber, .statTile, .avatar, .thumbnail, .dayTimeline:
            .display
        case .sparkline, .lineChart, .linePanels, .stackedBarChart, .histogram, .variableWidthBarChart, .bandBar,
            .zoneBars, .profileStrip, .heatmap, .dataTable, .routeMap:
            .charts
        case .card, .listRow, .listSection, .keyValueList, .sectionHeader, .separator, .collapsible,
            .pinnedFooter, .backdropSheet,
            .sheetHeader, .dayStrip, .segmentedProgress, .miniPlayerBar, .tileGrid:
            .layout
        case .appHeader, .headerButton, .headerProfileButton, .countBadge, .tabShell, .textLink, .toolbarPill:
            .navigation
        case .sheet, .modalPage, .inputModal, .infoButton, .infoSheet:
            .overlays
        case .actionChipRow, .actionCircle, .setupChecklistCard, .suggestionCard, .summaryStrip,
            .tonalCardRow:
            .quickActions
        case .accessibilitySizeReader, .wideWindowReader, .adaptiveColumns, .holdsLastValue,
            .maskedValue,
            .revealableValue, .deferredRow:
            .utilities
        case .loadableView, .screenScaffold, .confirm, .skeletonHeader, .skeletonStatGrid, .skeletonCard:
            .patterns
        case .listRowSkeleton, .loadMoreFooter, .loadableSection, .loadableCaptionSection,
            .sectionEmptyCard:
            .lists
        case .flowStep, .progressFlowStep, .valueStep, .stepIndicator, .reviewScaffold, .reviewSection,
            .reviewRow,
            .reviewDisclosure, .outcomeScaffold, .primerPage, .updateGateScreen:
            .flows
        case .chatTranscript, .chatComposer, .chatMessageBubble, .chatReply, .chatTypingIndicator, .chatToolStatus,
            .chatActionCard, .chatPromptSuggestions, .chatTimestamp, .chatErrorRow, .chatEmbedCard,
            .chatAttachmentStrip, .chatAttachSheet, .chatThoughtRow, .chatFeedbackRow, .chatQuestionCard,
            .chatQuestions,
            .chatBreakdownCard, .chatGreeting, .chatPromptCards, .chatGlow:
            .chat
        }
    }
}
