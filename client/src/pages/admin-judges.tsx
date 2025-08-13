import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Plus, User, Edit, Trash2, Shield, Eye, EyeOff, Mail } from "lucide-react";
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
  const [roleToCreate, setRoleToCreate] = useState<"judge" | "admin">("judge");
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const { data: votes = [], isLoading: votesLoading } = useQuery<Vote[]>({
    queryKey: ["/api/votes"],
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

  const handleCreateUser = (data: UserForm) => {
    createUserMutation.mutate({ ...data, role: roleToCreate });
  };

  const handleEditUser = (user: UserType) => {
    setEditingUser(user);
    form.reset({ name: user.name, email: user.email, password: "" });
  };

  const handleUpdateUser = (data: UserForm) => {
    if (editingUser) {
      const updateData = data.password ? data : { ...data, password: undefined };
      createUserMutation.mutate({ ...updateData, role: editingUser.role });
      setEditingUser(null);
    }
  };

  const handleDeleteUser = (id: string) => {
    if (confirm("Opravdu chcete smazat tento účet?")) {
      apiRequest("DELETE", `/api/users/${id}`, {}).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        toast({ title: "Účet smazán", description: "Uživatel byl odebrán." });
      });
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
        {[{ title: "Porotci", data: judges, role: "judge" }, { title: "Admini", data: admins, role: "admin" }].map(({ title, data, role }) => (
          <Card key={role}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{title} ({data.length})</CardTitle>
              <Dialog open={isCreateDialogOpen && roleToCreate === role} onOpenChange={(open) => {
                if (!open) {
                  setIsCreateDialogOpen(false);
                  setEditingUser(null);
                  form.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => { setIsCreateDialogOpen(true); setRoleToCreate(role); }}>
                    <Plus className="w-4 h-4 mr-2" />Nový {role}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>{editingUser ? "Upravit účet" : `Vytvořit ${role}`}</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(editingUser ? handleUpdateUser : handleCreateUser)} className="space-y-4">
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
                              <Input {...field} type={showPassword ? "text" : "password"} placeholder="••••••••" />
                            </FormControl>
                            <Button type="button" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 p-1" onClick={() => setShowPassword(!showPassword)}>
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="secondary" onClick={() => { setIsCreateDialogOpen(false); setEditingUser(null); form.reset(); }}>Zrušit</Button>
                        <Button type="submit" disabled={createUserMutation.isPending}>
                          {(createUserMutation.isPending) ? <LoadingSpinner size="sm" className="mr-2" /> : <Plus className="w-4 h-4 mr-2" />} {editingUser ? "Upravit" : "Vytvořit"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.map((user) => (
                <Card key={user.id} className="bg-background">
                  <CardContent className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{user.name}</div>
                      <div className="flex items-center gap-1 text-sm text-secondary/75"><Mail className="w-4 h-4" />{user.email}</div>
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
        ))}

        {/* Log */}
        <Card className="bg-black text-white font-mono">
          <CardHeader>
            <CardTitle>Log hlasování</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-96 overflow-y-auto">
            {votes.map(vote => (
              <div key={vote.id}>
                {new Date(vote.createdAt).toLocaleString()} - {vote.userId} hlasoval pro {vote.contestantId} - {vote.vote ? "👍" : "👎"}
              </div>
            ))}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
