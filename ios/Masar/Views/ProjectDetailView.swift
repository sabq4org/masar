import SwiftUI

struct ProjectDetailView: View {
    @EnvironmentObject var app: AppState
    @Environment(\.dismiss) private var dismiss
    let projectId: Int

    @State private var project: ProjectRow?
    @State private var tasks: [TaskRow] = []
    @State private var updates: [StatusUpdateRow] = []
    @State private var tab = 1 // 0 نظرة عامة، 1 قائمة، 2 لوحة
    @State private var statusType = "on_track"
    @State private var statusText = ""

    var body: some View {
        VStack(spacing: 0) {
            header
            tabs
            switch tab {
            case 0: overview
            case 2: board
            default: list
            }
        }
        .background(MTheme.paper)
        .toolbar(.hidden, for: .navigationBar)
        .task { await load() }
    }

    private func load() async {
        async let p = try? API.shared.project(projectId)
        async let t = try? API.shared.projectTasks(projectId)
        async let u = try? API.shared.statusUpdates(projectId)
        project = await p
        tasks = (await t) ?? []
        updates = (await u) ?? []
    }

    private var header: some View {
        HStack(spacing: 9) {
            Button { dismiss() } label: {
                Image(systemName: "chevron.forward")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(MTheme.ink2)
                    .frame(width: 36, height: 36)
            }
            RoundedRectangle(cornerRadius: 9)
                .fill(Color(hex: project?.color ?? "#77705F"))
                .frame(width: 34, height: 34)
                .overlay(
                    Text(String((project?.name ?? "؟").prefix(1)))
                        .font(MFont.text(14, .bold))
                        .foregroundStyle(Color(hex: "#F7F3EB"))
                )
            Text(project?.name ?? "…")
                .font(MFont.display(17, 700))
                .foregroundStyle(MTheme.ink)
                .lineLimit(1)
            Spacer()
            if let project {
                Button {
                    app.toggleStar(project)
                    self.project?.isStarred = !(project.isStarred ?? false)
                } label: {
                    Image(systemName: (project.isStarred ?? false) ? "star.fill" : "star")
                        .foregroundStyle((project.isStarred ?? false) ? MTheme.saffron : MTheme.muted)
                }
                ProjectStatusChip(status: project.currentStatus)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
    }

    private var tabs: some View {
        HStack(spacing: 2) {
            tabButton(0, "نظرة عامة")
            tabButton(1, "قائمة")
            tabButton(2, "لوحة")
            Spacer()
        }
        .padding(.horizontal, 16)
        .overlay(alignment: .bottom) { MTheme.line.frame(height: 1) }
    }

    private func tabButton(_ index: Int, _ label: String) -> some View {
        Button {
            withAnimation(.masar) { tab = index }
        } label: {
            Text(label)
                .font(MFont.text(12, .semibold))
                .foregroundStyle(tab == index ? MTheme.ink : MTheme.muted)
                .padding(.horizontal, 12)
                .padding(.top, 6)
                .padding(.bottom, 8)
                .overlay(alignment: .bottom) {
                    (tab == index ? MTheme.saffron : .clear).frame(height: 2)
                }
        }
        .buttonStyle(.plain)
    }

    private var sections: [SectionRow] { project?.sections ?? [] }

    private func sectionTasks(_ id: Int) -> [TaskRow] {
        tasks.filter { $0.sectionId == id }
    }

    // ─── نظرة عامة ───
    private var overview: some View {
        ScrollView {
            VStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("عن المشروع")
                        .font(MFont.text(12, .bold))
                        .foregroundStyle(MTheme.ink2)
                    Text(project?.description?.isEmpty == false ? project!.description! : "لا وصف بعد")
                        .font(MFont.text(13))
                        .foregroundStyle(MTheme.ink)
                        .lineSpacing(5)
                    HStack(spacing: 0) {
                        Text("الأعضاء")
                            .font(MFont.text(11, .bold))
                            .foregroundStyle(MTheme.ink2)
                            .padding(.trailing, 8)
                        ForEach(project?.members ?? []) { m in
                            AvatarView(name: m.name, colorHex: m.avatarColor, size: 26)
                                .padding(.leading, -6)
                                .overlay(Circle().stroke(MTheme.surface, lineWidth: 2).padding(.leading, -6))
                        }
                        Spacer()
                        let s = app.projectSummary(project ?? ProjectRow(id: 0, name: "", description: nil, color: "#000", currentStatus: nil, taskCount: tasks.count, doneCount: tasks.filter(\.isCompleted).count, memberCount: nil, isStarred: nil, sections: nil, members: nil, lastStatusUpdate: nil))
                        Text("\(tasks.count) مهمة · \(tasks.filter(\.isCompleted).count) مكتملة")
                            .font(MFont.text(11))
                            .foregroundStyle(MTheme.muted)
                        let _ = s
                    }
                    .padding(.top, 6)
                    SariLine(
                        progress: tasks.isEmpty ? 0 : Double(tasks.filter(\.isCompleted).count) / Double(tasks.count),
                        color: Color(hex: project?.color ?? "#1E2735")
                    )
                }
                .padding(14)
                .surfaceCard()

                statusUpdatesCard
            }
            .padding(16)
            .padding(.bottom, 60)
        }
    }

