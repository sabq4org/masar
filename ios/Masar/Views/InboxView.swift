import SwiftUI

struct InboxView: View {
    @EnvironmentObject var app: AppState
    @State private var archive = false

    private var rows: [NotificationRow] {
        app.notifications.filter { archive ? $0.isRead : !$0.isRead }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("الوارد")
                .font(MFont.display(20, 700))
                .foregroundStyle(MTheme.ink)
                .padding(.horizontal, 16)
                .padding(.top, 12)

            HStack(spacing: 2) {
                tabButton(false, app.unread > 0 ? "الأنشطة (\(app.unread))" : "الأنشطة")
                tabButton(true, "الأرشيف")
                Spacer()
                if !archive && app.unread > 0 {
                    Button { app.markAllRead() } label: {
                        Text("أرشفة الكل ✓")
                            .font(MFont.text(11, .semibold))
                            .foregroundStyle(MTheme.muted)
                    }
                }
            }
            .padding(.horizontal, 16)
            .overlay(alignment: .bottom) { MTheme.line.frame(height: 1) }

            ScrollView {
                VStack(spacing: 0) {
                    if rows.isEmpty {
                        VStack(spacing: 8) {
                            Image(systemName: "bell")
                                .font(.system(size: 22))
                            Text(archive ? "الأرشيف فارغ" : "لا أنشطة جديدة — كل شيء تحت السيطرة")
                                .font(MFont.text(13))
                        }
                        .foregroundStyle(MTheme.muted)
                        .padding(.vertical, 52)
                        .frame(maxWidth: .infinity)
                    } else {
                        ForEach(rows) { n in
                            row(n)
                            Divider().overlay(MTheme.lineSoft)
                        }
                    }
                }
                .surfaceCard()
                .padding(16)
                .padding(.bottom, 110)
            }
            .refreshable { await app.refreshNotifications() }
        }
    }

    private func tabButton(_ isArchive: Bool, _ label: String) -> some View {
        Button {
            withAnimation(.masar) { archive = isArchive }
        } label: {
            Text(label)
                .font(MFont.text(12, .semibold))
                .foregroundStyle(archive == isArchive ? MTheme.ink : MTheme.muted)
                .padding(.horizontal, 12)
                .padding(.top, 6)
                .padding(.bottom, 8)
                .overlay(alignment: .bottom) {
                    (archive == isArchive ? MTheme.saffron : .clear).frame(height: 2)
                }
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func row(_ n: NotificationRow) -> some View {
        let content = HStack(alignment: .top, spacing: 11) {
            if let actor = n.actor {
                AvatarView(name: actor.name, colorHex: actor.avatarColor, size: 32)
            } else {
                Image(systemName: "bell.fill")
                    .font(.system(size: 13))
                    .foregroundStyle(Color(hex: "#F7F3EB"))
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(MTheme.muted))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(n.title)
                    .font(MFont.text(13, n.isRead ? .medium : .bold))
                    .foregroundStyle(MTheme.ink)
                    .multilineTextAlignment(.leading)
                if let body = n.body {
                    Text(body)
                        .font(MFont.text(11.5))
                        .foregroundStyle(MTheme.muted)
                        .lineLimit(1)
                }
                Text(MDate.relative(n.createdAt))
                    .font(MFont.text(10))
                    .foregroundStyle(MTheme.muted)
            }
            Spacer(minLength: 4)
            Button {
                app.markRead(n, read: !n.isRead)
            } label: {
                Image(systemName: archive ? "arrow.uturn.backward" : "archivebox")
                    .font(.system(size: 13))
                    .foregroundStyle(MTheme.muted)
                    .frame(width: 34, height: 34)
            }
            .buttonStyle(.plain)
        }
        .padding(13)
        .background(n.isRead ? .clear : MTheme.saffron.opacity(0.05))

        if let taskId = n.taskId {
            NavigationLink(value: Route.task(taskId)) { content }
                .buttonStyle(.plain)
                .simultaneousGesture(TapGesture().onEnded {
                    if !n.isRead { app.markRead(n, read: true) }
                })
        } else {
            content
        }
    }
}
