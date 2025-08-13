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

// validace soutěžícího
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editingContestant, setEditingContestant] = useState<Contestant | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [runningTimers, setRunningTimers] = useState<Record<string, boolean>>({});

  // Časovač pro viditelné soutěžící
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

  // fetch kol a soutěžících
  const { data: rounds = [] } = useQuery<Round[]>({ queryKey: ["/api/rounds"] });
  const { data: contestants = [] } = useQuery<Contestant[]>({
    queryKey: ["/api/contestants"],
  });

  // Form
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

  // mutationy
  const createContestantMutation = useMutation({
    mutationFn: async (data: ContestantForm) => {
      const response = await apiRequest("POST", "/api/contestants", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/contestants"]);
      setOpenDialog(false);
      setEditingContestant(null);
      form.reset();
      toast({ title: "Soutěžící vytvořen", description: "Nový soutěžící byl úspěšně přidán" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se vytvořit soutěžícího", variant: "destructive" }),
  });

  const updateContestantMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContestantForm> }) => {
      const response = await apiRequest("PUT", `/api/contestants/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/contestants"]);
      setEditingContestant(null);
      toast({ title: "Soutěžící upraven", description: "Údaje soutěžícího byly úspěšně upraveny" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se upravit soutěžícího", variant: "destructive" }),
  });

  const deleteContestantMutation = useMutation({
    mutationFn: async (id: string) => {
      // nejdřív smazat hlasy
      await apiRequest("DELETE", `/api/votes/contestant/${id}`);
      // pak soutěžícího
      return apiRequest("DELETE", `/api/contestants/${id}`).then((r) => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/contestants"]);
      toast({ title: "Soutěžící smazán", description: "Soutěžící a jeho hlasy byly smazány" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se smazat soutěžícího", variant: "destructive" }),
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, isVisible }: { id: string; isVisible: boolean }) => {
      const response = await apiRequest("PUT", `/api/contestants/${id}/visibility`, { isVisibleToJudges: isVisible });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(["/api/contestants"]);
      setRunningTimers((prev) => ({ ...prev, [variables.id]: variables.isVisible }));
      toast({
        title: variables.isVisible ? "Soutěžící poslán porotcům" : "Soutěžící skryt před porotci",
        description: variables.isVisible
          ? "Porotci nyní mohou hlasovat"
          : "Porotci už nevidí tohoto soutěžícího",
      });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se změnit zobrazení soutěžícího", variant: "destructive" }),
  });

  const handleEdit = (c: Contestant) => {
    setEditingContestant(c);
    form.reset({ ...c });
    setOpenDialog(true);
  };

  const handleSubmit = (data: ContestantForm) => {
    if (editingContestant) updateContestantMutation.mutate({ id: editingContestant.id, data });
    else createContestantMutation.mutate(data);
  };

  const getTimeColor = (seconds: number) => (seconds < 120 ? "text-green-600" : seconds < 180 ? "text-orange-600" : "text-red-600");

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-background">
      <div className="flex items-center mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon" className="mr-4">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-secondary">Správa soutěžících</h1>
      </div>

      {/* Form Dialog */}
      <Dialog open={openDialog} onOpenChange={(open) => !open && setOpenDialog(false)}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            {editingContestant ? "Upravit soutěžícího" : "Nový soutěžící"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContestant ? "Upravit soutěžícího" : "Vytvořit nového soutěžícího"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Jméno a příjmení</FormLabel>
                  <FormControl><Input {...field} placeholder="Anna Nováková" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="className" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Třída</FormLabel>
                    <FormControl><Input {...field} placeholder="6.A" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="age" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Věk</FormLabel>
                    <FormControl><Input {...field} type="number" min="6" max="18" onChange={(e) => field.onChange(parseInt(e.target.value))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategorie</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Vyberte kategorii" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Zpěv">Zpěv</SelectItem>
                      <SelectItem value="Tanec">Tanec</SelectItem>
                      <SelectItem value="Hraní na nástroj">Hraní na nástroj</SelectItem>
                      <SelectItem value="Akrobacie">Akrobacie</SelectItem>
                      <SelectItem value="Ostatní">Ostatní</SelectItem>
                      <SelectItem value="Recitace">Recitace</SelectItem>
                      <SelectItem value="Malba">Malba</SelectItem>
                      <SelectItem value="Sochařství">Sochařství</SelectItem>
                      <SelectItem value="Sport">Sport</SelectItem>
                      <SelectItem value="Drama">Drama</SelectItem>
                      <SelectItem value="Komedie">Komedie</SelectItem>
                      <SelectItem value="Hudba">Hudba</SelectItem>
                      <SelectItem value="Magie">Magie</SelectItem>
                      <SelectItem value="Kostýmy">Kostýmy</SelectItem>
                      <SelectItem value="Video tvorba">Video tvorba</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Popis vystoupení</FormLabel>
                  <FormControl><Textarea {...field} placeholder="Stručný popis..." /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="roundId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kolo (jen info)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Vyber kolo" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {rounds.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => { setOpenDialog(false); setEditingContestant(null); form.reset(); }}>Zrušit</Button>
                <Button type="submit" className="flex-1">{editingContestant ? "Upravit" : "Vytvořit"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Accordion per round */}
      <div className="space-y-4 mt-6">
        {rounds.map((round) => (
          <Card key={round.id}>
            <CardHeader className="flex justify-between items-center">
              <CardTitle>{round.name}</CardTitle>
              <Button size="sm" onClick={() => { form.setValue("roundId", round.id); setOpenDialog(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Přidat soutěžícího
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {contestants.filter(c => c.roundId === round.id).map((c) => {
                  const time = timers[c.id] || 0;
                  return (
                    <Card key={c.id} className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold">{c.name}</h3>
                          <div className="text-sm text-secondary/75 flex gap-2">
                            <GraduationCap className="w-4 h-4" /> {c.className}
                            <Cake className="w-4 h-4" /> {c.age} let
                            <Music className="w-4 h-4" /> {c.category}
                          </div>
                          {c.description && <p className="text-sm">{c.description}</p>}
                          <span className={`px-2 py-1 rounded text-xs font-medium ${c.isVisibleToJudges ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                            {c.isVisibleToJudges ? "Viditelný" : "Skrytý"}
                          </span>
                          {time > 0 && <span className={`ml-2 font-semibold ${getTimeColor(time)}`}>{Math.floor(time/60)}:{(time%60).toString().padStart(2,"0")}</span>}
                        </div>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(c)}><Edit className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteContestantMutation.mutate(c.id)}><Trash2 className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => toggleVisibilityMutation.mutate({ id: c.id, isVisible: !c.isVisibleToJudges })}>
                            {c.isVisibleToJudges ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
                {contestants.filter(c => c.roundId === round.id).length === 0 && <p className="text-sm text-secondary/70">Žádní soutěžící</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
