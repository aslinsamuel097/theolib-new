"use client";

import { use, useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, BookOpen, Clock, Sparkles, ShieldCheck, Lock, Eye, Star, Loader2 } from 'lucide-react';
import { summarizeBook } from '@/ai/flows/book-summary-gen-ai';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

const LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/theolib-1677e.firebasestorage.app/o/logo%2Ftheolib_logo.png?alt=media";

function BookDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();
  
  const bookRef = useMemoFirebase(() => doc(db, "books", resolvedParams.id), [db, resolvedParams.id]);
  const { data: bookData, isLoading: isBookLoading } = useDoc(bookRef);
  const book = bookData ? { ...bookData, pdfUrl: bookData.pdfUrl || bookData.fullBookUrl } : null;

  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isBorrowed, setIsBorrowed] = useState(false);
  const [user, setUser] = useState<any>(null);

  const userRef = useRef<any>(null);
  const sessionTimeRef = useRef(0);

  useEffect(() => {
    const savedUser = localStorage.getItem('theolib_user');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      setUser(u);
      userRef.current = u;
    }
    const savedTime = localStorage.getItem('theolib_session_seconds');
    if (savedTime) sessionTimeRef.current = parseInt(savedTime, 10);
  }, []);

  useEffect(() => {
    if (book) {
      const savedBorrowed = localStorage.getItem('theolib_borrowed_ids');
      if (savedBorrowed && savedBorrowed.includes(resolvedParams.id)) {
        setIsBorrowed(true);
      }
    }
  }, [book, resolvedParams.id]);

  useEffect(() => {
    async function getSummary() {
      if (!book) return;
      setLoadingSummary(true);
      try {
        const result = await summarizeBook({
          bookTitle: book.title,
          bookDescription: book.author || "Theological manuscript"
        });
        setSummary(result.summary);
      } catch (err) {
        console.error("AI summary failed:", err);
      } finally {
        setLoadingSummary(false);
      }
    }
    if (book) getSummary();
  }, [book]);

  const handleBorrow = () => {
    if (!user || !book) return;
    if (user.role === 'demo') {
      toast({ variant: "destructive", title: "Access Restricted", description: "Demo identities cannot borrow manuscripts." });
      return;
    }
    const savedBorrowed = JSON.parse(localStorage.getItem('theolib_borrowed_ids') || '[]');
    if (!savedBorrowed.includes(book.id)) {
      const newBorrowed = [...savedBorrowed, book.id];
      localStorage.setItem('theolib_borrowed_ids', JSON.stringify(newBorrowed));
    }
    setIsBorrowed(true);
    addDocumentNonBlocking(collection(db, 'loans'), {
      userId: user.id,
      bookId: book.id,
      issuedAt: serverTimestamp()
    });
    toast({ title: "Loan Secured", description: "This volume is now in your collection." });
  };

  const handleRead = () => {
    if (!book) return;
    if (isBorrowed) router.push(`/reader/${book.id}?type=full`);
    else toast({ title: "Locked", description: "Please borrow this work for full access.", variant: "destructive" });
  };

  const handlePreview = () => {
    if (!book) return;
    router.push(`/reader/${book.id}?type=preview`);
  };

  if (isBookLoading) return <div className="flex h-screen items-center justify-center"><Clock className="animate-spin" /></div>;
  if (!book) return <div className="p-12 text-center font-bold">Manuscript not found</div>;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navigation />
      <main className="flex-1 container px-4 py-12 mx-auto">
        <Link href="/library" className="flex items-center text-sm text-muted-foreground hover:text-primary mb-8 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Catalog
        </Link>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4">
            <div className="sticky top-24">
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-xl mb-6 bg-muted">
                <Image src={book.thumbnailUrl || LOGO_URL} alt={book.title} fill className="object-cover" priority unoptimized />
              </div>
              <div className="space-y-4">
                <Button 
                  onClick={isBorrowed ? handleRead : handleBorrow} 
                  size="lg" 
                  className={cn("w-full font-bold shadow-lg", (user?.role === 'demo' && !isBorrowed) ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-secondary text-secondary-foreground")}
                  disabled={user?.role === 'demo' && !isBorrowed}
                >
                  {isBorrowed ? <><BookOpen className="mr-2 h-5 w-5" /> Read Full Text</> : (user?.role === 'demo' ? <><Lock className="mr-2 h-5 w-5" /> Borrow Restricted</> : <><ShieldCheck className="mr-2 h-5 w-5" /> Borrow Manuscript</>)}
                </Button>
                <Button variant="outline" className="w-full border-primary/20" onClick={handlePreview}><Eye className="mr-2 h-4 w-4" /> Preview (25 Pages)</Button>
                <div className="p-4 bg-muted/50 rounded-lg border text-sm space-y-3">
                  <div className="flex justify-between"><span className="text-muted-foreground">Language</span><span className="font-medium">{book.language || "English"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="font-medium">{book.category}</span></div>
                  {book.recommendedBy && <div className="flex justify-between pt-2 border-t"><span className="text-muted-foreground">Recom</span><Badge variant="secondary" className="bg-green-500/10 text-green-600">By {book.recommendedBy}</Badge></div>}
                </div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-8">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Badge className="bg-primary">{book.category}</Badge>
                <Badge variant="outline" className="border-primary/30 text-primary">{book.language || "English"}</Badge>
                <div className="flex items-center text-xs text-muted-foreground gap-1"><Lock className="h-3" /> Sanctuary Access</div>
              </div>
              <h1 className="text-4xl lg:text-5xl font-headline font-bold text-primary mb-2">{book.title}</h1>
              <p className="text-xl text-muted-foreground italic font-body">by {book.author}</p>
            </div>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-8 mb-8"><TabsTrigger value="overview" className="rounded-none pb-4 text-base font-headline">Overview</TabsTrigger><TabsTrigger value="ai-insight" className="rounded-none pb-4 text-base font-headline flex items-center gap-2"><Sparkles className="h-4 w-4" /> AI Insight</TabsTrigger></TabsList>
              <TabsContent value="overview" className="mt-0 prose prose-slate max-w-none"><h3 className="text-2xl font-headline font-bold mb-4">Summary of the Work</h3><p className="font-body text-lg text-muted-foreground leading-relaxed">This significant theological work by {book.author} explores critical themes within {book.category}.</p></TabsContent>
              <TabsContent value="ai-insight" className="mt-0"><div className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 rounded-xl">{loadingSummary ? <div className="space-y-4"><div className="h-4 bg-primary/20 animate-pulse rounded w-full"></div><div className="h-4 bg-primary/20 animate-pulse rounded w-5/6"></div></div> : <p className="font-body text-lg text-primary/90 leading-relaxed italic">{summary || "Consulting library..."}</p>}</div></TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
       <BookDetailContent params={params} />
    </Suspense>
  );
}
