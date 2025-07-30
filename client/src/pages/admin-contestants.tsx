import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Plus, User, Edit, Trash2, GraduationCap, Cake, Music } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Round, Contestant } from "@shared/schema";

const contestantSchema = z.object({
  name: z.string().min(1, "Jméno je povinné"),
  className: z.string().min(1, "Třída je povinná"),
  age: z.number().min(6).max(18),
  category: z.string().min(1, "Kategorie je povinná"),
  description: z.string().optional(),
  roundId: z.string().min(1, "Kolo je povinné"),
  order: z.number().min(1),
});

type ContestantForm = z.infer<typeof contestantSchema>;

export default function AdminContestants() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingContestant, setEditingContestant] = useState<Contestant | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rounds = [] } = useQuery<Round[]>({
    queryKey: ["/api/rounds"],
  });

  const { data: activeRound } = useQuery<Round>({
    queryKey: ["/api/rounds/active"],
  });

  const { data: contestants = [], isLoading } = useQuery<Contestant[]>({
    queryKey: ["/api/contestants/round", activeRound?.id],
    enabled: !!activeRound?.id,
  });

  const form = useForm<ContestantForm>({
    resolver: zodResolver(contestantSchema),
    defaultValues: {
      name: "",
      className: "",
      age: 12,
      category: "",
      description: "",
      roundId: activeRound?.id || "",
      order: contestants.length + 1,
    },
  });

  const createContestantMutation = useMutation({
    mutationFn: async (data: ContestantForm) => {
      const response = await apiRequest("POST", "/api/contestants", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants/round", activeRound?.id] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Soutěžící vytvořen",
        description: "Nový soutěžící byl úspěšně přidán",
      });
    },
    onError: () => {
      toast({
        title: "Chyba",
        description: "Nepodařilo se vytvořit soutěžícího",
        variant: "destructive",
      });
    },
  });

  const updateContestantMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContestantForm> }) => {
      const response = await apiRequest("PUT", `/api/contestants/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants/round", activeRound?.id] });
      setEditingContestant(null);
      toast({
        title: "Soutěžící upraven",
        description: "Údaje soutěžícího byly úspěšně upraveny",
      });
    },
    onError: () => {
      toast({
        title: "Chyba",
        description: "Nepodařilo se upravit soutěžícího",
        variant: "destructive",
      });
    },
  });

  const deleteContestantMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/contestants/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants/round", activeRound?.id] });
      toast({
        title: "Soutěžící smazán",
        description: "Soutěžící byl úspěšně odebrán",
      });
    },
    onError: () => {
      toast({
        title: "Chyba",
        description: "Nepodařilo se smazat soutěžícího",
        variant: "destructive",
      });
    },
  });

  const handleCreateContestant = (data: ContestantForm) => {
    createContestantMutation.mutate(data);
  };

  const handleEditContestant = (contestant: Contestant) => {
    setEditingContestant(contestant);
    form.reset({
      name: contestant.name,
      className: contestant.className,
      age: contestant.age,
      category: contestant.category,
      description: contestant.description || "",
      roundId: contestant.roundId || "",
      order: contestant.order,
    });
  };

  const handleUpdateContestant = (data: ContestantForm) => {
    if (editingContestant) {
      updateContestantMutation.mutate({ id: editingContestant.id, data });
    }
  };

  const handleDeleteContestant = (id: string) => {
    if (confirm("Opravdu chcete smazat tohoto soutěžícího?")) {
      deleteContestantMutation.mutate(id);
    }
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
            <h1 className="text-3xl font-bold text-secondary">Správa soutěžících</h1>
            <p className="text-secondary/75">
              {activeRound ? `Kolo: ${activeRound.name}` : "Žádné aktivní kolo"}
            </p>
          </div>
        </div>

        {activeRound && (
          <Dialog open={isCreateDialogOpen || !!editingContestant} onOpenChange={(open) => {
            if (!open) {
              setIsCreateDialogOpen(false);
              setEditingContestant(null);
              form.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nový soutěžící
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingContestant ? "Upravit soutěžícího" : "Vytvořit nového soutěžícího"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(editingContestant ? handleUpdateContestant : handleCreateContestant)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jméno a příjmení</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Anna Nováková" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="className"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Třída</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="6.A" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Věk</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              min="6" 
                              max="18"
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kategorie</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Vyberte kategorii" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Zpěv">Zpěv</SelectItem>
                            <SelectItem value="Tanec">Tanec</SelectItem>
                            <SelectItem value="Hraní na nástroj">Hraní na nástroj</SelectItem>
                            <SelectItem value="Akrobacie">Akrobacie</SelectItem>
                            <SelectItem value="Ostatní">Ostatní</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Popis vystoupení</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Stručný popis toho, co bude soutěžící předvádět..." />
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
                      onClick={() => {
                        setIsCreateDialogOpen(false);
                        setEditingContestant(null);
                        form.reset();
                      }}
                    >
                      Zrušit
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1"
                      disabled={createContestantMutation.isPending || updateContestantMutation.isPending}
                    >
                      {(createContestantMutation.isPending || updateContestantMutation.isPending) ? (
                        <LoadingSpinner size="sm" className="mr-2" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      {editingContestant ? "Upravit" : "Vytvořit"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!activeRound ? (
        <div className="text-center">
          <p className="text-lg text-secondary/75">Momentálně není aktivní žádné kolo</p>
          <p className="text-sm text-secondary/50">Nejprve vytvořte a aktivujte kolo</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          {contestants.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <User className="w-12 h-12 text-secondary/50 mx-auto mb-4" />
                <p className="text-secondary/75">V tomto kole nejsou žádní soutěžící</p>
                <p className="text-sm text-secondary/50">Přidejte prvního soutěžícího pro začátek hlasování</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {contestants.map((contestant) => (
                <Card key={contestant.id}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                          <User className="w-8 h-8 text-gray-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-secondary">{contestant.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-secondary/75 mt-1">
                            <div className="flex items-center gap-1">
                              <GraduationCap className="w-4 h-4" />
                              {contestant.className}
                            </div>
                            <div className="flex items-center gap-1">
                              <Cake className="w-4 h-4" />
                              {contestant.age} let
                            </div>
                            <div className="flex items-center gap-1">
                              <Music className="w-4 h-4" />
                              {contestant.category}
                            </div>
                          </div>
                          {contestant.description && (
                            <p className="text-sm text-secondary/75 mt-2 max-w-md">
                              {contestant.description}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditContestant(contestant)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteContestant(contestant.id)}
                          disabled={deleteContestantMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}