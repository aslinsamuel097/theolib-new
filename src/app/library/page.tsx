
"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Navigation } from '@/components/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from "@/hooks/use-toast";
import { 
  PlusSquare, 
  Lightbulb, 
  MessageCircle, 
  Clock as ClockIcon,
  BookOpen,
  Eye,
  RotateCcw,
  LayoutGrid,
  Search,
  Library as LibraryIcon,
  Loader2,
  BookMarked,
  Sparkles,
  Users,
  UserPlus,
  ArrowUpDown,
  SortAsc,
  SortDesc,
  FileText,
  Clock,
  CheckCircle2,
  MessageSquare,
  Star,
  Lock,
  Globe
} from 'lucide-react';
import { 
  useFirebase, 
  useCollection, 
  useMemoFirebase,
  deleteDocumentNonBlocking,
  addDocumentNonBlocking,
  useDoc,
} from '@/firebase';
import { collection, serverTimestamp, query, orderBy, where, doc, getDocs, limit } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/theolib-1677e.firebasestorage.app/o/logo%2Ftheolib_logo.png?alt=media";
const LANGUAGES = ["English", "Tamil", "Malayalam", "Hindi", "Others"];
const CATEGORIES = ["Theology", "CHRISTIAN Ethics", "Mission", "Intro to BIBLE", "CHURCH History", "Acts of Apostle", "Others"];
const LOAN_DURATION_DAYS = 5;
const MAX_LOANS = 5;
const MAX_MESSAGES = 10; 
const BORROW_COOL_OFF_HOURS = 48;

function LibraryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { firestore: db } = useFirebase();
  const [sessionTime, setSessionTime] = useState(0);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [localUser, setLocalUser] = useState<any>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("Whole Library");
  const [selectedCategory, setSelectedCategory] = useState<string>("All Categories");
  const [activeFilter, setActiveFilter] = useState<'all' | 'issued' | 'fellowship'>('all');
  const [localSearch, setLocalSearch] = useState('');
  
  const [sortField, setSortField] = useState<'title' | 'createdAt' | 'language'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageType, setMessageType] = useState<'Request' | 'Suggestion' | 'Contact' | 'Nomination' | 'OverdueReturn'>('Contact');
  const [messageContent, setMessageContent] = useState('');
  const [selectedNominationBook, setSelectedNominationBook] = useState<any>(null);

  useEffect(() => {
    const savedTime = localStorage.getItem('theolib_session_seconds');
    if (savedTime) setSessionTime(parseInt(savedTime, 10));
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setSessionTime(prev => {
          const next = prev + 1; 
          localStorage.setItem('theolib_session_seconds', next.toString()); 
          return next;
        });
      }
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('theolib_user');
    if (savedUser) setLocalUser(JSON.parse(savedUser)); else router.push('/');
    const clock = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clock);
  }, [router]);

  const userDocRef = useMemoFirebase(() => localUser?.id ? doc(db, "users", localUser.id) : null, [db, localUser?.id]);
  const { data: userData } = useDoc(userDocRef);

  const booksQuery = useMemoFirebase(() => query(collection(db, "books"), orderBy("createdAt", "desc")), [db]);
  const { data: booksData } = useCollection(booksQuery);
  const allBooks = booksData || [];

  const loansQuery = useMemoFirebase(() => localUser?.id ? query(collection(db, "loans"), where("userId", "==", localUser.id)) : null, [db, localUser?.id]);
  const { data: loansData } = useCollection(loansQuery);

  const messagesQuery = useMemoFirebase(() => localUser?.id ? query(collection(db, "messages"), where("userId", "==", localUser.id)) : null, [db, localUser?.id]);
  const { data: userMessagesData } = useCollection(messagesQuery);
  
  const activeUserInquiries = useMemo(() => {
    return (userMessagesData || []).filter(m => 
      !m.type.startsWith('Usage') && 
      m.type !== 'FriendRequest' && 
      m.type !== 'RegistrationInquiry' &&
      m.type !== 'Appeal' &&
      m.type !== 'Note' &&
      m.type !== 'ChatMessage'
    );
  }, [userMessagesData]);

  const pendingFellowshipRequests = useMemo(() => {
    return (userMessagesData || []).filter(m => m.type === 'FriendRequest' && !m.hasResponse);
  }, [userMessagesData]);

  const activeLoans = useMemo(() => (loansData || []).map(l => {
    const issuedAt = l.issuedAt?.toDate ? l.issuedAt.toDate().getTime() : new Date(l.issuedAt).getTime();
    const diffDays = Math.floor((Date.now() - issuedAt) / (24 * 60 * 60 * 1000));
    return { ...l, daysPassed: diffDays, daysLeft: Math.max(0, LOAN_DURATION_DAYS - diffDays) };
  }), [loansData]);

  const filteredBooks = useMemo(() => allBooks.filter(book => {
    if (activeFilter === 'fellowship') return false; 
    if (activeFilter === 'issued' && !activeLoans.some(l => l.bookId === book.id)) return false;
    if (selectedLanguage !== "Whole Library" && book.language !== selectedLanguage) return false;
    if (selectedCategory !== "All Categories" && book.category !== selectedCategory) return false;
    
    // Access logic:
    // If user is independent: see if global access OR individualAccess flag is true
    // If user is college-bound: see if global access OR their college is in allowedCollegeIds
    const isGlobal = !book.allowedCollegeIds || book.allowedCollegeIds.length === 0;
    
    if (localUser?.collegeId === "individual") {
      if (!isGlobal && !book.isIndividualAccess) return false;
    } else if (localUser?.collegeId) {
      if (!isGlobal && !book.allowedCollegeIds?.includes(localUser.collegeId)) return false;
    }

    const q = (localSearch || searchParams.get('search') || '').toLowerCase();
    if (q && !book.title?.toLowerCase().includes(q) && !book.author?.toLowerCase().includes(q)) return false;
    return true;
  }), [allBooks, selectedLanguage, selectedCategory, localUser?.collegeId, activeFilter, activeLoans, localSearch, searchParams]);

  const sortedBooks = useMemo(() => {
    let list = [...filteredBooks];
    list.sort((a, b) => {
      if (sortField === 'title') {
        const valA = (a.title || '').toLowerCase();
        const valB = (b.title || '').toLowerCase();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sortField === 'createdAt') {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (sortField === 'language') {
        const valA = (a.language || 'English').toLowerCase();
        const valB = (b.language || 'English').toLowerCase();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return 0;
    });
    return list;
  }, [filteredBooks, sortField, sortOrder]);

  const handleBorrow = async (book: any) => {
    try {
      if (localUser?.role === 'demo') {
        toast({ variant: "destructive", title: "Access Restricted", description: "Demo identities cannot borrow manuscripts." });
        return;
      }
      if (activeLoans.some(l => l.bookId === book.id)) { router.push(`/reader/${book.id}?type=full`); return; }
      if (activeLoans.length >= MAX_LOANS) { toast({ variant: "destructive", title: "Study Table Full" }); return; }
      
      const fortyEightHoursAgo = new Date(Date.now() - BORROW_COOL_OFF_HOURS * 60 * 60 * 1000);
      const coolOffQuery = query(
        collection(db, 'messages'),
        where('userId', '==', localUser.id),
        where('bookId', '==', book.id),
        where('type', '==', 'Usage:Return'),
        where('timestamp', '>=', fortyEightHoursAgo),
        limit(1)
      );
      
      const coolOffSnap = await getDocs(coolOffQuery);
      if (!coolOffSnap.empty) {
        const returnDoc = coolOffSnap.docs[0].data();
        const returnTime = returnDoc.timestamp?.toDate ? returnDoc.timestamp.toDate() : new Date(returnDoc.timestamp);
        const remainingHours = Math.ceil((returnTime.getTime() + BORROW_COOL_OFF_HOURS * 60 * 60 * 1000 - Date.now()) / (60 * 60 * 1000));
        toast({ variant: "destructive", title: "Cool-off Active", description: `Please wait ${remainingHours}h before re-borrowing.` });
        return;
      }

      addDocumentNonBlocking(collection(db, 'loans'), { userId: localUser.id, bookId: book.id, issuedAt: serverTimestamp() });
      toast({ title: "Loan Secured", description: "Identity verified. Full manuscript access granted." });
    } catch (err) {
      console.error("handleBorrow error:", err);
      toast({ variant: "destructive", title: "Loan Failed", description: "An error occurred while borrowing." });
    }
  };

  const handleReturnFromLibrary = (loan: any, bookTitle: string) => {
    addDocumentNonBlocking(collection(db, 'messages'), {
      userId: localUser.id,
      userName: `${localUser.firstName} ${localUser.lastName}`,
      collegeId: localUser.collegeId || 'guest',
      type: 'Usage:Return',
      content: `Scholar returned manuscript: "${bookTitle}"`,
      bookId: loan.bookId,
      bookTitle: bookTitle,
      timestamp: serverTimestamp()
    });
    deleteDocumentNonBlocking(doc(db, 'loans', loan.id));
    toast({ title: "Manuscript Returned" });
  };

  const handleSendMessage = () => {
    if (activeUserInquiries.length >= MAX_MESSAGES && messageType !== 'OverdueReturn') { 
      toast({ variant: "destructive", title: "Inquiry Limit Reached" }); 
      return; 
    }
    addDocumentNonBlocking(collection(db, "messages"), { 
      userId: localUser.id, 
      userName: `${localUser.firstName} ${localUser.lastName}`, 
      collegeId: localUser.collegeId || 'guest', 
      type: messageType, 
      content: messageContent, 
      bookId: selectedNominationBook?.id, 
      isReadByAdmin: false, 
      timestamp: serverTimestamp() 
    });
    setMessageContent(''); setMessageDialogOpen(false);
    if (messageType === 'Nomination') {
      toast({ title: "Nomination Sent", description: "The High Librarian will review this requisition." });
    }
  };

  const handleNominate = (book: any) => {
    setSelectedNominationBook(book);
    setMessageType('Nomination');
    setMessageContent(`I am nominating "${book.title}" for sanctuary-wide study.`);
    setMessageDialogOpen(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navigation />
      <main className="flex-1 container px-8 py-12 mx-auto space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="p-8 bg-card/60 backdrop-blur-xl border-white/5 shadow-2xl rounded-[2.5rem] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-all"><ClockIcon className="h-12 w-12" /></div>
            <div className="text-4xl font-mono text-secondary font-black mb-1">
              {Math.floor(sessionTime / 3600).toString().padStart(2, '0')}:{(Math.floor(sessionTime % 3600 / 60)).toString().padStart(2, '0')}:{(sessionTime % 60).toString().padStart(2, '0')}
            </div>
            <div className="text-[10px] uppercase font-black tracking-[0.3em] text-muted-foreground">Scholar Study Timer</div>
          </Card>
          <Card className="p-8 bg-card/60 backdrop-blur-xl border-white/5 shadow-2xl rounded-[2.5rem] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-all"><BookMarked className="h-12 w-12" /></div>
            <div className="text-4xl font-mono text-primary font-black mb-1">{allBooks.length}</div>
            <div className="text-[10px] uppercase font-black tracking-[0.3em] text-muted-foreground">Sanctuary Catalog</div>
          </Card>
          <Card className="p-8 bg-card/60 backdrop-blur-xl border-white/5 shadow-2xl rounded-[2.5rem] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-all"><Sparkles className="h-12 w-12" /></div>
            <div className="text-4xl font-mono text-green-500 font-black mb-1">{currentTime?.toLocaleTimeString().toLowerCase() || "--:--:--"}</div>
            <div className="text-[10px] uppercase font-black tracking-[0.3em] text-muted-foreground">Celestial Clock</div>
          </Card>
        </div>
        
        <div className="space-y-6">
          <div className="relative group max-w-2xl">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search the sacred archives..." 
              value={localSearch} 
              onChange={(e) => setLocalSearch(e.target.value)} 
              className="pl-16 h-16 rounded-[2rem] bg-card/40 backdrop-blur-xl border-white/10 shadow-inner text-lg outline-none focus:ring-4 focus:ring-primary/10 transition-all" 
            />
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <Button variant={selectedLanguage === "Whole Library" ? "secondary" : "outline"} className="rounded-2xl h-12 px-6 font-bold shadow-lg" onClick={() => { setSelectedLanguage("Whole Library"); setSelectedCategory("All Categories"); }}><LibraryIcon className="h-4 w-4 mr-2" /> Whole Library</Button>
            {LANGUAGES.map(lang => <Button key={lang} variant={selectedLanguage === lang ? "secondary" : "outline"} className="rounded-2xl h-12 px-6 font-bold shadow-lg" onClick={() => setSelectedLanguage(lang)}>{lang}</Button>)}
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="rounded-2xl h-12 px-6 font-bold gap-3 shadow-lg"><LayoutGrid className="h-4 w-4 text-primary" /> {selectedCategory}</Button></DropdownMenuTrigger><DropdownMenuContent className="rounded-2xl shadow-3xl bg-card/90 backdrop-blur-xl border-white/10">{CATEGORIES.map(c => <DropdownMenuItem key={c} className="rounded-xl h-10 font-bold" onClick={() => setSelectedCategory(c)}>{c}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-2xl h-12 px-6 font-bold gap-3 shadow-lg border-primary/20">
                  <ArrowUpDown className="h-4 w-4 text-primary" /> Sort Catalog
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="rounded-2xl bg-card/95 backdrop-blur-xl border-white/10 w-56 p-2">
                <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-40 px-4 py-2">Criteria</DropdownMenuLabel>
                <DropdownMenuItem className="rounded-xl" onClick={() => setSortField('title')}>
                  <FileText className="h-4 w-4 mr-2 opacity-60" /> Title {sortField === 'title' && <CheckCircle2 className="h-3 w-3 ml-auto text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl" onClick={() => setSortField('createdAt')}>
                  <Clock className="h-4 w-4 mr-2 opacity-60" /> Date Uploaded {sortField === 'createdAt' && <CheckCircle2 className="h-3 w-3 ml-auto text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl" onClick={() => setSortField('language')}>
                  <Globe className="h-4 w-4 mr-2 opacity-60" /> Language {sortField === 'language' && <CheckCircle2 className="h-3 w-3 ml-auto text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/5 mx-2 my-2" />
                <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-40 px-4 py-2">Direction</DropdownMenuLabel>
                <DropdownMenuItem className="rounded-xl" onClick={() => setSortOrder('asc')}>
                  <SortAsc className="h-4 w-4 mr-2 opacity-60" /> Ascending {sortOrder === 'asc' && <CheckCircle2 className="h-3 w-3 ml-auto text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl" onClick={() => setSortOrder('desc')}>
                  <SortDesc className="h-4 w-4 mr-2 opacity-60" /> Descending {sortOrder === 'desc' && <CheckCircle2 className="h-3 w-3 ml-auto text-primary" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex gap-2 p-1.5 bg-card/60 backdrop-blur-xl border border-white/5 rounded-2xl shadow-lg">
            <Button variant="ghost" className={cn("rounded-xl h-10 px-6 font-bold transition-all", activeFilter === 'all' ? 'bg-primary text-primary-foreground shadow-lg' : 'opacity-60')} onClick={() => setActiveFilter('all')}>All ({filteredBooks.length})</Button>
            <Button variant="ghost" className={cn("rounded-xl h-10 px-6 font-bold transition-all", activeFilter === 'issued' ? 'bg-secondary text-secondary-foreground shadow-lg' : 'opacity-60')} onClick={() => setActiveFilter('issued')}>Issued ({activeLoans.length}/{MAX_LOANS})</Button>
            {localUser?.role !== 'demo' && localUser?.collegeId !== "individual" && (
              <Button variant="ghost" className={cn("rounded-xl h-10 px-6 font-bold transition-all relative", activeFilter === 'fellowship' ? 'bg-primary text-primary-foreground shadow-lg' : 'opacity-60')} onClick={() => setActiveFilter('fellowship')}>
                <Users className="h-4 w-4 mr-2" /> 
                Fellowship
                {pendingFellowshipRequests.length > 0 && <Badge className="ml-2 bg-red-500 text-white animate-pulse h-5 w-5 p-0 flex items-center justify-center rounded-full border-2 border-background text-[9px] font-black">{pendingFellowshipRequests.length}</Badge>}
              </Button>
            )}
          </div>
        </div>

        {activeFilter === 'fellowship' && localUser?.role !== 'demo' && localUser?.collegeId !== "individual" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <Card className="p-10 rounded-[3rem] border-white/5 shadow-3xl bg-card/40 backdrop-blur-2xl">
              <h3 className="text-2xl font-headline font-bold mb-8 flex items-center gap-4 text-primary"><Users className="h-8 w-8" /> Active Fellowship</h3>
              <ScrollArea className="h-[500px] pr-6">
                {(userData?.friends || []).length === 0 ? (
                  <div className="py-20 text-center opacity-40 italic text-sm">No connections established. Consult the Librarian Gate to find scholars.</div>
                ) : userData.friends.map((friendId: string) => (
                  <div key={friendId} className="flex items-center justify-between p-6 bg-muted/30 rounded-[2rem] border border-white/5 mb-4 group hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg">{friendId[0].toUpperCase()}</div>
                      <span className="font-bold text-base">{friendId}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase font-black text-green-500 border-green-500/20 px-4 py-1.5 rounded-full">Connected</Badge>
                  </div>
                ))}
              </ScrollArea>
            </Card>

            <Card className="p-10 rounded-[3rem] border-white/5 shadow-3xl bg-card/40 backdrop-blur-2xl">
              <h3 className="text-2xl font-headline font-bold mb-8 flex items-center gap-4 text-secondary"><UserPlus className="h-8 w-8" /> Pending Inquiries</h3>
              <ScrollArea className="h-[500px] pr-6">
                {pendingFellowshipRequests.length === 0 ? (
                  <div className="py-20 text-center opacity-40 italic text-sm">No pending fellowship inquiries.</div>
                ) : pendingFellowshipRequests.map((req: any) => (
                  <div key={req.id} className="p-8 bg-card rounded-[2.5rem] border-2 border-primary/20 space-y-6 shadow-xl mb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="font-bold text-lg">{req.userName}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{req.fromId}</span>
                      </div>
                      <Badge className="bg-primary px-4 py-1.5 rounded-full font-black text-[9px] uppercase">New Inquiry</Badge>
                    </div>
                    <p className="text-sm italic text-muted-foreground leading-relaxed">"Scholar has requested fellowship within the sanctuary."</p>
                    <div className="grid grid-cols-2 gap-4">
                      <Button className="bg-green-600 hover:bg-green-700 h-12 rounded-xl font-bold text-xs">Accept</Button>
                      <Button variant="outline" className="h-12 rounded-xl font-bold text-xs border-destructive text-destructive hover:bg-destructive/10">Reject</Button>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {sortedBooks.map(book => {
              const loan = activeLoans.find(l => l.bookId === book.id); const isBorrowed = !!loan;
              return (
                <Card key={book.id} className="overflow-hidden group flex flex-col relative border-white/5 bg-card/40 backdrop-blur-xl rounded-[2.5rem] shadow-xl hover:shadow-primary/10 hover:border-primary/30 transition-all hover:-translate-y-2 duration-500">
                  <div className="relative aspect-[2/3] bg-muted overflow-hidden">
                    <Image src={book.thumbnailUrl || LOGO_URL} alt={book.title} fill className="object-cover transition-transform duration-700 group-hover:scale-110" unoptimized />
                    {isBorrowed && <Badge variant="secondary" className={cn("absolute top-4 right-4 z-10 font-black text-[10px] uppercase px-4 py-1.5 rounded-full shadow-2xl", loan.daysLeft <= 1 ? 'bg-destructive text-white' : 'bg-secondary text-white')}>{loan.daysLeft > 0 ? `${loan.daysLeft}d Left` : "Overdue"}</Badge>}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col items-center justify-center gap-3 p-8">
                      <Button variant="secondary" className="w-full h-12 rounded-xl font-black text-[10px] uppercase shadow-lg" onClick={() => router.push(`/reader/${book.id}?type=preview`)}><Eye className="mr-2 h-4 w-4" />Preview</Button>
                      {isBorrowed ? (
                        <>
                          <Button className="w-full h-12 rounded-xl font-black text-[10px] uppercase shadow-lg bg-primary" onClick={() => router.push(`/reader/${book.id}?type=full`)}>Read Full</Button>
                          <Button variant="outline" className="w-full h-12 rounded-xl font-black text-[10px] uppercase border-destructive text-destructive hover:bg-destructive/10" onClick={() => handleReturnFromLibrary(loan, book.title)}><RotateCcw className="mr-2 h-4 w-4" />Return</Button>
                        </>
                      ) : (
                        <Button 
                          className={cn("w-full h-12 rounded-xl font-black text-[10px] uppercase shadow-lg", localUser?.role === 'demo' ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-secondary text-white")} 
                          onClick={() => handleBorrow(book)}
                        >
                          {localUser?.role === 'demo' ? <><Lock className="mr-2 h-4 w-4" />Restricted</> : "Borrow"}
                        </Button>
                      )}
                      {localUser?.role === 'faculty' && (
                        <Button variant="outline" className="w-full h-12 rounded-xl font-black text-[10px] uppercase border-indigo-500 text-indigo-500 hover:bg-indigo-500/10" onClick={() => handleNominate(book)}><Star className="mr-2 h-4 w-4" />Nominate</Button>
                      )}
                    </div>
                  </div>
                  <div className="p-8 flex-1 flex flex-col gap-3">
                    <h3 className="font-headline font-bold text-xl text-primary line-clamp-2 cursor-pointer hover:text-secondary transition-colors" onClick={() => router.push(`/library/${book.id}`)}>{book.title}</h3>
                    <p className="text-xs text-muted-foreground italic truncate">by {book.author}</p>
                    {book.recommendedBy && (
                      <Badge variant="outline" className="w-fit text-[9px] uppercase border-indigo-500/30 text-indigo-500 bg-indigo-500/5">
                        By {book.recommendedBy}
                      </Badge>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <div className="pt-24 border-t border-white/5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <Card className="p-10 bg-card/30 backdrop-blur-xl border-white/5 rounded-[2.5rem] cursor-pointer hover:bg-primary/5 transition-all text-center group" onClick={() => { setMessageType('Request'); setMessageDialogOpen(true); }}>
              <PlusSquare className="h-12 w-12 mx-auto mb-4 text-primary opacity-40 group-hover:opacity-100 transition-all" />
              <h4 className="font-headline font-bold text-lg">Request a Volume</h4>
              <p className="text-[10px] uppercase font-black opacity-30 tracking-widest mt-1">Institutional Requisition</p>
            </Card>
            <Card className="p-10 bg-card/30 backdrop-blur-xl border-white/5 rounded-[2.5rem] cursor-pointer hover:bg-secondary/5 transition-all text-center group" onClick={() => { setMessageType('Suggestion'); setMessageDialogOpen(true); }}>
              <Lightbulb className="h-12 w-12 mx-auto mb-4 text-secondary opacity-40 group-hover:opacity-100 transition-all" />
              <h4 className="font-headline font-bold text-lg">Divine Insight</h4>
              <p className="text-[10px] uppercase font-black opacity-30 tracking-widest mt-1">Manuscript Suggestion</p>
            </Card>
            <Card className="p-10 bg-card/30 backdrop-blur-xl border-white/5 rounded-[2.5rem] cursor-pointer hover:bg-primary/5 transition-all text-center group" onClick={() => { setMessageType('Contact'); setMessageDialogOpen(true); }}>
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-primary opacity-40 group-hover:opacity-100 transition-all" />
              <h4 className="font-headline font-bold text-lg">Contact Sanctuary</h4>
              <p className="text-[10px] uppercase font-black opacity-30 tracking-widest mt-1">Direct Communication</p>
            </Card>
          </div>
        </div>

        <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
          <DialogContent className="rounded-[3rem] shadow-4xl bg-card/95 backdrop-blur-2xl border-white/10 p-0 overflow-hidden max-w-xl">
            <DialogHeader className="p-10 bg-primary/10 border-b border-white/5">
              <DialogTitle className="text-3xl font-headline font-bold text-primary flex items-center gap-4">
                <MessageSquare className="h-8 w-8" /> {messageType} Portal
              </DialogTitle>
            </DialogHeader>
            <div className="p-10 space-y-8">
              <div className="space-y-4">
                <Label className="text-[10px] uppercase font-black tracking-widest opacity-40">Inquiry Details</Label>
                <Textarea value={messageContent} onChange={(e) => setMessageContent(e.target.value)} placeholder="Type your inquiry..." className="min-h-[200px] bg-muted/50 border-white/10 rounded-[2rem] p-6 text-base shadow-inner outline-none" />
              </div>
              <Button onClick={handleSendMessage} className="w-full h-16 rounded-2xl font-black text-xs uppercase tracking-widest bg-primary shadow-2xl shadow-primary/30">Submit Dispatch</Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

export default function LibraryPage() {
  return (<Suspense fallback={<div className="flex h-screen items-center justify-center bg-background"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>}><LibraryContent /></Suspense>);
}
