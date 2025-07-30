import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, User, Check, X } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import type { Vote, Round } from "@shared/schema";

export default function VotingHistory() {
  const { user } = useAuth();

  const { data: userVotes = [], isLoading } = useQuery<Vote[]>({
    queryKey: ["/api/votes/user", user?.id],
    enabled: !!user?.id,
  });

  const { data: rounds = [] } = useQuery<Round[]>({
    queryKey: ["/api/rounds"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Group votes by rounds
  const votesByRound = rounds.map((round) => {
    const roundVotes = userVotes.filter((vote) => {
      // This would need to be joined with contestant data in a real implementation
      return true; // placeholder
    });
    return {
      ...round,
      votes: roundVotes,
    };
  });

  const totalVotes = userVotes.length;
  const positiveVotes = userVotes.filter((vote) => vote.vote === true).length;
  const negativeVotes = userVotes.filter((vote) => vote.vote === false).length;

  return (
    <div className="min-h-screen p-6 bg-background">
      {/* Header with Back Button */}
      <div className="flex items-center mb-8">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="mr-4">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-secondary">Historie hlasování</h1>
          <p className="text-secondary/75">Přehled vašich hlasů a výsledků</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Summary Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-primary mb-2">{totalVotes}</div>
              <div className="text-secondary/75">Celkově hlasů</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-success mb-2">{positiveVotes}</div>
              <div className="text-secondary/75">Pozitivních hlasů</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-destructive mb-2">{negativeVotes}</div>
              <div className="text-secondary/75">Negativních hlasů</div>
            </CardContent>
          </Card>
        </div>

        {/* History List */}
        <Card>
          <CardContent className="p-0">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-secondary">Historie podle hlasů</h2>
            </div>
            
            {userVotes.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-secondary/75">Zatím jste nehlasovali</p>
              </div>
            ) : (
              <div className="divide-y">
                {userVotes.map((vote) => (
                  <div key={vote.id} className="p-6">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <div className="font-medium text-secondary">
                            Soutěžící #{vote.contestantId.slice(-6)}
                          </div>
                          <div className="text-sm text-secondary/75">
                            {vote.createdAt ? new Date(vote.createdAt).toLocaleDateString("cs-CZ") : "Neznámé datum"}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {/* Judge Vote */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-secondary/75">Váš hlas:</span>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            vote.vote ? "bg-success" : "bg-destructive"
                          }`}>
                            {vote.vote ? (
                              <Check className="w-4 h-4 text-white" />
                            ) : (
                              <X className="w-4 h-4 text-white" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
