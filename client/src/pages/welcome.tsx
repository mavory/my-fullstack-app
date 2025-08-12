import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Key, LogIn, FileText, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

// Tady import loga, cesta podle tvýho projektu
import logo from "@/assets/skola-logo.png";

const loginSchema = z.object({
  email: z.string().email("Neplatný email"),
  password: z.string().min(1, "Heslo je povinné"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Welcome() {
  const [isJudgeModalOpen, setIsJudgeModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showJudgePassword, setShowJudgePassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const { login, getUserRole, logout } = useAuth();
  const { toast } = useToast();

  const judgeForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const adminForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleLogin = async (data: LoginForm, isAdmin: boolean) => {
    setIsLoading(true);
    try {
      const emailLower = data.email.trim().toLowerCase();
      const passwordLower = data.password.toLowerCase();

      await login(emailLower, passwordLower);

      if (typeof getUserRole === "function") {
        const role = await getUserRole(emailLower);
        if ((isAdmin && role !== "admin") || (!isAdmin && role !== "judge")) {
          if (typeof logout === "function") {
            try { await logout(); } catch (e) { /* ignore */ }
          }
          toast({
            title: "Chyba přihlášení",
            description: "Neplatné přihlašovací údaje",
            variant: "destructive",
          });
          return;
        }
      }

      setIsJudgeModalOpen(false);
      setIsAdminModalOpen(false);
      toast({
        title: "Úspěšně přihlášen",
        description: `Vítejte v systému${isAdmin ? " (Admin)" : ""}!`,
      });
    } catch (error) {
      toast({
        title: "Chyba přihlášení",
        description: "Neplatné přihlašovací údaje",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative bg-background overflow-hidden">
      {/* Dokumentace ikona vlevo nahoře */}
      <div className="absolute top-8 left-8">
        <Button
          variant="ghost"
          size="icon"
          className="text-secondary hover:text-primary transition-colors"
          onClick={() =>
            window.open(
              "https://husovka-ma-talent.gitbook.io/husovka-ma-talent-docs/",
              "_blank"
            )
          }
        >
          <FileText className="w-6 h-6" />
        </Button>
      </div>

      {/* Admin Key Icon vpravo nahoře */}
      <div className="absolute top-8 right-8">
        <Dialog open={isAdminModalOpen} onOpenChange={setIsAdminModalOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-secondary hover:text-primary transition-colors">
              <Key className="w-6 h-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                  <Key className="w-6 h-6 text-white" />
                </div>
              </div>
              <DialogTitle className="text-center text-2xl font-bold text-secondary">
                Administrátorské přihlášení
              </DialogTitle>
              <p className="text-center text-secondary/75">
                Zadejte admin přihlašovací údaje
              </p>
            </DialogHeader>
            <Form {...adminForm}>
              <form onSubmit={adminForm.handleSubmit((data) => handleLogin(data, true))} className="space-y-4">
                <FormField
                  control={adminForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Email</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="email" 
                          placeholder="prijmeni@husovka.cz"
                          className="rounded-lg"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={adminForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Heslo</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input 
                            {...field} 
                            type={showAdminPassword ? "text" : "password"} 
                            placeholder="••••••••"
                            className="rounded-lg pr-10"
                          />
                        </FormControl>
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          onClick={() => setShowAdminPassword(!showAdminPassword)}
                        >
                          {showAdminPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    className="flex-1 rounded-lg"
                    onClick={() => setIsAdminModalOpen(false)}
                  >
                    Zrušit
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 rounded-lg"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <LoadingSpinner size="sm" className="mr-2" />
                    ) : (
                      <Key className="w-4 h-4 mr-2" />
                    )}
                    Přihlásit jako Admin
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="text-center max-w-md mx-auto px-6">
        {/* School Logo */}
        <div className="mb-8">
          <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <img
              src={logo}
              alt="Logo školy"
              className="w-12 h-12 object-contain"
            />
          </div>
          <h1 className="text-4xl font-bold text-secondary mb-2">Husovka má talent</h1>
          <p className="text-lg text-secondary/75">Hlasovací systém pro porotce</p>
        </div>

        {/* Login Button */}
        <Dialog open={isJudgeModalOpen} onOpenChange={setIsJudgeModalOpen}>
          <DialogTrigger asChild>
            <Button 
              className="w-full py-4 px-8 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 text-lg font-semibold"
              size="lg"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Přihlásit se
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-center text-2xl font-bold text-secondary mb-2">
                Přihlášení porotce
              </DialogTitle>
              <p className="text-center text-secondary/75">
                Zadejte vaše přihlašovací údaje
              </p>
            </DialogHeader>
            <Form {...judgeForm}>
              <form onSubmit={judgeForm.handleSubmit((data) => handleLogin(data, false))} className="space-y-4">
                <FormField
                  control={judgeForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="email" 
                          placeholder="prijmeni@husovka.cz"
                          className="rounded-lg"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={judgeForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Heslo</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input 
                            {...field} 
                            type={showJudgePassword ? "text" : "password"} 
                            placeholder="••••••••"
                            className="rounded-lg pr-10"
                          />
                        </FormControl>
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          onClick={() => setShowJudgePassword(!showJudgePassword)}
                        >
                          {showJudgePassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    className="flex-1 rounded-lg"
                    onClick={() => setIsJudgeModalOpen(false)}
                  >
                    Zrušit
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 rounded-lg"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <LoadingSpinner size="sm" className="mr-2" />
                    ) : (
                      <LogIn className="w-4 h-4 mr-2" />
                    )}
                    Přihlásit
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
