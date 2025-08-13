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
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [runningTimers, setRunningTimers] = useState<Record<string, boolean>>({});
  const [selectedRoundId, setSelectedRoundId] = useState<string>("");

  // časomíra
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        const updated = { ...prev };
        Object.keys(runningTimers).forEach((id) => {
          if (runningTimers[id]) updated[id] = (updated[id] || 0) + 1;
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [runningTimers]);

  const { data: rounds = [] } = useQuery<Round[]>({ queryKey: ["/api/rounds"] });
  const { data: contestants = [] } = useQuery<Contestant[]>({ queryKey: ["/api/contestants"] });

  const form = useForm<ContestantForm>({
    resolver: zodResolver(contestantSchema),
    defaultValues: {
      name: "",
      className: "",
      age: 12,
      category: "",
      description: "",
      roundId: "",
      order: 1,
    },
  });

  const createContestantMutation = useMutation({
    mutationFn: async (data: ContestantForm) => {
      const response = await apiRequest("POST", "/api/contestants", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: "Soutěžící vytvořen", description: "Nový soutěžící byl přidán" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se vytvořit soutěžícího", variant: "destructive" }),
  });

  const updateContestantMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContestantForm> }) => {
      const response = await apiRequest("PUT", `/api/contestants/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants"] });
      setEditingContestant(null);
      toast({ title: "Soutěžící upraven", description: "Údaje soutěžícího byly upraveny" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se upravit soutěžícího", variant: "destructive" }),
  });

  const deleteContestantMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/votes/contestant/${id}`, {});
      const response = await apiRequest("DELETE", `/api/contestants/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants"] });
      toast({ title: "Soutěžící smazán", description: "Soutěžící byl odebrán" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se smazat soutěžícího", variant: "destructive" }),
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, isVisible }: { id: string; isVisible: boolean }) => {
      const response = await apiRequest("PUT", `/api/contestants/${id}/visibility`, { isVisibleToJudges: isVisible });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants"] });
      setRunningTimers((prev) => ({ ...prev, [variables.id]: variables.isVisible }));
      toast({
        title: variables.isVisible ? "Soutěžící viditelný" : "Soutěžící skryt",
        description: variables.isVisible ? "Porotci mohou hlasovat" : "Porotci nevidí soutěžícího",
      });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se změnit zobrazení", variant: "destructive" }),
  });

  const handleEditContestant = (c: Contestant) => {
    setEditingContestant(c);
    form.reset({
      name: c.name,
      className: c.className,
      age: c.age,
      category: c.category,
      description: c.description || "",
      roundId: c.roundId,
      order: c.order,
    });
  };

  const handleDeleteContestant = (id: string) => {
    if (confirm("Opravdu chcete smazat tohoto soutěžícího?")) deleteContestantMutation.mutate(id);
  };

  const getTimeColor = (seconds: number) => (seconds < 120 ? "text-green-600" : seconds < 180 ? "text-orange-600" : "text-red-600");

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-background">
      <div className="flex items-center mb-6 gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-secondary">Správa soutěžících</h1>
      </div>

      <Dialog open={isCreateDialogOpen || !!editingContestant} onOpenChange={(open) => {
        if (!open) { setIsCreateDialogOpen(false); setEditingContestant(null); form.reset(); }
      }}>
        <DialogTrigger asChild>
          <Button><Plus className="w-4 h-4 mr-2"/> Nový soutěžící</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContestant ? "Upravit soutěžícího" : "Vytvořit nového soutěžícího"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(editingContestant ? (data) => updateContestantMutation.mutate({id:editingContestant.id,data}) : createContestantMutation.mutate)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Jméno a příjmení</FormLabel>
                  <FormControl><Input {...field} placeholder="Anna Nováková"/></FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              <FormField control={form.control} name="className" render={({ field }) => (
                <FormItem>
                  <FormLabel>Třída</FormLabel>
                  <FormControl><Input {...field} placeholder="6.A"/></FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              <FormField control={form.control} name="age" render={({ field }) => (
                <FormItem>
                  <FormLabel>Věk</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" min="6" max="18" onChange={e=>field.onChange(parseInt(e.target.value))}/>
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategorie</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Vyberte kategorii"/></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Zpěv">Zpěv</SelectItem>
                      <SelectItem value="Tanec">Tanec</SelectItem>
                      <SelectItem value="Hraní na nástroj">Hraní na nástroj</SelectItem>
                      <SelectItem value="Akrobacie">Akrobacie</SelectItem>
                      <SelectItem value="Ostatní">Ostatní</SelectItem>
                      <SelectItem value="Nová kategorie 1">Nová kategorie 1</SelectItem>
                      <SelectItem value="Nová kategorie 2">Nová kategorie 2</SelectItem>
                      <SelectItem value="Nová kategorie 3">Nová kategorie 3</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage/>
                </FormItem>
              )}/>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Popis vystoupení</FormLabel>
                  <FormControl><Textarea {...field} placeholder="Stručný popis..."/></FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              <FormField control={form.control} name="roundId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kolo</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Vyberte kolo"/></SelectTrigger></FormControl>
                    <SelectContent>{rounds.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage/>
                </FormItem>
              )}/>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="secondary" className="flex-1" onClick={()=>{setIsCreateDialogOpen(false); setEditingContestant(null); form.reset();}}>Zrušit</Button>
                <Button type="submit" className="flex-1">{editingContestant ? "Upravit" : "Vytvořit"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6">
        {rounds.map(round => {
          const contestantsInRound = contestants.filter(c => c.roundId === round.id);
          return (
            <Card key={round.id} className="p-4">
              <CardHeader className="flex justify-between items-center">
                <CardTitle>{round.name} ({contestantsInRound.length} soutěžících) {round.isActive ? "(Aktivní)" : ""}</CardTitle>
                <Button size="icon" onClick={()=>{setIsCreateDialogOpen(true); form.setValue("roundId", round.id);}}>
                  <Plus className="w-4 h-4"/>
                </Button>
              </CardHeader>
              <CardContent className="grid gap-4">
                {contestantsInRound.length === 0 ? <p className="text-secondary/75">Žádní soutěžící</p> : 
                  contestantsInRound.map(c => {
                    const time = timers[c.id] || 0;
                    return (
                      <Card key={c.id} className="p-3 flex justify-between items-start gap-4">
                        <div className="flex gap-3">
                          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center"><User className="w-6 h-6 text-gray-400"/></div>
                          <div>
                            <h3 className="font-semibold">{c.name}</h3>
                            <p className="text-sm text-secondary/75">{c.className}, {c.age} let, {c.category}</p>
                            {c.description && <p className="text-sm text-secondary/50">{c.description}</p>}
                            {time>0 && <span className={`mt-1 font-semibold ${getTimeColor(time)}`}>{Math.floor(time/60)}:{(time%60).toString().padStart(2,"0")}</span>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant={c.isVisibleToJudges?"outline":"default"} size="icon" onClick={()=>toggleVisibilityMutation.mutate({id:c.id,isVisible:!c.isVisibleToJudges})}>
                            {c.isVisibleToJudges?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                          </Button>
                          <Button variant="outline" size="icon" onClick={()=>handleEditContestant(c)}><Edit className="w-4 h-4"/></Button>
                          <Button variant="destructive" size="icon" onClick={()=>handleDeleteContestant(c.id)}><Trash2 className="w-4 h-4"/></Button>
                        </div>
                      </Card>
                    )
                  })
                }
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
