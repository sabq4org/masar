import SwiftUI

@MainActor
final class AppState: ObservableObject {
    @Published var me: Me?
    @Published var checkedSession = false

    @Published var tasks: [TaskRow] = []
    @Published var sections: [MyTaskSection] = []
    @Published var projects: [ProjectRow] = []
    @Published var notifications: [NotificationRow] = []
    @Published var unread = 0
    @Published var users: [UserLite] = []

    @Published var toast: String?
    private var toastTask: Task<Void, Never>?

    // ─── الجلسة ───
    func bootstrap() async {
        defer { checkedSession = true }
        if let me = try? await API.shared.me() {
            self.me = me
            await refreshAll()
        }
    }

    func login(email: String, password: String) async throws {
        me = try await API.shared.login(email: email, password: password)
        await refreshAll()
    }

    func logout() async {
        try? await API.shared.logout()
        me = nil
        tasks = []
        projects = []
        notifications = []
    }

    // ─── التحميل ───
    func refreshAll() async {
        async let t = try? API.shared.myTasks()
        async let s = try? API.shared.mySections()
        async let p = try? API.shared.projects()
        async let n = try? API.shared.notifications()
        async let u = try? API.shared.users()
        tasks = (await t) ?? tasks
        sections = (await s) ?? sections
        projects = (await p) ?? projects
        if let payload = await n {
            notifications = payload.items
            unread = payload.unread
        }
        users = (await u) ?? users
    }

    func refreshNotifications() async {
        if let payload = try? await API.shared.notifications() {
            notifications = payload.items
            unread = payload.unread
        }
    }

    // ─── إجراءات المهام (تفاؤلية) ───
    func toggleComplete(_ task: TaskRow) {
        let newValue = !task.isCompleted
        patchLocal(task.id) { $0.isCompleted = newValue }
        if newValue { showToast("أُنجزت المهمة ✓") }
        Task {
            do {
                _ = try await API.shared.patchTask(task.id, ["isCompleted": newValue])
            } catch {
                patchLocal(task.id) { $0.isCompleted = !newValue }
                showToast(error.localizedDescription)
            }
        }
    }

    func quickAdd(title: String, sectionId: Int?) {
        Task {
            do {
                _ = try await API.shared.createTask(title: title, myTasksSectionId: sectionId)
                tasks = (try? await API.shared.myTasks()) ?? tasks
                showToast("أُضيفت المهمة")
            } catch {
                showToast(error.localizedDescription)
            }
        }
    }

    private func patchLocal(_ id: Int, _ mutate: (inout TaskRow) -> Void) {
        if let i = tasks.firstIndex(where: { $0.id == id }) {
            mutate(&tasks[i])
        }
    }

    // ─── المشاريع ───
    func toggleStar(_ project: ProjectRow) {
        let newValue = !(project.isStarred ?? false)
        if let i = projects.firstIndex(where: { $0.id == project.id }) {
            projects[i].isStarred = newValue
        }
        Task {
            try? await API.shared.setStar(project.id, starred: newValue)
        }
    }

    // ─── الوارد ───
    func markRead(_ n: NotificationRow, read: Bool) {
        if let i = notifications.firstIndex(where: { $0.id == n.id }) {
            notifications[i].isRead = read
        }
        unread = notifications.filter { !$0.isRead }.count
        Task { try? await API.shared.markRead(n.id, read: read) }
    }

    func markAllRead() {
        for i in notifications.indices { notifications[i].isRead = true }
        unread = 0
        showToast("أُرشفت كل الأنشطة")
        Task { try? await API.shared.markAllRead() }
    }

    // ─── مساعدات ───
    func showToast(_ message: String) {
        toastTask?.cancel()
        withAnimation(.masar) { toast = message }
        toastTask = Task {
            try? await Task.sleep(nanoseconds: 2_200_000_000)
            if !Task.isCancelled {
                withAnimation(.masar) { toast = nil }
            }
        }
    }

    func user(_ id: Int?) -> UserLite? {
        guard let id else { return nil }
        return users.first { $0.id == id }
    }

    // مجموعات «مهامي»
    var mine: [TaskRow] { tasks }
    var openMine: [TaskRow] { tasks.filter { !$0.isCompleted } }
    var upcoming: [TaskRow] {
        openMine.filter { MDate.due($0.dueAt, done: false)?.tone != .over }
    }
    var overdue: [TaskRow] {
        openMine.filter { MDate.due($0.dueAt, done: false)?.tone == .over }
    }
    var completedMine: [TaskRow] { tasks.filter { $0.isCompleted } }

    func sectionTasks(_ sectionId: Int, includeCompleted: Bool) -> [TaskRow] {
        tasks.filter { $0.myTasksSectionId == sectionId && (includeCompleted || !$0.isCompleted) }
    }

    func projectSummary(_ p: ProjectRow) -> (total: Int, done: Int, pct: Int) {
        let total = p.taskCount ?? 0
        let done = p.doneCount ?? 0
        return (total, done, total > 0 ? Int(round(Double(done) / Double(total) * 100)) : 0)
    }
}

// حالة المشروع — ألوان وتسميات
enum ProjectStatusMeta {
    static let all: [(key: String, label: String, hex: String)] = [
        ("on_track", "على المسار", "#2E7D5B"),
        ("at_risk", "في خطر", "#A87A0E"),
        ("off_track", "متعثر", "#B0413E"),
        ("on_hold", "معلّق", "#46536B"),
        ("complete", "مكتمل", "#33658A"),
    ]
    static func label(_ key: String?) -> String {
        all.first { $0.key == key }?.label ?? "بلا حالة"
    }
    static func color(_ key: String?) -> Color {
        Color(hex: all.first { $0.key == key }?.hex ?? "#77705F")
    }
}

enum PriorityMeta {
    static func label(_ key: String?) -> String? {
        switch key {
        case "urgent": "عاجلة"
        case "high": "عالية"
        case "normal": "متوسطة"
        case "low": "منخفضة"
        default: nil
        }
    }
    static func color(_ key: String?) -> Color {
        switch key {
        case "urgent": Color(hex: "#B0413E")
        case "high": Color(hex: "#C2701E")
        case "normal": Color(hex: "#8A6A10")
        case "low": Color(hex: "#33658A")
        default: MTheme.muted
        }
    }
}
