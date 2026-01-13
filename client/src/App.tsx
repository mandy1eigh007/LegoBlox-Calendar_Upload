import { Switch, Route } from "wouter";
import { StoreProvider } from "@/state/store";
import { PlanList } from "@/components/PlanList";
import { Builder } from "@/components/Builder";
import { StudentView } from "@/components/StudentView";
import { PublishedView } from "@/components/PublishedView";

function Router() {
  return (
    <Switch>
      <Route path="/" component={PlanList} />
      <Route path="/plan/:planId" component={Builder} />
      <Route path="/student/:publicId" component={StudentView} />
      <Route path="/p/:slug" component={PublishedView} />
      <Route>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-500">Page not found</p>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  );
}

export default App;
