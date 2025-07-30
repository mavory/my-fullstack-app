import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, User, Check, X, Trophy } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Round, Contestant, Vote, User as UserType } from "@shared/schema";

export default function AdminResults() {
  const { data: activeRound } = useQuery<Round>({
    queryKey: ["/api/rounds/active"],
  });

  const { data: contestants = [], isLoading } = useQuery<Contestant[]>({
    queryKey: ["/api/contestants/round", activeRound?.id],
    enabled: !!activeRound?.id,
  });

  const { data: allUsers = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const judges = allUsers.filter(user => user.role === 'judge');

  return (
    <div className="min-h-screen p-6 bg-background">
      <div className="flex items-center mb-8">
        <Link href="/admin">
          <Button variant="ghost" size="icon" className="mr-4">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-secondary">Online výsledky hlasování</h1>
          <p className="text-secondary/75">
            {activeRound ? `Kolo: ${activeRound.name}` : "Žádné aktivní kolo"}
          </p>
        </div>
      </div>

      {!activeRound ? (
        <div className="text-center">
          <p className="text-lg text-secondary/75">Momentálně není aktivní žádné kolo</p>
        </div>
      ) : (
        <div className="grid gap-6 max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Přehled výsledků - {activeRound.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-secondary/75 mb-4">
                Celkem porotců: {judges.length} | Soutěžících: {contestants.length}
              </div>
              
              {contestants.length === 0 ? (
                <p className="text-secondary/75">V tomto kole nejsou žádní soutěžící</p>
              ) : (
                <div className="space-y-4">
                  {contestants.map((contestant) => (
                    <ContestantResultCard 
                      key={contestant.id} 
                      contestant={contestant} 
                      totalJudges={judges.length}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ContestantResultCard({ contestant, totalJudges }: { 
  contestant: Contestant; 
  totalJudges: number; 
}) {
  const { data: votes = [] } = useQuery<Vote[]>({
    queryKey: ["/api/votes/contestant", contestant.id],
  });

  const positiveVotes = votes.filter(vote => vote.vote === true).length;
  const negativeVotes = votes.filter(vote => vote.vote === false).length;
  const totalVotes = votes.length;
  const percentage = totalJudges > 0 ? Math.round((positiveVotes / totalJudges) * 100) : 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <div className="font-semibold text-secondary">{contestant.name}</div>
              <div className="text-sm text-secondary/75">
                {contestant.className} • {contestant.age} let • {contestant.category}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="flex items-center gap-2 mb-1">
                <Check className="w-4 h-4 text-success" />
                <span className="text-lg font-bold text-success">{positiveVotes}</span>
              </div>
              <div className="text-xs text-secondary/75">Pozitivní</div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center gap-2 mb-1">
                <X className="w-4 h-4 text-destructive" />
                <span className="text-lg font-bold text-destructive">{negativeVotes}</span>
              </div>
              <div className="text-xs text-secondary/75">Negativní</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-bold text-primary">{percentage}%</div>
              <div className="text-xs text-secondary/75">Úspěšnost</div>
            </div>
            
            <div className="text-center">
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