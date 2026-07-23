import { Route, Switch, Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Me } from "./lib/types";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import MyTasks from "./pages/MyTasks";
import Projects from "./pages/Projects";
import ProjectBoard from "./pages/ProjectBoard";
import Inbox from "./pages/Inbox";

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
        <Route path="/" component={MyTasks} />
        <Route path="/projects" component={Projects} />
        <Route path="/projects/:id">{(params) => <ProjectBoard id={Number(params.id)} />}</Route>
        <Route path="/inbox" component={Inbox} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </Layout>
  );
}
