import Foundation
import Testing

@testable import Lift

/// `-open template-link`: the review sheet over Exercises with the made-up sample link, in demo mode only.
@Suite struct LaunchOptionsTemplateLinkTests {
    @Test func openTemplateLinkInDemoModeOpensTheSampleOverExercises() {
        let options = LaunchOptions(arguments: ["Lift", "-demo", "-tab", "exercises", "-open", "template-link"])
        #expect(options.opening == .templateLink)
        #expect(options.opening?.tab == .lift)
        #expect(options.opensTemplateLinkSample)
        #expect(options.initialRoute(upcomingSessionID: nil) == nil)
    }

    @Test func theSampleNeedsDemoData() {
        for arguments in [["Lift", "-open", "template-link"], ["Lift", "-fresh", "-open", "template-link"]] {
            #expect(!LaunchOptions(arguments: arguments).opensTemplateLinkSample)
        }
    }

    @Test func theSampleIsAValidLink() throws {
        #expect(!TemplateLinkSample.encoded.isEmpty)
        #expect(AppLink(url: try #require(AppLink.templates(payload: TemplateLinkSample.encoded).url)) != nil)
    }
}
