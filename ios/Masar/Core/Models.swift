import Foundation

// نماذج مطابقة لعقد الـ API في المستودع (client/src/lib/types.ts)

struct Me: Codable, Identifiable {
    let id: Int
    let email: String
    let name: String
    let role: String
    let avatarColor: String
    let avatarUrl: String?
    let permissions: [String]
}

struct UserLite: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let role: String
    let roleLabel: String?
    let avatarColor: String
    let avatarUrl: String?
    let departmentId: Int?
}

struct PersonRef: Codable, Hashable {
    let id: Int
    let name: String
    let avatarColor: String?
    let avatarUrl: String?
}

struct MyTaskSection: Codable, Identifiable, Hashable {
    let id: Int
    let title: String
    let orderIndex: Int
    let isDefault: Bool
}

struct SectionRow: Codable, Identifiable, Hashable {
    let id: Int
    let title: String
    let orderIndex: Int
}

struct MemberRow: Codable, Identifiable, Hashable {
    let id: Int
    let userId: Int
    let name: String
    let avatarColor: String
    let avatarUrl: String?
}

struct StatusUpdateRow: Codable, Identifiable {
    let id: Int
    let projectId: Int
    let statusType: String
    let title: String?
    let body: String?
    let createdAt: String
    let createdBy: PersonRef?
}

struct ProjectRow: Codable, Identifiable {
    let id: Int
    var name: String
    var description: String?
    var color: String
    var currentStatus: String?
    var taskCount: Int?
    var doneCount: Int?
    var memberCount: Int?
    var isStarred: Bool?
    var sections: [SectionRow]?
    var members: [MemberRow]?
    var lastStatusUpdate: StatusUpdateRow?
}

struct ProjectRef: Codable, Hashable {
    let id: Int
    let name: String
    let color: String
}

struct SubtaskLite: Codable, Hashable {
    let id: Int
    let isCompleted: Bool
}

struct TaskRow: Codable, Identifiable {
    let id: Int
    var title: String
    var description: String?
    var isCompleted: Bool
    var taskType: String
    var approvalStatus: String?
    var priority: String?
    var assigneeId: Int?
    var projectId: Int?
    var sectionId: Int?
    var myTasksSectionId: Int?
    var dueAt: String?
    var createdAt: String
    var assignee: PersonRef?
    var project: ProjectRef?
    var section: TitleRef?
    var subtasks: [SubtaskLite]?

    struct TitleRef: Codable, Hashable {
        let id: Int
        let title: String
    }

    var isMilestone: Bool { taskType == "milestone" }
    var isApproval: Bool { taskType == "approval" }
}

struct CommentRow: Codable, Identifiable {
    let id: Int
    let content: String
    let createdAt: String
    let user: PersonRef
}

struct ActivityRow: Codable, Identifiable {
    let id: Int
    let action: String
    let createdAt: String
    let user: NameRef?

    struct NameRef: Codable {
        let id: Int
        let name: String
    }
}

struct WatcherRow: Codable, Identifiable {
    let userId: Int
    let user: PersonRef
    var id: Int { userId }
}

struct TaskDetail: Codable, Identifiable {
    let id: Int
    var title: String
    var description: String?
    var isCompleted: Bool
    var taskType: String
    var approvalStatus: String?
    var priority: String?
    var dueAt: String?
    var createdAt: String
    var assignee: PersonRef?
    var project: ProjectRef?
    var section: TaskRow.TitleRef?
    var subtasks: [TaskRow]
    var comments: [CommentRow]
    var watchers: [WatcherRow]
    var likes: [LikeRow]
    var likedByMe: Bool
    var activity: [ActivityRow]

    struct LikeRow: Codable {
        let userId: Int
    }

    var isMilestone: Bool { taskType == "milestone" }
    var isApproval: Bool { taskType == "approval" }
}

struct NotificationRow: Codable, Identifiable {
    let id: Int
    let type: String
    let title: String
    let body: String?
    let taskId: Int?
    var isRead: Bool
    let createdAt: String
    let actor: PersonRef?
}

struct NotificationsPayload: Codable {
    let items: [NotificationRow]
    let unread: Int
}

struct SearchTaskRow: Codable, Identifiable {
    let id: Int
    let title: String
    let isCompleted: Bool
    let dueAt: String?
    let project: ProjectRef?
}

struct SearchPayload: Codable {
    let tasks: [SearchTaskRow]
    let projects: [ProjectRow]
    let users: [PersonRef] // البحث يرجع حقولًا مختصرة للأشخاص
}

struct OkPayload: Codable {
    let ok: Bool?
}

struct APIError: Codable, Error, LocalizedError {
    let error: String
    var errorDescription: String? { error }
}
