import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import NotFound from "@/pages/not-found";
import Welcome from "@/pages/welcome";
import JudgeDashboard from "@/pages/judge-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminResults from "@/pages/admin-results";
import AdminRounds from "@/pages/admin-rounds";
import AdminContestants from "@/pages/admin-contestants";
import AdminJudges from "@/pages/admin-judges";
import VotingInterface from "@/pages/voting-interface";
import VotingHistory from "@/pages/voting-history";

function ProtectedRoute({ children, adminOnly = false }: { 
  children: React.ReactNode; 
  adminOnly?: boolean; 
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Welcome />;
  }

  if (adminOnly && user.role !== "admin") {
    return <JudgeDashboard />;
  }

  return <>{children}</>;
}

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/">
        {user ? (
          user.role === "admin" ? <AdminDashboard /> : <JudgeDashboard />
        ) : (
          <Welcome />
        )}
      </Route>
      
      <Route path="/dashboard">
        <ProtectedRoute>
          {user?.role === "admin" ? <AdminDashboard /> : <JudgeDashboard />}
        </ProtectedRoute>
      </Route>
      
      <Route path="/voting">
        <ProtectedRoute>
          <VotingInterface />
        </ProtectedRoute>
      </Route>
      
      <Route path="/history">
        <ProtectedRoute>
          <VotingHistory />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin">
        <ProtectedRoute adminOnly>
          <AdminDashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/results">
        <ProtectedRoute adminOnly>
          <AdminResults />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/rounds">
        <ProtectedRoute adminOnly>
          <AdminRounds />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/contestants">
        <ProtectedRoute adminOnly>
          <AdminContestants />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/judges">
        <ProtectedRoute adminOnly>
          <AdminJudges />
        </ProtectedRoute>
      </Route>
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
