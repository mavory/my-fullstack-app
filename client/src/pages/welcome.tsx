import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LogIn, Key, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
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

  const { login, logout } = useAuth();
  const { toast } = useToast();

  const judgeForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const adminForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const handleLogin = async (data: LoginForm, isAdmin: boolean) => {
    setIsLoading(true);
    try {
      // Case insensitive login
      const emailLower = data.email.trim().toLowerCase();
      const passwordLower = data.password.toLowerCase();

      const loggedUser = await login(emailLower, passwordLower);

      if (!loggedUser) throw new Error("Uživatel nenalezen");

      const role = loggedUser.role;

      if (isAdmin && role !== "admin") {
        await logout();
        toast({
          title: "Špatné přihlašovací pole",
          description: "Tento účet není admin, přihlašte se přes porotcovské přihlášení.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (!isAdmin && role !== "judge") {
        await logout();
        toast({
          title: "Špatné přihlašovací pole",
          description: "Tento účet není porotce, přihlašte se přes adminské přihlášení.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
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
          {/* Tady můžeš dát ikonku */}
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
                <Key className="w-12 h-12 text-primary" />
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
                    <FormItem className="relative">
                      <FormLabel>Admin Heslo</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type={showAdminPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="rounded-lg pr-10"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          onClick={() => setShowAdminPassword(!showAdminPassword)}
                        >
                          {showAdminPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </FormControl>
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
          <img
            src={logo}
            alt="Logo školy"
            className="w-56 h-56 mx-auto object-contain"
          />
          <h1 className="text-5xl font-bold text-secondary mb-2">Husovka má talent</h1>
          <p className="text-lg text-secondary/75">Hlasovací systém pro porotce</p>
        </div>

        {/* Judge Login Button */}
        <Dialog open={isJudgeModalOpen} onOpenChange={setIsJudgeModalOpen}>
          <DialogTrigger asChild>
            <Button
              className="w-full py-4 px-8 rounded-lg shadow-lg transition-all duration-200 text-lg font-semibold"
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
                    <FormItem className="relative">
                      <FormLabel>Heslo</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type={showJudgePassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="rounded-lg pr-10"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          onClick={() => setShowJudgePassword(!showJudgePassword)}
                        >
                          {showJudgePassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </FormControl>
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
