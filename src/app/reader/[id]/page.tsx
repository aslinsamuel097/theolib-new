
'use client';

// CRITICAL: Polyfill Promise.withResolvers at the very top.
if (typeof Promise !== 'undefined' && typeof (Promise as any).withResolvers === 'undefined') {
  (Promise as any).withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

import "@/lib/pdf-polyfill";
import { use, Suspense, useEffect, useState, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  ArrowLeft, 
  ShieldAlert, 
  Loader2, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  Lock, 
  StickyNote, 
  MessageSquare, 
  Users, 
  Globe, 
  Lock as LockIcon, 
  Send, 
  Plus,
  MessageCircle,
  X,
  AlertTriangle,
  RotateCcw,
  CreditCard,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDoc, useMemoFirebase, useFirestore, addDocumentNonBlocking, useCollection } from "@/firebase";
import { doc, collection, serverTimestamp, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { Document, Page, pdfjs } from 'react-pdf';
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Import CSS for react-pdf
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set worker source to match the exact library version (4.8.69)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs`;

const BORROW_COOL_OFF_HOURS = 48;

// Simple abusive word filter
const ABUSIVE_WORDS = ["abuse", "badword", "idiot", "stupid", "hate", "kill", "damn"]; 
const containsAbusiveContent = (text: string) => {
  const lower = text.toLowerCase();
  return ABUSIVE_WORDS.some(word => lower.includes(word));
};

function ReaderContent({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { toast } = useToast();
  
  const type = searchParams.get("type") || "preview";
  const isPreview = type === "preview";
  
  const bookRef = useMemoFirebase(() => doc(db, "books", id), [db, id]);
  const { data: book, isLoading: isBookLoading } = useDoc(bookRef);

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  const userRef = useRef<any>(null);
  const [localUserId, setLocalUserId] = useState<string | null>(null);

  // Side panel state
  const [activePanel, setActivePanel] = useState<'none' | 'notes' | 'chat'>('none');

  // Notes state
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);
  const [viewedNote, setViewedNote] = useState<any>(null);
  const [noteContent, setNoteContent] = useState("");
  const [notePrivacy, setNotePrivacy] = useState<"public" | "friends" | "private">("public");

  // Chat state
  const [chatType, setChatType] = useState<"global" | "friends">("global");
  const [chatMessage, setChatMessage] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Derive pdfUrl safely with Google Drive proxy support
  const rawPdfUrl = book?.pdfUrl || book?.fullBookUrl || "";
  const pdfUrl = useMemo(() => {
    if (!rawPdfUrl) return "";
    const driveMatch = rawPdfUrl.match(/drive\.google\.com\/uc\?(?:.*&)?id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return `/api/drive/file/${driveMatch[1]}`;
    }
    return rawPdfUrl;
  }, [rawPdfUrl]);

  // Memoize the file configuration to prevent unnecessary re-renders/reloads in react-pdf
  const documentFile = useMemo(() => ({
    url: pdfUrl,
    withCredentials: false
  }), [pdfUrl]);

  useEffect(() => {
    setIsMounted(true);
    const savedUser = localStorage.getItem('theolib_user');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      userRef.current = u;
      setLocalUserId(u.id);
    }

    const updateWidth = () => {
      if (typeof window !== 'undefined') {
        const sidePanelWidth = activePanel !== 'none' ? 400 : 0;
        const width = Math.min(window.innerWidth - 64 - sidePanelWidth, 800);
        setContainerWidth(width > 0 ? width : 800);
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);

    if (userRef.current && book) {
      const now = new Date();
      const timeStr = format(now, "HH:mm:ss dd/MM/yyyy");
      addDocumentNonBlocking(collection(db, 'messages'), {
        userId: userRef.current.id,
        userName: `${userRef.current.firstName} ${userRef.current.lastName}`,
        collegeId: userRef.current.collegeId || 'guest',
        type: isPreview ? 'Usage:PreviewIn' : 'Usage:FullIn',
        content: timeStr,
        bookId: book.id,
        bookTitle: book.title,
        timestamp: serverTimestamp()
      });
    }

    return () => {
      if (userRef.current && book) {
        const now = new Date();
        const timeStr = format(now, "HH:mm:ss dd/MM/yyyy");
        addDocumentNonBlocking(collection(db, 'messages'), {
          userId: userRef.current.id,
          userName: `${userRef.current.firstName} ${userRef.current.lastName}`,
          collegeId: userRef.current.collegeId || 'guest',
          type: isPreview ? 'Usage:PreviewOut' : 'Usage:FullOut',
          content: timeStr,
          bookId: book.id,
          bookTitle: book.title,
          timestamp: serverTimestamp()
        });
      }
      window.removeEventListener('resize', updateWidth);
    };
  }, [book, isPreview, db, activePanel]);

  const currentUserDocRef = useMemoFirebase(() => localUserId ? doc(db, "users", localUserId) : null, [db, localUserId]);
  const { data: currentUser } = useDoc(currentUserDocRef);

  const loanQuery = useMemoFirebase(() => {
    if (!localUserId || !id) return null;
    return query(collection(db, "loans"), where("userId", "==", localUserId), where("bookId", "==", id), limit(1));
  }, [db, localUserId, id]);
  const { data: userLoan } = useCollection(loanQuery);
  const isBookBorrowed = userLoan && userLoan.length > 0;

  const handleReaderBorrow = async () => {
    try {
      if (!currentUser || !book || isBookBorrowed) return;
      
      // 48-Hour Cool-off Check
      const fortyEightHoursAgo = new Date(Date.now() - BORROW_COOL_OFF_HOURS * 60 * 60 * 1000);
      const coolOffQuery = query(
        collection(db, 'messages'),
        where('userId', '==', currentUser.id),
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
        
        toast({ 
          variant: "destructive", 
          title: "Cool-off Period Active", 
          description: `This volume was recently returned. Please wait ${remainingHours} more hours.` 
        });
        return;
      }

      addDocumentNonBlocking(collection(db, 'loans'), {
        userId: currentUser.id,
        bookId: book.id,
        issuedAt: serverTimestamp()
      });
      
      toast({ title: "Loan Secured", description: "Identity verified. Full manuscript access granted." });
      
      const params = new URLSearchParams(searchParams.toString());
      params.set('type', 'full');
      router.replace(`${window.location.pathname}?${params.toString()}`);
    } catch (err) {
      console.error("handleReaderBorrow error:", err);
      toast({ variant: "destructive", title: "Loan Failed", description: "Could not process borrow request." });
    }
  };

  // Notes Query - Book specific
  const notesQuery = useMemoFirebase(() => {
    if (!book?.id) return null;
    return query(
      collection(db, "messages"), 
      where("bookId", "==", book.id), 
      where("type", "==", "Note"),
      orderBy("timestamp", "desc")
    );
  }, [db, book?.id]);
  const { data: allNotes } = useCollection(notesQuery);

  const visibleNotes = useMemo(() => {
    if (!allNotes || !currentUser) return [];
    return allNotes.filter(n => {
      if (n.userId === currentUser.id) return true;
      if (n.privacy === 'public') return true;
      if (n.privacy === 'friends' && (currentUser.friends || []).includes(n.userId)) return true;
      return false;
    });
  }, [allNotes, currentUser]);

  // Chat Query - Global
  const chatQuery = useMemoFirebase(() => {
    return query(
      collection(db, "messages"),
      where("type", "==", "ChatMessage"),
      orderBy("timestamp", "desc"),
      limit(100)
    );
  }, [db]);
  const { data: allChatMessages } = useCollection(chatQuery);

  const visibleChatMessages = useMemo(() => {
    if (!allChatMessages || !currentUser) return [];
    const reversed = [...allChatMessages].reverse();
    return reversed.filter(m => {
      if (m.chatType === 'global') return true;
      if (m.chatType === 'friends') {
        return m.userId === currentUser.id || (currentUser.friends || []).includes(m.userId);
      }
      return false;
    });
  }, [allChatMessages, currentUser]);

  const currentTabChatMessages = useMemo(() => {
    return visibleChatMessages.filter(m => m.chatType === chatType);
  }, [visibleChatMessages, chatType]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentTabChatMessages, activePanel]);

  const handleCreateNote = () => {
    if (!noteContent.trim() || !currentUser || !book) return;
    if (containsAbusiveContent(noteContent)) {
      toast({ variant: "destructive", title: "Content Blocked", description: "Abusive comments are legally punishable." });
      return;
    }
    addDocumentNonBlocking(collection(db, "messages"), {
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`,
      bookId: book.id,
      bookTitle: book.title,
      type: "Note",
      content: noteContent,
      privacy: notePrivacy,
      timestamp: serverTimestamp()
    });
    setNoteContent("");
    setIsNewNoteOpen(false);
    toast({ title: "Note Indexed" });
  };

  const handleSendChat = () => {
    if (!chatMessage.trim() || !currentUser) return;
    if (containsAbusiveContent(chatMessage)) {
      toast({ variant: "destructive", title: "Message Blocked", description: "Abusive words are legally punishable." });
      return;
    }
    addDocumentNonBlocking(collection(db, "messages"), {
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`,
      bookId: book?.id || 'global',
      bookTitle: book?.title || 'Global Sanctuary Chat',
      type: "ChatMessage",
      chatType: chatType,
      content: chatMessage,
      timestamp: serverTimestamp()
    });
    setChatMessage("");
  };

  const togglePanel = (panel: 'notes' | 'chat') => {
    setActivePanel(current => current === panel ? 'none' : panel);
  };

  const goToPrevPage = () => setPageNumber(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setPageNumber(prev => Math.min(numPages || prev, prev + 1));

  const canGoPrev = pageNumber > 1;
  const canGoNext = !!numPages && (pageNumber < numPages && (!isPreview || pageNumber < 26));

  const handleLoadError = (error: any) => {
    console.error("PDF Load Error:", error);
    if (error.message?.includes('402')) {
      setLoadError("Sanctuary Quota Exceeded. The digital archive bandwidth has been exhausted for this session. Please notify the High Librarian.");
    } else if (error.message?.includes('403')) {
      setLoadError("Sanctuary Access Denied. Your identity lacks the necessary clearance for this specific transmission.");
    } else {
      setLoadError("The digital manuscript failed to open due to an archival transmission error.");
    }
  };

  if (isBookLoading || !isMounted) {
    return <div className="flex h-screen items-center justify-center bg-[#0c0819]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (!book || loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6 bg-[#0c0819] text-center">
        {loadError?.includes('Quota') ? <CreditCard className="h-16 w-16 text-amber-500 mb-6 animate-pulse" /> : <ShieldAlert className="h-16 w-16 text-destructive mb-6" />}
        <h1 className="text-3xl font-headline font-bold text-white mb-4">{loadError ? "Archival Lock" : "Manuscript Not Found"}</h1>
        <p className="text-slate-400 max-w-md mx-auto leading-relaxed mb-8">{loadError || "The requested volume does not exist within the current registry."}</p>
        <Button onClick={() => router.push("/library")} className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 font-bold">Return to Sanctuary</Button>
      </div>
    );
  }

  const handleDownloadPdf = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `${book.title}.pdf`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Archival Extraction", description: "Manuscript is being downloaded for authorized study." });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0c0819] overflow-hidden relative text-white">
      <header className="h-16 flex items-center justify-between px-6 bg-[#1a1233] border-b border-white/10 z-50 shrink-0 shadow-lg">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold truncate max-w-[200px]">{book.title}</h1>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1"><BookOpen className="h-2.5 w-2.5" />{isPreview ? "Sanctuary Preview" : "Full Manuscript"}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-black/40 px-4 py-1 rounded-full border border-white/5 mr-4 h-8">
            <span className="text-xs font-mono min-w-[80px] text-center">Page {pageNumber} of {numPages || '?'}</span>
          </div>

          {currentUser?.canDownloadPdf && !isPreview && (
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-[#2d244a] border-white/10 gap-2 rounded-full text-green-400 hover:text-green-300 hover:bg-[#2d244a]/80"
              onClick={handleDownloadPdf}
            >
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download</span>
            </Button>
          )}
          
          <div className="flex items-center gap-2">
            <Button variant={activePanel === 'notes' ? "secondary" : "outline"} size="sm" className="bg-[#2d244a] border-white/10 gap-2 relative rounded-full" onClick={() => togglePanel('notes')}>
              <StickyNote className="h-4 w-4 text-primary" /> <span className="hidden sm:inline">Notes</span>
              {visibleNotes.length > 0 && <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center bg-primary text-[8px] border-2 border-[#1a1233]">{visibleNotes.length}</Badge>}
            </Button>
            <Button variant={activePanel === 'chat' ? "secondary" : "outline"} size="sm" className="bg-[#2d244a] border-white/10 gap-2 rounded-full" onClick={() => togglePanel('chat')}>
              <MessageSquare className="h-4 w-4 text-secondary" /> <span className="hidden sm:inline">Chat</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Centered Side Pagination Buttons */}
        <div className="absolute inset-y-0 left-0 z-40 flex items-center px-4 pointer-events-none">
          <Button 
            variant="secondary" 
            size="icon" 
            className={cn(
              "h-14 w-14 rounded-full shadow-2xl transition-all pointer-events-auto bg-black/60 hover:bg-black/80 border border-white/10 backdrop-blur-md",
              !canGoPrev && "opacity-0 scale-90 pointer-events-none"
            )}
            onClick={goToPrevPage}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
        </div>

        <div className="absolute inset-y-0 right-0 z-40 flex items-center px-4 pointer-events-none" style={{ right: activePanel !== 'none' ? '400px' : '0' }}>
          <Button 
            variant="secondary" 
            size="icon" 
            className={cn(
              "h-14 w-14 rounded-full shadow-2xl transition-all pointer-events-auto bg-black/60 hover:bg-black/80 border border-white/10 backdrop-blur-md",
              !canGoNext && "opacity-0 scale-90 pointer-events-none"
            )}
            onClick={goToNextPage}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </div>

        <main className="flex-1 relative overflow-y-auto overflow-x-hidden p-4 sm:p-8 flex justify-center min-h-0 bg-[#0c0819]">
          <div className="min-h-full flex flex-col items-center">
            {isPreview && pageNumber > 25 ? (
              <div className="flex flex-col items-center justify-center w-full max-w-2xl aspect-[2/3] bg-black rounded-lg border-2 border-dashed border-white/20 text-center p-12 space-y-6">
                <Lock className="h-16 w-16 text-secondary animate-bounce" />
                <h2 className="text-3xl font-headline font-bold">Divine Access Restricted</h2>
                <p className="text-muted-foreground font-body">The first 25 pages are available for preview. Borrow this work for full access.</p>
                <Button 
                  variant="secondary" 
                  size="lg" 
                  className="font-bold px-12" 
                  onClick={isBookBorrowed ? () => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('type', 'full');
                    router.replace(`${window.location.pathname}?${params.toString()}`);
                  } : handleReaderBorrow}
                >
                  {isBookBorrowed ? "Unlock Full Access" : "Borrow for Full Study"}
                </Button>
              </div>
            ) : (
              <Document
                file={documentFile}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                onLoadError={handleLoadError}
                loading={<div className="flex flex-col items-center gap-4 mt-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="text-xs text-muted-foreground uppercase tracking-widest">Opening Manuscript...</span></div>}
              >
                <Page pageNumber={pageNumber} width={containerWidth} className="shadow-2xl rounded-sm overflow-hidden" renderTextLayer={false} renderAnnotationLayer={false} />
              </Document>
            )}
          </div>
        </main>

        {activePanel !== 'none' && (
          <aside className="w-[400px] border-l border-white/10 bg-[#1a1233] flex flex-col shrink-0 animate-in slide-in-from-right duration-300 relative z-50">
            {activePanel === 'notes' && (
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary font-bold"><StickyNote className="h-5 w-5" /> Sanctuary Notes</div>
                  <Button variant="ghost" size="icon" onClick={() => setActivePanel('none')}><X className="h-4 w-4" /></Button>
                </div>
                
                <div className="bg-destructive/10 p-3 flex items-start gap-2 border-b border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-[10px] uppercase font-bold text-destructive leading-tight">Warning: Abusive comments are legally punishable.</p>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                  {!isNewNoteOpen && !viewedNote ? (
                    <div className="flex flex-col h-full">
                      <div className="p-4"><Button onClick={() => setIsNewNoteOpen(true)} className="w-full gap-2 rounded-xl bg-primary hover:bg-primary/90"><Plus className="h-4 w-4" /> Preserve Insight</Button></div>
                      <ScrollArea className="flex-1 px-4">
                        <div className="space-y-4 pb-4">
                          {visibleNotes.length === 0 ? (
                            <div className="py-20 text-center opacity-40 italic text-sm">No notes indexed for this volume.</div>
                          ) : (
                            visibleNotes.map((note) => (
                              <div key={note.id} onClick={() => setViewedNote(note)} className="p-4 rounded-2xl bg-[#0c0819] border border-white/5 space-y-3 hover:border-primary/50 cursor-pointer transition-all">
                                <div className="flex justify-between items-start">
                                  <div className="flex flex-col"><span className="text-xs font-bold text-primary">{note.userId}</span><span className="text-[9px] text-muted-foreground font-mono">{note.timestamp?.toDate ? format(note.timestamp.toDate(), "HH:mm dd/MM/yy") : "..."}</span></div>
                                  <Badge variant="outline" className="text-[9px]">{note.privacy}</Badge>
                                </div>
                                <p className="text-sm leading-relaxed line-clamp-3 italic opacity-80">"{note.content}"</p>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : isNewNoteOpen ? (
                    <div className="p-4 space-y-4">
                      <Button variant="ghost" size="sm" onClick={() => setIsNewNoteOpen(false)} className="gap-2 -ml-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back</Button>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground">Privacy</label>
                          <Select value={notePrivacy} onValueChange={(v: any) => setNotePrivacy(v)}>
                            <SelectTrigger className="bg-[#0c0819] border-white/10"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#1a1233] border-white/10 text-white">
                              <SelectItem value="public">Public</SelectItem>
                              <SelectItem value="friends">Friends</SelectItem>
                              <SelectItem value="private">Private</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground">Insight Content</label>
                          <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Type your theological research..." className="w-full min-h-[150px] bg-[#0c0819] border-white/10 rounded-xl p-3 text-sm" />
                        </div>
                        <Button onClick={handleCreateNote} className="w-full font-bold">Index Note</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
                      <Button variant="ghost" size="sm" onClick={() => setViewedNote(null)} className="gap-2 -ml-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back</Button>
                      <div className="p-6 rounded-3xl bg-[#0c0819] border border-primary/20 space-y-4">
                        <div className="flex justify-between items-center"><span className="text-sm font-bold text-primary">{viewedNote.userId}</span><Badge variant="outline" className="text-[10px] uppercase">{viewedNote.privacy}</Badge></div>
                        <ScrollArea className="max-h-[300px]"><p className="text-base leading-relaxed whitespace-pre-wrap italic">"{viewedNote.content}"</p></ScrollArea>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activePanel === 'chat' && (
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-secondary font-bold"><MessageCircle className="h-5 w-5" /> Sanctuary Chat</div>
                  <Button variant="ghost" size="icon" onClick={() => setActivePanel('none')}><X className="h-4 w-4" /></Button>
                </div>

                <div className="bg-destructive/10 p-3 flex items-start gap-2 border-b border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-[10px] uppercase font-bold text-destructive leading-tight">Warning: Abusive words are legally punishable.</p>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="px-4 py-2 bg-[#0c0819]/30">
                    <div className="flex gap-1 p-1 bg-[#0c0819] rounded-lg border border-white/5">
                      <Button variant={chatType === 'global' ? 'secondary' : 'ghost'} size="sm" className="flex-1 text-[10px] font-bold h-8" onClick={() => setChatType('global')}><Globe className="h-3 w-3 mr-1" /> Global</Button>
                      <Button variant={chatType === 'friends' ? 'secondary' : 'ghost'} size="sm" className="flex-1 text-[10px] font-bold h-8" onClick={() => setChatType('friends')}><Users className="h-3 w-3 mr-1" /> Fellowship</Button>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 px-4 py-4">
                    <div className="space-y-4 pb-4">
                      {currentTabChatMessages.length === 0 ? (
                        <div className="py-20 text-center opacity-40 italic text-sm">No messages exchanged yet.</div>
                      ) : (
                        currentTabChatMessages.map((msg) => (
                          <div key={msg.id} className={cn("flex flex-col max-w-[90%]", msg.userId === localUserId ? "ml-auto items-end" : "mr-auto items-start")}>
                            <div className="flex items-center gap-2 mb-1 px-1">
                              <span className="text-[9px] font-bold text-muted-foreground">{msg.userId}</span>
                              <span className="text-[8px] opacity-40">{msg.timestamp?.toDate ? format(msg.timestamp.toDate(), "HH:mm") : "..."}</span>
                            </div>
                            <div className={cn("px-3 py-2 rounded-2xl text-xs leading-relaxed", msg.userId === localUserId ? "bg-secondary text-white rounded-tr-none" : "bg-[#0c0819] border border-white/5 rounded-tl-none")}>
                              {msg.content}
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={chatScrollRef} />
                    </div>
                  </ScrollArea>

                  <div className="p-4 bg-[#0c0819]/50 border-t border-white/10">
                    <div className="flex gap-2">
                      <Input value={chatMessage} onChange={e => setChatMessage(e.target.value)} placeholder="Type a message..." className="bg-[#0c0819] border-white/10 rounded-xl text-xs h-9" onKeyDown={e => e.key === 'Enter' && handleSendChat()} />
                      <Button size="icon" onClick={handleSendChat} className="bg-secondary hover:bg-secondary/90 shrink-0 rounded-xl h-9 w-9"><Send className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      <footer className="h-8 bg-[#1a1233] flex items-center justify-center border-t border-white/10 shrink-0">
        <p className="text-[10px] text-muted-foreground opacity-50 uppercase tracking-[0.3em]">TheoLib Digital Sanctuary</p>
      </footer>
    </div>
  );
}

export default function ReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#0c0819]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <ReaderContent id={resolvedParams.id} />
    </Suspense>
  );
}
