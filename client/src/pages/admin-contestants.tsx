import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Plus, User, Edit, Trash2, GraduationCap, Cake, Music, Eye, EyeOff } from "lucide-react";
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

  // časomíra per soutěžící
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [runningTimers, setRunningTimers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const updated = { ...prev };
        Object.keys(runningTimers).forEach(id => {
          if (runningTimers[id]) updated[id] = (updated[id] || 0) + 1;
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [runningTimers]);

  const { data: rounds = [] } = useQuery<Round[]>({ queryKey: ["/api/rounds"] });

  const { data: contestants = [], isLoading } = useQuery<Contestant[]>({
    queryKey: ["/api/contestants/all"],
  });

  const form = useForm<ContestantForm>({
    resolver: zodResolver(contestantSchema),
    defaultValues: {
      name: "",
      className: "",
      age: 12,
      category: "",
      description: "",
      roundId: rounds[0]?.id || "",
      order: contestants.length + 1,
    },
  });

  const createContestantMutation = useMutation({
    mutationFn: async (data: ContestantForm) => {
      const res = await apiRequest("POST", "/api/contestants", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants/all"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: "Soutěžící vytvořen", description: "Nový soutěžící byl přidán" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se vytvořit soutěžícího", variant: "destructive" }),
  });

  const updateContestantMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContestantForm> }) => {
      const res = await apiRequest("PUT", `/api/contestants/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants/all"] });
      setEditingContestant(null);
      toast({ title: "Soutěžící upraven", description: "Údaje byly úspěšně upraveny" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se upravit soutěžícího", variant: "destructive" }),
  });

  const deleteContestantMutation = useMutation({
    mutationFn: async (id: string) => {
      // nejdřív smažeme hlasy
      await apiRequest("DELETE", `/api/votes/contestant/${id}`);
      const res = await apiRequest("DELETE", `/api/contestants/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants/all"] });
      toast({ title: "Soutěžící smazán", description: "Soutěžící byl odebrán" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se smazat soutěžícího", variant: "destructive" }),
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, isVisible }: { id: string; isVisible: boolean }) => {
      const res = await apiRequest("PUT", `/api/contestants/${id}/visibility`, { isVisibleToJudges: isVisible });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants/all"] });
      setRunningTimers(prev => ({ ...prev, [variables.id]: variables.isVisible }));
      toast({
        title: variables.isVisible ? "Soutěžící viditelný porotcům" : "Soutěžící skryt",
      });
    },
  });

  const handleCreateContestant = (data: ContestantForm) => createContestantMutation.mutate(data);
  const handleEditContestant = (c: Contestant) => {
    setEditingContestant(c);
    form.reset({ ...c });
  };
  const handleUpdateContestant = (data: ContestantForm) => editingContestant && updateContestantMutation.mutate({ id: editingContestant.id, data });
  const handleDeleteContestant = (id: string) => confirm("Opravdu chcete smazat tohoto soutěžícího?") && deleteContestantMutation.mutate(id);

  const getTimeColor = (seconds: number) => seconds < 120 ? "text-green-600" : seconds < 180 ? "text-orange-600" : "text-red-600";

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-background">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div className="flex items-center">
          <Link href="/admin"><Button variant="ghost" size="icon" className="mr-4"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-secondary">Správa soutěžících</h1>
            <p className="text-secondary/75">Všechna kola</p>
          </div>
        </div>
        <Dialog open={isCreateDialogOpen || !!editingContestant} onOpenChange={(open) => { if (!open) { setIsCreateDialogOpen(false); setEditingContestant(null); form.reset(); }}}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Nový soutěžící</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingContestant ? "Upravit soutěžícího" : "Vytvořit nového soutěžícího"}</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(editingContestant ? handleUpdateContestant : handleCreateContestant)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Jméno a příjmení</FormLabel><FormControl><Input {...field} placeholder="Anna Nováková" /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="className" render={({ field }) => (<FormItem><FormLabel>Třída</FormLabel><FormControl><Input {...field} placeholder="6.A" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="age" render={({ field }) => (<FormItem><FormLabel>Věk</FormLabel><FormControl><Input {...field} type="number" min="0" max="20" onChange={(e) => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Kategorie</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Vyberte kategorii" /></SelectTrigger></FormControl><SelectContent>
                  {["Zpěv","Tanec","Hraní na nástroj","Akrobacie","Ostatní","Sport","Recitace","Herectví","Malba","Fotografie","Video","IT","Kulinářství","Věda","Robotika","Móda"].map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Popis vystoupení</FormLabel><FormControl><Textarea {...field} placeholder="Stručný popis vystoupení..." /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="roundId" render={({ field }) => (<FormItem><FormLabel>Kolo</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Vyber kolo" /></SelectTrigger></FormControl><SelectContent>
                  {rounds.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent></Select><FormMessage /></FormItem>)} />
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => { setIsCreateDialogOpen(false); setEditingContestant(null); form.reset(); }}>Zrušit</Button>
                  <Button type="submit" className="flex-1" disabled={createContestantMutation.isPending || updateContestantMutation.isPending}>
                    {(createContestantMutation.isPending || updateContestantMutation.isPending) ? <LoadingSpinner size="sm" className="mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    {editingContestant ? "Upravit" : "Vytvořit"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="max-w-5xl mx-auto space-y-4">
        {rounds.map(round => (
          <details key={round.id} className="group border rounded-lg">
            <summary className="flex justify-between items-center p-4 cursor-pointer group-open:bg-gray-50">
              <span className="font-semibold">{round.name}</span>
              <Button size="icon" variant="ghost" onClick={() => setEditingContestant(null)}>
                <Plus className="w-4 h-4" />
              </Button>
            </summary>
            <div className="p-4 grid gap-4">
              {contestants.filter(c => c.roundId === round.id).map(contestant => {
                const time = timers[contestant.id] || 0;
                return (
                  <Card key={contestant.id}>
                    <CardContent className="p-4 sm:p-6 flex justify-between items-start sm:items-center gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center"><User className="w-8 h-8 text-gray-400" /></div>
                        <div>
                          <h3 className="font-semibold text-secondary">{contestant.name}</h3>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-secondary/75 mt-1">
                            <div className="flex items-center gap-1"><GraduationCap className="w-4 h-4" />{contestant.className}</div>
                            <div className="flex items-center gap-1"><Cake className="w-4 h-4" />{contestant.age} let</div>
                            <div className="flex items-center gap-1"><Music className="w-4 h-4" />{contestant.category}</div>
                          </div>
                          {contestant.description && <p className="text-sm text-secondary/75 mt-1">{contestant.description}</p>}
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${contestant.isVisibleToJudges ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>{contestant.isVisibleToJudges ? "Viditelný porotcům" : "Skrytý"}</span>
                            {time > 0 && <span className={`ml-2 font-semibold ${getTimeColor(time)}`}>{Math.floor(time/60)}:{(time%60).toString().padStart(2,"0")}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant={contestant.isVisibleToJudges ? "outline" : "default"} size="icon" onClick={() => toggleVisibilityMutation.mutate({ id: contestant.id, isVisible: !contestant.isVisibleToJudges })}>
                          {contestant.isVisibleToJudges ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => handleEditContestant(contestant)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteContestant(contestant.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {contestants.filter(c => c.roundId === round.id).length === 0 && <p className="text-secondary/75 text-sm">V tomto kole nejsou žádní soutěžící</p>}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
