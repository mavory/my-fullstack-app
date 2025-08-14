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

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // --- USERS (admins + judges) ---
  const { data: users = [], isLoading: isUsersLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
    queryFn: () => getJSON<UserType[]>("GET", "/api/users"),
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
    const map = new Map<string, Contestant>();
    for (const c of contestants) map.set(c.id, c);
    return map;
  }, [contestants]);

  // --- VOTES (podle porotců) ---
  type VoteEvent = {
    id: string;
    judgeId: string;
    judgeName: string;
    contestantId: string;
    contestantName: string;
    vote: boolean;
    createdAt: string | Date;
  };

  const {
    data: voteEvents = [],
    isLoading: isVotesLoading,
    refetch: refetchVotes,
  } = useQuery<VoteEvent[]>({
    queryKey: ["/api/votes/byJudges", judgeIds, !!contestants.length],
    enabled: judgeIds.length > 0 && contestants.length >= 0, // spustí se až po users; contestants můžou být prázdní, ale ready
    queryFn: async () => {
      // stáhnout hlasy pro každého porotce
      const perJudge = await Promise.all(
        judgeIds.map(async (jid) => {
          const votes = await getJSON<Vote[]>("GET", `/api/votes/user/${jid}`);
          return { jid, votes };
        })
      );

      // zploštit + napojit jména soutěžících
      const events: VoteEvent[] = [];
      for (const { jid, votes } of perJudge) {
        const judgeName = judges.find((j) => j.id === jid)?.name ?? "Neznámý porotce";
        for (const v of votes) {
          const c = contestantsById.get(v.contestantId);
          // zobrazíme jen hlasy na soutěžící, co existují v DB (měli by)
          if (c) {
            events.push({
              id: v.id,
              judgeId: jid,
              judgeName,
              contestantId: v.contestantId,
              contestantName: c.name,
              vote: v.vote,
              createdAt: v.createdAt ?? new Date().toISOString(),
            });
          }
        }
      }

      // seřadit od nejnovějších
      events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return events;
    },
  });

  const filteredEvents = useMemo(() => {
    if (selectedJudgeId === "__ALL__") return voteEvents;
    return voteEvents.filter((e) => e.judgeId === selectedJudgeId);
  }, [voteEvents, selectedJudgeId]);

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
      // po změně userů můžeme přenačíst i hlasy (nový porotce atd.)
      refetchVotes();
    },
    onError: (error: any) => {
      toast({
        title: "Chyba",
        description: error?.message || "Nepodařilo se vytvořit účet",
        variant: "destructive",
      });
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
    if (confirm("Opravdu chcete smazat tento účet?")) {
      deleteUserMutation.mutate(id);
    }
  };

  const generateEmailFromName = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      const surname = parts[parts.length - 1];
      const normalized = surname
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");
      return `${normalized}@husovka.cz`;
    }
    return "";
  };

  const renderUserCard = (user: UserType, labelIcon: React.ReactNode) => (
    <Card key={user.id} className="bg-background">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            {labelIcon}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-semibold text-secondary">{user.name}</h3>
            <div className="flex items-center justify-center sm:justify-start gap-1 text-sm text-secondary/75">
              <Mail className="w-4 h-4" />
              {user.email}
            </div>
          </div>
          <div className="text-center sm:text-right">
            <div className="text-sm text-secondary/75">
              Vytvořen:{" "}
              {user.createdAt ? new Date(user.createdAt).toLocaleDateString("cs-CZ") : "Neznámo"}
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

      <div className="max-w-4xl mx-auto space-y-8">
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
                      setIsCreateDialogOpen(true);
                      setCreateRole(role as "admin" | "judge");
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nový {role}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>
                      {editingUser ? "Upravit účet" : `Vytvořit ${title.toLowerCase()}`}
                    </DialogTitle>
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
                                <Input
                                  {...field}
                                  type={showPassword ? "text" : "password"}
                                  placeholder="••••••••"
                                />
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
                        <Button type="submit" disabled={createUserMutation.isPending || updateUserMutation.isPending}>
                          {createUserMutation.isPending || updateUserMutation.isPending ? (
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

        {/* BOX: Historie hlasování porotců */}
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle>Historie hlasování porotců</CardTitle>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Filtrovat porotce:</label>
              <select
                className="border rounded px-2 py-1 text-sm bg-background"
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
          </CardHeader>
          <CardContent>
            {filteredEvents.length === 0 ? (
              <div className="text-sm text-muted-foreground">Zatím žádné hlasy.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left border-b">
                    <tr>
                      <th className="py-2 pr-4">Datum / čas</th>
                      <th className="py-2 pr-4">Porotce</th>
                      <th className="py-2 pr-4">Soutěžící</th>
                      <th className="py-2 pr-4">Hlas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((e) => (
                      <tr key={e.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-4">{new Date(e.createdAt).toLocaleString("cs-CZ")}</td>
                        <td className="py-2 pr-4">{e.judgeName}</td>
                        <td className="py-2 pr-4">{e.contestantName}</td>
                        <td className="py-2 pr-4">{e.vote ? "👍" : "👎"}</td>
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
