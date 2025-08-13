import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Plus, User, Edit, Trash2, Eye, EyeOff } from "lucide-react";
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

  const [timers, setTimers] = useState<Record<string, number>>({});
  const [runningTimers, setRunningTimers] = useState<Record<string, boolean>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContestant, setEditingContestant] = useState<Contestant | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);

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
      roundId: selectedRoundId || "",
      order: 1,
    },
  });

  const createContestantMutation = useMutation({
    mutationFn: async (data: ContestantForm) => apiRequest("POST", "/api/contestants", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants"] });
      setIsDialogOpen(false);
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
    mutationFn: async (id: string) => {
      // 1️⃣ nejdřív smažeme všechny votes
      await apiRequest("DELETE", `/api/votes/contestant/${id}`);
      // pak smažeme soutěžícího
      return apiRequest("DELETE", `/api/contestants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contestants"] });
      toast({ title: "Soutěžící a jeho hlasy smazány" });
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

  const handleEdit = (c: Contestant) => {
    setEditingContestant(c);
    form.reset({
      name: c.name,
      className: c.className,
      age: c.age,
      category: c.category,
      description: c.description || "",
      roundId: c.roundId,
      order: c.order,
    });
    setIsDialogOpen(true);
  };

  const categories = [
    "Zpěv","Tanec","Hraní na nástroj","Akrobacie","Ostatní","Kreativita","Sport","Drama","Instrumentální","Humor","Mluvené slovo","Multimédia","Týmové","Solo","DJ","Výtvarné umění","Komik","Stand-up","Kouzelnictví"
  ];

  const getTimeColor = (s: number) => s < 120 ? "text-green-600" : s < 180 ? "text-orange-600" : "text-red-600";

  if(isLoading) return <div className="min-h-screen flex justify-center items-center"><LoadingSpinner size="lg"/></div>;

  return (
    <div className="p-4 bg-background min-h-screen">
      <div className="flex items-center mb-4">
        <Link href="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5"/></Button></Link>
        <h1 className="text-2xl font-bold ml-2">Správa soutěžících</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {rounds.map(r => (
          <Card key={r.id} className="p-4">
            <CardHeader className="flex justify-between items-center">
              <CardTitle>{r.name}</CardTitle>
              <Button size="icon" onClick={() => { setSelectedRoundId(r.id); setIsDialogOpen(true); setEditingContestant(null); }}>
                <Plus className="w-4 h-4"/>
              </Button>
            </CardHeader>
            <CardContent>
              {contestants.filter(c => c.roundId === r.id).length === 0 ? (
                <p className="text-sm text-secondary/75">Žádní soutěžící</p>
              ) : (
                <div className="space-y-2">
                  {contestants.filter(c => c.roundId === r.id).map(c => {
                    const time = timers[c.id]||0;
                    return (
                      <div key={c.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div>
                          <p className="font-semibold">{c.name} ({c.category})</p>
                          <p className="text-xs">{c.className} - {c.age} let</p>
                          {time>0 && <span className={`text-xs font-semibold ${getTimeColor(time)}`}>{Math.floor(time/60)}:{(time%60).toString().padStart(2,"0")}</span>}
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant={c.isVisibleToJudges?"outline":"default"} onClick={()=>toggleVisibilityMutation.mutate({id:c.id,isVisible:!c.isVisibleToJudges})}>
                            {c.isVisibleToJudges?<EyeOff className="w-4 h-4"/><></>:<Eye className="w-4 h-4"/>}
                          </Button>
                          <Button size="icon" variant="outline" onClick={()=>handleEdit(c)}><Edit className="w-4 h-4"/></Button>
                          <Button size="icon" variant="destructive" onClick={()=>deleteContestantMutation.mutate(c.id)}><Trash2 className="w-4 h-4"/></Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={open=>{ if(!open){setIsDialogOpen(false); setEditingContestant(null); form.reset();}}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContestant?"Upravit soutěžícího":"Nový soutěžící"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(data=>editingContestant?updateContestantMutation.mutate({id:editingContestant.id,data}):createContestantMutation.mutate(data))} className="space-y-4">
              <FormField control={form.control} name="name" render={({field})=><FormItem><FormLabel>Jméno</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>} />
              <FormField control={form.control} name="className" render={({field})=><FormItem><FormLabel>Třída</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>} />
              <FormField control={form.control} name="age" render={({field})=><FormItem><FormLabel>Věk</FormLabel><FormControl><Input {...field} type="number" onChange={e=>field.onChange(parseInt(e.target.value))}/></FormControl><FormMessage/></FormItem>} />
              <FormField control={form.control} name="category" render={({field})=><FormItem><FormLabel>Kategorie</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormTrigger><SelectValue placeholder="Vyberte kategorii"/></FormTrigger><SelectContent>{categories.map(cat=><SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>} />
              <FormField control={form.control} name="description" render={({field})=><FormItem><FormLabel>Popis</FormLabel><FormControl><Textarea {...field}/></FormControl><FormMessage/></FormItem>} />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={()=>{setIsDialogOpen(false);setEditingContestant(null);form.reset();}}>Zrušit</Button>
                <Button type="submit">{editingContestant?"Upravit":"Vytvořit"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
