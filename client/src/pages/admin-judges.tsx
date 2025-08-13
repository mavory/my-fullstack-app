import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Plus, Edit, Trash2, Shield, User, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User as UserType, Vote as VoteType } from "@shared/schema";

const userSchema = z.object({
  name: z.string().min(1, "Jméno je povinné"),
  email: z.string().email("Neplatný email"),
  password: z.string().min(6, "Heslo musí mít alespoň 6 znaků"),
});

type UserForm = z.infer<typeof userSchema>;

export default function AdminJudges() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Načtení uživatelů
  const { data: users = [], isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
    staleTime: 1000 * 60,
  });

  // Načtení hlasů
  const { data: votes = [], isLoading: votesLoading } = useQuery<VoteType[]>({
    queryKey: ["/api/votes"],
    staleTime: 1000 * 60,
  });

  const judges = users.filter(u => u.role === "judge");
  const admins = users.filter(u => u.role === "admin");

  const form = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  // Mutace vytvoření uživatele (jen judge)
  const createUserMutation = useMutation({
    mutationFn: async (data: UserForm) => {
      const res = await apiRequest("POST", "/api/auth/register", { ...data, role: "judge" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: "Porotce vytvořen", description: "Účet byl přidán." });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message || "Nepodařilo se vytvořit účet", variant: "destructive" });
    },
  });

  // Mutace aktualizace
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserForm> }) => {
      const res = await apiRequest("PUT", `/api/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      form.reset();
      toast({ title: "Uživatel upraven", description: "Údaje byly upraveny." });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodařilo se upravit účet", variant: "destructive" }),
  });

  const handleEditUser = (user: UserType) => {
    setEditingUser(user);
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
      apiRequest("DELETE", `/api/users/${id}`, {}).then(() => queryClient.invalidateQueries({ queryKey: ["/api/users"] }));
    }
  };

  if (usersLoading || votesLoading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="min-h-screen p-4 md:p-6 bg-background">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Správa účtů</h1>
          <p className="text-muted-foreground">Porotci a administrátoři</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Porotci */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><User className="text-white w-6 h-6" />Porotci ({judges.length})</CardTitle>
            <Dialog open={isCreateDialogOpen || !!editingUser} onOpenChange={(open) => {
              if (!open) { setIsCreateDialogOpen(false); setEditingUser(null); form.reset(); }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Nový judge</Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>{editingUser ? "Upravit účet" : "Vytvořit judge"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(editingUser ? handleUpdateUser : createUserMutation.mutate)} className="space-y-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jméno a příjmení</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Jan Novák" />
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
                        <div className="relative">
                          <FormControl>
                            <Input {...field} type={showPassword ? "text" : "password"} placeholder="••••••" />
                          </FormControl>
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2">
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="secondary" onClick={() => { setIsCreateDialogOpen(false); setEditingUser(null); form.reset(); }}>Zrušit</Button>
                      <Button type="submit" disabled={createUserMutation.isPending || updateUserMutation.isPending}>
                        {(createUserMutation.isPending || updateUserMutation.isPending) ? <LoadingSpinner size="sm" className="mr-2" /> : <Plus className="w-4 h-4 mr-2" />} {editingUser ? "Upravit" : "Vytvořit"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-4">
            {judges.map(user => (
              <Card key={user.id} className="bg-background">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <User className="text-white w-6 h-6" />
                    <div className="flex flex-col text-white">
                      <span className="font-semibold">{user.name}</span>
                      <span className="text-sm text-white/70">{user.email}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEditUser(user)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteUser(user.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        {/* Admini */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="text-white w-6 h-6" />Admini ({admins.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {admins.map(user => (
              <Card key={user.id} className="bg-background">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Shield className="text-white w-6 h-6" />
                    <div className="flex flex-col text-white">
                      <span className="font-semibold">{user.name}</span>
                      <span className="text-sm text-white/70">{user.email}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm"><Edit className="w-4 h-4" /></Button>
                    <Button variant="outline" size="sm"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        {/* Log hlasů */}
        <Card className="bg-black text-white">
          <CardHeader>
            <CardTitle>Log hlasování porotců</CardTitle>
            <p className="text-sm text-white/70">Zobrazuje všechny hlasy z tabulky votes</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-1">
              <thead>
                <tr>
                  <th className="pr-4">Čas</th>
                  <th className="pr-4">Porotce</th>
                  <th className="pr-4">Soutěžící</th>
                  <th className="pr-4">Hlas</th>
                </tr>
              </thead>
              <tbody>
                {votes.map(v => (
                  <tr key={v.id} className="border-b border-white/20">
                    <td>{new Date(v.createdAt).toLocaleString("cs-CZ")}</td>
                    <td>{users.find(u => u.id === v.userId)?.name || "Neznámo"}</td>
                    <td>{v.contestantId}</td>
                    <td>{v.vote ? "Pro" : "Proti"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
