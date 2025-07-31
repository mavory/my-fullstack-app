import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Settings, Users, UserCheck, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

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
    <div className="min-h-screen bg-background flex flex-col px-4 sm:px-6 lg:px-8 overflow-x-hidden overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-secondary">
          Administrátorský panel
        </h1>

        {/* User Info Box */}
        <Card className="w-full md:w-auto shadow-md ml-auto">
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 py-3">
            <div className="text-left sm:text-right flex-1 min-w-0">
              <div className="text-xs sm:text-sm text-secondary/75 truncate">
                Přihlášen jako admin:
              </div>
              <div className="font-semibold text-secondary truncate">
                {user?.name}
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleLogout}
              className="rounded-lg px-3 py-2 flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <LogOut className="w-4 h-4" />
              Odhlásit se
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Admin Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl w-full mx-auto">
        {/* Real-time Results */}
        <Link href="/admin/results">
          <Card className="hover:shadow-xl transition-transform cursor-pointer hover:scale-[1.01] duration-200 min-w-0 will-change-transform overflow-hidden">
            <CardContent className="p-6 text-center flex flex-col items-center">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-primary rounded-full flex items-center justify-center mb-4">
                <BarChart3 className="w-7 h-7 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-secondary mb-2">
                Online výsledky
              </h3>
              <p className="text-xs md:text-sm text-secondary/75">
                Zobrazení aktuálních hlasů porotců
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Round Management */}
        <Link href="/admin/rounds">
          <Card className="hover:shadow-xl transition-transform cursor-pointer hover:scale-[1.01] duration-200 min-w-0 will-change-transform overflow-hidden">
            <CardContent className="p-6 text-center flex flex-col items-center">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-green-600 rounded-full flex items-center justify-center mb-4">
                <Settings className="w-7 h-7 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-secondary mb-2">
                Správa kol
              </h3>
              <p className="text-xs md:text-sm text-secondary/75">
                Vytvoření a editace soutěžních kol
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Contestant Management */}
        <Link href="/admin/contestants">
          <Card className="hover:shadow-xl transition-transform cursor-pointer hover:scale-[1.01] duration-200 min-w-0 will-change-transform overflow-hidden">
            <CardContent className="p-6 text-center flex flex-col items-center">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-red-600 rounded-full flex items-center justify-center mb-4">
                <Users className="w-7 h-7 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-secondary mb-2">
                Správa soutěžících
              </h3>
              <p className="text-xs md:text-sm text-secondary/75">
                Přidání a úprava účastníků
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Judge Management */}
        <Link href="/admin/judges">
          <Card className="hover:shadow-xl transition-transform cursor-pointer hover:scale-[1.01] duration-200 min-w-0 will-change-transform overflow-hidden">
            <CardContent className="p-6 text-center flex flex-col items-center">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-secondary rounded-full flex items-center justify-center mb-4">
                <UserCheck className="w-7 h-7 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-secondary mb-2">
                Správa porotců
              </h3>
              <p className="text-xs md:text-sm text-secondary/75">
                Přidání a správa účtů porotců
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-6xl w-full mx-auto mt-8">
        <Card className="min-w-0">
          <CardContent className="p-4 text-center">
            <div className="text-lg md:text-xl font-bold text-primary">
              {stats?.activeJudges || 0}
            </div>
            <div className="text-xs md:text-sm text-secondary/75">
              Aktivních porotců
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardContent className="p-4 text-center">
            <div className="text-lg md:text-xl font-bold text-green-600">
              {stats?.totalContestants || 0}
            </div>
            <div className="text-xs md:text-sm text-secondary/75">
              Celkem soutěžících
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardContent className="p-4 text-center">
            <div className="text-lg md:text-xl font-bold text-green-600">
              {stats?.currentRound || 0}
            </div>
            <div className="text-xs md:text-sm text-secondary/75">
              Aktuální kolo
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardContent className="p-4 text-center">
            <div className="text-lg md:text-xl font-bold text-secondary">
              {stats?.totalVotes || 0}
            </div>
            <div className="text-xs md:text-sm text-secondary/75">
              Celkem hlasů
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
