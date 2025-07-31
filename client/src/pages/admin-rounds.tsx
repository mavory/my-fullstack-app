import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Plus, Play, Pause, Settings, Users } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Round } from "@shared/schema";

const roundSchema = z.object({
  name: z.string().min(1, "Název je povinný"),
  description: z.string().optional(),
  roundNumber: z.number().min(1, "Číslo kola musí být alespoň 1"),
});

type RoundForm = z.infer<typeof roundSchema>;

export default function AdminRounds() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rounds = [], isLoading } = useQuery<Round[]>({
    queryKey: ["/api/rounds"],
  });

  const { data: activeRound } = useQuery<Round>({
    queryKey: ["/api/rounds/active"],
  });

  const form = useForm<RoundForm>({
    resolver: zodResolver(roundSchema),
    defaultValues: {
      name: "",
      description: "",
      roundNumber: rounds.length + 1,
    },
  });

  const createRoundMutation = useMutation({
    mutationFn: async (data: RoundForm) => {
      const response = await apiRequest("POST", "/api/rounds", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rounds"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Kolo vytvořeno",
        description: "Nové kolo bylo úspěšně vytvořeno",
      });
    },
    onError: () => {
      toast({
        title: "Chyba",
        description: "Nepodařilo se vytvořit kolo",
        variant: "destructive",
      });
    },
  });

  const activateRoundMutation = useMutation({
    mutationFn: async (roundId: string) => {
      const response = await apiRequest("PUT", `/api/rounds/${roundId}/activate`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rounds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rounds/active"] });
      toast({
        title: "Kolo aktivováno",
        description: "Kolo bylo úspěšně aktivováno",
      });
    },
    onError: () => {
      toast({
        title: "Chyba",
        description: "Nepodařilo se aktivovat kolo",
        variant: "destructive",
      });
    },
  });

  const deactivateRoundMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/rounds/deactivate", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rounds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rounds/active"] });
      toast({
        title: "Kolo zastaveno",
        description: "Aktivní kolo bylo úspěšně zastaveno",
      });
    },
    onError: () => {
      toast({
        title: "Chyba",
        description: "Nepodařilo se zastavit kolo",
        variant: "destructive",
      });
    },
  });

  const handleCreateRound = (data: RoundForm) =>
    createRoundMutation.mutate(data);
  const handleActivateRound = (roundId: string) =>
    activateRoundMutation.mutate(roundId);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-background">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div className="flex items-center">
          <Link href="/admin">
            <Button variant="ghost" size="icon" className="mr-3">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-secondary">
              Správa kol
            </h1>
            <p className="text-secondary/75 text-sm sm:text-base">
              Vytváření a správa soutěžních kol
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {activeRound && (
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={() => {
                if (confirm("Opravdu chcete zastavit aktivní kolo?")) {
                  deactivateRoundMutation.mutate();
                }
              }}
              disabled={deactivateRoundMutation.isPending}
            >
              {deactivateRoundMutation.isPending ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <Pause className="w-4 h-4 mr-2" />
              )}
              Zastavit kolo
            </Button>
          )}

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Nové kolo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm sm:max-w-md w-[95%] rounded-xl">
              <DialogHeader>
                <DialogTitle>Vytvořit nové kolo</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleCreateRound)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Název</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Popis</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="roundNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Číslo kola</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full">
                    Vytvořit
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* List of rounds */}
      <div className="max-w-3xl mx-auto">
        <div className="grid gap-4">
          {rounds.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Settings className="w-12 h-12 text-secondary/50 mx-auto mb-4" />
                <p className="text-secondary/75">
                  Zatím nejsou vytvořena žádná kola
                </p>
                <p className="text-sm text-secondary/50">
                  Vytvořte první kolo pro začátek soutěže
                </p>
              </CardContent>
            </Card>
          ) : (
            rounds.map((round) => (
              <RoundCard
                key={round.id}
                round={round}
                onActivate={handleActivateRound}
                deactivateRound={deactivateRoundMutation}
                activateRound={activateRoundMutation}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function RoundCard({
  round,
  onActivate,
  deactivateRound,
  activateRound,
}: {
  round: Round;
  onActivate: (id: string) => void;
  deactivateRound: any;
  activateRound: any;
}) {
  const [showContestants, setShowContestants] = useState(false);

  const { data: contestants = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/contestants/round", round.id],
    enabled: !!round.id,
  });

  return (
    <Card className={round.isActive ? "border-primary shadow-md" : ""}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="text-base sm:text-lg font-semibold text-secondary">
                {round.name}
              </h3>
              {round.isActive && (
                <span className="bg-primary text-white px-2 py-1 rounded text-xs font-medium">
                  AKTIVNÍ
                </span>
              )}
            </div>
            {round.description && (
              <p className="text-secondary/75 text-sm mb-2">
                {round.description}
              </p>
            )}
            <div className="text-xs text-secondary/50 flex items-center gap-2">
              Kolo č. {round.roundNumber} •{" "}
              {isLoading ? "Načítání..." : `Soutěžících: ${contestants.length}`}
              {contestants.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowContestants((p) => !p)}
                >
                  <Users className="w-4 h-4 mr-1" />
                  {showContestants ? "Skrýt" : "Zobrazit"}
                </Button>
              )}
            </div>
            {showContestants && contestants.length > 0 && (
              <ul className="mt-2 list-disc list-inside text-sm text-secondary/80">
                {contestants.map((c) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {round.isActive ? (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm("Opravdu chcete zastavit aktivní kolo?")) {
                    deactivateRound.mutate();
                  }
                }}
                disabled={deactivateRound.isPending}
                className="w-full sm:w-auto"
              >
                {deactivateRound.isPending ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <Pause className="w-4 h-4 mr-2" />
                )}
                Zastavit kolo
              </Button>
            ) : (
              <Button
                onClick={() => onActivate(round.id)}
                disabled={activateRound.isPending}
                className="w-full sm:w-auto"
              >
                {activateRound.isPending ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Aktivovat
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
