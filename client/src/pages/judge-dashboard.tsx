import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Vote, History, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";

export default function JudgeDashboard() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-background">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-secondary">
          Porotcovský panel
        </h1>

        {/* User Info Box */}
        <Card className="shadow-md w-full sm:w-auto">
          <CardContent className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:gap-4 gap-2">
            <div className="text-left sm:text-right flex-1">
              <div className="text-sm text-secondary/75">Přihlášen jako:</div>
              <div className="font-semibold text-secondary">{user?.name}</div>
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

      {/* Main Action Buttons */}
      <div className="flex justify-center">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
          {/* Voting Button */}
          <Link href="/voting">
            <Card className="hover:shadow-xl transition-shadow cursor-pointer transform hover:scale-105 duration-200">
              <CardContent className="p-6 sm:p-8 text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Vote className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-secondary mb-2">
                  Hlasování
                </h3>
                <p className="text-secondary/75 text-sm sm:text-base">
                  Hlasujte pro aktuální soutěžící
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* History Button */}
          <Link href="/history">
            <Card className="hover:shadow-xl transition-shadow cursor-pointer transform hover:scale-105 duration-200">
              <CardContent className="p-6 sm:p-8 text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <History className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-secondary mb-2">
                  Historie hlasování
                </h3>
                <p className="text-secondary/75 text-sm sm:text-base">
                  Zobrazit výsledky a historii
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
