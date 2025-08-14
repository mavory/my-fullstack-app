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
import { LoadingSpinner } from "@/components/ui/loading-spinner";
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

export default function AdminContestants() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingContestant, setEditingContestant] = useState<Contestant | null>(null);

  // časomíra – sekundy + běžící stav
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [runningTimers, setRunningTimers] = useState<Record<string, boolean>>({});

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

  /* ===== Data: kola ===== */
  const { data: rounds = [], isLoading: roundsLoading } = useQuery<Round[]>({
    queryKey: ["/api/rounds"],
  });

  /* ===== Data: soutěžící per kolo ===== */
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

  /* ===== Form ===== */
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

  /* ===== CSV Import State ===== */
  const [csvImportStatus, setCsvImportStatus] = useState<{
    loading: boolean;
    added: ContestantForm[];
    skipped: string[];
  }>({ loading: false, added: [], skipped: [] });

  /* ===== Helpers ===== */
  const invalidateContestantsOf = (roundId?: string) => {
    if (!roundId) {
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "/api/contestants/round" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants/round", roundId] });
    }
  };

  const getTimeColor = (s: number) => (s < 120 ? "text-green-600" : s < 180 ? "text-orange-600" : "text-red-600");

  /* ===== Mutace ===== */
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

  /* ===== CSV Import Handler ===== */
  const handleCSVImport = (roundId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.click();

    input.onchange = async () => {
      if (!input.files?.length) return;
      setCsvImportStatus({ loading: true, added: [], skipped: [] });

      const file = input.files[0];
      const text = await file.text();
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

      const added: ContestantForm[] = [];
      const skipped: string[] = [];
      const startTime = Date.now();

      for (const line of lines) {
        const [name, className, ageStr, category, description] = line.split(",").map(s => s.trim());
        const age = parseInt(ageStr || "0", 10);
        const exists = (contestantsByRound[roundId] ?? []).some(
          (c) => c.name === name && c.className === className && c.age === age
        );
        if (exists) {
          skipped.push(name);
          continue;
        }
        added.push({
          name,
          className,
          age,
          category: category || "-",
          description: description || "",
          roundId,
          order: (contestantsByRound[roundId]?.length ?? 0) + added.length + 1,
        });
      }

      for (const c of added) {
        await createContestantMutation.mutateAsync(c);
      }

      const elapsed = Date.now() - startTime;
      const remaining = 5000 - elapsed;
      if (remaining > 0) await new Promise(res => setTimeout(res, remaining));

      setCsvImportStatus({ loading: false, added, skipped });
    };
  };

  /* ===== Handlery ===== */
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

  /* ===== Loading (jen initial) ===== */
  if (roundsLoading || anyContestantsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  /* ===== UI ===== */
  return (
    <div className="min-h-screen p-4 sm:p-6 bg-background relative">
      {/* Header */}
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
          {/* CSV Import Button */}
          <Button onClick={() => handleCSVImport("")}>
            <Plus className="w-4 h-4 mr-2" /> Import CSV
          </Button>

          {/* Globální přidání soutěžícího */}
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                setIsCreateDialogOpen(false);
                setEditingContestant(null);
                form.reset();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenCreate()}>
                <Plus className="w-4 h-4 mr-2" /> Nový soutěžící
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingContestant ? "Upravit soutěžícího" : "Vytvořit nového soutěžícího"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Form Fields */}
                  <FormField name="name" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jméno a příjmení</FormLabel>
                      <FormControl><Input {...field} placeholder="Anna Novakova" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField name="className" control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Třída</FormLabel>
                        <FormControl><Input {...field} placeholder="6.A" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField name="age" control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Věk</FormLabel>
                        <FormControl>
                          <Input type="number" min={6} max={18} value={field.value} onChange={(e) => field.onChange(parseInt(e.target.value || "0", 10))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField name="category" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategorie</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Vyber kategorii" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="description" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Popis vystoupení</FormLabel>
                      <FormControl><Textarea {...field} placeholder="Strucny popis…"/></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="roundId" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kolo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Vyber kolo" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {rounds.map((r) => <SelectItem key={r.id} value={r.id}>{r.roundNumber ? `${r.roundNumber}. kolo` : r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button type="button" variant="secondary" className="flex-1" onClick={() => { setIsCreateDialogOpen(false); setEditingContestant(null); form.reset(); }}>Zrusit</Button>
                    <Button type="submit" className="flex-1" disabled={createContestantMutation.isPending || updateContestantMutation.isPending}>
                      {(createContestantMutation.isPending || updateContestantMutation.isPending) && <LoadingSpinner size="sm" className="mr-2" />}
                      {editingContestant ? "Upravit" : "Vytvorit"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* CSV Import Loading + Stats */}
      {csvImportStatus.loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="flex flex-col items-center gap-4 p-6 bg-background rounded shadow-lg">
            <div className="animate-spin border-4 border-t-4 border-gray-300 rounded-full w-16 h-16"></div>
            <p className="text-lg font-medium text-secondary">Importuji CSV...</p>
          </div>
        </div>
      )}

      {!csvImportStatus.loading && (csvImportStatus.added.length > 0 || csvImportStatus.skipped.length > 0) && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="flex flex-col gap-4 p-6 bg-background rounded shadow-lg max-w-sm">
            <h2 className="text-xl font-bold text-secondary">Import dokončen</h2>
            <p>Přidáno: {csvImportStatus.added.length}</p>
            <p>Nezahrnuto (duplicitní): {csvImportStatus.skipped.length}</p>
            {csvImportStatus.skipped.length > 0 && (
              <p className="text-sm text-muted-foreground">Nepřidáno: {csvImportStatus.skipped.join(", ")}</p>
            )}
            <Button onClick={() => setCsvImportStatus({ loading: false, added: [], skipped: [] })}>Zavřít</Button>
          </div>
        </div>
      )}

      {/* Kola a soutěžící */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rounds.map((r) => (
          <Card key={r.id} className="shadow-sm border">
            <CardHeader>
              <CardTitle>{r.roundNumber ? `${r.roundNumber}. kolo` : r.name}</CardTitle>
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={() => handleOpenCreate(r.id)}><Plus className="w-4 h-4 mr-1" /> Přidat</Button>
                <Button size="sm" onClick={() => handleCSVImport(r.id)}>Import CSV</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {contestantsByRound[r.id]?.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2 border rounded hover:bg-gray-50">
                    <div>
                      <p className="font-medium">{c.name} ({c.className})</p>
                      <p className="text-sm text-muted-foreground">{c.category} | {c.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-mono ${getTimeColor(timers[c.id] ?? 0)}`}>{timers[c.id] ?? 0}s</span>
                      <Button size="icon" variant="ghost" onClick={() => toggleVisibilityMutation.mutate({ id: c.id, isVisible: !(c.isVisibleToJudges ?? false), roundId: r.id })}>
                        {(c.isVisibleToJudges ?? false) ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleEditContestant(c)}><Edit className="w-4 h-4"/></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteContestant(c.id)}><Trash2 className="w-4 h-4"/></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
