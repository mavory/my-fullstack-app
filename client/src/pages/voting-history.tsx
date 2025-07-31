import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, User, Check, X, HelpCircle, Calendar } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import type { Vote, Round, Contestant } from "@shared/schema";

export default function VotingHistory() {
  const { user } = useAuth();

  const { data: userVotes = [], isLoading: loadingVotes } = useQuery<Vote[]>({
    queryKey: ["/api/votes/user", user?.id],
    enabled: !!user?.id,
  });

  const { data: rounds = [], isLoading: loadingRounds } = useQuery<Round[]>({
    queryKey: ["/api/rounds"],
  });

  if (loadingVotes || loadingRounds) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const totalVotes = userVotes.length;
  const positiveVotes = userVotes.filter((vote) => vote.vote === true).length;
  const negativeVotes = userVotes.filter((vote) => vote.vote === false).length;

  return (
    <div className="min-h-screen p-6 bg-background">
      {/* Header */}
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
              <div className="text-2xl font-bold text-black mb-2">{totalVotes}</div>
              <div className="text-secondary/75">Celkově hlasů</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-green-600 mb-2">{positiveVotes}</div>
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
              <h2 className="text-xl font-bold text-secondary">Vaše hlasy</h2>
            </div>

            {userVotes.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-secondary/75">Zatím jste nehlasovali</p>
              </div>
            ) : (
              <div className="divide-y">
                {rounds.map((round) => (
                  <RoundHistory
                    key={round.id}
                    round={round}
                    votes={userVotes}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RoundHistory({ round, votes }: { round: Round; votes: Vote[] }) {
  const { data: contestants = [], isLoading } = useQuery<Contestant[]>({
    queryKey: ["/api/contestants/round", round.id],
    enabled: !!round.id,
  });

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  // 🟢 vezmeme jen hlasy, které patří soutěžícím z tohoto kola
  const roundVotes = votes.filter((vote) =>
    contestants.some((c) => c.id === vote.contestantId)
  );

  if (roundVotes.length === 0) return null;

  return (
    <div className="p-6">
      <h3 className="font-bold mb-4">{round.name}</h3>
      {roundVotes.map((vote) => {
        const contestant = contestants.find((c) => c.id === vote.contestantId);

        return (
          <div key={vote.id} className="flex justify-between items-center py-4 border-b last:border-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <div className="font-medium text-secondary">
                  {contestant
                    ? `${contestant.name} – ${contestant.className || "Neznámá třída"}`
                    : `Neznámý soutěžící (ID: ${vote.contestantId})`}
                </div>
                {contestant && (
                  <div className="text-sm text-secondary/75">
                    {contestant.age} let • {contestant.category}
                  </div>
                )}
                <div className="text-xs text-secondary/50 flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  {vote.createdAt
                    ? new Date(vote.createdAt).toLocaleString("cs-CZ", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Neznámé datum"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-secondary/75">Váš hlas:</span>
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    vote.vote === true
                      ? "bg-green-600"
                      : vote.vote === false
                      ? "bg-destructive"
                      : "bg-gray-400"
                  }`}
                >
                  {vote.vote === true ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : vote.vote === false ? (
                    <X className="w-4 h-4 text-white" />
                  ) : (
                    <HelpCircle className="w-4 h-4 text-white" />
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
