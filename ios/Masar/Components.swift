import SwiftUI

// ─── شعار «مسار»: الكلمة والسطر يخرج من نهايتها إلى النقطة الزعفرانية ───
struct MasarLogoView: View {
    var size: CGFloat = 22

    var body: some View {
        HStack(spacing: size * 0.14) {
            HStack(spacing: size * 0.1) {
                Circle()
                    .fill(MTheme.saffron)
                    .frame(width: size * 0.19, height: size * 0.19)
                Capsule()
                    .fill(MTheme.ink)
                    .frame(width: size * 0.55, height: max(2, size * 0.055))
            }
            .padding(.top, size * 0.42)
            Text("مســار")
                .font(MFont.display(size, 700))
                .foregroundStyle(MTheme.ink)
        }
        .environment(\.layoutDirection, .leftToRight)
        .accessibilityLabel("مسار")
    }
}

// ─── «السطر الساري» — شريط تقدم بنقطة أنت-هنا ───
struct SariLine: View {
    let progress: Double // 0...1
    var color: Color = MTheme.ink
    var height: CGFloat = 3

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let x = w * min(1, max(0, progress))
            ZStack(alignment: .trailing) {
                Capsule().fill(MTheme.line)
                Capsule().fill(color).frame(width: x)
                Circle()
                    .fill(MTheme.saffron)
                    .frame(width: height + 5, height: height + 5)
                    .offset(x: -(x - (height + 5) / 2))
            }
        }
        .frame(height: height + 5)
    }
}

// ─── أفاتار حرفي ───
struct AvatarView: View {
    let name: String
    let colorHex: String?
    var size: CGFloat = 30

    var body: some View {
        Text(String(name.trimmingCharacters(in: .whitespaces).prefix(1)))
            .font(MFont.text(size * 0.42, .bold))
            .foregroundStyle(Color(hex: "#F7F3EB"))
            .frame(width: size, height: size)
            .background(Circle().fill(Color(hex: colorHex ?? "#77705F")))
    }
}

// ─── دائرة الإكمال بنبضة الإنجاز ───
struct CheckCircle: View {
    let done: Bool
    var size: CGFloat = 19
    let action: () -> Void
    @State private var pop = false

    var body: some View {
        Button {
            if !done {
                pop = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.26) { pop = false }
            }
            action()
        } label: {
            ZStack {
                Circle()
                    .stroke(done ? MTheme.success : MTheme.muted.opacity(0.6), lineWidth: 1.5)
                    .background(Circle().fill(done ? MTheme.success : .clear))
                Image(systemName: "checkmark")
                    .font(.system(size: size * 0.5, weight: .bold))
                    .foregroundStyle(done ? Color(hex: "#F7F3EB") : MTheme.muted.opacity(0.45))
            }
            .frame(width: size, height: size)
            .scaleEffect(pop ? 1.25 : 1)
            .animation(.masar, value: pop)
        }
        .buttonStyle(.plain)
        .frame(width: 32, height: 32)
    }
}

// ─── معيّن المعلم (milestone) ───
struct MilestoneDiamond: View {
    var size: CGFloat = 12
    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.2)
            .fill(MTheme.review)
            .frame(width: size, height: size)
            .rotationEffect(.degrees(45))
            .frame(width: 32, height: 32)
    }
}

// ─── مبسولة الأولوية ───
struct PriorityChip: View {
    let priority: String?
    var body: some View {
        if let label = PriorityMeta.label(priority) {
            Text(label)
                .font(MFont.text(9.5, .bold))
                .foregroundStyle(PriorityMeta.color(priority))
                .padding(.horizontal, 7)
                .padding(.vertical, 1.5)
                .background(Capsule().fill(PriorityMeta.color(priority).opacity(0.13)))
        }
    }
}

// ─── تسمية الاستحقاق ───
struct DueLabel: View {
    let dueAt: String?
    let done: Bool
    var size: CGFloat = 11

    var body: some View {
        if let due = MDate.due(dueAt, done: done) {
            Text(due.label)
                .font(MFont.text(size, .bold))
                .foregroundStyle(color(due.tone))
        }
    }

    private func color(_ tone: MDate.Tone) -> Color {
        switch tone {
        case .over: MTheme.danger
        case .near: MTheme.success
        case .far, .none: MTheme.muted
        }
    }
}

// ─── مبسولة حالة المشروع ───
struct ProjectStatusChip: View {
    let status: String?
    var body: some View {
        Text(ProjectStatusMeta.label(status))
            .font(MFont.text(10, .bold))
            .foregroundStyle(ProjectStatusMeta.color(status))
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(Capsule().fill(ProjectStatusMeta.color(status).opacity(0.13)))
    }
}

// ─── بطاقة سطحية موحدة ───
extension View {
    func surfaceCard(radius: CGFloat = MTheme.rCard) -> some View {
        background(
            RoundedRectangle(cornerRadius: radius)
                .fill(MTheme.surface)
                .shadow(color: Color(hex: "#1E2735").opacity(0.08), radius: 1, y: 1)
        )
        .overlay(
            RoundedRectangle(cornerRadius: radius)
                .stroke(MTheme.line, lineWidth: 1)
        )
    }
}

// ─── التوست ───
struct ToastView: View {
    let message: String
    var body: some View {
        Text(message)
            .font(MFont.text(12, .semibold))
            .foregroundStyle(Color(hex: "#F7F3EB"))
            .padding(.horizontal, 18)
            .padding(.vertical, 9)
            .background(Capsule().fill(Color(hex: "#1E2735")))
            .shadow(color: Color(hex: "#1E2735").opacity(0.3), radius: 11, y: 8)
    }
}

// ─── صف مهمة موحد (الرئيسية/مهامي/المشروع) ───
struct TaskRowView: View {
    @EnvironmentObject var app: AppState
    let task: TaskRow
    var showProjectDot = true
    var showAssignee = false

    var body: some View {
        HStack(spacing: 9) {
            if task.isMilestone {
                MilestoneDiamond()
            } else {
                CheckCircle(done: task.isCompleted) { app.toggleComplete(task) }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(task.title)
                    .font(MFont.text(13.5, .semibold))
                    .foregroundStyle(task.isCompleted ? MTheme.muted : MTheme.ink)
                    .strikethrough(task.isCompleted, color: MTheme.muted)
                    .lineLimit(1)
                HStack(spacing: 7) {
                    if !task.isCompleted { PriorityChip(priority: task.priority) }
                    if let p = task.project, showProjectDot {
                        HStack(spacing: 4) {
                            RoundedRectangle(cornerRadius: 2.5)
                                .fill(Color(hex: p.color))
                                .frame(width: 7, height: 7)
                            Text(p.name)
                                .font(MFont.text(10))
                                .foregroundStyle(MTheme.muted)
                                .lineLimit(1)
                        }
                    }
                    if let subs = task.subtasks, !subs.isEmpty {
                        Text("\(subs.filter(\.isCompleted).count)/\(subs.count) فرعية")
                            .font(MFont.text(9.5))
                            .foregroundStyle(MTheme.muted)
                    }
                }
            }
            Spacer(minLength: 4)
            if showAssignee, let a = task.assignee {
                AvatarView(name: a.name, colorHex: a.avatarColor, size: 24)
            }
            DueLabel(dueAt: task.dueAt, done: task.isCompleted)
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 50)
        .contentShape(Rectangle())
    }
}
