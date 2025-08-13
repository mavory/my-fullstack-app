import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  name: z.string().min(1),
  className: z.string().min(1),
  age: z.number().min(6).max(18),
  category: z.string().min(1),
  description: z.string().optional(),
  roundId: z.string().min(1),
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

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        const updated = { ...prev };
        Object.keys(runningTimers).forEach((id) => {
          if (runningTimers[id]) updated[id] = (prev[id] || 0) + 1;
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [runningTimers]);

  const { data: rounds = [] } = useQuery<Round[]>(["/api/rounds"]);
  const { data: activeRound } = useQuery<Round>(["/api/rounds/active"]);

  const { data: contestants = [], isLoading } = useQuery<Contestant[]>({
    queryKey: ["/api/contestants/round", activeRound?.id],
    enabled: !!activeRound?.id,
    staleTime: 1000 * 60,
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
    mutationFn: (data: ContestantForm) => apiRequest("POST", "/api/contestants", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/contestants/round", activeRound?.id]);
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: "Soutěžící vytvořen", description: "Nový soutěžící byl úspěšně přidán" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se vytvořit soutěžícího", variant: "destructive" }),
  });

  const updateContestantMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ContestantForm> }) =>
      apiRequest("PUT", `/api/contestants/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/contestants/round", activeRound?.id]);
      setEditingContestant(null);
      toast({ title: "Soutěžící upraven", description: "Údaje soutěžícího byly úspěšně upraveny" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se upravit soutěžícího", variant: "destructive" }),
  });

  const deleteContestantMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/votes/contestant/${id}`);
      return apiRequest("DELETE", `/api/contestants/${id}`).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/contestants/round", activeRound?.id]);
      toast({ title: "Soutěžící smazán", description: "Soutěžící byl úspěšně odebrán" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se smazat soutěžícího", variant: "destructive" }),
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ id, isVisible }: { id: string; isVisible: boolean }) =>
      apiRequest("PUT", `/api/contestants/${id}/visibility`, { isVisibleToJudges: isVisible }).then(r => r.json()),
    onMutate: async ({ id, isVisible }) => {
      await queryClient.cancelQueries(["/api/contestants/round", activeRound?.id]);
      const previous = queryClient.getQueryData<Contestant[]>(["/api/contestants/round", activeRound?.id]);
      queryClient.setQueryData(["/api/contestants/round", activeRound?.id], (old: any) =>
        old.map((c: Contestant) => (c.id === id ? { ...c, isVisibleToJudges: isVisible } : c))
      );
      setRunningTimers((prev) => ({ ...prev, [id]: isVisible }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["/api/contestants/round", activeRound?.id], context.previous);
      toast({ title: "Chyba", description: "Nepodařilo se změnit zobrazení soutěžícího", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries(["/api/contestants/round", activeRound?.id]),
  });

  const handleCreateContestant = (data: ContestantForm) => createContestantMutation.mutate(data);
  const handleEditContestant = (contestant: Contestant) => {
    setEditingContestant(contestant);
    form.reset({ ...contestant, age: contestant.age || 12 });
  };
  const handleUpdateContestant = (data: ContestantForm) => editingContestant && updateContestantMutation.mutate({ id: editingContestant.id, data });
  const handleDeleteContestant = (id: string) => confirm("Opravdu chcete smazat tohoto soutěžícího?") && deleteContestantMutation.mutate(id);
  const getTimeColor = (seconds: number) => (seconds < 120 ? "text-green-600" : seconds < 180 ? "text-orange-600" : "text-red-600");

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-background">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div className="flex items-center">
          <Link href="/admin">
            <Button variant="ghost" size="icon" className="mr-4"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-secondary">Správa soutěžících</h1>
            <p className="text-secondary/75">{activeRound ? `Kolo: ${activeRound.name}` : "Žádné aktivní kolo"}</p>
          </div>
        </div>

        <Dialog open={isCreateDialogOpen || !!editingContestant} onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingContestant(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nový soutěžící
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingContestant ? "Upravit soutěžícího" : "Vytvořit nového soutěžícího"}</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(editingContestant ? handleUpdateContestant : handleCreateContestant)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Jméno</FormLabel><FormControl><Input {...field} placeholder="Anna Nováková" /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="className" render={({ field }) => (
                  <FormItem><FormLabel>Třída</FormLabel><FormControl><Input {...field} placeholder="6.A" /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="age" render={({ field }) => (
                  <FormItem><FormLabel>Věk</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Kategorie</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Vyberte kategorii" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Zpěv">Zpěv</SelectItem>
                      <SelectItem value="Tanec">Tanec</SelectItem>
                      <SelectItem value="Hraní na nástroj">Hraní na nástroj</SelectItem>
                      <SelectItem value="Akrobacie">Akrobacie</SelectItem>
                      <SelectItem value="Ostatní">Ostatní</SelectItem>
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Popis</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => { setIsCreateDialogOpen(false); setEditingContestant(null); form.reset(); }}>Zrušit</Button>
                  <Button type="submit">{editingContestant ? "Upravit" : "Vytvořit"}</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {!activeRound && <p className="text-red-600">Momentálně není aktivní žádné kolo.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {contestants.map((c) => (
          <Card key={c.id} className="relative">
            <CardContent>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-semibold">{c.name}</h2>
                  <p className="text-sm">{c.className}, {c.age} let</p>
                  <p className="text-sm font-medium">{c.category}</p>
                  {c.description && <p className="mt-1 text-sm text-secondary/80">{c.description}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" onClick={() => handleEditContestant(c)}><Edit className="w-4 h-4" /></Button>
                  <Button size="icon" variant="destructive" onClick={() => handleDeleteContestant(c.id)}><Trash2 className="w-4 h-4" /></Button>
                  <Button size="icon" variant="outline" onClick={() => toggleVisibilityMutation.mutate({ id: c.id, isVisible: !c.isVisibleToJudges })}>
                    {c.isVisibleToJudges ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              {runningTimers[c.id] && <p className={`mt-2 font-bold ${getTimeColor(timers[c.id] || 0)}`}>{Math.floor((timers[c.id]||0)/60)}:{(timers[c.id]||0)%60}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
