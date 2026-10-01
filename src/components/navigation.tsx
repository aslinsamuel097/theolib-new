"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Search, 
  User, 
  Moon, 
  Sun, 
  LogOut, 
  PlusSquare, 
  Lightbulb, 
  MessageCircle, 
  Bell, 
  BookOpen,
  Star,
  X,
  ShieldCheck,
  Check,
  BookMarked,
  UserPlus,
  Users,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  useFirebase, 
  useFirestore, 
  addDocumentNonBlocking, 
  useCollection, 
  useMemoFirebase,
  updateDocumentNonBlocking,
  useDoc
} from '@/firebase';
import { signOut } from 'firebase/auth';
import { collection, serverTimestamp, query, orderBy, where, doc, getDocs, getDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

const LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/theolib-1677e.firebasestorage.app/o/logo%2Ftheolib_logo.png?alt=media";

export function Navigation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { auth } = useFirebase();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [localUser, setLocalUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageType, setMessageType] = useState<'Request' | 'Suggestion' | 'Contact'>('Contact');
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [findScholarsOpen, setFindScholarsOpen] = useState(false);
  const [scholarSearchQuery, setScholarSearchQuery] = useState('');
  const [foundScholars, setFoundScholars] = useState<any[]>([]);
  const [isSearchingScholars, setIsSearchingScholars] = useState(false);

  const [lastCheck, setLastCheck] = useState<number>(0);

  const userDocRef = useMemoFirebase(() => localUser?.id ? doc(db, "users", localUser.id) : null, [db, localUser?.id]);
  const { data: user } = useDoc(userDocRef);

  const booksQuery = useMemoFirebase(() => query(collection(db, "books"), orderBy("updatedAt", "desc")), [db]);
  const { data: books } = useCollection(booksQuery);

  const responsesQuery = useMemoFirebase(() => {
    if (!localUser?.id) return null;
    return query(
      collection(db, "messages"), 
      where("userId", "==", localUser.id), 
      where("isReadByScholar", "==", false)
    );
  }, [db, localUser?.id]);
  const { data: activeMessages } = useCollection(responsesQuery);

  const filteredActiveMessages = useMemo(() => {
    return (activeMessages || []).filter(m => (m.hasResponse || m.type === 'FriendRequest') && !m.hasResponseInFellowshipHub);
  }, [activeMessages]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theolib_theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    }
    const savedLastCheck = localStorage.getItem('theolib_last_notif_check');
    if (savedLastCheck) setLastCheck(parseInt(savedLastCheck, 10));
    const savedUser = localStorage.getItem('theolib_user');
    if (savedUser) setLocalUser(JSON.parse(savedUser));
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theolib_theme', newTheme);
    if (newTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  useEffect(() => {
    if (!scholarSearchQuery.trim()) { setFoundScholars([]); return; }
    const searchTimer = setTimeout(async () => {
      setIsSearchingScholars(true);
      try {
        const q = query(collection(db, "users"));
        const snap = await getDocs(q);
        const term = scholarSearchQuery.toLowerCase();
        const results = snap.docs
          .map(d => ({ ...d.data(), id: d.id }))
          .filter((u: any) => {
            if (u.id === localUser?.id) return false;
            const searchId = (u.id || '').toLowerCase();
            const searchFirstName = (u.firstName || '').toLowerCase();
            const searchLastName = (u.lastName || '').toLowerCase();
            return searchId.includes(term) || searchFirstName.includes(term) || searchLastName.includes(term);
          });
        setFoundScholars(results);
      } catch (err) {
        console.error("Scholar search failed:", err);
      } finally {
        setIsSearchingScholars(false);
      }
    }, 500);
    return () => clearTimeout(searchTimer);
  }, [scholarSearchQuery, db, localUser?.id]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value; setSearchQuery(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('search', value); else params.delete('search');
    router.push(`/library?${params.toString()}`);
  };

  const notifications = useMemo(() => {
    if (!books) return [];
    return books.filter(book => {
      const updatedAt = book.updatedAt?.toDate ? book.updatedAt.toDate().getTime() : (book.updatedAt ? new Date(book.updatedAt).getTime() : 0);
      const createdAt = book.createdAt?.toDate ? book.createdAt.toDate().getTime() : (book.createdAt ? new Date(book.createdAt).getTime() : 0);
      return Math.max(updatedAt, createdAt) > lastCheck;
    });
  }, [books, lastCheck]);

  const handleResetNotifications = () => {
    const now = Date.now(); setLastCheck(now); localStorage.setItem('theolib_last_notif_check', now.toString());
  };

  const handleLogout = async () => {
    if (localUser) {
      addDocumentNonBlocking(collection(db, 'messages'), { userId: localUser.id, userName: `${localUser.firstName} ${localUser.lastName}`, collegeId: localUser.collegeId || 'guest', type: 'Usage:Logout', content: format(new Date(), "HH:mm:ss dd/MM/yyyy"), timestamp: serverTimestamp() });
    }
    localStorage.removeItem('theolib_user'); localStorage.removeItem('theolib_session_seconds');
    router.push('/');
  };

  const handleAddFriend = async (target: any) => {
    try {
      if ((user?.friends || []).includes(target.id)) {
        toast({ title: "Already Connected", description: "This scholar is already in your fellowship." });
        return;
      }

      const q = query(
        collection(db, 'messages'),
        where('type', '==', 'FriendRequest'),
        where('fromId', '==', localUser.id),
        where('userId', '==', target.id),
        where('hasResponse', '==', false)
      );
      
      const snap = await getDocs(q);
      if (!snap.empty) {
        toast({ variant: "destructive", title: "Already Requested", description: "A fellowship inquiry is already pending." });
        return;
      }

      addDocumentNonBlocking(collection(db, 'messages'), { 
        userId: target.id, 
        userName: `${localUser?.firstName || 'Scholar'}`, 
        collegeId: localUser?.collegeId || "Sanctuary", 
        type: 'FriendRequest', 
        content: `Fellowship Inquiry: Scholar ID: ${localUser.id} has requested fellowship.`, 
        fromId: localUser.id, 
        timestamp: serverTimestamp(),
        isReadByScholar: false,
        hasResponse: false
      });
      toast({ title: "Inquiry Transmitted" });
    } catch (err) {
      console.error("handleAddFriend error:", err);
      toast({ variant: "destructive", title: "Transmission Failed", description: "Could not send fellowship inquiry." });
    }
  };

  const handleAcceptFriend = async (msg: any) => {
    if (!user || !msg.fromId) return;
    
    try {
      const myFriends = [...(user.friends || []), msg.fromId];
      updateDocumentNonBlocking(doc(db, "users", user.id), { friends: myFriends });
      
      const senderDoc = await getDoc(doc(db, "users", msg.fromId));
      if (senderDoc.exists()) {
        const senderData = senderDoc.data();
        const senderFriends = [...(senderData.friends || []), user.id];
        updateDocumentNonBlocking(doc(db, "users", msg.fromId), { friends: senderFriends });
      }

      updateDocumentNonBlocking(doc(db, "messages", msg.id), { 
        isReadByScholar: true, 
        hasResponse: true, 
        adminResponse: "Accepted Fellowship",
        respondedAt: serverTimestamp()
      });
      
      toast({ title: "Fellowship Established" });
    } catch (err) {
      console.error("handleAcceptFriend error:", err);
      toast({ variant: "destructive", title: "Action Failed", description: "Could not accept fellowship." });
    }
  };

  const handleRejectFriend = (msg: any) => {
    updateDocumentNonBlocking(doc(db, "messages", msg.id), { 
      isReadByScholar: true, 
      hasResponse: true, 
      adminResponse: "Declined Fellowship",
      respondedAt: serverTimestamp()
    });
    toast({ title: "Inquiry Dismissed" });
  };

  const handleSendMessage = () => {
    if (!messageContent.trim()) return;
    setIsSending(true);
    addDocumentNonBlocking(collection(db, 'messages'), { userId: localUser.id, userName: `${localUser.firstName} ${localUser.lastName}`, collegeId: localUser.collegeId || 'guest', type: messageType, content: messageContent, hasResponse: false, isReadByScholar: false, isReadByAdmin: false, timestamp: serverTimestamp() });
    toast({ title: "Message Sent" }); setMessageContent(''); setMessageDialogOpen(false); setIsSending(false);
  };

  return (
    <>
      <nav className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-xl border-b border-white/5 shadow-2xl">
        <div className="container flex h-20 items-center justify-between px-8 mx-auto">
          <Link href="/library" className="flex items-center space-x-4 group">
            <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur-md shadow-xl transition-all group-hover:scale-110 group-hover:rotate-6">
              <Image src={LOGO_URL} alt="Logo" fill className="object-contain p-2" unoptimized />
            </div>
            <div className="flex flex-col">
              <span className="font-headline text-2xl font-black tracking-tight text-primary">TheoLib</span>
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground opacity-60">Digital Sanctuary</span>
            </div>
          </Link>

          <div className="flex-1 max-w-xl px-12 hidden md:block">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input 
                type="search" 
                placeholder="Search manuscripts..." 
                value={searchQuery} 
                onChange={handleSearchChange} 
                className="h-12 w-full rounded-2xl border border-white/10 bg-muted/40 backdrop-blur-md pl-12 pr-6 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Popover modal={false} onOpenChange={(open) => { if (!open) handleResetNotifications(); }}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-12 w-12 rounded-2xl bg-muted/40 border border-white/5 shadow-inner">
                  <Bell className="h-5 w-5" />
                  {(notifications.length > 0 || filteredActiveMessages.length > 0) && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-secondary text-white text-[10px] border-2 border-background animate-pulse font-black shadow-lg">
                      {notifications.length + filteredActiveMessages.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0 bg-card/90 backdrop-blur-2xl border-white/10 shadow-3xl rounded-[2rem] overflow-hidden" align="end">
                <div className="p-6 border-b border-white/5 bg-primary/5 flex items-center justify-between">
                  <h4 className="font-headline font-bold text-lg text-primary">Celestial Updates</h4>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold">{notifications.length + filteredActiveMessages.length} New</Badge>
                </div>
                <ScrollArea className="h-96">
                  <div className="p-4 space-y-2">
                    {filteredActiveMessages.map(msg => (
                      <div key={msg.id} className="p-4 rounded-3xl bg-primary/10 border border-primary/20 mb-2 group cursor-pointer hover:bg-primary/20 transition-all">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-6 w-6 rounded-lg bg-primary/20 flex items-center justify-center">
                            {msg.type === 'FriendRequest' ? <Users className="h-3 w-3 text-primary" /> : <MessageCircle className="h-3 w-3 text-primary" />}
                          </div>
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest">{msg.type === 'FriendRequest' ? 'Fellowship Inquiry' : 'Divine Response'}</p>
                        </div>
                        <p className="text-xs leading-relaxed opacity-80 mb-3 line-clamp-2">"{msg.content}"</p>
                        <Button size="sm" className="w-full h-8 rounded-xl font-bold text-[10px]">Acknowledge</Button>
                      </div>
                    ))}
                    {notifications.length === 0 && filteredActiveMessages.length === 0 ? (
                      <div className="py-20 text-center space-y-3">
                        <Loader2 className="h-8 w-8 text-primary mx-auto opacity-20" />
                        <p className="text-xs text-muted-foreground italic">No new pulses from the sanctuary.</p>
                      </div>
                    ) : notifications.map(book => (
                      <div key={book.id} className="p-4 rounded-3xl hover:bg-muted/50 cursor-pointer border border-transparent hover:border-white/5 transition-all" onClick={() => router.push(`/library/${book.id}`)}>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-7 rounded-md overflow-hidden relative border border-white/10 shadow-sm"><Image src={LOGO_URL} alt="Book" fill className="object-cover" unoptimized /></div>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-primary line-clamp-1">
                              {book.recommendedBy ? `${book.recommendedBy}; ${book.title}: ${book.category}: ${book.language || 'English'}` : book.title}
                            </span>
                            <span className="text-[9px] uppercase font-black opacity-40">
                              {book.recommendedBy ? 'Faculty Recommendation' : 'Indexed Volume'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-muted/40 border border-white/5 shadow-inner" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="h-5 w-5 text-yellow-500" /> : <Moon className="h-5 w-5 text-primary" />}
            </Button>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-12 gap-3 px-4 rounded-2xl bg-card/60 backdrop-blur-md border-white/10 shadow-xl hover:scale-105 transition-all">
                  <div className="h-7 w-7 rounded-xl bg-primary/10 flex items-center justify-center"><User className="h-4 w-4 text-primary" /></div>
                  <span className="font-black text-[10px] uppercase tracking-widest hidden lg:inline">{localUser?.firstName || 'Scholar'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72 bg-card/90 backdrop-blur-2xl border-white/10 shadow-3xl rounded-[2rem] p-2" align="end">
                <DropdownMenuLabel className="p-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-lg shadow-lg">{(localUser?.firstName || 'S')[0]}</div>
                      <div className="flex flex-col">
                        <span className="font-headline text-lg font-bold">{user?.firstName || localUser?.firstName} {user?.lastName || localUser?.lastName}</span>
                        <span className="text-[9px] uppercase font-black opacity-40 tracking-widest">{localUser?.role || 'Scholar'} Identity</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-2xl border border-primary/10">
                      <BookMarked className="h-4 w-4 text-primary" />
                      <span className="text-[9px] uppercase font-black tracking-widest text-primary">Sanctuary Access Enabled</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/5 mx-4" />
                <div className="p-2 space-y-1">
                  {localUser?.role === 'super' && <DropdownMenuItem onSelect={() => router.push('/admin')} className="rounded-xl h-11 px-4 font-black text-[10px] uppercase tracking-widest text-primary focus:bg-primary/10 focus:text-primary">Librarian Panel</DropdownMenuItem>}
                  <DropdownMenuItem onSelect={() => router.push('/my-books')} className="rounded-xl h-11 px-4 font-black text-[10px] uppercase tracking-widest">My Study Table</DropdownMenuItem>
                  {localUser?.role !== 'demo' && (
                    <DropdownMenuItem onSelect={() => setFindScholarsOpen(true)} className="rounded-xl h-11 px-4 font-black text-[10px] uppercase tracking-widest">Seek Fellowship</DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-white/5 mx-2" />
                  <DropdownMenuItem onSelect={() => { setMessageType('Request'); setMessageDialogOpen(true); }} className="rounded-xl h-11 px-4 font-black text-[10px] uppercase tracking-widest">Request Volume</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => { setMessageType('Suggestion'); setMessageDialogOpen(true); }} className="rounded-xl h-11 px-4 font-black text-[10px] uppercase tracking-widest">Submit Insight</DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleLogout} className="rounded-xl h-11 px-4 font-black text-[10px] uppercase tracking-widest text-destructive focus:bg-destructive/10 focus:text-destructive">Terminate Session</DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      {filteredActiveMessages.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/40 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-card/90 backdrop-blur-3xl border border-white/10 shadow-4xl rounded-[3rem] overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="bg-primary/10 p-8 flex justify-between items-center border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/20 rounded-[1.5rem] shadow-xl shadow-primary/10">
                  {filteredActiveMessages[0].type === 'FriendRequest' ? <Users className="h-8 w-8 text-primary" /> : <ShieldCheck className="h-8 w-8 text-primary" />}
                </div>
                <div>
                  <h3 className="text-2xl font-headline font-bold text-primary">{filteredActiveMessages[0].type === 'FriendRequest' ? 'Fellowship Inquiry' : 'Divine Response'}</h3>
                  <p className="text-[10px] uppercase font-black opacity-40 tracking-widest">Sanctuary Transmission</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-2xl hover:bg-white/5" onClick={() => updateDocumentNonBlocking(doc(db, "messages", filteredActiveMessages[0].id), { isReadByScholar: true })}><X className="h-6 w-6" /></Button>
            </div>
            <div className="p-10 space-y-8">
              <div className="bg-muted/40 p-6 rounded-[2rem] italic text-lg leading-relaxed text-muted-foreground shadow-inner border border-white/5">
                "{filteredActiveMessages[0].content}"
              </div>
              {filteredActiveMessages[0].hasResponse && filteredActiveMessages[0].type !== 'FriendRequest' && (
                <div className="text-xl font-body leading-relaxed text-foreground/90 p-4 border-l-4 border-primary bg-primary/5 rounded-r-2xl">
                  {filteredActiveMessages[0].adminResponse}
                </div>
              )}
              {filteredActiveMessages[0].type === 'FriendRequest' ? (
                <div className="grid grid-cols-2 gap-4">
                  <Button className="h-14 rounded-2xl font-black text-xs uppercase tracking-widest bg-green-600 hover:bg-green-700 shadow-xl shadow-green-500/20" onClick={() => handleAcceptFriend(filteredActiveMessages[0])}><CheckCircle2 className="h-5 w-5 mr-2" /> Accept</Button>
                  <Button variant="outline" className="h-14 rounded-2xl font-black text-xs uppercase tracking-widest text-destructive border-destructive hover:bg-destructive/10" onClick={() => handleRejectFriend(filteredActiveMessages[0])}><XCircle className="h-5 w-5 mr-2" /> Reject</Button>
                </div>
              ) : (
                <Button className="w-full h-16 rounded-2xl font-black text-xs uppercase tracking-widest bg-primary shadow-2xl shadow-primary/30" onClick={() => updateDocumentNonBlocking(doc(db, "messages", filteredActiveMessages[0].id), { isReadByScholar: true })}><Check className="h-5 w-5 mr-2" /> Acknowledge</Button>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={findScholarsOpen} onOpenChange={setFindScholarsOpen}>
        <DialogContent className="rounded-[3rem] shadow-4xl bg-card/95 backdrop-blur-2xl border-white/10 p-0 overflow-hidden max-w-xl">
          <DialogHeader className="p-10 bg-primary/10 border-b border-white/5">
            <DialogTitle className="text-3xl font-headline font-bold text-primary flex items-center gap-4"><Users className="h-8 w-8" /> Seek Fellowship</DialogTitle>
            <DialogDescription className="text-xs uppercase font-black opacity-40 tracking-widest">Connect with other researchers in the sanctuary</DialogDescription>
          </DialogHeader>
          <div className="p-10 space-y-8">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input placeholder="Search Scholar ID or Name..." value={scholarSearchQuery} onChange={(e) => setScholarSearchQuery(e.target.value)} className="h-14 pl-12 rounded-2xl bg-muted/50 border-white/10 shadow-inner" />
            </div>
            <ScrollArea className="h-96 pr-4">
              {isSearchingScholars ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                  <p className="text-[10px] uppercase font-black tracking-widest opacity-40">Consulting Registry</p>
                </div>
              ) : foundScholars.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground italic text-sm opacity-40">No scholars found matching your inquiry.</div>
              ) : foundScholars.map(s => {
                const isFriend = (user?.friends || []).includes(s.id);
                return (
                  <div key={s.id} className="flex items-center justify-between p-6 bg-muted/30 rounded-[2rem] border border-white/5 mb-3 group hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg">{s.id[0].toUpperCase()}</div>
                      <div className="flex flex-col">
                        <span className="font-bold text-base">{s.firstName || ''} {s.lastName || ''}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{s.id}</span>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant={isFriend ? "outline" : "secondary"} 
                      className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-6 shadow-md" 
                      onClick={() => handleAddFriend(s)} 
                      disabled={isFriend}
                    >
                      {isFriend ? "Connected" : "Request"}
                    </Button>
                  </div>
                );
              })}</ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="rounded-[3rem] shadow-4xl bg-card/95 backdrop-blur-2xl border-white/10 p-0 overflow-hidden max-w-xl">
          <DialogHeader className="p-10 bg-primary/10 border-b border-white/5">
            <DialogTitle className="text-3xl font-headline font-bold text-primary flex items-center gap-4">
              {messageType === 'Request' ? <PlusSquare className="h-8 w-8" /> : messageType === 'Suggestion' ? <Lightbulb className="h-8 w-8" /> : <MessageCircle className="h-8 w-8" />}
              {messageType} Portal
            </DialogTitle>
            <DialogDescription className="text-xs uppercase font-black opacity-40 tracking-widest">Transmit your inquiry directly to the high librarian</DialogDescription>
          </DialogHeader>
          <div className="p-10 space-y-8">
            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground">Inquiry Content</Label>
              <Textarea placeholder={`Compose your ${messageType.toLowerCase()} here...`} value={messageContent} onChange={(e) => setMessageContent(e.target.value)} className="min-h-[200px] bg-muted/50 border-white/10 rounded-[2rem] p-6 text-base leading-relaxed shadow-inner" />
            </div>
            <Button onClick={handleSendMessage} disabled={isSending} className="w-full h-16 rounded-2xl font-black text-xs uppercase tracking-widest bg-primary shadow-2xl shadow-primary/30">
              {isSending ? <Loader2 className="animate-spin h-5 w-5" /> : `Transmit ${messageType}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
