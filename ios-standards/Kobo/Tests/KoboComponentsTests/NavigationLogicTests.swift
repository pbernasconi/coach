import Testing

@testable import KoboComponents

@Suite struct NavigationLogicTests {
    @Test func badgesHideAtZeroAndCapAtNinetyNine() {
        #expect(CountBadgeText.label(for: 0) == nil)
        #expect(CountBadgeText.label(for: -3) == nil)
        #expect(CountBadgeText.label(for: 1) == "1")
        #expect(CountBadgeText.label(for: 99) == "99")
        #expect(CountBadgeText.label(for: 100) == "99+")
        #expect(CountBadgeText.label(for: 12_000) == "99+")
        #expect(CountBadgeText.label(for: 10, cap: 9) == "9+")
        #expect(CountBadgeText.label(for: 2, cap: 0) == "1+")
        #expect(CountBadgeText.isShown(1))
        #expect(!CountBadgeText.isShown(0))
    }

    @Test func theProfileTitleIsTheTrimmedNameOrNothing() {
        #expect(HeaderProfileTitle.title(name: "Ada Lovelace") == "Ada Lovelace")
        #expect(HeaderProfileTitle.title(name: "  Ada \n") == "Ada")
        #expect(HeaderProfileTitle.title(name: nil) == nil)
        #expect(HeaderProfileTitle.title(name: "   ") == nil)
    }

    @Test func aPadAdaptsAndAPhoneKeepsItsTabBar() {
        #expect(TabShellLayout.forDevice(isPad: true) == .sidebarAdaptable)
        #expect(TabShellLayout.forDevice(isPad: false) == .tabBar)
    }

    @Test func onlyAnotherTabIsASwitch() {
        #expect(TabShellRules.isSwitch(from: "home", to: "search"))
        #expect(!TabShellRules.isSwitch(from: "home", to: "home"))
    }
}
