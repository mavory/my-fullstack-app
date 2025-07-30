import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Plus, Play, Pause, Settings } from "lucide-react";
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

  const handleCreateRound = (data: RoundForm) => {
    createRoundMutation.mutate(data);
  };

  const handleActivateRound = (roundId: string) => {
    activateRoundMutation.mutate(roundId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-background">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Link href="/admin">
            <Button variant="ghost" size="icon" className="mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-secondary">Správa kol</h1>
            <p className="text-secondary/75">Vytváření a správa soutěžních kol</p>
          </div>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nové kolo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vytvořit nové kolo</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateRound)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Název kola</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="např. 1. kolo - Základní školáci" />
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
                      <FormLabel>Popis (volitelný)</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Popis kola..." />
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
                        <Input 
                          {...field} 
                          type="number" 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    className="flex-1"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Zrušit
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={createRoundMutation.isPending}
                  >
                    {createRoundMutation.isPending ? (
                      <LoadingSpinner size="sm" className="mr-2" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Vytvořit
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="grid gap-4">
          {rounds.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Settings className="w-12 h-12 text-secondary/50 mx-auto mb-4" />
                <p className="text-secondary/75">Zatím nejsou vytvořena žádná kola</p>
                <p className="text-sm text-secondary/50">Vytvořte první kolo pro začátek soutěže</p>
              </CardContent>
            </Card>
          ) : (
            rounds.map((round) => (
              <Card key={round.id} className={round.isActive ? "border-primary shadow-md" : ""}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-secondary">{round.name}</h3>
                        {round.isActive && (
                          <span className="bg-primary text-white px-2 py-1 rounded text-xs font-medium">
                            AKTIVNÍ
                          </span>
                        )}
                      </div>
                      {round.description && (
                        <p className="text-secondary/75 text-sm mb-2">{round.description}</p>
                      )}
                      <div className="text-xs text-secondary/50">
                        Kolo č. {round.roundNumber} • Vytvořeno: {new Date(round.createdAt!).toLocaleDateString("cs-CZ")}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {round.isActive ? (
                        <Button variant="outline" disabled>
                          <Pause className="w-4 h-4 mr-2" />
                          Aktivní
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => handleActivateRound(round.id)}
                          disabled={activateRoundMutation.isPending}
                        >
                          {activateRoundMutation.isPending ? (
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}