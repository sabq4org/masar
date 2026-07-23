import Foundation

/// عميل REST — نفس API الويب؛ الجلسة عبر كوكي connect.sid تُدار تلقائيًا
final class API {
    static let shared = API()
    let base = URL(string: "https://masar-production-3543.up.railway.app")!

    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.httpCookieStorage = .shared
        cfg.httpShouldSetCookies = true
        cfg.timeoutIntervalForRequest = 20
        return URLSession(configuration: cfg)
    }()

    private let decoder = JSONDecoder()

    func request<T: Decodable>(
        _ method: String,
        _ path: String,
        query: [String: String] = [:],
        body: [String: Any?]? = nil
    ) async throws -> T {
        var comps = URLComponents(url: base.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty {
            comps.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        var req = URLRequest(url: comps.url!)
        req.httpMethod = method
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            var json: [String: Any] = [:]
            for (key, value) in body { json[key] = value ?? NSNull() }
            req.httpBody = try JSONSerialization.data(withJSONObject: json)
        }
        let (data, resp) = try await session.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        if status >= 400 {
            if let apiError = try? decoder.decode(APIError.self, from: data) { throw apiError }
            throw APIError(error: "تعذر الاتصال بالخادم (\(status))")
        }
        return try decoder.decode(T.self, from: data)
    }

    // ─── الحساب ───
    func login(email: String, password: String) async throws -> Me {
        try await request("POST", "/api/auth/login", body: ["email": email, "password": password])
    }
    func me() async throws -> Me { try await request("GET", "/api/auth/me") }
    func logout() async throws { let _: OkPayload = try await request("POST", "/api/auth/logout") }

    // ─── المهام ───
    func myTasks() async throws -> [TaskRow] {
        try await request("GET", "/api/tasks", query: ["mine": "1", "roots": "1", "limit": "300"])
    }
    func projectTasks(_ projectId: Int) async throws -> [TaskRow] {
        try await request("GET", "/api/tasks", query: ["projectId": String(projectId), "roots": "1", "limit": "300"])
    }
    func taskDetail(_ id: Int) async throws -> TaskDetail {
        try await request("GET", "/api/tasks/\(id)")
    }
    func createTask(title: String, myTasksSectionId: Int?) async throws -> TaskRow {
        try await request("POST", "/api/tasks", body: ["title": title, "myTasksSectionId": myTasksSectionId])
    }
    func patchTask(_ id: Int, _ fields: [String: Any?]) async throws -> TaskRow {
        try await request("PATCH", "/api/tasks/\(id)", body: fields)
    }
    func decideApproval(_ id: Int, decision: String) async throws -> TaskRow {
        try await request("POST", "/api/tasks/\(id)/approval", body: ["decision": decision])
    }
    func addComment(_ id: Int, content: String) async throws -> CommentRow {
        try await request("POST", "/api/tasks/\(id)/comments", body: ["content": content])
    }
    func setLike(_ id: Int, liked: Bool) async throws {
        let _: OkPayload = try await request(liked ? "POST" : "DELETE", "/api/tasks/\(id)/like")
    }

    // ─── أقسام «مهامي» ───
    func mySections() async throws -> [MyTaskSection] {
        try await request("GET", "/api/my-tasks/sections")
    }

    // ─── المشاريع ───
    func projects() async throws -> [ProjectRow] { try await request("GET", "/api/projects") }
    func project(_ id: Int) async throws -> ProjectRow { try await request("GET", "/api/projects/\(id)") }
    func setStar(_ id: Int, starred: Bool) async throws {
        let _: OkPayload = try await request(starred ? "POST" : "DELETE", "/api/projects/\(id)/star")
    }
    func statusUpdates(_ id: Int) async throws -> [StatusUpdateRow] {
        try await request("GET", "/api/projects/\(id)/status-updates")
    }
    func publishStatusUpdate(_ id: Int, statusType: String, body: String) async throws -> StatusUpdateRow {
        try await request("POST", "/api/projects/\(id)/status-updates", body: ["statusType": statusType, "body": body])
    }

    // ─── الوارد والبحث والأشخاص ───
    func notifications() async throws -> NotificationsPayload { try await request("GET", "/api/notifications") }
    func markRead(_ id: Int, read: Bool) async throws {
        let _: OkPayload = try await request("POST", "/api/notifications/\(id)/\(read ? "read" : "unread")")
    }
    func markAllRead() async throws {
        let _: OkPayload = try await request("POST", "/api/notifications/read-all")
    }
    func search(_ q: String) async throws -> SearchPayload {
        try await request("GET", "/api/search", query: ["q": q])
    }
    func users() async throws -> [UserLite] { try await request("GET", "/api/users") }
}

// ─── تواريخ ISO → عرض عربي ميلادي ───
enum MDate {
    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let isoPlain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func parse(_ s: String?) -> Date? {
        guard let s else { return nil }
        return iso.date(from: s) ?? isoPlain.date(from: s)
    }

    static let arLocale = Locale(identifier: "ar_SA@calendar=gregorian")

    /// حالة الاستحقاق: (نص، درجة اللون)
    enum Tone { case over, near, far, none }

    static func due(_ s: String?, done: Bool) -> (label: String, tone: Tone)? {
        guard let d = parse(s) else { return nil }
        let cal = Calendar(identifier: .gregorian)
        let f = DateFormatter()
        f.locale = arLocale
        f.calendar = cal
        if cal.isDateInToday(d) { return ("اليوم", done ? .none : .near) }
        if cal.isDateInTomorrow(d) { return ("غدًا", done ? .none : .near) }
        if cal.isDateInYesterday(d) { return ("أمس", done ? .none : .over) }
        let over = d < Date() && !done
        if abs(d.timeIntervalSinceNow) < 6 * 86400 {
            f.dateFormat = "EEEE"
        } else {
            f.dateFormat = "d MMMM"
        }
        return (f.string(from: d), over ? .over : (done ? .none : .far))
    }

    static func relative(_ s: String) -> String {
        guard let d = parse(s) else { return "" }
        let f = RelativeDateTimeFormatter()
        f.locale = arLocale
        f.unitsStyle = .short
        return f.localizedString(for: d, relativeTo: Date())
    }

    static func today() -> String {
        let f = DateFormatter()
        f.locale = arLocale
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "EEEE، d MMMM"
        return f.string(from: Date())
    }
}
