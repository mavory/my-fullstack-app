import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient, useQueries } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, User, Edit, Trash2, GraduationCap, Cake, Music, Eye, EyeOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Round, Contestant } from "@shared/schema";

/* ===== Validace ===== */
const contestantSchema = z.object({
  name: z.string().min(1, "Jméno je povinné"),
  className: z.string().min(1, "Třída je povinná"),
  age: z.number().int().min(6).max(18),
  category: z.string().min(1, "Kategorie je povinná"),
  description: z.string().optional(),
  roundId: z.string().min(1, "Kolo je povinné"),
  order: z.number().int().min(1),
});
type ContestantForm = z.infer<typeof contestantSchema>;

const CATEGORY_OPTIONS = [
  "Zpěv","Tanec","Hraní na nástroj","Akrobacie","Ostatní",
  "Recitace","Divadlo","Sportovní vystoupení","Kouzla & triky","Výtvarné umění",
  "Fotografie","Video tvorba","Móda & design","Stand-up","Beatbox",
  "DJ performance","Slam poetry","Literární čtení","Debata / rétorika",
];

/* ===== Komponent ===== */
export default function AdminContestants() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingContestant, setEditingContestant] = useState<Contestant | null>(null);

  const [timers, setTimers] = useState<Record<string, number>>({});
  const [runningTimers, setRunningTimers] = useState<Record<string, boolean>>({});

  const [csvSummary, setCsvSummary] = useState<{ added: number; skipped: string[] } | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setTimers((prev) => {
        const copy = { ...prev };
        for (const key of Object.keys(runningTimers)) {
          if (runningTimers[key]) copy[key] = (copy[key] ?? 0) + 1;
        }
        return copy;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [runningTimers]);

  const { data: rounds = [], isLoading: roundsLoading } = useQuery<Round[]>({
    queryKey: ["/api/rounds"],
  });

  const contestantsPerRoundQueries = useQueries({
    queries: (rounds ?? []).map((r) => ({
      queryKey: ["/api/contestants/round", r.id],
      enabled: !!r?.id,
    })),
  });

  const contestantsByRound: Record<string, Contestant[]> = useMemo(() => {
    const map: Record<string, Contestant[]> = {};
    rounds.forEach((r, idx) => {
      const data = (contestantsPerRoundQueries[idx]?.data as Contestant[] | undefined) ?? [];
      map[r.id] = [...data].sort((a, b) => a.order - b.order);
    });
    return map;
  }, [rounds, contestantsPerRoundQueries]);

  const anyContestantsLoading = contestantsPerRoundQueries.some((q) => q.isLoading);

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

  const invalidateContestantsOf = (roundId?: string) => {
    if (!roundId) {
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "/api/contestants/round" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants/round", roundId] });
    }
  };

  const getTimeColor = (s: number) => (s < 120 ? "text-green-600" : s < 180 ? "text-orange-600" : "text-red-600");

  const createContestantMutation = useMutation({
    mutationFn: async (data: ContestantForm) => {
      const res = await apiRequest("POST", "/api/contestants", data);
      return res.json();
    },
    onSuccess: (_d, vars) => {
      invalidateContestantsOf(vars.roundId);
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: "Soutěžící vytvořen", description: "Nový soutěžící byl přidán." });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se vytvořit soutěžícího.", variant: "destructive" }),
  });

  const updateContestantMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContestantForm> }) => {
      const res = await apiRequest("PUT", `/api/contestants/${id}`, data);
      return res.json();
    },
    onSuccess: (_d, vars) => {
      invalidateContestantsOf(vars.data?.roundId);
      setEditingContestant(null);
      setIsCreateDialogOpen(false);
      toast({ title: "Soutěžící upraven", description: "Údaje byly uloženy." });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se upravit soutěžícího.", variant: "destructive" }),
  });

  const deleteContestantMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await apiRequest("DELETE", `/api/votes/contestant/${id}`, {});
      const res = await apiRequest("DELETE", `/api/contestants/${id}`, {});
      return res.json();
    },
    onSuccess: (_d, vars) => {
      invalidateContestantsOf();
      toast({ title: "Soutěžící smazán", description: "Hlasy odstraněny a soutěžící smazán." });
      setRunningTimers((prev) => ({ ...prev, [vars.id]: false }));
    },
    onError: () => toast({ title: "Chyba", description: "Smazání se nepovedlo.", variant: "destructive" }),
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, isVisible }: { id: string; isVisible: boolean; roundId?: string }) => {
      const res = await apiRequest("PUT", `/api/contestants/${id}/visibility`, { isVisibleToJudges: isVisible });
      return res.json();
    },
    onSuccess: (_d, vars) => {
      invalidateContestantsOf(vars.roundId);
      setRunningTimers((prev) => ({ ...prev, [vars.id]: vars.isVisible }));
      toast({
        title: vars.isVisible ? "Zobrazeno porotcům" : "Skryto porotcům",
        description: vars.isVisible ? "Hlasování povoleno." : "Hlasování zastaveno.",
      });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se změnit viditelnost.", variant: "destructive" }),
  });

  const handleOpenCreate = (roundId?: string) => {
    setIsCreateDialogOpen(true);
    setEditingContestant(null);
    const inRound = roundId ? (contestantsByRound[roundId] ?? []).length : 0;
    form.reset({
      name: "",
      className: "",
      age: 12,
      category: "",
      description: "",
      roundId: roundId ?? "",
      order: inRound + 1,
    });
  };

  const handleEditContestant = (c: Contestant) => {
    setEditingContestant(c);
    setIsCreateDialogOpen(true);
    form.reset({
      name: c.name,
      className: c.className,
      age: c.age,
      category: c.category,
      description: c.description ?? "",
      roundId: c.roundId ?? "",
      order: c.order,
    });
  };

  const handleDeleteContestant = (id: string) => {
    if (confirm("Opravdu smazat soutěžícího? Nejprve se smažou hlasy.")) {
      deleteContestantMutation.mutate({ id });
    }
  };

  const onSubmit = (data: ContestantForm) => {
    if (editingContestant) {
      updateContestantMutation.mutate({ id: editingContestant.id, data });
    } else {
      const count = (contestantsByRound[data.roundId] ?? []).length;
      createContestantMutation.mutate({ ...data, order: count + 1 });
    }
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = text.split("\n").map((r) => r.trim()).filter(Boolean);
      const newContestants: ContestantForm[] = [];
      const skipped: string[] = [];

      rows.forEach((row) => {
        const cols = row.split(",").map((v) => v.trim());
        const [name, className, ageStr, category = "-", description = "-", roundId = ""] = cols;
        const age = parseInt(ageStr || "0", 10);

        const exists = Object.values(contestantsByRound).flat().some(
          (c) => c.name === name && c.className === className && c.age === age && (c.roundId ?? "") === roundId
        );

        if (exists) skipped.push(name + " (" + className + ")");
        else {
          const order = (contestantsByRound[roundId]?.length ?? 0) + newContestants.filter((x) => x.roundId === roundId).length + 1;
          newContestants.push({ name, className, age, category, description, roundId, order });
        }
      });

      newContestants.forEach((c) => createContestantMutation.mutate(c));
      setCsvSummary({ added: newContestants.length, skipped });
    };
    reader.readAsText(file);
  };

  if (roundsLoading || anyContestantsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-lg text-secondary">Načítám data…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-background">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-secondary">Správa soutěžících</h1>
            <p className="text-sm text-secondary/60">Všechna kola níže. Přidávej soutěžící přímo do kol.</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { if (!open) { setIsCreateDialogOpen(false); setEditingContestant(null); form.reset(); }}}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Nový soutěžící</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingContestant ? "Upravit soutěžícího" : "Vytvořit nového soutěžícího"}</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField name="name" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jméno a příjmení</FormLabel>
                      <FormControl><Input {...field} placeholder="Anna Nováková" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField name="className" control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Třída</FormLabel>
                        <FormControl><Input {...field} placeholder="6.A" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}/>
                    <FormField name="age" control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Věk</FormLabel>
                        <FormControl><Input type="number" min={6} max={18} value={field.value} onChange={(e) => field.onChange(parseInt(e.target.value || "0", 10))}/></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}/>
                  </div>
                  <FormField name="category" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategorie</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Vyber kategorii" /></SelectTrigger></FormControl>
                        <SelectContent>{CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField name="description" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Popis vystoupení</FormLabel>
                      <FormControl><Textarea {...field} placeholder="Stručný popis…"/></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField name="roundId" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kolo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Vyber kolo" /></SelectTrigger></FormControl>
                        <SelectContent>{rounds.map((r) => <SelectItem key={r.id} value={r.id}>{r.roundNumber ? `${r.roundNumber}. kolo` : r.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button type="button" variant="secondary" className="flex-1" onClick={() => { setIsCreateDialogOpen(false); setEditingContestant(null); form.reset(); }}>Zrušit</Button>
                    <Button type="submit" className="flex-1" disabled={createContestantMutation.isPending || updateContestantMutation.isPending}>{editingContestant ? "Upravit" : "Vytvořit"}</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded cursor-pointer">
            Import CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
          </label>
        </div>
      </div>

      <div className="max-w-4xl mx-auto grid gap-5">
        {rounds.map((round) => {
          const list = contestantsByRound[round.id] ?? [];
          return (
            <Card key={round.id} className="shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-lg sm:text-xl">{round.roundNumber ? `${round.roundNumber}. kolo` : (round.name ?? "Kolo")}</span>
                    {round.isActive && <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Aktivní</span>}
                  </CardTitle>
                  <div className="mt-1 text-sm text-secondary/70"><span className="mr-3">Soutěžících: <b>{list.length}</b></span></div>
                  {round.description && <p className="mt-1 text-sm text-secondary/70">{round.description}</p>}
                </div>
                <Button onClick={() => handleOpenCreate(round.id)}><Plus className="w-4 h-4 mr-2" /> Přidat soutěžícího</Button>
              </CardHeader>

              <CardContent className="grid gap-3">
                {list.length === 0 ? (
                  <div className="text-secondary/60 text-sm">Zatím žádní soutěžící v tomto kole.</div>
                ) : (
                  list.map((c) => {
                    const time = timers[c.id] ?? 0;
                    return (
                      <Card key={c.id} className="border border-border/60 rounded-xl">
                        <CardContent className="p-4 flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0"><User className="w-6 h-6 text-secondary/60" /></div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-secondary">{c.name}</h3>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.isVisibleToJudges ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>{c.isVisibleToJudges ? "Viditelný porotcům" : "Skrytý"}</span>
                                {time > 0 && <span className={`ml-1 text-xs font-semibold ${getTimeColor(time)}`}>{Math.floor(time / 60)}:{(time % 60).toString().padStart(2, "0")}</span>}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-secondary/75">
                                <span className="inline-flex items-center gap-1"><GraduationCap className="w-4 h-4" />{c.className}</span>
                                <span className="inline-flex items-center gap-1"><Cake className="w-4 h-4" />{c.age} let</span>
                                <span className="inline-flex items-center gap-1"><Music className="w-4 h-4" />{c.category}</span>
                              </div>
                              {c.description && <p className="mt-2 text-sm text-secondary/75 max-w-xl">{c.description}</p>}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button variant={c.isVisibleToJudges ? "outline" : "default"} size="icon" onClick={() => toggleVisibilityMutation.mutate({ id: c.id, isVisible: !c.isVisibleToJudges, roundId: c.roundId ?? undefined })} title={c.isVisibleToJudges ? "Skrýt" : "Zobrazit porotcům"}>{c.isVisibleToJudges ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
                            <Button variant="outline" size="icon" onClick={() => handleEditContestant(c)} title="Upravit"><Edit className="w-4 h-4" /></Button>
                            <Button variant="destructive" size="icon" onClick={() => handleDeleteContestant(c.id)} title="Smazat"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
