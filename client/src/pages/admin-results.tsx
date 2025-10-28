import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, User, Check, X, Trophy, ListFilter, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Round, Contestant, Vote, User as UserType } from "@shared/schema";

export default function AdminResults() {
  const [showAllRounds, setShowAllRounds] = useState(false);
  const [isAudienceMode, setIsAudienceMode] = useState(false);
  const [audienceShowAllRounds, setAudienceShowAllRounds] = useState(false);

  const { data: rounds = [], isLoading: roundsLoading } = useQuery<Round[]>({
    queryKey: ["/api/rounds"],
  });

  const { data: allUsers = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  useEffect(() => {
    if (isAudienceMode) {
      document.documentElement.requestFullscreen?.();
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.();
    }
  }, [isAudienceMode]);

  if (roundsLoading) {
    return (
      <div className="h-screen flex items-center justify-center overflow-hidden">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const activeRound = rounds.find((r) => r.isActive);

  let roundsToShow: Round[] = [];
  if (isAudienceMode) {
    roundsToShow = audienceShowAllRounds ? rounds : activeRound ? [activeRound] : [];
  } else if (showAllRounds) {
    roundsToShow = rounds;
  } else if (activeRound) {
    roundsToShow = [activeRound];
  }

  const judges = allUsers.filter((user) => user.role === "judge");

  const handleToggleAudience = () => {
    if (!isAudienceMode) {
      setAudienceShowAllRounds(showAllRounds);
    }
    setIsAudienceMode((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8 overflow-x-hidden">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        {!isAudienceMode && (
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-secondary truncate">
                Online výsledky hlasování
              </h1>
              <p className="text-sm sm:text-base text-secondary/75 truncate">
                {activeRound ? `Aktivní kolo: ${activeRound.name}` : "Žádné aktivní kolo"}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!isAudienceMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllRounds((prev) => !prev)}
              className="flex items-center gap-2"
            >
              <ListFilter className="w-4 h-4" />
              {showAllRounds ? "Jen aktivní kolo" : "Všechna kola"}
            </Button>
          )}

          <Button
            variant="outline"
            size={isAudienceMode ? "icon" : "sm"}
            onClick={handleToggleAudience}
            className="flex items-center gap-2"
          >
            {isAudienceMode ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <>
                <Eye className="w-5 h-5" />
                <span>Režim pro diváky</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {roundsToShow.length === 0 ? (
        !isAudienceMode && (
          <div className="text-center mt-8">
            <p className="text-lg text-secondary/75">
              {showAllRounds ? "Nejsou k dispozici žádná kola" : "Momentálně není aktivní žádné kolo"}
            </p>
          </div>
        )
      ) : (
        <div className="grid gap-6 max-w-6xl mx-auto">
          {roundsToShow.map((round) => (
            <RoundResults key={round.id} round={round} judges={judges} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoundResults({ round, judges }: { round: Round; judges: UserType[] }) {
  const { data: contestants = [], isLoading } = useQuery<Contestant[]>({
    queryKey: ["/api/contestants/round", round.id],
    enabled: !!round.id,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{round.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  // 🟩 TADY: filtrujeme jen soutěžící, kteří jsou aktuálně viditelní pro porotce
  const visibleContestants = contestants.filter((c) => c.isVisibleToJudges);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Trophy className="w-5 h-5 shrink-0" />
          Výsledky – {round.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-secondary/75 mb-4">
          Celkem porotců: {judges.length} | Zobrazení soutěžící: {visibleContestants.length}
        </div>

        {visibleContestants.length === 0 ? (
          <p className="text-secondary/75">V tomto kole nejsou aktuálně žádní viditelní soutěžící</p>
        ) : (
          <div className="space-y-4">
            {visibleContestants.map((contestant) => (
              <ContestantResultCard key={contestant.id} contestant={contestant} totalJudges={judges.length} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContestantResultCard({
  contestant,
  totalJudges,
}: {
  contestant: Contestant;
  totalJudges: number;
}) {
  const { data: votes = [] } = useQuery<Vote[]>({
    queryKey: ["/api/votes/contestant", contestant.id],
  });

  const positiveVotes = votes.filter((v) => v.vote === true).length;
  const negativeVotes = votes.filter((v) => v.vote === false).length;
  const totalVotes = votes.length;
  const percentage = totalJudges > 0 ? Math.round((positiveVotes / totalJudges) * 100) : 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-secondary truncate">{contestant.name}</div>
              <div className="text-xs sm:text-sm text-secondary/75 truncate">
                {contestant.className} • {contestant.age} let • {contestant.category}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:gap-6 gap-4 text-center w-full sm:w-auto">
            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Check className="w-4 h-4 text-success" />
                <span className="text-base sm:text-lg font-bold text-success">{positiveVotes}</span>
              </div>
              <div className="text-xs text-secondary/75">Pozitivní</div>
            </div>

            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <X className="w-4 h-4 text-destructive" />
                <span className="text-base sm:text-lg font-bold text-destructive">{negativeVotes}</span>
              </div>
              <div className="text-xs text-secondary/75">Negativní</div>
            </div>

            <div>
              <div className="text-base sm:text-lg font-bold text-primary">{percentage}%</div>
              <div className="text-xs text-secondary/75">Úspěšnost</div>
            </div>

            <div>
              <div className="text-sm text-secondary/75">
                {totalVotes}/{totalJudges} hlasů
              </div>
              <div className="text-xs text-secondary/75">Účast</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
