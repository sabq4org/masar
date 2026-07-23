import { Route, Switch, Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Me } from "./lib/types";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Overview from "./pages/Overview";
import MyTasks from "./pages/MyTasks";
import Projects from "./pages/Projects";
import ProjectBoard from "./pages/ProjectBoard";
import Teams from "./pages/Teams";
import CalendarPage from "./pages/CalendarPage";
import Reports from "./pages/Reports";
import Inbox from "./pages/Inbox";
import UsersAdmin from "./pages/UsersAdmin";
import Settings from "./pages/Settings";
import Templates from "./pages/Templates";

function can(me: Me, perm: string) {
  return me.permissions.includes("*") || me.permissions.includes(perm);
}

export default function App() {
  const { data: me, isLoading } = useQuery<Me | null>({ queryKey: ["/api/auth/me"] });

  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center text-ink-3">
        جارٍ التحميل…
      </div>
    );

  if (!me) return <Login />;

  return (
    <Layout me={me}>
      <Switch>
        <Route path="/" component={() => <Overview me={me} />} />
        <Route path="/my" component={MyTasks} />
        <Route path="/projects" component={Projects} />
        <Route path="/projects/:id">{(params) => <ProjectBoard id={Number(params.id)} />}</Route>
        <Route path="/teams" component={Teams} />
        <Route path="/templates">
          {can(me, "projects.manage") ? <Templates /> : <Redirect to="/" />}
        </Route>
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/reports">
          {can(me, "reports.view") ? <Reports /> : <Redirect to="/" />}
        </Route>
        <Route path="/inbox" component={Inbox} />
        <Route path="/users">
          {can(me, "users.manage") ? <UsersAdmin /> : <Redirect to="/" />}
        </Route>
        <Route path="/settings">
          {can(me, "workflow.manage") ? <Settings /> : <Redirect to="/" />}
        </Route>
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </Layout>
  );
}
