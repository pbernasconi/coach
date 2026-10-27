import Foundation
import KoboComponents

/// The photos and files on the next message (lift/COACH-CHAT.md, "Attachments"): each one uploads as soon as it is
/// picked, so Send only waits for the slow ones; a failed one can be tapped to try again. Also loads the tiles of sent
/// photos. Changes the tab's state through `edit`, which `CoachViewModel` hands it.
@MainActor
final class CoachUploads {
    private let coach: any CoachChatting
    private let edit: ((inout CoachState) -> Void) -> Void
    /// What each tile was made from, kept until it is sent so a failed upload can run again.
    private var picked: [String: ChatPickedFile] = [:]
    private var tasks: [String: Task<Void, Never>] = [:]
    private var loading: Set<String> = []

    init(coach: any CoachChatting, edit: @escaping ((inout CoachState) -> Void) -> Void) {
        self.coach = coach
        self.edit = edit
    }

    func handle(_ action: CoachAction, in state: CoachState) -> Task<Void, Never>? {
        switch action {
        case .attachShown(let shown): edit { $0.isAttaching = shown }
        case .filesPicked(let files): return add(files, room: CoachState.attachmentLimit - state.attachments.count)
        case .attachmentRemoved(let id): remove(id)
        case .attachmentRetried(let id): return upload(id)
        case .filePreviewNeeded(let id): return loadPreview(id, in: state)
        default: break
        }
        return nil
    }

    /// The message went: its files belong to it now.
    func sent() {
        picked = [:]
        tasks = [:]
    }

    private func add(_ files: [ChatPickedFile], room: Int) -> Task<Void, Never>? {
        let added = Array(files.prefix(max(0, room)))
        guard !added.isEmpty else { return nil }
        edit { state in
            for file in added {
                state.attachments.append(file.attachment)
                state.previews[file.id] = file.preview
            }
        }
        for file in added { picked[file.id] = file }
        let started = added.compactMap { upload($0.id) }
        return Task { for task in started { await task.value } }
    }

    private func remove(_ id: String) {
        tasks[id]?.cancel()
        tasks[id] = nil
        picked[id] = nil
        edit { state in
            state.attachments.removeAll { $0.id == id }
            state.uploaded[id] = nil
            state.previews[id] = nil
        }
    }

    private func upload(_ id: String) -> Task<Void, Never>? {
        guard let file = picked[id], tasks[id] == nil else { return nil }
        edit { $0.setAttachment(id, .uploading) }
        let coach = coach
        let task = Task {
            do {
                let stored = try await coach.upload(file)
                guard !Task.isCancelled else { return }
                edit { state in
                    state.uploaded[id] = stored
                    state.setAttachment(id, .ready)
                }
            } catch {
                guard !Task.isCancelled else { return }
                edit { $0.setAttachment(id, .failed) }
            }
            tasks[id] = nil
        }
        tasks[id] = task
        return task
    }

    /// A sent photo's tile: its bytes from the server, shrunk once for the tile.
    private func loadPreview(_ id: String, in state: CoachState) -> Task<Void, Never>? {
        guard state.previews[id] == nil, !loading.contains(id) else { return nil }
        loading.insert(id)
        let coach = coach
        return Task {
            if let data = try? await coach.fileData(id), let tile = await ChatImageData.thumbnail(data) {
                edit { $0.previews[id] = tile }
            }
            loading.remove(id)
        }
    }
}
