import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Plus, User, Edit, Trash2, GraduationCap, Cake, Music, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Round, Contestant } from "@shared/schema";

const contestantSchema = z.object({
  name: z.string().min(1),
  className: z.string().min(1),
  age: z.number().min(6).max(18),
  category: z.string().min(1),
  description: z.string().optional(),
  roundId: z.string().min(1),
  order: z.number().min(1),
});

type ContestantForm = z.infer<typeof contestantSchema>;

export default function AdminContestants() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingContestant, setEditingContestant] = useState<Contestant | null>(null);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);

  // Timery
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [runningTimers, setRunningTimers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const updated = { ...prev };
        Object.keys(runningTimers).forEach(id => {
          if (runningTimers[id]) updated[id] = (updated[id] || 0) + 1;
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [runningTimers]);

  const { data: rounds = [] } = useQuery<Round[]>({ queryKey: ["/api/rounds"] });
  const { data: contestants = [], isLoading } = useQuery<Contestant[]>({ queryKey: ["/api/contestants"] });

  const form = useForm<ContestantForm>({
    resolver: zodResolver(contestantSchema),
    defaultValues: {
      name: "",
      className: "",
      age: 12,
      category: "",
      description: "",
      roundId: activeRoundId || "",
      order: 1,
    },
  });

  const createContestantMutation = useMutation({
    mutationFn: async (data: ContestantForm) => apiRequest("POST", "/api/contestants", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: "Soutěžící vytvořen" });
    },
  });

  const updateContestantMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContestantForm> }) =>
      apiRequest("PUT", `/api/contestants/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants"] });
      setEditingContestant(null);
      toast({ title: "Soutěžící upraven" });
    },
  });

  const deleteContestantMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/contestants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants"] });
      toast({ title: "Soutěžící smazán" });
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, isVisible }: { id: string; isVisible: boolean }) =>
      apiRequest("PUT", `/api/contestants/${id}/visibility`, { isVisibleToJudges: isVisible }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants"] });
      setRunningTimers(prev => ({ ...prev, [vars.id]: vars.isVisible }));
    },
  });

  const handleCreate = (data: ContestantForm) => createContestantMutation.mutate(data);
  const handleUpdate = (data: ContestantForm) => editingContestant && updateContestantMutation.mutate({ id: editingContestant.id, data });
  const handleDelete = (contestant: Contestant) => {
    if(confirm("Opravdu smazat soutěžícího?")) deleteContestantMutation.mutate(contestant.id);
  };
  const handleEdit = (contestant: Contestant) => {
    setEditingContestant(contestant);
    form.reset({
      name: contestant.name,
      className: contestant.className,
      age: contestant.age,
      category: contestant.category,
      description: contestant.description || "",
      roundId: contestant.roundId || "",
      order: contestant.order,
    });
    setIsCreateDialogOpen(true);
  };

  const categories = ["Zpěv","Tanec","Hraní na nástroj","Akrobacie","Ostatní","Kreativita","Sport","Drama","Instrumentální","Humor","Mluvené slovo","Multimédia","Týmové","Solo","DJ","Výtvarné umění"];

  const getTimeColor = (seconds: number) => {
    if(seconds<120) return "text-green-600";
    if(seconds<180) return "text-orange-600";
    return "text-red-600";
  }

  if(isLoading) return <div className="min-h-screen flex justify-center items-center"><LoadingSpinner size="lg"/></div>;

  return (
    <div className="p-4 bg-background min-h-screen">
      <div className="flex items-center mb-4">
        <Link href="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5"/></Button></Link>
        <h1 className="text-2xl font-bold ml-2">Správa soutěžících</h1>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {rounds.map(r=>(
          <Button key={r.id} variant={activeRoundId===r.id?"default":"outline"} onClick={()=>setActiveRoundId(r.id)}>
            {r.name}
          </Button>
        ))}
        <Button onClick={()=>{setIsCreateDialogOpen(true); setEditingContestant(null);}}>+ Nový soutěžící</Button>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={open => { if(!open){setIsCreateDialogOpen(false); setEditingContestant(null); form.reset();} }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContestant ? "Upravit soutěžícího" : "Nový soutěžící"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(editingContestant?handleUpdate:handleCreate)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field })=>(
                <FormItem>
                  <FormLabel>Jméno</FormLabel>
                  <FormControl><Input {...field}/></FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              <FormField control={form.control} name="className" render={({ field })=>(
                <FormItem>
                  <FormLabel>Třída</FormLabel>
                  <FormControl><Input {...field}/></FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              <FormField control={form.control} name="age" render={({ field })=>(
                <FormItem>
                  <FormLabel>Věk</FormLabel>
                  <FormControl><Input {...field} type="number" min={6} max={18} onChange={e=>field.onChange(Number(e.target.value))}/></FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              <FormField control={form.control} name="category" render={({ field })=>(
                <FormItem>
                  <FormLabel>Kategorie</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Vyberte kategorii"/></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map(cat=><SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage/>
                </FormItem>
              )}/>
              <FormField control={form.control} name="description" render={({ field })=>(
                <FormItem>
                  <FormLabel>Popis</FormLabel>
                  <FormControl><Textarea {...field}/></FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              <FormField control={form.control} name="roundId" render={({ field })=>(
                <FormItem>
                  <FormLabel>Kolo</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Vyberte kolo"/></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rounds.map(r=><SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage/>
                </FormItem>
              )}/>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="secondary" onClick={()=>{setIsCreateDialogOpen(false); setEditingContestant(null); form.reset();}}>Zrušit</Button>
                <Button type="submit">{editingContestant?"Upravit":"Vytvořit"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">
        {contestants.filter(c=>!activeRoundId||c.roundId===activeRoundId).map(contestant=>{
          const time = timers[contestant.id]||0;
          return (
            <Card key={contestant.id}>
              <CardContent className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-400"/>
                  </div>
                  <div>
                    <p className="font-semibold">{contestant.name}</p>
                    <p className="text-sm text-secondary/75">{contestant.category}</p>
                    {time>0 && <p className={`text-sm font-semibold ${getTimeColor(time)}`}>{Math.floor(time/60)}:{(time%60).toString().padStart(2,"0")}</p>}
                    <p className={`px-2 py-1 text-xs rounded ${contestant.isVisibleToJudges?"bg-green-100 text-green-700":"bg-gray-100 text-gray-700"}`}>
                      {contestant.isVisibleToJudges?"Viditelný":"Skrytý"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant={contestant.isVisibleToJudges?"outline":"default"} onClick={()=>toggleVisibilityMutation.mutate({id:contestant.id,isVisible:!contestant.isVisibleToJudges})}>
                    {contestant.isVisibleToJudges?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                  </Button>
                  <Button size="icon" variant="outline" onClick={()=>handleEdit(contestant)}><Edit className="w-4 h-4"/></Button>
                  <Button size="icon" variant="destructive" onClick={()=>handleDelete(contestant)}><Trash2 className="w-4 h-4"/></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
