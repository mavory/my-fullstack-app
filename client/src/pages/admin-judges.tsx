import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  ArrowLeft,
  Plus,
  Mail,
  User,
  Edit,
  Trash2,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import { Link } from "wouter";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User as UserType } from "@shared/schema";

/**
 * Validace formuláře uživatele (stejné jako měl user)
 */
const userSchema = z.object({
  name: z.string().min(1, "Jméno je povinné"),
  email: z.string().email("Neplatný email"),
  password: z.string().min(6, "Heslo musí mít alespoň 6 znaků"),
});
type UserForm = z.infer<typeof userSchema>;

/**
 * Typy pro hlasovací log (podle toho, co backend vrací v storage.getVotesByContestant)
 * Předpokládám tvar: [{ id, userId, contestantId, vote, createdAt }, ...]
 * Když voláme /api/votes/contestant/:id tak server vrátí pole hlasů pro toho soutěžícího.
 */
type RawVote = {
  id: string;
  userId: string;
  contestantId: string;
  vote: boolean;
  createdAt: string;
};

type Contestant = {
  id: string;
  name: string;
  className?: string;
  roundId?: string;
};

type Round = {
  id: string;
  name: string;
  roundNumber: number;
};

export default function AdminJudges() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [createRole, setCreateRole] = useState<"admin" | "judge" | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ----------------------
  // USERS (admins + judges)
  // ----------------------
  const {
    data: users = [],
    isLoading: isLoadingUsers,
    isError: isUsersError,
    error: usersError,
  } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      const json = await res.json();
      // backend returns array; but be defensive:
      return Array.isArray(json) ? json : json.users ?? [];
    },
    // users endpoint requires admin; make sure current user is admin in UI
  });

  // ----------------------
  // ROUNDS -> to fetch contestants by round
  // ----------------------
  const {
    data: rounds = [],
    isLoading: isLoadingRounds,
    isError: isRoundsError,
  } = useQuery<Round[]>({
    queryKey: ["/api/rounds"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/rounds");
      const json = await res.json();
      return Array.isArray(json) ? json : json.rounds ?? [];
    },
  });

  // ----------------------
  // CONTESTANTS - fetch per round (since there's only /api/contestants/round/:roundId in routes.ts)
  // ----------------------
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [isLoadingContestants, setIsLoadingContestants] = useState(false);
  const [contestantsError, setContestantsError] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!rounds || rounds.length === 0) {
        setContestants([]);
        return;
      }
      setIsLoadingContestants(true);
      setContestantsError(null);
      try {
        // for each round, fetch contestants
        const fetches = rounds.map(async (r) => {
          const res = await apiRequest("GET", `/api/contestants/round/${r.id}`);
          const json = await res.json();
          // defensive: api might return array or { contestants: [] }
          return Array.isArray(json) ? json : json.contestants ?? [];
        });
        const nested = await Promise.all(fetches);
        if (cancelled) return;
        // flatten and keep roundId
        const flat: Contestant[] = nested.flat().map((c: any) => ({
          id: c.id,
          name: c.name,
          className: c.className ?? c.class_name ?? "",
          roundId: c.roundId ?? c.round_id ?? c.round?.id ?? undefined,
        }));
        setContestants(flat);
      } catch (err) {
        if (!cancelled) setContestantsError(err);
      } finally {
        if (!cancelled) setIsLoadingContestants(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rounds]);

  // ----------------------
  // VOTES - fetch per contestant
  // ----------------------
  const [rawVotes, setRawVotes] = useState<RawVote[]>([]);
  const [isLoadingVotes, setIsLoadingVotes] = useState(false);
  const [votesError, setVotesError] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!contestants || contestants.length === 0) {
        setRawVotes([]);
        return;
      }
      setIsLoadingVotes(true);
      setVotesError(null);
      try {
        // fetch votes for each contestant (admin-only endpoint exists)
        const fetches = contestants.map(async (c) => {
          const res = await apiRequest("GET", `/api/votes/contestant/${c.id}`);
          const json = await res.json();
          // sometimes backend may return { votes: [...] }
          const arr = Array.isArray(json) ? json : json.votes ?? [];
          // normalize createdAt and fields
          return arr.map((v: any) => ({
            id: v.id,
            userId: v.userId ?? v.user_id,
            contestantId: v.contestantId ?? v.contestant_id ?? c.id,
            vote: !!v.vote,
            createdAt: v.createdAt ?? v.created_at ?? v.created,
          })) as RawVote[];
        });
        const nested = await Promise.all(fetches);
        if (cancelled) return;
        const allVotes: RawVote[] = nested.flat();
        // sort by createdAt descending
        allVotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRawVotes(allVotes);
      } catch (err) {
        if (!cancelled) setVotesError(err);
      } finally {
        if (!cancelled) setIsLoadingVotes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contestants]);

  // ----------------------
  // Prepare users lists and helper functions
  // ----------------------
  const judges = users.filter((u) => u.role === "judge");
  const admins = users.filter((u) => u.role === "admin");

  const form = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: UserForm & { role: string }) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsCreateDialogOpen(false);
      setCreateRole(null);
      form.reset();
      toast({ title: "Uživatel vytvořen", description: "Účet byl přidán." });
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserForm> }) => {
      const response = await apiRequest("PUT", `/api/users/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      form.reset();
      toast({ title: "Uživatel upraven", description: "Údaje byly upraveny." });
    },
    onError: (error: any) => {
      toast({ title: "Chyba", description: error?.message || "Nepodařilo se upravit účet", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/users/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Účet smazán", description: "Uživatel byl odebrán." });
    },
    onError: (error: any) => {
      toast({ title: "Chyba", description: error?.message || "Nepodařilo se smazat účet", variant: "destructive" });
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
      const normalized = surname.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
      return `${normalized}@husovka.cz`;
    }
    return "";
  };

  const handleNameChange = (name: string) => {
    const email = generateEmailFromName(name);
    if (email) form.setValue("email", email);
  };

  // ----------------------
  // Compose votesWithInfo: attach user name, contestant name, round info
  // ----------------------
  const votesWithInfo = rawVotes.map((v) => {
    const user = users.find((u) => u.id === v.userId);
    const contestant = contestants.find((c) => c.id === v.contestantId);
    const round = rounds.find((r) => r.id === contestant?.roundId);
    return {
      ...v,
      userName: user?.name ?? "Neznámý porotce",
      contestantName: contestant?.name ?? "Neznámý soutěžící",
      contestantClass: contestant?.className ?? "",
      roundName: round?.name ?? "",
      roundNumber: round?.roundNumber ?? null,
      createdAtFormatted: new Date(v.createdAt).toLocaleString("cs-CZ"),
    };
  });

  // Loading combined
  const globalLoading = isLoadingUsers || isLoadingRounds || isLoadingContestants || isLoadingVotes;

  if (isUsersError) {
    return <div className="p-4 text-red-600">Chyba načítání uživatelů.</div>;
  }

  return (
    <div className="min-h-screen p-4 md:p-6 bg-background">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Správa účtů</h1>
          <p className="text-muted-foreground">Porotci a administrátoři</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {[
          { title: "Porotci", data: judges, icon: <User className="text-white w-6 h-6" />, role: "judge" },
          { title: "Admini", data: admins, icon: <Shield className="text-white w-6 h-6" />, role: "admin" }
        ].map(({ title, data, icon, role }) => (
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
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsCreateDialogOpen(true);
                      setCreateRole(role as "admin" | "judge");
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />Nový {role}
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>{editingUser ? "Upravit účet" : `Vytvořit ${title.toLowerCase()}`}</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(editingUser ? handleUpdateUser : handleCreateUser)} className="space-y-4">
                      <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Jméno a příjmení</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Jan Novák" onChange={(e) => { field.onChange(e); handleNameChange(e.target.value); }} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="novak@husovka.cz" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Heslo</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                className="pr-10" // prostor pro icon
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword((p) => !p)}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500"
                                aria-label="Zobrazit/skrýt heslo"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="secondary" onClick={() => { setIsCreateDialogOpen(false); setEditingUser(null); setCreateRole(null); form.reset(); }}>
                          Zrušit
                        </Button>
                        <Button type="submit" disabled={createUserMutation.isPending || updateUserMutation.isPending}>
                          {(createUserMutation.isPending || updateUserMutation.isPending) ? <LoadingSpinner size="sm" className="mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                          {editingUser ? "Upravit" : "Vytvořit"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>

            <CardContent className="space-y-4">
              {data.map((user) => (
                <div key={user.id}>
                  {renderUserCard(user, icon)}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {/* Třetí box - místo "Přihlašovací údaje" -> Historie hlasování */}
        <Card>
          <CardHeader>
            <CardTitle>Historie hlasování</CardTitle>
          </CardHeader>
          <CardContent>
            {globalLoading ? (
              <div className="flex items-center justify-center py-6"><LoadingSpinner size="lg" /></div>
            ) : votesError ? (
              <div className="text-red-600">Chyba při načítání hlasů.</div>
            ) : rawVotes.length === 0 ? (
              <div className="text-muted-foreground">Žádné hlasování zatím nebylo provedeno.</div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm table-auto">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-2 py-1 text-left">Porotce</th>
                      <th className="px-2 py-1 text-left">Kolo</th>
                      <th className="px-2 py-1 text-left">Soutěžící</th>
                      <th className="px-2 py-1 text-left">Hlas</th>
                      <th className="px-2 py-1 text-left">Čas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {votesWithInfo.map((v) => (
                      <tr key={v.id} className="border-b">
                        <td className="px-2 py-1">{v.userName}</td>
                        <td className="px-2 py-1">{v.roundName ? `#${v.roundNumber} - ${v.roundName}` : "-"}</td>
                        <td className="px-2 py-1">{v.contestantName} {v.contestantClass ? `(${v.contestantClass})` : ""}</td>
                        <td className={`px-2 py-1 font-semibold ${v.vote ? "text-green-600" : "text-red-600"}`}>{v.vote ? "✔ Ano" : "✖ Ne"}</td>
                        <td className="px-2 py-1">{v.createdAtFormatted}</td>
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

/**
 * Poznámky:
 * - Tento komponent NEVYTVOŘÍ žádné nové API. Používá pouze:
 *   - GET /api/users
 *   - GET /api/rounds
 *   - GET /api/contestants/round/:roundId   (pro všechny rounds)
 *   - GET /api/votes/contestant/:contestantId  (pro každého contestant)
 *   - POST /api/auth/register, PUT /api/users/:id, DELETE /api/users/:id (mutace uživatelů)
 *
 * - Důvod volby: v routes.ts máš ty přesně tyhle endpointy, takže je takto využívám
 *   a žádný nový endpoint netvořím.
 *
 * - Pokud máš velké množství contestants / hlasů, tak volání GET /api/votes/contestant/:id
 *   pro každý contestant může být pomalé. Pak doporučuju na backend doplnit jeden
 *   endpoint (např. GET /api/votes) který by dal paginovaný seznam hlasů. Ale to už
 *   nechávám na tobě — tady to řeším čistě frontendově přes available endpoints.
 *
 * - `apiRequest` předpokládám, že umí (method?, path, body?) — v kódu používám `apiRequest("GET", "/api/...")` nebo `apiRequest("POST", "/api/...", body)` tam, kde je potřeba. Pokud má tvoje utilita jiný tvar, uprav to drobně podle ní.
 *
 * - Ošetřil jsem varianty vráceného JSON (`[]` nebo `{ votes: [] }`, `{ contestants: [] }`), takže by to mělo být robustní.
 */
