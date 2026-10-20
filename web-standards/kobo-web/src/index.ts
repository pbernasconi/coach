// Kobo web. Layers: tokens (tokens.css) → lib → components → patterns. Edges point one way.

// lib
export { cn, TEXT_ROLES } from './lib/cn'
export { TONES, TONE_CLASS, toneClass, type Tone } from './lib/tone'
export {
  DASH,
  MINUS,
  MONEY_HIDDEN_LABEL,
  MONEY_UNAVAILABLE_LABEL,
  formatMoney,
  formatMoneyHidden,
  formatMoneyLabel,
  formatSignedMoney,
} from './lib/format/money'
export {
  formatBytes,
  formatCompactMoney,
  formatDelta,
  formatMultiple,
  formatNumber,
  formatPercent,
  type MoneyScale,
} from './lib/format/numbers'

// Controls
export { Button, buttonVariants, focusRing, type ButtonProps } from './components/controls/Button'
export { Spinner, type SpinnerProps } from './components/controls/Spinner'

// Fields
export { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet } from './components/fields/Field'
export { Input, fieldBox, type InputProps } from './components/fields/Input'
export { Label, type LabelProps } from './components/fields/Label'
export { Textarea } from './components/fields/Textarea'

// Feedback
export { EmptyState, type EmptyStateProps } from './components/feedback/EmptyState'
export { ErrorState, classifyError, type ErrorKind, type ErrorStateProps } from './components/feedback/ErrorState'
export { InlineNotice, type InlineNoticeProps } from './components/feedback/InlineNotice'
export { RowsSkeleton, Skeleton } from './components/feedback/Skeleton'
export { StatusPill, type StatusPillProps } from './components/feedback/StatusPill'

// Display
export { Meter, type MeterProps } from './components/display/Meter'
export { clampFraction, meterTone } from './components/display/meterMath'
export { MoneyDisplay, type MoneyDisplayProps } from './components/display/MoneyDisplay'
export { StatTile, statDelta, type StatDelta, type StatTileProps } from './components/display/StatTile'

// Overlays
export {
  ConfirmProvider,
  useConfirm,
  type ConfirmFn,
  type ConfirmOptions,
  type ConfirmWithReasonOptions,
  type ConfirmWithReasonResult,
} from './components/overlays/ConfirmProvider'
export { confirmBlocker, type ConfirmReason, type ConfirmTypedWord } from './components/overlays/confirmRules'
export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  type DialogContentProps,
} from './components/overlays/Dialog'

// Patterns
export { QueryBoundary, type QueryBoundaryProps, type QueryLike } from './patterns/QueryBoundary'
export { SkeletonRegion, type SkeletonRegionProps } from './patterns/SkeletonRegion'
export { MAIN_CONTENT_ID, SkipLink } from './patterns/SkipLink'

// ── More components ────────────────────────────────────────────────────────────────────────────

// Primitives: tooltips
export { DEFAULT_TOOLTIP_DELAY_MS, Tooltip, TooltipTrigger, TooltipProvider, TooltipIconTrigger, TooltipContent } from './components/overlays/Tooltip'
export type { TooltipIconTriggerProps, TooltipContentProps } from './components/overlays/Tooltip'
export { StandardTooltip, type StandardTooltipProps } from './components/overlays/StandardTooltip'
export { HelpTooltip, type HelpTooltipProps } from './components/overlays/HelpTooltip'

// Primitives: display
export { Separator } from './components/display/Separator'
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './components/display/Card'
export { Avatar, AvatarImage, AvatarFallback } from './components/display/Avatar'
export { getInitials, getAvatarColor } from './components/display/avatarInitials'
export { AvatarGroup, type AvatarGroupProps, type AvatarGroupUser } from './components/display/AvatarGroup'
export { MaskedValue, type MaskedValueProps } from './components/display/MaskedValue'
export { maskValue, MASK_DOT } from './components/display/maskValue'
export { TruncatedText, type TruncatedTextProps } from './components/display/TruncatedText'
export { StepIndicator, type StepIndicatorProps } from './components/display/StepIndicator'
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from './components/display/Collapsible'

// Primitives: controls
export { Checkbox, CheckboxField, type CheckboxFieldProps } from './components/controls/Checkbox'
export { Switch } from './components/controls/Switch'
export { RadioGroup, RadioGroupItem } from './components/controls/RadioGroup'
export { ChoiceCard, type ChoiceCardProps } from './components/controls/ChoiceCard'
export { RadioCards, type RadioCardOption, type RadioCardsProps } from './components/controls/RadioCards'
export { Tabs, TabsList, TabsTrigger, TabsContent } from './components/controls/Tabs'
export { TextLink, textLinkVariants, type TextLinkProps } from './components/controls/TextLink'
export { ToggleRow, type ToggleRowProps } from './components/controls/ToggleRow'
export { CopyButton, COPIED_RESET_MS, type CopyButtonProps } from './components/controls/CopyButton'
export { CopyableValue, type CopyableValueProps } from './components/controls/CopyableValue'

