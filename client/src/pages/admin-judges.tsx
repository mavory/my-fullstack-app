import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Plus, Mail, User, Edit, Trash2, Shield, Eye, EyeOff, ThumbsUp, ThumbsDown } from "lucide-react";
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

  const [selectedJudgeId, setSelectedJudgeId] = useState<string>("__ALL__");
  const [selectedRoundId, setSelectedRoundId] = useState<string>("__ALL__");
  const [selectedVoteKind, setSelectedVoteKind] = useState<"__ALL__" | "positive" | "negative">("__ALL__");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading: isUsersLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });
  const judges = useMemo(() => users.filter((u) => u.role === "judge"), [users]);
  const admins = useMemo(() => users.filter((u) => u.role === "admin"), [users]);
  const judgeIds = useMemo(() => judges.map((j) => j.id), [judges]);

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

  const { data: voteEvents = [], isLoading: isVotesLoading, refetch: refetchVotes } = useQuery<VoteEvent[]>({
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
    onError: () => {
      toast({ title: "Chyba", description: "Nepodařilo se upravit účet", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => getJSON("DELETE", `/api/users/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Účet smazán", description: "Uživatel byl odebrán." });
      refetchVotes();
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodařilo se smazat účet", variant: "destructive" });
    },
  });

  // --- NEW: allowed deletion emails + current user query + robust extractor ---
  const ALLOWED_DELETION_EMAILS = useMemo(
    () => new Set(["admin@husovka.cz".toLowerCase(), "organizace@husovka.cz".toLowerCase()]),
    []
  );

  const { data: currentUserRaw = null, isLoading: isCurrentUserLoading } = useQuery<any | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        return await getJSON<any>("GET", "/api/auth/me");
      } catch {
        return null;
      }
    },
  });

  // helper: try to extract an email string from various possible response shapes
  const extractEmailFromCurrentUser = (u: any): string => {
    if (!u) return "";
    const candidates = [
      u.email,
      u.user?.email,
      u.data?.email,
      u.data?.user?.email,
      u.attributes?.email,
      u.emailAddress,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim().toLowerCase();
    }
    // sometimes the API returns { user: { ... } } as top-level, so try deeper
    try {
      const jsonStr = JSON.stringify(u);
      const match = jsonStr.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
      if (match) return match[0].toLowerCase();
    } catch {
      /* ignore */
    }
    return "";
  };

  const currentUserEmail = extractEmailFromCurrentUser(currentUserRaw);
  const canCurrentUserManage = Boolean(currentUserEmail && ALLOWED_DELETION_EMAILS.has(currentUserEmail));
  // --------------------------------------------------------

  const handleCreateUser = (data: UserForm) => {
    if (!createRole) return;
    createUserMutation.mutate({ ...data, role: createRole });
  };

  // Modified: check permissions before allowing to open edit dialog
  const handleEditUser = (user: UserType) => {
    if (!canCurrentUserManage) {
      toast({ title: "Bez oprávnění", description: "Tento účet nemůže upravovat účty.", variant: "destructive" });
      return;
    }
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

  // Modified: check permissions before attempting deletion (uses robust email extraction)
  const handleDeleteUser = (id: string, targetUserEmail?: string) => {
    const allowed = canCurrentUserManage;

    if (!allowed) {
      toast({ title: "Bez oprávnění", description: "Tento účet nemůže mazat účty.", variant: "destructive" });
      return;
    }

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

  const renderUserCard = (user: UserType, labelIcon: React.ReactNode) => {
    const canManage = canCurrentUserManage;
    return (
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEditUser(user)}
                disabled={!canManage || updateUserMutation.isLoading}
                title={!canManage ? "Nemáš oprávnění upravovat účty" : "Upravit účet"}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeleteUser(user.id, user.email)}
                disabled={!canManage || deleteUserMutation.isLoading}
                title={!canManage ? "Nemáš oprávnění mazat účty" : "Smazat účet"}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const removeDiacritics = (str) => {
    return str
      .normalize("NFD") // rozdělí diakritiku
      .replace(/[\u0300-\u036f]/g, ""); // smaže diakritiku
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFont("helvetica");

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const title = "Judges' Voting History";
    const exportedAt = `Exported: ${new Date().toLocaleString("cs-CZ")}`;

    // Header
    doc.setFontSize(16);
    doc.setFont(undefined, "bold");
    doc.text(title, 40, 40);
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.text(exportedAt, 40, 58);

    // Tabulka
    const head = [["Date/Time", "Judge", "Contestant", "Round", "Vote"]];
    const body = filteredEvents.map((e) => [
      new Date(e.createdAt).toLocaleString("cs-CZ"),
      removeDiacritics(e.judgeName),
      removeDiacritics(e.contestantName),
      removeDiacritics(e.roundLabel),
      e.vote ? "Pozitivni" : "Negativni",
    ]);

    autoTable(doc, {
      head,
      body,
      startY: 70,
      styles: { font: "helvetica", fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
      margin: { left: 40, right: 40 },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.text(`Strana ${i} / ${pageCount}`, pageWidth - 80, pageHeight - 20);
    }

    doc.save(`hlasovani_${Date.now()}.pdf`);
  };

  if (isUsersLoading || isRoundsLoading || isContestantsLoading || isVotesLoading || isCurrentUserLoading) {
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
        {[
          { title: "Porotci", data: judges, icon: <User className="text-white w-6 h-6" />, role: "judge" },
          { title: "Admini", data: admins, icon: <Shield className="text-white w-6 h-6" />, role: "admin" },
        ].map(({ title, data, icon, role }) => (
          <Card key={role}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {icon}
                {title} ({data.length})
              </CardTitle>
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
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!canCurrentUserManage) {
                        toast({
                          title: "Bez oprávnění",
                          description: "Tento účet nemůže vytvářet nové účty.",
                          variant: "destructive",
                        });
                        return;
                      }
                      setIsCreateDialogOpen(true);
                      setCreateRole(role as "admin" | "judge");
                    }}
                    disabled={!canCurrentUserManage}
                    title={!canCurrentUserManage ? "Nemáš oprávnění vytvářet účty" : `Nový ${role}`}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nový {role}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>{editingUser ? "Upravit účet" : `Vytvořit ${title.toLowerCase()}`}</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(editingUser ? handleUpdateUser : handleCreateUser)}
                      className="space-y-4"
                    >
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Jméno a příjmení</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Jan Novák"
                                onChange={(e) => {
                                  field.onChange(e);
                                  const email = generateEmailFromName(e.target.value);
                                  if (email) form.setValue("email", email);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="novak@husovka.cz" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Heslo</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input {...field} type={showPassword ? "text" : "password"} placeholder="••••••••" />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword((prev) => !prev)}
                                  className="absolute right-2 top-2 text-gray-500"
                                >
                                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setIsCreateDialogOpen(false);
                            setEditingUser(null);
                            setCreateRole(null);
                            form.reset();
                          }}
                        >
                          Zrušit
                        </Button>
                        <Button
                          type="submit"
                          disabled={
                            createUserMutation.isLoading ||
                            updateUserMutation.isLoading ||
                            !canCurrentUserManage
                          }
                        >
                          {createUserMutation.isLoading || updateUserMutation.isLoading ? (
                            <LoadingSpinner size="sm" className="mr-2" />
                          ) : (
                            <Plus className="w-4 h-4 mr-2" />
                          )}
                          {editingUser ? "Upravit" : "Vytvořit"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-4">{data.map((user) => renderUserCard(user, icon))}</CardContent>
          </Card>
        ))}

        {/* Historie hlasování porotců */}
        <Card>
          <CardHeader className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle>Historie hlasování porotců</CardTitle>
              <Button onClick={exportPDF} size="sm">
                Export PDF
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">Porotce:</label>
                <select
                  className="border rounded px-2 py-1 text-sm bg-background w-full"
                  value={selectedJudgeId}
                  onChange={(e) => setSelectedJudgeId(e.target.value)}
                >
                  <option value="__ALL__">Všichni</option>
                  {judges.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">Kolo:</label>
                <select
                  className="border rounded px-2 py-1 text-sm bg-background w-full"
                  value={selectedRoundId}
                  onChange={(e) => setSelectedRoundId(e.target.value)}
                >
                  <option value="__ALL__">Všechna</option>
                  {availableRoundIds.map((rid) => {
                    const r = roundsMap.get(rid);
                    const label = r
                      ? r.roundNumber != null
                        ? `Kolo ${r.roundNumber}${r.name ? ` – ${r.name}` : ""}`
                        : r.name ?? rid
                      : rid;
                    return (
                      <option key={rid} value={rid}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">Hlas:</label>
                <select
                  className="border rounded px-2 py-1 text-sm bg-background w-full"
                  value={selectedVoteKind}
                  onChange={(e) => setSelectedVoteKind(e.target.value as any)}
                >
                  <option value="__ALL__">Vše</option>
                  <option value="positive">Pozitivní (👍)</option>
                  <option value="negative">Negativní (👎)</option>
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {filteredEvents.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nic tu není. Změň filtr nebo ještě nikdo nehlasoval.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left border-b">
                    <tr>
                      <th className="py-2 pr-4">Datum / čas</th>
                      <th className="py-2 pr-4">Porotce</th>
                      <th className="py-2 pr-4">Soutěžící</th>
                      <th className="py-2 pr-4">Kolo</th>
                      <th className="py-2 pr-4">Hlas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((e) => (
                      <tr key={e.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-4">{new Date(e.createdAt).toLocaleString("cs-CZ")}</td>
                        <td className="py-2 pr-4">{e.judgeName}</td>
                        <td className="py-2 pr-4">{e.contestantName}</td>
                        <td className="py-2 pr-4">{e.roundLabel}</td>
                        <td className="py-2 pr-4" title={e.vote ? "Pozitivní" : "Negativní"}>
                          {e.vote ? <ThumbsUp className="w-5 h-5" /> : <ThumbsDown className="w-5 h-5" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
