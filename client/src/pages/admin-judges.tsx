import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Plus, User, Shield, Mail, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type UserType = { id: string; name: string; email: string; role: "admin" | "judge"; createdAt?: string };
type Contestant = { id: string; name: string; roundId?: string };
type Round = { id: string; roundNumber?: number; name?: string };
type Vote = { id: string; contestantId: string; vote: boolean; createdAt: string };

const lexendFont = "/fonts/Lexend-Regular.ttf";

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});
type UserForm = z.infer<typeof userSchema>;

export default function AdminPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [createRole, setCreateRole] = useState<"admin" | "judge" | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [selectedJudgeId, setSelectedJudgeId] = useState("__ALL__");
  const [selectedRoundId, setSelectedRoundId] = useState("__ALL__");
  const [selectedVoteKind, setSelectedVoteKind] = useState<"__ALL__" | "positive" | "negative">("__ALL__");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch users
  const { data: users = [], isLoading: isUsersLoading } = useQuery<UserType[]>({ queryKey: ["/api/users"] });
  const judges = useMemo(() => users.filter((u) => u.role === "judge"), [users]);
  const admins = useMemo(() => users.filter((u) => u.role === "admin"), [users]);

  // Fetch rounds
  const { data: rounds = [], isLoading: isRoundsLoading } = useQuery<Round[]>({
    queryKey: ["/api/rounds"],
    queryFn: () => apiRequest("GET", "/api/rounds").then((r) => r.json()),
  });
  const roundsMap = useMemo(() => {
    const m = new Map<string, Round>();
    rounds.forEach((r) => m.set(r.id, r));
    return m;
  }, [rounds]);

  // Fetch contestants
  const { data: contestants = [], isLoading: isContestantsLoading } = useQuery<Contestant[]>({
    queryKey: ["/api/contestants"],
    queryFn: () => apiRequest("GET", "/api/contestants").then((r) => r.json()),
  });
  const contestantsMap = useMemo(() => {
    const m = new Map<string, Contestant>();
    contestants.forEach((c) => m.set(c.id, c));
    return m;
  }, [contestants]);

  // Fetch votes
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
  const { data: votes = [], isLoading: isVotesLoading, refetch: refetchVotes } = useQuery<VoteEvent[]>({
    queryKey: ["/api/votes"],
    queryFn: async () => {
      const allVotes: VoteEvent[] = [];
      for (const judge of judges) {
        const userVotes: Vote[] = await apiRequest("GET", `/api/votes/user/${judge.id}`).then((r) => r.json());
        userVotes.forEach((v) => {
          const c = contestantsMap.get(v.contestantId);
          if (!c) return;
          const r = c.roundId ? roundsMap.get(c.roundId) : undefined;
          const roundLabel = r ? (r.roundNumber ? `Kolo ${r.roundNumber}${r.name ? ` – ${r.name}` : ""}` : r.name ?? "") : "";
          allVotes.push({
            id: v.id,
            judgeId: judge.id,
            judgeName: judge.name,
            contestantId: c.id,
            contestantName: c.name,
            roundId: c.roundId ?? null,
            roundLabel,
            vote: v.vote,
            createdAt: v.createdAt,
          });
        });
      }
      return allVotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
  });

  const availableRoundIds = useMemo(() => [...new Set(votes.map((v) => v.roundId).filter(Boolean))], [votes]);
  const filteredEvents = useMemo(() => {
    return votes
      .filter((v) => selectedJudgeId === "__ALL__" || v.judgeId === selectedJudgeId)
      .filter((v) => selectedRoundId === "__ALL__" || v.roundId === selectedRoundId)
      .filter((v) =>
        selectedVoteKind === "__ALL__" ? true : selectedVoteKind === "positive" ? v.vote : !v.vote
      );
  }, [votes, selectedJudgeId, selectedRoundId, selectedVoteKind]);

  const form = useForm<UserForm>({ resolver: zodResolver(userSchema) });

  const createUserMutation = useMutation({
    mutationFn: (data: UserForm & { role: "admin" | "judge" }) =>
      apiRequest("POST", "/api/auth/register", data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/users"]);
      setIsCreateDialogOpen(false);
      form.reset();
      refetchVotes();
      toast({ title: "Uživatel vytvořen" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserForm> }) =>
      apiRequest("PUT", `/api/users/${id}`, data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/users"]);
      setEditingUser(null);
      form.reset();
      refetchVotes();
      toast({ title: "Účet upraven" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/users"]);
      refetchVotes();
      toast({ title: "Účet smazán" });
    },
  });

  const handleCreateUser = (data: UserForm) => {
    if (!createRole) return;
    createUserMutation.mutate({ ...data, role: createRole });
  };
  const handleUpdateUser = (data: UserForm) => {
    if (!editingUser) return;
    const updateData = data.password ? data : { ...data, password: undefined };
    updateUserMutation.mutate({ id: editingUser.id, data: updateData });
  };

  const handleDeleteUser = (id: string) => {
    if (confirm("Opravdu smazat účet?")) deleteUserMutation.mutate(id);
  };

  const handleEditUser = (user: UserType) => {
    setEditingUser(user);
    form.reset({ name: user.name, email: user.email, password: "" });
    setShowPassword(false);
    setIsCreateDialogOpen(true);
  };

  const exportPDF = async () => {
    const doc = new jsPDF();
    // Přidat font
    const fontBytes = await fetch(lexendFont).then((r) => r.arrayBuffer());
    doc.addFileToVFS("Lexend-Regular.ttf", fontBytes);
    doc.addFont("Lexend-Regular.ttf", "Lexend", "normal");
    doc.setFont("Lexend");

    const title = "Historie hlasování porotců";
    const exportedAt = `Exportováno: ${new Date().toLocaleString("cs-CZ")}`;
    doc.setFontSize(16);
    doc.text(title, 40, 40);
    doc.setFontSize(10);
    doc.text(exportedAt, 40, 58);

    const head = [["Datum / čas", "Porotce", "Soutěžící", "Kolo", "Hlas"]];
    const body = filteredEvents.map((e) => [
      new Date(e.createdAt).toLocaleString("cs-CZ"),
      e.judgeName,
      e.contestantName,
      e.roundLabel,
      e.vote ? "Pozitivní" : "Negativní",
    ]);
    autoTable(doc, { head, body, startY: 70, styles: { font: "Lexend", fontSize: 9 } });
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
    <div className="min-h-screen p-4 md:p-6 bg-background space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Správa účtů</h1>
          <p className="text-muted-foreground">Porotci a administrátoři</p>
        </div>
      </div>

      {[{ title: "Porotci", data: judges, role: "judge", icon: <User /> }, { title: "Admini", data: admins, role: "admin", icon: <Shield /> }].map(({ title, data, role, icon }) => (
        <Card key={role}>
          <CardHeader className="flex justify-between items-center">
            <CardTitle>
              {icon} {title} ({data.length})
            </CardTitle>
            <Dialog open={isCreateDialogOpen || !!editingUser} onOpenChange={(open) => !open && setIsCreateDialogOpen(false)}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setCreateRole(role as "admin" | "judge")}>
                  <Plus /> Nový {role}
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
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}/>
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}/>
                    <FormField control={form.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Heslo</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input type={showPassword ? "text" : "password"} {...field} />
                            <button type="button" className="absolute right-2 top-2" onClick={() => setShowPassword((p) => !p)}>
                              {showPassword ? <EyeOff /> : <Eye />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}/>
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" type="button" onClick={() => setIsCreateDialogOpen(false)}>Zrušit</Button>
                      <Button type="submit">{editingUser ? "Upravit" : "Vytvořit"}</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-4">{data.map((u) => (
            <Card key={u.id}>{u.name}</Card>
          ))}</CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="flex justify-between items-center">
          <CardTitle>Historie hlasování porotců</CardTitle>
          <Button onClick={exportPDF}>Export PDF</Button>
        </CardHeader>
        <CardContent>
          {filteredEvents.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nic tu není. Změň filtr nebo ještě nikdo nehlasoval.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Datum / čas</th>
                    <th>Porotce</th>
                    <th>Soutěžící</th>
                    <th>Kolo</th>
                    <th>Hlas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((e) => (
                    <tr key={e.id}>
                      <td>{new Date(e.createdAt).toLocaleString("cs-CZ")}</td>
                      <td>{e.judgeName}</td>
                      <td>{e.contestantName}</td>
                      <td>{e.roundLabel}</td>
                      <td>{e.vote ? "👍" : "👎"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