// Overlays: sheets, alerts, menus, toasts
export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle, SheetDescription, sheetVariants, type SheetContentProps } from './components/overlays/Sheet'
export { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, type AlertDialogButtonProps } from './components/overlays/AlertDialog'
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuRadioGroup } from './components/overlays/DropdownMenu'
export { Toaster, toast, type ToasterProps } from './components/overlays/Toaster'
export { FormDialog, type FormDialogProps } from './components/overlays/FormDialog'
export { ConfirmDialog, type ConfirmDialogProps } from './components/overlays/ConfirmDialog'

// Text fields
export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from './components/fields/Select'
export { SearchInput, type SearchInputProps } from './components/fields/SearchInput'
export { PasswordInput, type PasswordInputProps } from './components/fields/PasswordInput'
export { PasswordRequirements, type PasswordRequirementsProps } from './components/fields/PasswordRequirements'
export { MIN_STRENGTH, PASSWORD_MIN_LENGTH, PASSWORD_RULES, STRENGTH_LABELS, passwordMeetsRules, passwordState, scorePassword, validatePassword, type PasswordRule, type PasswordRuleState, type PasswordState } from './components/fields/passwordRules'
export { OtpInput, PinInput, type OtpInputProps } from './components/fields/OtpInput'
export { sanitizeOtp } from './components/fields/otpCode'
export { ResendCodeButton, type ResendCodeButtonProps } from './components/controls/ResendCodeButton'
export { EmailChipsInput, type EmailChipsInputProps } from './components/fields/EmailChipsInput'
export { DEFAULT_EMAIL_CHIP_MESSAGES, addEmailChips, isEmailShape, type EmailChipMessages, type EmailChipRejection, type EmailChipsParseResult } from './components/fields/emailChips'
export { CountedTextarea, type CountedTextareaProps } from './components/fields/CountedTextarea'
export { CharacterCount } from './components/fields/CharacterCount'
export { isAtLimit, isNearLimit } from './components/fields/characterLimit'
export { OptionalFieldDisclosure, type OptionalFieldDisclosureProps } from './components/fields/OptionalFieldDisclosure'
export { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, useFormField } from './components/fields/Form'
export { LabeledField, type LabeledFieldProps } from './components/fields/LabeledField'

// Data
export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow, type TableCellProps, type TableHeadProps } from './components/data/Table'
export { SortableColumnHeader, type SortableColumnHeaderProps } from './components/data/SortableColumnHeader'
export { ariaSort, compareSortValues, sortHeaderAction, sortRows, type SortDirection, type SortHeaderAction, type SortState } from './components/data/sortModel'
export { clickableRowProps, type ClickableRowProps } from './components/data/clickableRow'
export { DataTable, type DataTableColumn, type DataTableProps } from './components/data/DataTable'
export { LoadMoreRow, type LoadMoreRowProps } from './components/data/LoadMoreRow'
export { LOAD_MORE_COPY, isEmptyFooter, loadMoreModel, pageFooterAction, type LoadMoreCopy, type LoadMoreModel, type PageInfo } from './components/data/loadMoreModel'
export { KeyValueList, useKeyValueRowDensity, type KeyValueListProps, type KeyValueRowDensity } from './components/data/KeyValueList'
export { KeyValueRow, type KeyValueRowProps } from './components/data/KeyValueRow'
export { DetailPanel, detailPanelWidths, type DetailPanelProps } from './components/data/DetailPanel'
export { FloatingSelectionBar, type FloatingSelectionBarProps } from './components/data/FloatingSelectionBar'
export { Timeline, type TimelineProps, type TimelineStep, type TimelineTone } from './components/data/Timeline'
export { ReviewSection, type ReviewRow, type ReviewSectionProps } from './components/data/ReviewSection'
export { ReviewDisclosure, type ReviewDisclosureProps } from './components/data/ReviewDisclosure'
export { ReviewAcknowledgement, type ReviewAcknowledgementProps } from './components/data/ReviewAcknowledgement'
export { StatusCard, type StatusCardProps } from './components/feedback/StatusCard'
export { SuccessState, type SuccessStateProps } from './components/feedback/SuccessState'
export { LoadingSkeleton, type LoadingSkeletonProps, type LoadingSkeletonVariant } from './components/feedback/LoadingSkeleton'
export { RouteErrorScreen, type RouteErrorScreenProps } from './patterns/RouteErrorScreen'
export { ROUTE_ERROR_COPY, isStaleBuildError, type RouteErrorCopy } from './patterns/routeError'
export { PageGateState, type PageGateStateProps } from './patterns/PageGateState'
export { pageGateStatus, type PageGateStatus } from './patterns/pageGate'

// Hooks
export { useStoredValue, type StoredValueArea, type StoredValueOptions } from './hooks/useStoredValue'
export { useIsMobile, MOBILE_BREAKPOINT } from './hooks/useIsMobile'
export { useMountEffect } from './hooks/useMountEffect'

