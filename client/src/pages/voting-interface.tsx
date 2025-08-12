import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Check, X, User, GraduationCap, Cake, Music } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Round, Contestant, Vote } from "@shared/schema";

export default function VotingInterface() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Polling aktivního kola každých 3 vteřin, aby se to aktualizovalo hned, jak se kolo vypne/zapne
  const { data: activeRound } = useQuery<Round>({
    queryKey: ["/api/rounds/active"],
    refetchInterval: 1000,
  });

  const { data: contestants = [], isLoading } = useQuery<Contestant[]>({
    queryKey: ["/api/contestants/visible"],
    enabled: !!activeRound,
  });

  const { data: userVotes = [] } = useQuery<Vote[]>({
    queryKey: ["/api/votes/user", user?.id],
    enabled: !!user?.id,
  });

  const voteMutation = useMutation({
    mutationFn: async ({ contestantId, vote }: { contestantId: string; vote: boolean }) => {
      const response = await apiRequest("POST", "/api/votes", { contestantId, vote });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/votes/user", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/rounds/active"] }); // tady hned refetch aktivního kola
      toast({
        title: "Hlas zaznamenán",
        description: "Váš hlas byl úspěšně zaznamenán!",
      });
    },
    onError: () => {
      toast({
        title: "Chyba",
        description: "Nepodařilo se zaznamenat hlas",
        variant: "destructive",
      });
    },
  });

  const currentContestant = contestants[0];
  const currentVote = userVotes.find((vote) => vote.contestantId === currentContestant?.id);

  const handleVote = (vote: boolean) => {
    if (currentContestant) {
      voteMutation.mutate({ contestantId: currentContestant.id, vote });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!activeRound) {
    return (
      <div className="min-h-screen p-6 bg-background">
        <div className="flex items-center mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-secondary">Hlasování</h1>
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg text-secondary/75">Momentálně není aktivní žádné kolo, vyčkejte nyní</p>
        </div>
      </div>
    );
  }

  if (contestants.length === 0) {
    return (
      <div className="min-h-screen p-6 bg-background">
        <div className="flex items-center mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-secondary">Hlasování - {activeRound.name}</h1>
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg text-secondary/75">Vyčkejte prosím, až se vám zobrazí profil soutěžícího</p>
        </div>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-secondary">
            Hlasování - {activeRound.name}
          </h1>
          <p className="text-secondary/75">
            Soutěžící: {contestants.length} účastníků
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Voting Controls */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-secondary mb-8">Vaše hodnocení</h2>

            <div className="flex justify-center gap-8 mb-8">
              {/* Negative Vote */}
              <Button
                onClick={() => handleVote(false)}
                disabled={voteMutation.isPending}
                className="w-24 h-24 rounded-full bg-red-600 hover:bg-red-700 shadow-lg transition-all duration-200 transform hover:scale-110"
                size="icon"
              >
                {voteMutation.isPending ? (
                  <LoadingSpinner size="md" className="text-white" />
                ) : (
                  <X className="w-12 h-12 text-white" />
                )}
              </Button>

              {/* Positive Vote */}
              <Button
                onClick={() => handleVote(true)}
                disabled={voteMutation.isPending}
                className="w-24 h-24 rounded-full bg-green-600 hover:bg-green-700 shadow-lg transition-all duration-200 transform hover:scale-110"
                size="icon"
              >
                {voteMutation.isPending ? (
                  <LoadingSpinner size="md" className="text-white" />
                ) : (
                  <Check className="w-12 h-12 text-white" />
                )}
              </Button>
            </div>

            <div className="text-sm text-secondary/75 mb-4">
              <span className="text-red-600 font-semibold">Červená</span> = Nepostoupí |{" "}
              <span className="text-green-600 font-semibold">Zelená</span> = Postoupí
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-secondary/75 mb-1">
                  Váš hlas pro aktuálního soutěžícího:
                </div>
                <div className="font-semibold text-secondary">
                  {currentVote ? (
                    <span className={currentVote.vote ? "text-green-600" : "text-red-600"}>
                      {currentVote.vote ? "Postoupí" : "Nepostoupí"}
                    </span>
                  ) : (
                    "Zatím nehlasováno"
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contestant Information */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-2xl font-bold text-secondary mb-6">Aktuální soutěžící</h2>
              <div className="text-center">
                <div className="w-32 h-32 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <User className="w-16 h-16 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-secondary mb-2">
                  {currentContestant?.name}
                </h3>
                <div className="space-y-2 text-secondary">
                  <div className="flex justify-center items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-primary" />
                    <span>Třída: <span className="font-semibold">{currentContestant?.className}</span></span>
                  </div>
                  <div className="flex justify-center items-center gap-2">
                    <Cake className="w-4 h-4 text-primary" />
                    <span>Věk: <span className="font-semibold">{currentContestant?.age} let</span></span>
                  </div>
                  <div className="flex justify-center items-center gap-2">
                    <Music className="w-4 h-4 text-primary" />
                    <span>Kategorie: <span className="font-semibold">{currentContestant?.category}</span></span>
                  </div>
                </div>
                {currentContestant?.description && (
                  <Card className="mt-4">
                    <CardContent className="p-4">
                      <div className="text-sm text-secondary/75 mb-1">Popis vystoupení:</div>
                      <p className="text-sm text-secondary">{currentContestant.description}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
