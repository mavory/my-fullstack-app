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

/* ===== Komponent ===== */
export default function AdminContestants() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingContestant, setEditingContestant] = useState<Contestant | null>(null);
  const [isImportingCSV, setIsImportingCSV] = useState(false);

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

  /* ===== CSV Import Handler ===== */
  const handleCSVImport = async (roundId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.click();

    input.onchange = async () => {
      if (!input.files?.length) return;
      setIsImportingCSV(true);

      const file = input.files[0];
      const text = await file.text();
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      const newContestants: ContestantForm[] = [];
      const duplicates: string[] = [];

      for (const line of lines) {
        const [name, className, ageStr, category, performanceCategory] = line.split(",").map(s => s.trim());
        const age = parseInt(ageStr || "0", 10);

        // kontrola duplicity
        const exists = (contestantsByRound[roundId] ?? []).some(c =>
          c.name === name && c.className === className && c.age === age && c.roundId === roundId
        );
        if (exists) {
          duplicates.push(name);
          continue;
        }

        newContestants.push({
          name,
          className,
          age,
          category: category || "-",
          description: performanceCategory || "",
          roundId,
          order: (contestantsByRound[roundId]?.length ?? 0) + newContestants.length + 1,
        });
      }

      // vytvořit nové
      for (const c of newContestants) {
        await createContestantMutation.mutateAsync(c);
      }

      setIsImportingCSV(false);

      if (duplicates.length) {
        toast({ title: "CSV Import", description: `Nepřidáno (duplicitní): ${duplicates.join(", ")}`, variant: "warning" });
      } else {
        toast({ title: "CSV Import", description: "Všichni soutěžící přidáni!" });
      }
    };
  };

  if (roundsLoading || anyContestantsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  /* ===== UI ===== */
  return (
    <div className="min-h-screen p-4 sm:p-6 bg-background">
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

        {/* Globální přidání soutěžícího a CSV */}
        <div className="flex flex-col sm:flex-row gap-2">
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
                <DialogTitle>{editingContestant ? "Upravit soutěžícího" : "Nový soutěžící"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jméno</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="className"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Třída</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
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
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kategorie</FormLabel>
                        <FormControl>
                          <Select {...field}>
                            <SelectTrigger>
                              <SelectValue placeholder="Vyber kategorii" />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORY_OPTIONS.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                        <FormLabel>Popis / vystoupení</FormLabel>
                        <FormControl><Textarea {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="roundId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kolo</FormLabel>
                        <FormControl>
                          <Select {...field}>
                            <SelectTrigger>
                              <SelectValue placeholder="Vyber kolo" />
                            </SelectTrigger>
                            <SelectContent>
                              {rounds.map((r) => (
                                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit">{editingContestant ? "Uložit" : "Vytvořit"}</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* CSV import */}
          <Button
            onClick={() => {
              if (!rounds.length) return toast({ title: "Chyba", description: "Žádné kolo k importu.", variant: "destructive" });
              handleCSVImport(rounds[0].id);
            }}
            disabled={isImportingCSV}
          >
            {isImportingCSV ? <LoadingSpinner size="sm" className="mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Import CSV
          </Button>
        </div>
      </div>

      {/* Kola a soutěžící */}
      <div className="grid gap-6">
        {rounds.map((round) => (
          <Card key={round.id}>
            <CardHeader>
              <CardTitle>{round.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(contestantsByRound[round.id] ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Žádní soutěžící v tomto kole.</p>
              ) : (
                <div className="space-y-2">
                  {contestantsByRound[round.id].map((c) => (
                    <div key={c.id} className="flex items-center justify-between border rounded p-2">
                      <div>
                        <p className="font-semibold">{c.name} ({c.className})</p>
                        <p className="text-sm text-muted-foreground">{c.category} - {c.description}</p>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Button size="sm" variant="outline" onClick={() => handleEditContestant(c)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteContestant(c.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={runningTimers[c.id] ? "secondary" : "default"}
                          onClick={() => toggleVisibilityMutation.mutate({ id: c.id, isVisible: !runningTimers[c.id], roundId: c.roundId })}
                        >
                          {runningTimers[c.id] ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </Button>
                        <span className={getTimeColor(timers[c.id] ?? 0)}>
                          {Math.floor((timers[c.id] ?? 0) / 60)
                            .toString()
                            .padStart(2, "0")}:
                          {((timers[c.id] ?? 0) % 60).toString().padStart(2, "0")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