    private var statusUpdatesCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("تحديثات الحالة")
                .font(MFont.text(12, .bold))
                .foregroundStyle(MTheme.ink2)
            HStack(spacing: 6) {
                ForEach(ProjectStatusMeta.all.prefix(3), id: \.key) { meta in
                    Button {
                        statusType = meta.key
                    } label: {
                        Text(meta.label)
                            .font(MFont.text(11, .bold))
                            .foregroundStyle(statusType == meta.key ? Color(hex: meta.hex) : MTheme.muted)
                            .padding(.horizontal, 11)
                            .padding(.vertical, 4)
                            .background(
                                Capsule().fill(statusType == meta.key ? Color(hex: meta.hex).opacity(0.13) : .clear)
                            )
                            .overlay(
                                Capsule().stroke(statusType == meta.key ? Color(hex: meta.hex) : MTheme.line, lineWidth: 1.5)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            TextField("ماذا حدث هذا الأسبوع؟ ما التالي؟", text: $statusText, axis: .vertical)
                .font(MFont.text(13))
                .lineLimit(2...4)
                .padding(10)
                .background(RoundedRectangle(cornerRadius: MTheme.rField).fill(MTheme.paper))
                .overlay(RoundedRectangle(cornerRadius: MTheme.rField).stroke(MTheme.line, lineWidth: 1))
            Button {
                publish()
            } label: {
                Text("نشر التحديث")
                    .font(MFont.text(12, .bold))
                    .foregroundStyle(Color(hex: "#F7F3EB"))
                    .padding(.horizontal, 18)
                    .padding(.vertical, 9)
                    .background(RoundedRectangle(cornerRadius: MTheme.rField).fill(Color(hex: "#1E2735")))
            }
            .opacity(statusText.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1)

            if updates.isEmpty {
                Text("لا تحديثات حالة بعد — انشر أول تحديث")
                    .font(MFont.text(11.5))
                    .foregroundStyle(MTheme.muted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            } else {
                ForEach(updates) { up in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 7) {
                            Circle().fill(ProjectStatusMeta.color(up.statusType)).frame(width: 8, height: 8)
                            Text(ProjectStatusMeta.label(up.statusType))
                                .font(MFont.text(11, .bold))
                                .foregroundStyle(ProjectStatusMeta.color(up.statusType))
                            Spacer()
                            Text(MDate.relative(up.createdAt))
                                .font(MFont.text(10))
                                .foregroundStyle(MTheme.muted)
                        }
                        if let title = up.title, !title.isEmpty {
                            Text(title).font(MFont.text(13, .bold)).foregroundStyle(MTheme.ink)
                        }
                        if let body = up.body, !body.isEmpty {
                            Text(body)
                                .font(MFont.text(12))
                                .foregroundStyle(MTheme.ink2)
                                .lineSpacing(4)
                        }
                        if let by = up.createdBy {
                            HStack(spacing: 6) {
                                AvatarView(name: by.name, colorHex: by.avatarColor, size: 20)
                                Text(by.name).font(MFont.text(10.5)).foregroundStyle(MTheme.muted)
                            }
                            .padding(.top, 2)
                        }
                    }
                    .padding(11)
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(MTheme.lineSoft, lineWidth: 1))
                }
            }
        }
        .padding(14)
        .surfaceCard()
    }

