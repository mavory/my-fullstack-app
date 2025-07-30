import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Check, X, ChevronLeft, ChevronRight, User, GraduationCap, Cake, Music } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Round, Contestant, Vote } from "@shared/schema";

export default function VotingInterface() {
  const [currentContestantIndex, setCurrentContestantIndex] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: activeRound } = useQuery<Round>({
    queryKey: ["/api/rounds/active"],
  });

  const { data: contestants = [], isLoading } = useQuery<Contestant[]>({
    queryKey: ["/api/contestants/round", activeRound?.id],
    enabled: !!activeRound?.id,
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

  const currentContestant = contestants[currentContestantIndex];
  const currentVote = userVotes.find((vote) => vote.contestantId === currentContestant?.id);

  const handleVote = (vote: boolean) => {
    if (currentContestant) {
      voteMutation.mutate({ contestantId: currentContestant.id, vote });
    }
  };

  const nextContestant = () => {
    if (currentContestantIndex < contestants.length - 1) {
      setCurrentContestantIndex(currentContestantIndex + 1);
    }
  };

  const previousContestant = () => {
    if (currentContestantIndex > 0) {
      setCurrentContestantIndex(currentContestantIndex - 1);
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
          <p className="text-lg text-secondary/75">Momentálně není aktivní žádné kolo</p>
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
          <p className="text-lg text-secondary/75">V tomto kole nejsou žádní soutěžící</p>
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

      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Voting Controls */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-secondary mb-8">Vaše hodnocení</h2>
            
            {/* Voting Buttons */}
            <div className="flex justify-center gap-8 mb-8">
              {/* Negative Vote */}
              <Button
                onClick={() => handleVote(false)}
                disabled={voteMutation.isPending}
                className="w-24 h-24 rounded-full bg-destructive hover:bg-destructive/90 shadow-lg transition-all duration-200 transform hover:scale-110"
                size="icon"
              >
                {voteMutation.isPending ? (
                  <LoadingSpinner size="md" className="text-white" />
                ) : (
                  <X className="w-12 h-12" />
                )}
              </Button>
              
              {/* Positive Vote */}
              <Button
                onClick={() => handleVote(true)}
                disabled={voteMutation.isPending}
                className="w-24 h-24 rounded-full bg-success hover:bg-success/90 shadow-lg transition-all duration-200 transform hover:scale-110"
                size="icon"
              >
                {voteMutation.isPending ? (
                  <LoadingSpinner size="md" className="text-white" />
                ) : (
                  <Check className="w-12 h-12" />
                )}
              </Button>
            </div>

            <div className="text-sm text-secondary/75 mb-4">
              <span className="text-destructive font-semibold">Červená</span> = Nepostoupí |{" "}
              <span className="text-success font-semibold">Zelená</span> = Postoupí
            </div>

            {/* Current Vote Status */}
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-secondary/75 mb-1">
                  Váš hlas pro aktuálního soutěžícího:
                </div>
                <div className="font-semibold text-secondary">
                  {currentVote ? (
                    <span className={currentVote.vote ? "text-success" : "text-destructive"}>
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
              
              {/* Contestant Card */}
              <div className="text-center">
                {/* Contestant Photo Placeholder */}
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
                
                {/* Performance Description */}
                {currentContestant?.description && (
                  <Card className="mt-4">
                    <CardContent className="p-4">
                      <div className="text-sm text-secondary/75 mb-1">Popis vystoupení:</div>
                      <p className="text-sm text-secondary">{currentContestant.description}</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center mt-6">
                <Button
                  onClick={previousContestant}
                  disabled={currentContestantIndex === 0}
                  variant="ghost"
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Předchozí</span>
                </Button>
                
                <div className="text-sm text-secondary/75">
                  {currentContestantIndex + 1} z {contestants.length}
                </div>
                
                <Button
                  onClick={nextContestant}
                  disabled={currentContestantIndex === contestants.length - 1}
                  variant="ghost"
                  className="flex items-center gap-2"
                >
                  <span>Další</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
