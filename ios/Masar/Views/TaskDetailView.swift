import SwiftUI

struct TaskDetailView: View {
    @EnvironmentObject var app: AppState
    @Environment(\.dismiss) private var dismiss
    let taskId: Int

    @State private var task: TaskDetail?
    @State private var comment = ""

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider().overlay(MTheme.line)
            if let task {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        if task.isApproval { approvalCard(task) }
                        titleBlock(task)
                        fields(task)
                        if let desc = task.description, !desc.isEmpty { descBlock(desc) }
                        subtasksBlock(task)
                        watchersBlock(task)
                        feedBlock(task)
                    }
                    .padding(.bottom, 20)
                }
                commentBar
            } else {
                Spacer()
                ProgressView()
                Spacer()
            }
        }
        .background(MTheme.surface)
        .toolbar(.hidden, for: .navigationBar)
        .task { await load() }
    }

    private func load() async {
        task = try? await API.shared.taskDetail(taskId)
    }

    // ─── شريط الأدوات ───
    private var toolbar: some View {
        HStack(spacing: 6) {
            Button { dismiss() } label: {
                Image(systemName: "chevron.forward")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(MTheme.ink2)
                    .frame(width: 38, height: 38)
            }
            if let task, !task.isMilestone {
                Button {
                    toggleComplete()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark")
                            .font(.system(size: 11, weight: .heavy))
                        Text(task.isCompleted ? "مكتملة" : "وضع علامة الإكمال")
                            .font(MFont.text(12, .bold))
                    }
                    .foregroundStyle(task.isCompleted ? Color(hex: "#F7F3EB") : MTheme.ink2)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(
                        RoundedRectangle(cornerRadius: MTheme.rField)
                            .fill(task.isCompleted ? MTheme.success : .clear)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: MTheme.rField)
                            .stroke(task.isCompleted ? MTheme.success : MTheme.line, lineWidth: 1.5)
                    )
                }
                .buttonStyle(.plain)
            }
            Spacer()
            if let task {
                Button {
                    toggleLike()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: task.likedByMe ? "hand.thumbsup.fill" : "hand.thumbsup")
                            .font(.system(size: 14))
                        Text("\(task.likes.count)")
                            .font(MFont.text(12, .semibold))
                    }
                    .foregroundStyle(task.likedByMe ? MTheme.saffron : MTheme.muted)
                    .padding(8)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    // ─── بطاقة الاعتماد ───
    @ViewBuilder
    private func approvalCard(_ task: TaskDetail) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "info.circle")
                    .font(.system(size: 13, weight: .semibold))
                Text("مهمة اعتماد" + approvalSuffix(task.approvalStatus))
                    .font(MFont.text(12, .bold))
            }
            .foregroundStyle(MTheme.review)
            if task.approvalStatus == "pending" {
                HStack(spacing: 6) {
                    approvalButton("اعتماد", fill: MTheme.success) { decide("approved") }
                    approvalButton("طلب تعديل", stroke: MTheme.wait) { decide("changes_requested") }
                    approvalButton("رفض", stroke: MTheme.danger) { decide("rejected") }
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: MTheme.rField).fill(MTheme.review.opacity(0.05)))
        .overlay(RoundedRectangle(cornerRadius: MTheme.rField).stroke(MTheme.review.opacity(0.3), lineWidth: 1))
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }

    private func approvalSuffix(_ s: String?) -> String {
        switch s {
        case "approved": " — معتمدة ✓"
        case "changes_requested": " — طُلبت تعديلات"
        case "rejected": " — مرفوضة"
        default: ""
        }
    }

    private func approvalButton(
        _ label: String,
        fill: Color? = nil,
        stroke: Color? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(label)
                .font(MFont.text(11.5, .bold))
                .foregroundStyle(fill != nil ? Color(hex: "#F7F3EB") : (stroke ?? MTheme.ink))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(RoundedRectangle(cornerRadius: MTheme.rField).fill(fill ?? .clear))
                .overlay(RoundedRectangle(cornerRadius: MTheme.rField).stroke(stroke ?? .clear, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
    }

    // ─── العنوان والحقول ───
    private func titleBlock(_ task: TaskDetail) -> some View {
        HStack(alignment: .top, spacing: 9) {
            if task.isMilestone {
                RoundedRectangle(cornerRadius: 3)
                    .fill(MTheme.review)
                    .frame(width: 15, height: 15)
                    .rotationEffect(.degrees(45))
                    .padding(.top, 6)
            }
            Text(task.title)
                .font(MFont.display(19, 700))
                .foregroundStyle(task.isCompleted ? MTheme.muted : MTheme.ink)
                .lineSpacing(4)
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 4)
    }

    private func fields(_ task: TaskDetail) -> some View {
        VStack(spacing: 2) {
            fieldRow("المسؤول") {
                if let a = task.assignee {
                    HStack(spacing: 7) {
                        AvatarView(name: a.name, colorHex: a.avatarColor, size: 24)
                        Text(a.name).font(MFont.text(13, .semibold)).foregroundStyle(MTheme.ink)
                    }
                } else {
                    Text("بلا مسؤول").font(MFont.text(12)).foregroundStyle(MTheme.muted)
                }
            }
            fieldRow("الاستحقاق") {
                if let due = MDate.due(task.dueAt, done: task.isCompleted) {
                    Text(due.label)
                        .font(MFont.text(13, .bold))
                        .foregroundStyle(due.tone == .over ? MTheme.danger : due.tone == .near ? MTheme.success : MTheme.muted)
                } else {
                    Text("بلا تاريخ").font(MFont.text(12)).foregroundStyle(MTheme.muted)
                }
            }
            fieldRow("المشروع") {
                if let p = task.project {
                    HStack(spacing: 6) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color(hex: p.color))
                            .frame(width: 9, height: 9)
                        Text(p.name).font(MFont.text(13, .semibold)).foregroundStyle(MTheme.ink)
                        if let sec = task.section {
                            Text("· \(sec.title)").font(MFont.text(11)).foregroundStyle(MTheme.muted)
                        }
                    }
                } else {
                    Text("بلا مشروع").font(MFont.text(12)).foregroundStyle(MTheme.muted)
                }
            }
            fieldRow("الأولوية") {
                if task.priority != nil {
                    PriorityChip(priority: task.priority)
                } else {
                    Text("بلا أولوية").font(MFont.text(12)).foregroundStyle(MTheme.muted)
                }
            }
        }
        .padding(.horizontal, 16)
    }

    private func fieldRow<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        HStack(spacing: 12) {
            Text(label)
                .font(MFont.text(12, .semibold))
                .foregroundStyle(MTheme.muted)
                .frame(width: 88, alignment: .leading)
            content()
            Spacer()
        }
        .frame(minHeight: 38)
    }

    private func descBlock(_ desc: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("الوصف").font(MFont.text(12, .bold)).foregroundStyle(MTheme.ink2)
            Text(desc)
                .font(MFont.text(13))
                .foregroundStyle(MTheme.ink)
                .lineSpacing(6)
                .padding(11)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(RoundedRectangle(cornerRadius: MTheme.rField).stroke(MTheme.lineSoft, lineWidth: 1))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
    }

    // ─── الفرعيات ───
    private func subtasksBlock(_ task: TaskDetail) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 5) {
                Text("المهام الفرعية").font(MFont.text(12, .bold)).foregroundStyle(MTheme.ink2)
                if !task.subtasks.isEmpty {
                    Text("\(task.subtasks.filter(\.isCompleted).count)/\(task.subtasks.count)")
                        .font(MFont.text(10))
                        .foregroundStyle(MTheme.muted)
                }
            }
            VStack(spacing: 0) {
                if task.subtasks.isEmpty {
                    Text("لا مهام فرعية")
                        .font(MFont.text(11.5))
                        .foregroundStyle(MTheme.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(11)
                } else {
                    ForEach(task.subtasks) { sub in
                        HStack(spacing: 9) {
                            CheckCircle(done: sub.isCompleted, size: 17) { toggleSubtask(sub) }
                            Text(sub.title)
                                .font(MFont.text(13))
                                .foregroundStyle(sub.isCompleted ? MTheme.muted : MTheme.ink)
                            Spacer()
                        }
                        .padding(.horizontal, 11)
                        .frame(minHeight: 42)
                        if sub.id != task.subtasks.last?.id {
                            Divider().overlay(MTheme.lineSoft)
                        }
                    }
                }
            }
            .overlay(RoundedRectangle(cornerRadius: MTheme.rField).stroke(MTheme.lineSoft, lineWidth: 1))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    // ─── المتعاونون ───
    private func watchersBlock(_ task: TaskDetail) -> some View {
        HStack(spacing: 8) {
            Text("المتعاونون").font(MFont.text(12, .bold)).foregroundStyle(MTheme.ink2)
            HStack(spacing: -6) {
                ForEach(task.watchers) { w in
                    AvatarView(name: w.user.name, colorHex: w.user.avatarColor, size: 24)
                        .overlay(Circle().stroke(MTheme.surface, lineWidth: 2))
                }
            }
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(MTheme.paper.opacity(0.6))
        .overlay(alignment: .top) { MTheme.lineSoft.frame(height: 1) }
    }

    // ─── سجل النشاط والتعليقات ───
    private func feedBlock(_ task: TaskDetail) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(task.activity.suffix(6).reversed()) { a in
                HStack(spacing: 4) {
                    Text(a.user?.name ?? "النظام").font(MFont.text(10.5, .bold))
                    Text(activityLabel(a.action)).font(MFont.text(10.5))
                    Text("· \(MDate.relative(a.createdAt))")
                        .font(MFont.text(10))
                        .foregroundStyle(MTheme.muted)
                }
                .foregroundStyle(MTheme.ink2)
            }
            ForEach(task.comments) { c in
                HStack(alignment: .top, spacing: 8) {
                    AvatarView(name: c.user.name, colorHex: c.user.avatarColor, size: 26)
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 7) {
                            Text(c.user.name).font(MFont.text(11.5, .bold)).foregroundStyle(MTheme.ink)
                            Text(MDate.relative(c.createdAt))
                                .font(MFont.text(9.5))
                                .foregroundStyle(MTheme.muted)
                        }
                        Text(c.content)
                            .font(MFont.text(12.5))
                            .foregroundStyle(MTheme.ink)
                            .lineSpacing(4)
                    }
                    .padding(9)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: MTheme.rField).fill(MTheme.paper.opacity(0.7)))
                    .overlay(RoundedRectangle(cornerRadius: MTheme.rField).stroke(MTheme.lineSoft, lineWidth: 1))
                }
            }
        }
        .padding(16)
    }

    private func activityLabel(_ action: String) -> String {
        switch action {
        case "created": "أنشأ المهمة"
        case "completed": "أكمل المهمة"
        case "uncompleted": "أعاد فتح المهمة"
        case "assigned": "غيّر المسؤول"
        case "updated": "عدّل الحقول"
        case "approval_decided": "بتّ في الاعتماد"
        case "commented": "علّق"
        default: action
        }
    }

    // ─── محرر التعليق ───
    private var commentBar: some View {
        HStack(spacing: 8) {
            AvatarView(name: app.me?.name ?? "؟", colorHex: app.me?.avatarColor, size: 28)
            TextField("أضف تعليقًا…", text: $comment)
                .font(MFont.text(13))
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Capsule().fill(MTheme.paper))
                .overlay(Capsule().stroke(MTheme.line, lineWidth: 1))
            Button {
                send()
            } label: {
                Text("تعليق")
                    .font(MFont.text(12, .bold))
                    .foregroundStyle(Color(hex: "#F7F3EB"))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(RoundedRectangle(cornerRadius: MTheme.rField).fill(Color(hex: "#1E2735")))
            }
            .opacity(comment.trimmingCharacters(in: .whitespaces).isEmpty ? 0.4 : 1)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(MTheme.surface)
        .overlay(alignment: .top) { MTheme.line.frame(height: 1) }
    }

    // ─── إجراءات ───
    private func toggleComplete() {
        guard var t = task else { return }
        t.isCompleted.toggle()
        task = t
        if t.isCompleted { app.showToast("أُنجزت المهمة ✓") }
        Task {
            _ = try? await API.shared.patchTask(taskId, ["isCompleted": t.isCompleted])
            await app.refreshAll()
        }
    }

    private func toggleLike() {
        guard var t = task else { return }
        let newValue = !t.likedByMe
        t.likedByMe = newValue
        if newValue {
            t.likes.append(.init(userId: app.me?.id ?? 0))
        } else {
            t.likes.removeAll { $0.userId == app.me?.id }
        }
        task = t
        Task { try? await API.shared.setLike(taskId, liked: newValue) }
    }

    private func toggleSubtask(_ sub: TaskRow) {
        Task {
            _ = try? await API.shared.patchTask(sub.id, ["isCompleted": !sub.isCompleted])
            await load()
        }
    }

    private func decide(_ decision: String) {
        Task {
            do {
                _ = try await API.shared.decideApproval(taskId, decision: decision)
                await load()
                await app.refreshAll()
                app.showToast(
                    decision == "approved" ? "اعتُمدت المهمة ✓"
                        : decision == "changes_requested" ? "طُلبت تعديلات" : "رُفضت المهمة"
                )
            } catch {
                app.showToast(error.localizedDescription)
            }
        }
    }

    private func send() {
        let text = comment.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        comment = ""
        Task {
            _ = try? await API.shared.addComment(taskId, content: text)
            await load()
        }
    }
}
