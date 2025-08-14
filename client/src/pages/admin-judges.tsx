import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Plus, Mail, User, Edit, Trash2, Shield, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User as UserType, Vote, Contestant, Round } from "@shared/schema";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const userSchema = z.object({
  name: z.string().min(1, "Jméno je povinné"),
  email: z.string().email("Neplatný email"),
  password: z.string().min(6, "Heslo musí mít alespoň 6 znaků"),
});
type UserForm = z.infer<typeof userSchema>;

async function getJSON<T>(method: string, url: string, body?: any): Promise<T> {
  const res = await apiRequest(method as any, url, body);
  return res.json();
}

export default function AdminJudges() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [createRole, setCreateRole] = useState<"admin" | "judge" | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Filtry pro box historie
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>("__ALL__");
  const [selectedRoundId, setSelectedRoundId] = useState<string>("__ALL__");
  const [selectedVoteKind, setSelectedVoteKind] = useState<"__ALL__" | "positive" | "negative">("__ALL__");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // --- USERS (admins + judges) ---
  const { data: users = [], isLoading: isUsersLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });
  const judges = useMemo(() => users.filter((u) => u.role === "judge"), [users]);
  const admins = useMemo(() => users.filter((u) => u.role === "admin"), [users]);
  const judgeIds = useMemo(() => judges.map((j) => j.id), [judges]);

  // --- ROUNDS (všechny) ---
  const { data: rounds = [], isLoading: isRoundsLoading } = useQuery<Round[]>({
    queryKey: ["/api/rounds"],
    queryFn: () => getJSON<Round[]>("GET", "/api/rounds"),
  });
  const roundIds = useMemo(() => rounds.map((r) => r.id), [rounds]);
  const roundsMap = useMemo(() => {
    const m = new Map<string, Round>();
    for (const r of rounds) m.set(r.id, r);
    return m;
  }, [rounds]);

  // --- CONTESTANTS (všichni přes rounds) ---
  const { data: contestants = [], isLoading: isContestantsLoading } = useQuery<Contestant[]>({
    queryKey: ["/api/contestants/byRounds", roundIds],
    enabled: roundIds.length > 0,
    queryFn: async () => {
      const all = await Promise.all(
        roundIds.map((rid) => getJSON<Contestant[]>("GET", `/api/contestants/round/${rid}`))
      );
      return all.flat();
    },
  });
  const contestantsById = useMemo(() => {
    const m = new Map<string, Contestant>();
    for (const c of contestants) m.set(c.id, c);
    return m;
  }, [contestants]);

  // --- VOTES (skrze /api/votes/user/:id pro každého porotce) ---
  type VoteEvent = {
    id: string;
    judgeId: string;
    judgeName: string;
    contestantId: string;
    contestantName: string;
    roundId: string | null;
    roundLabel: string;
    vote: boolean;
    createdAt: string;
  };

  const {
    data: voteEvents = [],
    isLoading: isVotesLoading,
    refetch: refetchVotes,
  } = useQuery<VoteEvent[]>({
    queryKey: ["/api/votes/byJudges", judgeIds, contestants.length, rounds.length],
    enabled: judgeIds.length > 0,
    queryFn: async () => {
      const perJudge = await Promise.all(
        judgeIds.map(async (jid) => {
          const votes = await getJSON<Vote[]>("GET", `/api/votes/user/${jid}`);
          return { jid, votes };
        })
      );

      const events: VoteEvent[] = [];
      for (const { jid, votes } of perJudge) {
        const judgeName = judges.find((j) => j.id === jid)?.name ?? "Neznámý porotce";
        for (const v of votes) {
          const c = contestantsById.get(v.contestantId);
          if (!c) continue;
          const r = c.roundId ? roundsMap.get(c.roundId) : undefined;
          const roundLabel = r
            ? (r.roundNumber != null ? `Kolo ${r.roundNumber}${r.name ? ` – ${r.name}` : ""}` : (r.name ?? "Neznámé kolo"))
            : "Neznámé kolo";
          events.push({
            id: v.id,
            judgeId: jid,
            judgeName,
            contestantId: v.contestantId,
            contestantName: c.name,
            roundId: c.roundId ?? null,
            roundLabel,
            vote: Boolean(v.vote),
            createdAt: (v.createdAt ? new Date(v.createdAt) : new Date()).toISOString(),
          });
        }
      }

      events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return events;
    },
  });

  const availableRoundIds = useMemo(() => {
    const set = new Set<string>();
    for (const e of voteEvents) if (e.roundId) set.add(e.roundId);
    return Array.from(set);
  }, [voteEvents]);

  const filteredEvents = useMemo(() => {
    let list = voteEvents;

    if (selectedJudgeId !== "__ALL__") list = list.filter((e) => e.judgeId === selectedJudgeId);
    if (selectedRoundId !== "__ALL__") list = list.filter((e) => e.roundId === selectedRoundId);
    if (selectedVoteKind !== "__ALL__")
      list = list.filter((e) => (selectedVoteKind === "positive" ? e.vote === true : e.vote === false));

    return list;
  }, [voteEvents, selectedJudgeId, selectedRoundId, selectedVoteKind]);

  // --- Form + mutace uživatelů ---
  const form = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const createUserMutation = useMutation({
    mutationFn: (data: UserForm & { role: string }) => getJSON("POST", "/api/auth/register", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsCreateDialogOpen(false);
      setCreateRole(null);
      form.reset();
      toast({ title: "Uživatel vytvořen", description: "Účet byl přidán." });
      refetchVotes();
    },
    onError: (error: any) => {
      toast({ title: "Chyba", description: error?.message || "Nepodařilo se vytvořit účet", variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserForm> }) =>
      getJSON("PUT", `/api/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      form.reset();
      toast({ title: "Uživatel upraven", description: "Údaje byly upraveny." });
      refetchVotes();
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se upravit účet", variant: "destructive" }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => getJSON("DELETE", `/api/users/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Účet smazán", description: "Uživatel byl odebrán." });
      refetchVotes();
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se smazat účet", variant: "destructive" }),
  });

  const handleCreateUser = (data: UserForm) => {
    if (!createRole) return;
    createUserMutation.mutate({ ...data, role: createRole });
  };
  const handleEditUser = (user: UserType) => {
    setEditingUser(user);
    setShowPassword(false);
    form.reset({ name: user.name, email: user.email, password: "" });
  };
  const handleUpdateUser = (data: UserForm) => {
    if (editingUser) {
      const updateData = data.password ? data : { ...data, password: undefined };
      updateUserMutation.mutate({ id: editingUser.id, data: updateData });
    }
  };
  const handleDeleteUser = (id: string) => {
    if (confirm("Opravdu chcete smazat tento účet?")) deleteUserMutation.mutate(id);
  };
  const generateEmailFromName = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      const surname = parts[parts.length - 1];
      const normalized = surname.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
      return `${normalized}@husovka.cz`;
    }
    return "";
  };

  const renderUserCard = (user: UserType, labelIcon: React.ReactNode) => (
    <Card key={user.id} className="bg-background">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">{labelIcon}</div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-semibold text-secondary">{user.name}</h3>
            <div className="flex items-center justify-center sm:justify-start gap-1 text-sm text-secondary/75">
              <Mail className="w-4 h-4" />
              {user.email}
            </div>
          </div>
          <div className="text-center sm:text-right">
            <div className="text-sm text-secondary/75">
              Vytvořen: {user.createdAt ? new Date(user.createdAt).toLocaleDateString("cs-CZ") : "Neznámo"}
            </div>
            <div className="text-xs text-success">Aktivní</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleEditUser(user)}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDeleteUser(user.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt" });
    doc.setFontSize(16);
    doc.text("Historie hlasování porotců", 40, 40);
    doc.setFontSize(10);
    doc.text("Stránka: https://hlasovani-v2.onrender.com", 40, 58);
    doc.text(`Exportováno: ${new Date().toLocaleString("cs-CZ")}`, 40, 72);

    doc.setTextColor(150);
    doc.setFontSize(50);
    doc.text("HUSOVKA MÁ TALENT", doc.internal.pageSize.getWidth()/2, doc.internal.pageSize.getHeight()/2, { align: "center", angle: 45 });
    doc.setTextColor(0);

    const head = [["Datum / čas", "Porotce", "Soutěžící", "Kolo", "Hlas"]];
    const body = filteredEvents.map((e) => [
      new Date(e.createdAt).toLocaleString("cs-CZ"),
      e.judgeName,
      e.contestantName,
      e.roundLabel,
      e.vote ? "Pozitivní" : "Negativní",
    ]);

    autoTable(doc, {
      head,
      body,
      startY: 100,
      styles: { fontSize: 9, cellPadding: 6, overflow: "linebreak" },
      headStyles: { fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 140 }, 2: { cellWidth: 160 }, 3: { cellWidth: 140 }, 4: { cellWidth: 80 } },
      didDrawPage: (data) => {
        const str = `${doc.getNumberOfPages()}`;
        doc.setFontSize(9);
        doc.text(`Strana ${str}`, doc.internal.pageSize.getWidth() - 60, doc.internal.pageSize.getHeight() - 20);
      },
    });

    doc.save(`hlasovani_${Date.now()}.pdf`);
  };

  if (isUsersLoading || isRoundsLoading || isContestantsLoading || isVotesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 bg-background">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Správa účtů</h1>
          <p className="text-muted-foreground">Porotci a administrátoři</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-8">
        {[{ title: "Porotci", data: judges, icon: <User className="text-white w-6 h-6" />, role: "judge" }, { title: "Admini", data: admins, icon: <Shield className="text-white w-6 h-6" />, role: "admin" }].map(({ title, data, icon, role }) => (
          <Card key={role}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">{icon}{title} ({data.length})</CardTitle>
              <Dialog
                open={isCreateDialogOpen || !!editingUser}
                onOpenChange={(open) => {
                  if (!open) {
                    setIsCreateDialogOpen(false);
                    setEditingUser(null);
                    setCreateRole(null);
                    form.reset();
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => { setIsCreateDialogOpen(true); setCreateRole(role as "admin" | "judge"); }}>
                    <Plus className="w-4 h-4 mr-2" />Nový {role}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>{editingUser ? "Upravit účet" : `Vytvořit ${title.toLowerCase()}`}</DialogTitle></DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(editingUser ? handleUpdateUser : handleCreateUser)} className="space-y-4">
                      <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Jméno a příjmení</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Jan Novák" onChange={(e) => { field.onChange(e); const email = generateEmailFromName(e.target.value); if (email) form.setValue("email", email); }} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl><Input {...field} placeholder="novak@husovka.cz" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Heslo</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input {...field} type={showPassword ? "text" : "password"} placeholder="••••••••" />
                              <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-2 top-2 text-gray-500">
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" className="w-full">{editingUser ? "Upravit" : "Vytvořit"}</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="grid gap-4">
              {data.map((u) => renderUserCard(u, icon))}
            </CardContent>
          </Card>
        ))}

        <Button onClick={exportPDF} className="w-full md:w-1/3 mt-6">Exportovat historii do PDF</Button>
      </div>
    </div>
  );
}
