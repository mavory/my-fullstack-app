import { useEffect, useState } from "react";
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
import type { User as UserType, Vote, Contestant } from "@shared/schema";

const userSchema = z.object({
  name: z.string().min(1, "Jméno je povinné"),
  email: z.string().email("Neplatný email"),
  password: z.string().min(6, "Heslo musí mít alespoň 6 znaků"),
});

type UserForm = z.infer<typeof userSchema>;

export default function AdminJudges() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [createRole, setCreateRole] = useState<"admin" | "judge" | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [votesByJudge, setVotesByJudge] = useState<Record<string, Vote[]>>({});

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading: isUsersLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const { data: contestants = [], isLoading: isContestantsLoading } = useQuery<Contestant[]>({
    queryKey: ["/api/contestants/visible"],
  });

  const judges = users.filter((user) => user.role === "judge");
  const admins = users.filter((user) => user.role === "admin");

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
        description: error.message || "Nepodařilo se vytvořit účet",
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
    onError: () => {
      toast({ title: "Chyba", description: "Nepodařilo se upravit účet", variant: "destructive" });
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

  // Fetch votes per judge
  useEffect(() => {
    judges.forEach(async (judge) => {
      try {
        const votes: Vote[] = await apiRequest("GET", `/api/votes/user/${judge.id}`);
        setVotesByJudge((prev) => ({ ...prev, [judge.id]: votes }));
      } catch (e) {
        console.error("Failed to fetch votes for judge", judge.id, e);
      }
    });
  }, [users]);

  if (isUsersLoading || isContestantsLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );

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
              {user.createdAt
                ? new Date(user.createdAt).toLocaleDateString("cs-CZ")
                : "Neznámo"}
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

  const renderVotesHistory = () => {
    if (!judges.length) return <div>Žádní porotci</div>;

    return judges.map((judge) => {
      const votes = votesByJudge[judge.id] || [];
      return (
        <Card key={judge.id} className="bg-background">
          <CardHeader>
            <CardTitle>{judge.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {votes.length === 0 ? (
              <div>Žádné hlasování zatím nebylo provedeno.</div>
            ) : (
              votes.map((v) => {
                const contestant = contestants.find((c) => c.id === v.contestantId);
                return (
                  <div key={v.id} className="flex justify-between text-sm">
                    <span>{contestant ? contestant.name : "Neznámý soutěžící"}</span>
                    <span>{v.vote ? "👍" : "👎"}</span>
                    <span>{new Date(v.createdAt).toLocaleString("cs-CZ")}</span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      );
    });
  };

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
          { title: "Admini", data: admins, icon: <Shield className="text-white w-6 h-6" />, role: "admin" }
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
                              <Input {...field} placeholder="Jan Novák" />
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
                                  className="absolute right-2 top-2 text-sm"
                                >
                                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit">{editingUser ? "Upravit" : "Vytvořit"}</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-2">{data.map((user) => renderUserCard(user, icon))}</CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>Historie hlasování porotců</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">{renderVotesHistory()}</CardContent>
        </Card>
      </div>
    </div>
  );
}
