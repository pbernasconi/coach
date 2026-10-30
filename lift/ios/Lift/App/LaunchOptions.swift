import Foundation
import LiftCore

/// What the launch arguments ask for. CI and the UI smoke test use them; a normal launch passes none.
///
///     -demo                                   in-memory database filled with fabricated sessions
///     -fresh                                  in-memory database as a first launch leaves it: the exercise library
///                                             and nothing else (no sessions, no templates); wins over -demo, so
///                                             the screenshot script's empty states (`-demo -fresh`) work
///     -tab today|week|coach|lift|settings     the tab to open first (Week without it); history and exercises
///                                             open the Lift tab on that segment
///     -appearance dark|light                  forces an appearance (CI usually sets it with simctl)
///     -open workout                           with -demo: pushes today's or the next planned session on Week
///     -open exercise                          with -demo: pushes the Back squat detail on Exercises
///     -open catalog                           with -demo: pushes the exercise catalog browse on Exercises
///     -open import                            with -demo: opens Import from Notes over History with a made-up
///                                             note already read, on the review step
///     -open templates                         with -demo: pushes the templates list on Exercises
///     -open template                          with -demo: pushes the first template's editor on Exercises
///     -open summary                           with -demo: pushes the latest logged session's summary on Week
///     -open lift-session                      with -demo: pushes the demo Lower A on Lift (its body map)
///     -open progress                          with -demo: opens History on Progress (hard sets per muscle)
///     -open plates                            with -demo: pushes Plates and bars on Settings
///     -open activity|ride|activity-pending   with -demo: pushes a made-up activity on Week (DemoActivities)
///     -open today-trends|today-end            with -demo: Today scrolled to its trends or its end
///     -open widgets                           with -demo: the Coach widget's faces on a made-up Home Screen
///     -coach conversation|questions|proposal  with -demo: the Coach tab opens on that made-up chat (DemoCoachThreads)
///     -open template-link                     with -demo: opens the template link review over Exercises with the
///                                             made-up `TemplateLinkSample`
///     -open-url lift://…                      opens that Lift link once the data is ready, through the same router
///                                             as a tapped link (a simulator cannot answer the system's "Open in
///                                             Lift?" prompt that `simctl openurl` raises); not for -demo
nonisolated struct LaunchOptions: Equatable, Sendable {
    enum Appearance: String, Equatable, Sendable {
        case dark
        case light
    }

    /// A screen to push once the data is ready, for screenshots.
    enum Opening: String, Equatable, Sendable {
        case workout
        case exercise
        case catalog
        /// Import from Notes: a modal page over History rather than a pushed route.
        case importNotes = "import"
        case templates
        case template
        case summary
        /// Lift: the demo's finished Lower A, which leads with its body map.
        case liftSession = "lift-session"
        /// History's Progress view: a segment of the History tab rather than a pushed route.
        case progress
        /// Settings → Plates and bars.
        case plates
        /// The template link review: a sheet over Exercises rather than a pushed route.
        case templateLink = "template-link"
        /// A made-up run's activity page, on Week.
        case activity
        /// A made-up ride with power, on Week.
        case ride
        /// An activity Strava is still sending, on Week.
        case activityPending = "activity-pending"
        /// Today scrolled to its trends, for screenshots.
        case todayTrends = "today-trends"
        /// Today scrolled to its end (body and labs), for screenshots.
        case todayEnd = "today-end"
        /// The Coach widget's faces on a made-up Home Screen, instead of the app (`HomeWidgetGallery`).
        case widgets

        /// The Lift segment the screen belongs to; nil outside the Lift tab.
        var liftSegment: LiftSegment? {
            switch self {
            case .exercise, .catalog, .templates, .template, .templateLink: .exercises
            case .importNotes, .progress: .history
            default: nil
            }
        }

        /// The tab whose stack the screen is pushed on.
        var tab: AppTab {
            switch self {
            case .workout, .summary, .activity, .ride, .activityPending: .week
            case .exercise, .catalog, .templates, .template, .templateLink, .importNotes, .progress, .liftSession: .lift
            case .plates: .settings
            case .todayTrends, .todayEnd, .widgets: .today
            }
        }
    }

    var isDemo = false
    var initialTab = AppTab.week
    /// The Lift tab's first segment: `-tab history` and `-tab exercises` open it there (they were tabs before).
    var liftSegment = LiftSegment.overview
    var appearance: Appearance?
    var opening: Opening?
    /// `-fresh`: an empty in-memory database that never syncs or touches Apple Health, for the empty states.
    var isFresh = false
    /// A `lift://` link to open at launch (`-open-url`), case kept: an enrollment code is case-sensitive.
    var openURL: URL?
    /// `-voice denied` with `-demo`: the microphone acts as if it were turned off in Settings (for screenshots).
    var deniesVoice = false
    /// `-coach conversation|questions|proposal` with `-demo`: the Coach tab opens on that made-up chat (screenshots).
    var coachScenario: String?

    init(
        isDemo: Bool = false,
        initialTab: AppTab = .week,
        liftSegment: LiftSegment = .overview,
        appearance: Appearance? = nil,
        opening: Opening? = nil,
        isFresh: Bool = false
    ) {
        self.isDemo = isDemo
        self.initialTab = initialTab
        self.liftSegment = liftSegment
        self.appearance = appearance
        self.opening = opening
        self.isFresh = isFresh
    }

    /// Where the data lives for this launch.
    var dataSource: AppInfo.DataSource {
        if isFresh { return .fresh }
        return isDemo ? .demo : .device
    }

    /// Parses `ProcessInfo.processInfo.arguments`. Unknown arguments and bad values are ignored.
    init(arguments: [String]) {
        self.init()
        isFresh = arguments.contains("-fresh")
        isDemo = !isFresh && (arguments.contains("-demo") || arguments.contains("--demo"))
        let tab = Self.value(after: "-tab", in: arguments)
        if let segment = tab.flatMap(LiftSegment.init(rawValue:)), segment != .overview {
            initialTab = .lift
            liftSegment = segment
        } else if let tab = tab.flatMap(AppTab.init(rawValue:)) {
            initialTab = tab
        }
        appearance = Self.value(after: "-appearance", in: arguments).flatMap(Appearance.init(rawValue:))
        opening = Self.value(after: "-open", in: arguments).flatMap(Opening.init(rawValue:))
        if tab == nil, let opening {  // `-open` alone selects the tab (and Lift segment) its screen is pushed on
            initialTab = opening.tab
            liftSegment = opening.liftSegment ?? liftSegment
        }
        deniesVoice = isDemo && Self.value(after: "-voice", in: arguments) == "denied"
        coachScenario = isDemo ? Self.value(after: "-coach", in: arguments) : nil
        if let index = arguments.firstIndex(of: "-open-url"), arguments.indices.contains(index + 1),
            let url = URL(string: arguments[index + 1]), url.scheme?.lowercased() == AppLink.scheme
        {
            openURL = url
        }
    }

    /// The route `opening.tab` starts on in demo mode: the given session for `-open workout`, the Back squat detail
    /// for `-open exercise`, the catalog browse for `-open catalog`, the templates, the given template's editor, the
    /// given logged session's summary, or Plates and bars for `-open plates`. Nil without demo data, so a real launch
    /// never opens a screen by itself.
    func initialRoute(upcomingSessionID: UUID?, templateID: UUID? = nil, loggedSessionID: UUID? = nil) -> AppRoute? {
        guard isDemo, let opening else { return nil }
        switch opening {
        case .workout: return upcomingSessionID.map(AppRoute.workout)
        case .templates: return .templates
        case .template: return templateID.map(AppRoute.template)
        case .summary: return loggedSessionID.map(AppRoute.workoutSummary)
        // The session in DemoAPI/app-lift-sessions.json.
        case .liftSession: return .liftSession("de300000-0000-4000-8000-000000000100")
        case .exercise: return .exercise(ExerciseLibrary.seedID(1))
        case .catalog: return .catalog
        case .plates: return .plates
        case .activity: return .activity(DemoActivities.run)
        case .ride: return .activity(DemoActivities.ride)
        case .activityPending: return .activity(DemoActivities.pending)
        // A modal page (`opensImportSample`), a sheet (`opensTemplateLinkSample`), or a segment of History
        // (`historySegment`).
        case .importNotes, .templateLink, .progress, .todayTrends, .todayEnd, .widgets: return nil
        }
    }

    /// The History tab's first view: Progress for `-open progress` in demo mode, Sessions otherwise.
    var historySegment: HistorySegment {
        isDemo && opening == .progress ? .progress : .sessions
    }

    /// Where Today starts scrolled to: `-open today-trends` or `-open today-end` in demo mode, else the top.
    var todayAnchor: TodayAnchor? {
        guard isDemo else { return nil }
        switch opening {
        case .todayTrends: return .trends
        case .todayEnd: return .end
        default: return nil
        }
    }


    /// `-open import` in demo mode: the shell opens the import flow with the made-up sample note already read.
    var opensImportSample: Bool { isDemo && opening == .importNotes }

    /// `-open template-link` in demo mode: the shell opens the template link review with the made-up sample link.
    var opensTemplateLinkSample: Bool { isDemo && opening == .templateLink }

    /// `-open widgets` in demo mode: the app shows the Coach widget's gallery instead of its tabs (screenshots).
    var showsWidgetGallery: Bool { isDemo && opening == .widgets }

    private static func value(after flag: String, in arguments: [String]) -> String? {
        guard let index = arguments.firstIndex(of: flag), arguments.indices.contains(index + 1) else { return nil }
        return arguments[index + 1].lowercased()
    }
}

/// The ids of the made-up activities in the Training demo bodies (`Resources/DemoAPI/app-activities-*.json`).
nonisolated enum DemoActivities {
    static let run = "9000000102"
    static let ride = "9000000103"
    static let pending = "9000000104"
}
