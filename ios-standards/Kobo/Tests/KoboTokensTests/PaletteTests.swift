import KoboTokens
import SwiftUI
import Testing

@Suite struct PaletteTests {
    @Test(arguments: [Palette.system, Palette.amber])
    func aPaletteWithoutAWashUsesTheCanvasAndSeparator(_ palette: Palette) {
        #expect(palette.accentWash == palette.canvas)
        #expect(palette.accentWashSeparator == palette.separator)
    }

    @Test func coachHasItsOwnWash() {
        let coach = Palette.coach
        #expect(coach.accentWash != coach.canvas)
        #expect(coach.accentWashSeparator != coach.separator)
        #expect(coach != Palette.amber)
    }

    @Test func coachThemeUsesTheCoachPalette() {
        #expect(Theme.coach.palette == .coach)
    }
}
