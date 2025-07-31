import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Plus, UserCheck, Mail, User, Edit, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User as UserType } from "@shared/schema";

const judgeSchema = z.object({
  name: z.string().min(1, "Jméno je povinné"),
  email: z.string().email("Neplatný email"),
  password: z.string().min(6, "Heslo musí mít alespoň 6 znaků"),
});

type JudgeForm = z.infer<typeof judgeSchema>;

export default function AdminJudges() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingJudge, setEditingJudge] = useState<UserType | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const judges = users.filter(user => user.role === 'judge');

  const form = useForm<JudgeForm>({
    resolver: zodResolver(judgeSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const createJudgeMutation = useMutation({
    mutationFn: async (data: JudgeForm) => {
      const response = await apiRequest("POST", "/api/auth/register", {
        ...data,
        role: "judge"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Porotce vytvořen",
        description: "Nový porotce byl úspěšně přidán",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Chyba",
        description: error.message || "Nepodařilo se vytvořit porotce",
        variant: "destructive",
      });
    },
  });

  const updateJudgeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<JudgeForm> }) => {
      const response = await apiRequest("PUT", `/api/users/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingJudge(null);
      form.reset();
      toast({
        title: "Porotce upraven",
        description: "Údaje porotce byly úspěšně upraveny",
      });
    },
    onError: () => {
      toast({
        title: "Chyba",
        description: "Nepodařilo se upravit porotce",
        variant: "destructive",
      });
    },
  });

  const deleteJudgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/users/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Porotce smazán",
        description: "Porotce byl úspěšně odebrán",
      });
    },
    onError: () => {
      toast({
        title: "Chyba",
        description: "Nepodařilo se smazat porotce",
        variant: "destructive",
      });
    },
  });

  const handleCreateJudge = (data: JudgeForm) => {
    createJudgeMutation.mutate(data);
  };

  const handleEditJudge = (judge: UserType) => {
    setEditingJudge(judge);
    form.reset({
      name: judge.name,
      email: judge.email,
      password: "",
    });
  };

  const handleUpdateJudge = (data: JudgeForm) => {
    if (editingJudge) {
      const updateData = data.password ? data : { ...data, password: undefined };
      updateJudgeMutation.mutate({ id: editingJudge.id, data: updateData });
    }
  };

  const handleDeleteJudge = (id: string) => {
    if (confirm("Opravdu chcete smazat tohoto porotce? Tato akce je nevratná.")) {
      deleteJudgeMutation.mutate(id);
    }
  };

  const generateEmailFromName = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      const surname = parts[parts.length - 1];
      const normalizedSurname = surname
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return `${normalizedSurname}@husovka.cz`;
    }
    return "";
  };

  const handleNameChange = (name: string) => {
    const email = generateEmailFromName(name);
    if (email) {
      form.setValue("email", email);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 bg-background">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-secondary">Správa porotců</h1>
            <p className="text-secondary/75 text-sm md:text-base">Přidání a správa účtů porotců</p>
          </div>
        </div>

        <Dialog open={isCreateDialogOpen || !!editingJudge} onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingJudge(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="w-full md:w-auto" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nový porotce
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingJudge ? "Upravit porotce" : "Vytvořit nového porotce"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(editingJudge ? handleUpdateJudge : handleCreateJudge)} className="space-y-4">
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
                            handleNameChange(e.target.value);
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
                      <div className="text-xs text-secondary/50">
                        Email se automaticky generuje z příjmení
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Heslo {editingJudge && "(nechte prázdné pro zachování současného)"}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="••••••••" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    className="flex-1"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      setEditingJudge(null);
                      form.reset();
                    }}
                  >
                    Zrušit
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={createJudgeMutation.isPending || updateJudgeMutation.isPending}
                  >
                    {(createJudgeMutation.isPending || updateJudgeMutation.isPending) ? (
                      <LoadingSpinner size="sm" className="mr-2" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    {editingJudge ? "Upravit" : "Vytvořit"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              Seznam porotců ({judges.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {judges.length === 0 ? (
              <div className="text-center py-8">
                <UserCheck className="w-12 h-12 text-secondary/50 mx-auto mb-4" />
                <p className="text-secondary/75">Zatím nejsou vytvoření žádní porotci</p>
                <p className="text-sm text-secondary/50">Přidejte prvního porotce pro začátek hlasování</p>
              </div>
            ) : (
              <div className="space-y-4">
                {judges.map((judge) => (
                  <Card key={judge.id} className="bg-background">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto sm:mx-0">
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                          <h3 className="font-semibold text-secondary">{judge.name}</h3>
                          <div className="flex items-center justify-center sm:justify-start gap-1 text-sm text-secondary/75">
                            <Mail className="w-4 h-4" />
                            {judge.email}
                          </div>
                        </div>
                        <div className="text-center sm:text-right">
                          <div className="text-sm text-secondary/75">
                            Vytvořen: {judge.createdAt ? new Date(judge.createdAt).toLocaleDateString("cs-CZ") : "Neznámo"}
                          </div>
                          <div className="text-xs text-success">Aktivní</div>
                        </div>
                        <div className="flex justify-center sm:justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditJudge(judge)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteJudge(judge.id)}
                            disabled={deleteJudgeMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {judges.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Přihlašovací údaje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg text-center sm:text-left">
                <p className="text-sm text-secondary/75 mb-2">
                  Všichni nově přidaní porotci mají automaticky: <strong>heslo123</strong>
                </p>
                <p className="text-xs text-secondary/50">
                  Doporučujeme porotcům změnit heslo po prvním přihlášení!
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
