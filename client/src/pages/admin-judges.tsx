import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Eye, EyeOff, ArrowLeft, Plus, User, Edit, Trash2, Shield } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User as UserType, Vote } from "@shared/schema";

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

  // ✅ Fetch users properly
  const { data: users = [], isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      return res.json();
    },
  });

  const { data: votes = [] } = useQuery<Vote[]>({
    queryKey: ["/api/votes"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/votes");
      return res.json();
    },
  });

  const judges = users.filter(user => user.role === "judge");
  const admins = users.filter(user => user.role === "admin");

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
      form.reset();
      toast({ title: "Uživatel vytvořen", description: "Účet byl přidán." });
    },
    onError: (error: any) => {
      toast({ title: "Chyba", description: error.message || "Nepodařilo se vytvořit účet", variant: "destructive" });
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

  const handleCreateUser = (data: UserForm, role: string) => {
    createUserMutation.mutate({ ...data, role });
  };

  const handleEditUser = (user: UserType) => {
    setEditingUser(user);
    form.reset({ name: user.name, email: user.email, password: "" });
    setShowPassword(false);
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

  if (usersLoading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;

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
            <Button variant="outline" size="sm" onClick={() => handleEditUser(user)}><Edit className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => handleDeleteUser(user.id)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

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

        {[{ title: "Porotci", data: judges, icon: <User className="text-white w-6 h-6" />, role: "judge" },
          { title: "Admini", data: admins, icon: <Shield className="text-white w-6 h-6" />, role: "admin" }].map(({ title, data, icon, role }) => (
          <Card key={role}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">{icon}{title} ({data.length})</CardTitle>
              <Dialog open={isCreateDialogOpen || !!editingUser} onOpenChange={(open) => {
                if (!open) {
                  setIsCreateDialogOpen(false);
                  setEditingUser(null);
                  form.reset();
                  setShowPassword(false);
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Nový {role}</Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>{editingUser ? "Upravit účet" : `Vytvořit ${title.toLowerCase()}`}</DialogTitle></DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(editingUser ? handleUpdateUser : (data) => handleCreateUser(data, role))} className="space-y-4">
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
                          <div className="relative">
                            <FormControl>
                              <Input {...field} type={showPassword ? "text" : "password"} placeholder="••••••••" />
                            </FormControl>
                            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowPassword(!showPassword)}>
                              {showPassword ? <EyeOff /> : <Eye />}
                            </button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="secondary" onClick={() => { setIsCreateDialogOpen(false); setEditingUser(null); form.reset(); setShowPassword(false); }}>Zrušit</Button>
                        <Button type="submit" disabled={createUserMutation.isPending || updateUserMutation.isPending}>
                          {(createUserMutation.isPending || updateUserMutation.isPending) ? "..." : editingUser ? "Upravit" : "Vytvořit"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.map((user) => renderUserCard(user, icon))}
            </CardContent>
          </Card>
        ))}

        {/* CMD style log */}
        <Card className="bg-black text-white">
          <CardHeader><CardTitle>Log hlasování porotců</CardTitle></CardHeader>
          <CardContent className="font-mono text-sm space-y-1">
            {votes.length === 0 && <div>Žádná data</div>}
            {votes.map((v) => (
              <div key={v.id}>
                {v.userId} → {v.contestantId} | {v.vote ? "Pro" : "Proti"} | {new Date(v.createdAt).toLocaleString()}
              </div>
            ))}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
