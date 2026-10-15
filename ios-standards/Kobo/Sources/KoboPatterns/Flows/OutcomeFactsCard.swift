import KoboComponents
import KoboTokens
import SwiftUI

/// The facts of an outcome in a grouped `ListSection` card, one `KeyValueRow` each, read as "label, value".
struct OutcomeFactsCard: View {
    let facts: [OutcomeFact]

    var body: some View {
        ListSection {
            ForEach(facts) { fact in
                KeyValueRow(verbatim: fact.label, value: fact.value)
            }
        } header: {
            EmptyView()
        }
        .listSectionStyle(.grouped)
    }
}
