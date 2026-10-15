import Testing

@testable import Lift

/// The catalog's display text: names in sentence case, like the library's.
@Suite struct CatalogTextTests {
    @Test(arguments: [
        ("Barbell Bent Over Row", "Barbell bent over row"),
        ("3/4 Sit-Up", "3/4 Sit-up"),
        ("45° Side Bend", "45° Side bend"),
        ("Assisted Standing Triceps Extension (With Towel)", "Assisted standing triceps extension (with towel)"),
        ("EZ-Bar Close-Grip Bench Press", "EZ-bar close-grip bench press"),
        ("Barbell JM Bench Press", "Barbell JM bench press"),
        ("Dumbbell Romanian Deadlift", "Dumbbell Romanian deadlift"),
        ("Smith Machine Squat", "Smith machine squat"),
        ("Lever T-Bar Row", "Lever T-bar row"),
        ("Archer Pull Up v2", "Archer pull up v2"),
        ("", ""),
    ])
    func namesAreSentenceCase(raw: String, expected: String) {
        #expect(CatalogText.name(raw) == expected)
    }

    @Test func bodyWeightReadsAsTheLibrarysWord() {
        #expect(CatalogText.label("body weight") == "Bodyweight")
        #expect(CatalogText.label("upper legs") == "Upper legs")
    }
}
