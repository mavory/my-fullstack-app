import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Key, LogIn, FileText, Eye, EyeOff, Sun, Moon } from "lucide-react"; // Přidány Sun a Moon
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

import logo from "@/assets/skola-logo.png";

// --- START: Logika pro Dark/Light Mode ---
// Tuto logiku můžete později přesunout do dedikovaného useTheme hooku
const useLocalTheme = () => {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window !== 'undefined') {
            const storedTheme = localStorage.getItem('theme');
            if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                return 'dark';
            }
        }
        return 'light';
    });

    useEffect(() => {
        const root = window.document.documentElement;
        // Odstranění předchozí třídy
        root.classList.remove(theme === 'dark' ? 'light' : 'dark');
        // Přidání aktuální třídy (dark/light)
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(currentTheme => (currentTheme === 'light' ? 'dark' : 'light'));
    };

    // Komponenta pro přepínač
    const ThemeToggle = () => (
        <Button
          variant="ghost"
          size="icon"
          className="text-foreground/70 hover:text-primary transition-colors"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? (
            <Sun className="w-6 h-6" /> // Tmavý režim: Zobraz Slunce (pro přepnutí na světlý)
          ) : (
            <Moon className="w-6 h-6" /> // Světlý režim: Zobraz Měsíc (pro přepnutí na tmavý)
          )}
        </Button>
    );

    return { ThemeToggle };
};
// --- END: Logika pro Dark/Light Mode ---

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
  const { ThemeToggle } = useLocalTheme(); // Inicializace theme toggle

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
      const emailLower = data.email.trim().toLowerCase();
      const passwordValue = data.password;

      const loggedUser = await login(emailLower, passwordValue);

      if (!loggedUser) throw new Error("Uživatel nenalezen");

      const role = (loggedUser as any).role;

      if (isAdmin && role !== "admin") {
        await logout();
        toast({
          title: "Špatné přihlašovací pole",
          description: "Tento účet není admin, přihlašte se v porotcovském přihlášení.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (!isAdmin && role !== "judge") {
        await logout();
        toast({
          title: "Špatné přihlašovací pole",
          description: "Tento účet není porotce, přihlašte se v admin přihlášení.",
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
    } catch (error: any) {
      // Tady upravíme hlášku, pokud server vrátí 401, přepíšeme na něco normálního
      const message =
        error.message?.toLowerCase().includes("401") ||
        error.message?.toLowerCase().includes("unauthorized")
          ? "Nesprávné heslo nebo email"
          : error.message || "Neplatné přihlašovací údaje";

      toast({
        title: "Chyba přihlášení",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Hlavní kontejner: použije barvy z CSS proměnných
    <div className="min-h-screen flex items-center justify-center relative bg-background text-foreground overflow-hidden"> 

      {/* Ikonky vlevo nahoře (Dark mode + Dokumentace) */}
      <div className="absolute top-8 left-8 flex gap-2">
        
        {/* Tlačítko pro přepínání Dark/Light mode */}
        <ThemeToggle /> 

        {/* Dokumentace ikona */}
        <Button
          variant="ghost"
          size="icon"
          // Použijeme text-foreground/70 pro neutrální barvu
          className="text-foreground/70 hover:text-primary transition-colors" 
          onClick={() => window.open("https://husovka-ma-talent.gitbook.io/husovka-ma-talent-docs/", "_blank")}
        >
          <FileText className="w-6 h-6" />
        </Button>
      </div>

      {/* Admin Key Icon vpravo nahoře */}
      <div className="absolute top-8 right-8">
        <Dialog open={isAdminModalOpen} onOpenChange={setIsAdminModalOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-foreground/70 hover:text-primary transition-colors">
              <Key className="w-6 h-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-center mb-4">
                {/* Ikona s neonovým akcentem */}
                <div className="w-12 h-12 bg-primary rounded-sm flex items-center justify-center"> {/* rounded-sm pro ostrost */}
                  <Key className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
              <DialogTitle className="text-center text-3xl font-bold"> {/* text-3xl pro výrazný nadpis */}
                Administrátorské přihlášení
              </DialogTitle>
              <p className="text-center text-muted-foreground">Zadejte admin přihlašovací údaje</p>
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
                        <Input {...field} type="email" placeholder="prijmeni@husovka.cz" className="rounded-sm" />
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
                            className="rounded-sm pr-10" // rounded-sm
                          />
                        </FormControl>
                        <button
                          type="button"
                          // Použijeme text-muted-foreground pro ikonku
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/90 transition-colors"
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
                    className="flex-1 rounded-sm" // rounded-sm
                    onClick={() => setIsAdminModalOpen(false)}
                  >
                    Zrušit
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 rounded-sm" // rounded-sm
                    disabled={isLoading}>
                    {isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : <Key className="w-4 h-4 mr-2" />}
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
          <img src={logo} alt="Logo školy" className="w-56 h-56 mx-auto object-contain" />
          {/* Velký, tučný text pro moderní vzhled */}
          <h1 className="text-5xl font-extrabold text-foreground mb-4">Husovka má talent</h1>
          <p className="text-lg text-muted-foreground">Hlasovací systém pro porotce</p>
        </div>

        {/* Login Button */}
        <Dialog open={isJudgeModalOpen} onOpenChange={setIsJudgeModalOpen}>
          <DialogTrigger asChild>
            <Button
              // Zde jsme odstranili zastaralé custom styly (shadow-lg, hover:scale-105, rounded-lg)
              // Nyní se spoléháme na animace a styly v button.tsx
              className="w-full text-lg font-semibold"
              size="lg" // size="lg" zajistí velké tlačítko
            >
              <LogIn className="w-5 h-5 mr-2" />
              Přihlásit se
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-primary rounded-sm flex items-center justify-center">
                  <Key className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
              <DialogTitle className="text-center text-3xl font-bold mb-2">
                Přihlášení porotce
              </DialogTitle>
              <p className="text-center text-muted-foreground">Zadejte vaše přihlašovací údaje</p>
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
                        <Input {...field} type="email" placeholder="prijmeni@husovka.cz" className="rounded-sm" />
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
                            className="rounded-sm pr-10" // rounded-sm
                          />
                        </FormControl>
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/90 transition-colors"
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
                    className="flex-1 rounded-sm" // rounded-sm
                    onClick={() => setIsJudgeModalOpen(false)}
                  >
                    Zrušit
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 rounded-sm" // rounded-sm
                    disabled={isLoading}>
                    {isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
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
