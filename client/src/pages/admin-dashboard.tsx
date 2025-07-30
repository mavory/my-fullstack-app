import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Settings, Users, UserCheck, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";

export default function AdminDashboard() {
  const { user, logout } = useAuth();

  const { data: stats } = useQuery<{
    totalVotes: number;
    activeJudges: number;
    totalContestants: number;
    currentRound: number;
  }>({
    queryKey: ["/api/stats"],
  });

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen p-6 bg-background">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Administrátorský panel</h1>
          <p className="text-secondary/75">Správa soutěže Husovka má talent</p>
        </div>
        
        {/* Admin Info */}
        <div className="text-right">
          <div className="text-sm text-secondary/75 mb-1">Přihlášen jako admin:</div>
          <div className="font-semibold text-secondary">{user?.name}</div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="text-primary hover:text-blue-700 transition-colors p-0 h-auto"
          >
            <LogOut className="w-4 h-4 mr-1" />
            Odhlásit se
          </Button>
        </div>
      </div>

      {/* Admin Action Buttons */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {/* Real-time Results */}
        <Card className="hover:shadow-xl transition-shadow cursor-pointer transform hover:scale-105 duration-200">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-bold text-secondary mb-2">Online výsledky</h3>
            <p className="text-sm text-secondary/75">Zobrazení aktuálních hlasů porotců</p>
          </CardContent>
        </Card>

        {/* Round Management */}
        <Card className="hover:shadow-xl transition-shadow cursor-pointer transform hover:scale-105 duration-200">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-bold text-secondary mb-2">Správa kol</h3>
            <p className="text-sm text-secondary/75">Vytvoření a editace soutěžních kol</p>
          </CardContent>
        </Card>

        {/* Contestant Management */}
        <Card className="hover:shadow-xl transition-shadow cursor-pointer transform hover:scale-105 duration-200">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-error rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-bold text-secondary mb-2">Správa soutěžících</h3>
            <p className="text-sm text-secondary/75">Přidání a úprava účastníků</p>
          </CardContent>
        </Card>

        {/* Judge Management */}
        <Card className="hover:shadow-xl transition-shadow cursor-pointer transform hover:scale-105 duration-200">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCheck className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-bold text-secondary mb-2">Správa porotců</h3>
            <p className="text-sm text-secondary/75">Přidání a správa účtů porotců</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto mt-8">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-xl font-bold text-primary">{stats?.activeJudges || 0}</div>
            <div className="text-sm text-secondary/75">Aktivních porotců</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-xl font-bold text-success">{stats?.totalContestants || 0}</div>
            <div className="text-sm text-secondary/75">Celkem soutěžících</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-xl font-bold text-error">{stats?.currentRound || 0}</div>
            <div className="text-sm text-secondary/75">Aktuální kolo</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-xl font-bold text-secondary">{stats?.totalVotes || 0}</div>
            <div className="text-sm text-secondary/75">Celkem hlasů</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
