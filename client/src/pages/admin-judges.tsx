import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Plus, UserCheck, Mail, User } from "lucide-react";
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

  const handleCreateJudge = (data: JudgeForm) => {
    createJudgeMutation.mutate(data);
  };

  // Funkce pro automatické generování emailu z jména
  const generateEmailFromName = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      const surname = parts[parts.length - 1]; // Poslední slovo je příjmení
      // Odstranění diakritiky a převod na malá písmena
      const normalizedSurname = surname
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // Odstranění diakritiky
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
    <div className="min-h-screen p-6 bg-background">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Link href="/admin">
            <Button variant="ghost" size="icon" className="mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-secondary">Správa porotců</h1>
            <p className="text-secondary/75">Přidání a správa účtů porotců</p>
          </div>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nový porotce
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vytvořit nového porotce</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateJudge)} className="space-y-4">
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
                      <FormLabel>Heslo</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="••••••••" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    className="flex-1"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Zrušit
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={createJudgeMutation.isPending}
                  >
                    {createJudgeMutation.isPending ? (
                      <LoadingSpinner size="sm" className="mr-2" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Vytvořit
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
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-secondary">{judge.name}</h3>
                          <div className="flex items-center gap-1 text-sm text-secondary/75">
                            <Mail className="w-4 h-4" />
                            {judge.email}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-secondary/75">
                            Vytvořen: {judge.createdAt ? new Date(judge.createdAt).toLocaleDateString("cs-CZ") : "Neznámo"}
                          </div>
                          <div className="text-xs text-success">Aktivní</div>
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
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-secondary/75 mb-2">
                  Všichni porotci používají heslo: <strong>heslo123</strong>
                </p>
                <p className="text-xs text-secondary/50">
                  Doporučujeme porotcům změnit heslo po prvním přihlášení
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}