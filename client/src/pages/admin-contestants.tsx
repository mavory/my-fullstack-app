import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Plus, Trash2, Edit, Eye, EyeOff, User, GraduationCap, Cake, Music } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Contestant, Round } from "@shared/schema";

const contestantSchema = z.object({
  name: z.string().min(1, "Jméno je povinné"),
  className: z.string().min(1, "Třída je povinná"),
  age: z.number().min(6).max(18),
  category: z.string().min(1, "Kategorie je povinná"),
  description: z.string().optional(),
  roundId: z.string().min(1, "Kolo je povinné"),
});

type ContestantForm = z.infer<typeof contestantSchema>;

export default function AdminContestants() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingContestant, setEditingContestant] = useState<Contestant | null>(null);
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [runningTimers, setRunningTimers] = useState<Record<string, boolean>>({});
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);

  // časomíra
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
    queryKey: ["/api/contestants"],
  });

  const form = useForm<ContestantForm>({
    resolver: zodResolver(contestantSchema),
    defaultValues: {
      name: "",
      className: "",
      age: 12,
      category: "",
      description: "",
      roundId: "",
    },
  });

  // Mutace
  const createContestant = useMutation({
    mutationFn: (data: ContestantForm) => apiRequest("POST", "/api/contestants", data).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants"] });
      setEditingContestant(null);
      form.reset();
      toast({ title: "Soutěžící vytvořen", description: "Nový soutěžící byl přidán" });
    },
  });

  const updateContestant = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ContestantForm }) => 
      apiRequest("PUT", `/api/contestants/${id}`, data).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants"] });
      setEditingContestant(null);
      form.reset();
      toast({ title: "Soutěžící upraven", description: "Údaje byly aktualizovány" });
    },
  });

  const deleteContestant = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/votes/contestant/${id}`); // smaž hlasování
      return apiRequest("DELETE", `/api/contestants/${id}`).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants"] });
      toast({ title: "Soutěžící smazán" });
    },
  });

  const toggleVisibility = useMutation({
    mutationFn: ({ id, isVisible }: { id: string; isVisible: boolean }) =>
      apiRequest("PUT", `/api/contestants/${id}/visibility`, { isVisibleToJudges: isVisible }).then(res => res.json()),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants"] });
      setRunningTimers(prev => ({ ...prev, [vars.id]: vars.isVisible }));
    },
  });

  const handleSubmit = (data: ContestantForm) => {
    if (editingContestant) updateContestant.mutate({ id: editingContestant.id, data });
    else createContestant.mutate(data);
  };

  const getTimeColor = (seconds: number) => {
    if (seconds < 120) return "text-green-600";
    if (seconds < 180) return "text-orange-600";
    return "text-red-600";
  };

  if (isLoading) return <div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-background">
      <h1 className="text-2xl font-bold mb-4">Správa soutěžících</h1>

      {/* Tlačítka pro přidání */}
      <div className="flex flex-wrap gap-2 mb-6">
        {rounds.map(round => (
          <Dialog key={round.id} onOpenChange={(open) => { if (!open) setEditingContestant(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { form.setValue("roundId", round.id); setActiveRoundId(round.id); }}>
                <Plus className="w-4 h-4 mr-1" /> Přidat do {round.name}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingContestant ? "Upravit soutěžícího" : "Nový soutěžící"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jméno a příjmení</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={form.control} name="className" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Třída</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={form.control} name="age" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Věk</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategorie</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Vyberte kategorii" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {["Zpěv","Tanec","Hraní na nástroj","Akrobacie","Ostatní","Instrumentální","Výtvarné","Drama","Sportovní","Mluvené slovo","Magic","Stand-up","Tvořivost","Video","Fotografie"].map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Popis vystoupení</FormLabel>
                      <FormControl><Textarea {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <div className="flex gap-2 justify-end">
                    <Button type="submit">{editingContestant ? "Upravit" : "Vytvořit"}</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        ))}
      </div>

      {/* Tabulka soutěžících */}
      <div className="overflow-x-auto">
        <table className="w-full table-auto border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">Jméno</th>
              <th className="p-2 border">Třída</th>
              <th className="p-2 border">Věk</th>
              <th className="p-2 border">Kategorie</th>
              <th className="p-2 border">Kolo</th>
              <th className="p-2 border">Popis</th>
              <th className="p-2 border">Viditelnost</th>
              <th className="p-2 border">Čas</th>
              <th className="p-2 border">Akce</th>
            </tr>
          </thead>
          <tbody>
            {contestants.map(c => (
              <tr key={c.id} className="text-center border-b">
                <td className="p-2">{c.name}</td>
                <td className="p-2">{c.className}</td>
                <td className="p-2">{c.age}</td>
                <td className="p-2">{c.category}</td>
                <td className="p-2">{rounds.find(r => r.id === c.roundId)?.name || "-"}</td>
                <td className="p-2">{c.description}</td>
                <td className="p-2">
                  <Button size="icon" variant="outline" onClick={() => toggleVisibility.mutate({ id: c.id, isVisible: !c.isVisibleToJudges })}>
                    {c.isVisibleToJudges ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </td>
                <td className={`p-2 ${getTimeColor(timers[c.id] || 0)}`}>{Math.floor((timers[c.id] || 0)/60)}:{((timers[c.id]||0)%60).toString().padStart(2,"0")}</td>
                <td className="p-2 flex justify-center gap-1">
                  <Button size="icon" variant="outline" onClick={() => { setEditingContestant(c); form.setValue("roundId", c.roundId); }}>{<Edit className="w-4 h-4" />}</Button>
                  <Button size="icon" variant="destructive" onClick={() => { if(confirm("Opravdu smazat?")) deleteContestant.mutate(c.id); }}>{<Trash2 className="w-4 h-4" />}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
