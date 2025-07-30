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
    <div className="min-h-screen p-6 bg-background">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Porotcovský panel</h1>
          <p className="text-secondary/75">Husovka má talent</p>
        </div>
        
        {/* User Info */}
        <div className="text-right">
          <div className="text-sm text-secondary/75 mb-1">Přihlášen jako:</div>
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

      {/* Main Action Buttons */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Voting Button */}
        <Link href="/voting">
          <Card className="hover:shadow-xl transition-shadow cursor-pointer transform hover:scale-105 duration-200">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <Vote className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-secondary mb-2">Hlasování</h3>
              <p className="text-secondary/75">Hlasujte pro aktuální soutěžící</p>
            </CardContent>
          </Card>
        </Link>

        {/* History Button */}
        <Link href="/history">
          <Card className="hover:shadow-xl transition-shadow cursor-pointer transform hover:scale-105 duration-200">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-secondary mb-2">Historie hlasování</h3>
              <p className="text-secondary/75">Zobrazit výsledky a historii</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
