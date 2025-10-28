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
    if (showAllRounds) return; // zablokovat režim pro diváky při všech kolech
    if (!isAudienceMode) setAudienceShowAllRounds(showAllRounds);
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
            disabled={showAllRounds} // disable button při všech kolech
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
            <RoundResults
              key={round.id}
              round={round}
              judges={judges}
              showAllRounds={showAllRounds}
              isAudienceMode={isAudienceMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoundResults({
  round,
  judges,
  showAllRounds,
  isAudienceMode,
}: {
  round: Round;
  judges: UserType[];
  showAllRounds: boolean;
  isAudienceMode: boolean;
}) {
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

  // pokud všechna kola, ukázat všechny soutěžící, jinak jen viditelné
  let displayedContestants = showAllRounds
    ? [...contestants].sort((a, b) => {
        // filtrovat podle procent (pokud jsou nějaké hlasy)
        const votesA = a.votes || [];
        const votesB = b.votes || [];
        const percA = judges.length ? Math.round((votesA.filter((v) => v.vote === true).length / judges.length) * 100) : 0;
        const percB = judges.length ? Math.round((votesB.filter((v) => v.vote === true).length / judges.length) * 100) : 0;
        return percB - percA;
      })
    : contestants.filter((c) => c.isVisibleToJudges);

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
          Celkem porotců: {judges.length} | Zobrazení soutěžící: {displayedContestants.length}
        </div>

        {displayedContestants.length === 0 ? (
          <p className="text-secondary/75">V tomto kole nejsou žádní soutěžící</p>
        ) : (
          <div className="space-y-4">
            {displayedContestants.map((contestant) => (
              <ContestantResultCard
                key={contestant.id}
                contestant={contestant}
                judges={judges}
                showAllRounds={showAllRounds}
                isAudienceMode={isAudienceMode}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContestantResultCard({
  contestant,
  judges,
  showAllRounds,
  isAudienceMode,
}: {
  contestant: Contestant;
  judges: UserType[];
  showAllRounds: boolean;
  isAudienceMode: boolean;
}) {
  const { data: votes = [] } = useQuery<Vote[]>({
    queryKey: ["/api/votes/contestant", contestant.id],
  });

  const positiveVotes = votes.filter((v) => v.vote === true).length;
  const negativeVotes = votes.filter((v) => v.vote === false).length;
  const totalVotes = votes.length;
  const percentage = judges.length > 0 ? Math.round((positiveVotes / judges.length) * 100) : 0;

  // velikost karty a centrace pro režim diváka, jen pokud není všechna kola
  const isBig = isAudienceMode && !showAllRounds;

  return (
    <Card className={`${isBig ? "w-full max-w-4xl mx-auto p-10" : ""}`}>
      <CardContent className={`p-4 ${isBig ? "flex flex-col items-center justify-center text-center" : ""}`}>
        <div className={`flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 ${isBig ? "w-full" : ""}`}>
          <div className="flex items-center gap-3">
            <div className={`bg-gray-200 rounded-full flex items-center justify-center shrink-0 ${isBig ? "w-32 h-32" : "w-10 h-10 sm:w-12 sm:h-12"}`}>
              <User className={`text-gray-400 ${isBig ? "w-20 h-20" : "w-5 h-5 sm:w-6 sm:h-6"}`} />
            </div>
            <div className="min-w-0">
              <div className={`font-semibold text-secondary ${isBig ? "text-4xl" : "truncate"}`}>{contestant.name}</div>
              <div className={`text-secondary/75 ${isBig ? "text-xl" : "text-xs sm:text-sm truncate"}`}>
                {contestant.className} • {contestant.age} let • {contestant.category}
              </div>
            </div>
          </div>

          <div className={`grid grid-cols-2 sm:flex sm:gap-6 gap-4 text-center w-full sm:w-auto ${isBig ? "mt-6" : ""}`}>
            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Check className="w-4 h-4 text-success" />
                <span className={`text-base sm:text-lg font-bold text-success ${isBig ? "text-2xl" : ""}`}>{positiveVotes}</span>
              </div>
              <div className={`text-xs text-secondary/75 ${isBig ? "text-lg" : ""}`}>Pozitivní</div>
            </div>

            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <X className="w-4 h-4 text-destructive" />
                <span className={`text-base sm:text-lg font-bold text-destructive ${isBig ? "text-2xl" : ""}`}>{negativeVotes}</span>
              </div>
              <div className={`text-xs text-secondary/75 ${isBig ? "text-lg" : ""}`}>Negativní</div>
            </div>

            <div>
              <div className={`text-base sm:text-lg font-bold text-primary ${isBig ? "text-2xl" : ""}`}>{percentage}%</div>
              <div className={`text-xs text-secondary/75 ${isBig ? "text-lg" : ""}`}>Úspěšnost</div>
            </div>

            <div>
              <div className={`text-sm text-secondary/75 ${isBig ? "text-lg" : ""}`}>
                {totalVotes}/{judges.length} hlasů
              </div>
              <div className={`text-xs text-secondary/75 ${isBig ? "text-lg" : ""}`}>Účast</div>
            </div>
          </div>

        </div>

        {/* Detail hlasů porotců, jen pokud není showAllRounds */}
        {!showAllRounds && (
          <div className="mt-4 grid grid-cols-5 gap-4 text-center">
            {judges.slice(0, 5).map((judge) => {
              const vote = votes.find((v) => v.userId === judge.id);
              const votedYes = vote?.vote === true;
              const votedNo = vote?.vote === false;

              return (
                <div key={judge.id} className="flex flex-col items-center">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-secondary">
                    {judge.name.split(" ")[0]}
                  </div>
                  <div className="mt-2 text-lg">
                    {votedYes && <Check className="w-5 h-5 text-success mx-auto" />}
                    {votedNo && <X className="w-5 h-5 text-destructive mx-auto" />}
                    {!votedYes && !votedNo && <span className="text-gray-400 text-xl">–</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