    private func publish() {
        let text = statusText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        Task {
            do {
                _ = try await API.shared.publishStatusUpdate(projectId, statusType: statusType, body: text)
                statusText = ""
                updates = (try? await API.shared.statusUpdates(projectId)) ?? updates
                project = try? await API.shared.project(projectId)
                app.showToast("نُشر تحديث الحالة")
            } catch {
                app.showToast(error.localizedDescription)
            }
        }
    }

    // ─── قائمة ───
    private var list: some View {
        ScrollView {
            VStack(spacing: 0) {
                ForEach(sections) { section in
                    let rows = sectionTasks(section.id)
                    HStack(spacing: 7) {
                        Text(section.title).font(MFont.text(13, .bold)).foregroundStyle(MTheme.ink)
                        Text("\(rows.count)").font(MFont.text(11)).foregroundStyle(MTheme.muted)
                        Spacer()
                    }
                    .padding(.horizontal, 14)
                    .frame(minHeight: 38)
                    .background(MTheme.paper.opacity(0.7))
                    ForEach(rows) { task in
                        Divider().overlay(MTheme.lineSoft)
                        NavigationLink(value: Route.task(task.id)) {
                            TaskRowView(task: task, showProjectDot: false, showAssignee: true)
                                .environmentObject(app)
                        }
                        .buttonStyle(.plain)
                    }
                    Divider().overlay(MTheme.lineSoft)
                }
            }
            .surfaceCard()
            .padding(16)
            .padding(.bottom, 60)
        }
        .refreshable { await load() }
    }

    // ─── لوحة ───
    private var board: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 10) {
                ForEach(sections) { section in
                    let rows = sectionTasks(section.id)
                    VStack(spacing: 8) {
                        HStack(spacing: 6) {
                            Text(section.title).font(MFont.text(13, .bold))
                            Spacer()
                            Text("\(rows.count)").font(MFont.text(11)).foregroundStyle(MTheme.muted)
                        }
                        .padding(.horizontal, 6)
                        ScrollView {
                            VStack(spacing: 8) {
                                ForEach(rows) { task in
                                    NavigationLink(value: Route.task(task.id)) {
                                        VStack(alignment: .leading, spacing: 6) {
                                            HStack(alignment: .top, spacing: 8) {
                                                if task.isMilestone {
                                                    MilestoneDiamond().frame(width: 22, height: 22)
                                                } else {
                                                    CheckCircle(done: task.isCompleted, size: 17) {
                                                        Task {
                                                            _ = try? await API.shared.patchTask(task.id, ["isCompleted": !task.isCompleted])
                                                            await load()
                                                        }
                                                    }
                                                    .frame(width: 22, height: 22)
                                                }
                                                Text(task.title)
                                                    .font(MFont.text(12.5, .semibold))
                                                    .foregroundStyle(task.isCompleted ? MTheme.muted : MTheme.ink)
                                                    .multilineTextAlignment(.leading)
                                                Spacer(minLength: 0)
                                            }
                                            HStack(spacing: 7) {
                                                PriorityChip(priority: task.priority)
                                                DueLabel(dueAt: task.dueAt, done: task.isCompleted, size: 10)
                                                Spacer()
                                                if let a = task.assignee {
                                                    AvatarView(name: a.name, colorHex: a.avatarColor, size: 22)
                                                }
                                            }
                                            .padding(.leading, 26)
                                        }
                                        .padding(11)
                                        .surfaceCard(radius: 10)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                    .padding(8)
                    .frame(width: 240)
                    .background(RoundedRectangle(cornerRadius: MTheme.rCard).fill(MTheme.paper.opacity(0.85)))
                    .overlay(RoundedRectangle(cornerRadius: MTheme.rCard).stroke(MTheme.line, lineWidth: 1))
                }
            }
            .padding(16)
        }
    }
}