// Layout
export { PageHeader, type PageHeaderProps } from './components/layout/PageHeader'
export { StepHeader, type StepHeaderProps } from './components/layout/StepHeader'
export { SectionRail, type SectionRailItem, type SectionRailProps } from './components/layout/SectionRail'
export { FlowShell, type FlowShellProps } from './components/layout/FlowShell'
export { shouldCloseOnEscape, type EscapeEventLike } from './components/layout/flowEscape'
export { FlowFooter, type FlowFooterProps } from './components/layout/FlowFooter'
export { FlowFooterSlotProvider, FlowFooterOutlet, useFlowFooter, useHasFlowFooterSlot } from './components/layout/FlowFooterSlot'
export { FullScreenWizard, type FullScreenWizardProps, type WizardStep } from './components/layout/FullScreenWizard'
export { WizardStepRail, type WizardStepRailProps } from './components/layout/WizardStepRail'
export { wizardLabels, wizardStepState, DEFAULT_WIZARD_LABELS, type WizardLabels, type WizardStepState } from './components/layout/wizardLabels'

// Navigation
export { Breadcrumb, type BreadcrumbItem, type BreadcrumbProps } from './components/navigation/Breadcrumb'
export { CollapsibleNavGroup, type CollapsibleNavGroupProps } from './components/navigation/CollapsibleNavGroup'
export { FilterPills, type FilterPill, type FilterPillsProps } from './components/navigation/FilterPills'
export { formatPillCount } from './components/navigation/pillCount'
export { StepNav, type StepNavStep, type StepNavProps } from './components/navigation/StepNav'
export { Sidebar, SidebarTrigger, SidebarRail, SidebarInset, type SidebarProps } from './components/navigation/Sidebar'
export { SidebarProvider, type SidebarProviderProps } from './components/navigation/SidebarProvider'
export { useSidebar, type SidebarContextValue } from './components/navigation/useSidebar'
export { SidebarHeader, SidebarFooter, SidebarSeparator, SidebarContent, SidebarInput, SidebarGroup, SidebarGroupLabel, SidebarGroupAction, SidebarGroupContent } from './components/navigation/SidebarSections'
export { SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, SidebarMenuBadge, SidebarMenuSkeleton, sidebarMenuButtonVariants, type SidebarMenuButtonProps } from './components/navigation/SidebarMenu'
export { SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, type SidebarMenuSubButtonProps } from './components/navigation/SidebarMenuSub'
export { SIDEBAR_COOKIE_NAME, SIDEBAR_WIDTH, SIDEBAR_WIDTH_MOBILE, SIDEBAR_WIDTH_ICON, SIDEBAR_KEYBOARD_SHORTCUT, isSidebarShortcut, sidebarCookie, sidebarState, type SidebarState } from './components/navigation/sidebarState'

// Session
export { IdleSessionWarning, type IdleSessionWarningProps, type IdleSessionLabels } from './components/feedback/IdleSessionWarning'
export { createIdleSessionController, secondsLeft, systemClock, COUNTDOWN_TICK_MS, type IdleSessionClock, type IdleSessionController, type IdleSessionOptions, type IdleSessionSnapshot, type IdlePhase } from './components/feedback/idleSessionController'
export { formatCountdown, spokenDuration, countdownAnnouncement } from './components/feedback/idleSessionFormat'

// Print
export { PrintDocument, PrintDocumentLayout, type PrintDocumentProps, type PrintDocumentLayoutProps } from './components/print/PrintDocument'
export { PrintButton, type PrintButtonProps } from './components/print/PrintButton'
export { usePrintDocumentReady, subscribeToPrintDocumentReady, PRINT_ROOT_CLASS } from './components/print/usePrintDocumentReady'

// Formatted fields and pickers
export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './components/overlays/Popover'
export { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut, type CommandDialogProps } from './components/overlays/Command'
export { commandFilter, rankOption, searchOptions, type SearchableOption } from './components/overlays/selectSearch'
export { CurrencyInput, type CurrencyInputProps } from './components/fields/CurrencyInput'
export { parseMoney, type MoneyParseFailure, type MoneyParseResult } from './components/fields/currencyText'
export { DateTextInput, type DateTextInputProps } from './components/fields/DateTextInput'
export { DatePicker, type DatePickerProps } from './components/fields/DatePicker'
export { Calendar } from './components/fields/Calendar'
export { DEFAULT_DATE_MESSAGES, addDays, dateToIso, evaluateDateText, formatMediumDate, isoToDate, quickDateChips, todayIso, type DateBounds, type DateMessages, type DateTextStatus, type IsoDate, type QuickDateChip } from './components/fields/dateText'
export { InternationalPhoneInput, type InternationalPhoneInputProps } from './components/fields/InternationalPhoneInput'
export { EMPTY_INTERNATIONAL_PHONE, toE164, type InternationalPhoneValue } from './components/fields/phoneNumber'
export { CountryCombobox, type CountryComboboxProps } from './components/fields/CountryCombobox'
export { CountryFlagIcon, type CountryFlagIconProps } from './components/fields/CountryFlagIcon'
export { COUNTRY_OPTIONS, flagEmoji, getCountryOption, type CountryCode, type CountryOption } from './components/fields/countries'
export { FileDropzone, type FileDropzoneProps } from './components/fields/FileDropzone'
export { type FileRejection } from './components/fields/fileRules'
