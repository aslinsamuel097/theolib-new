
"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Clock, BookOpen, Info, ShieldAlert, RotateCcw, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  useFirebase, 
  useCollection, 
  useMemoFirebase,
  deleteDocumentNonBlocking,
  addDocumentNonBlocking
} from '@/firebase';
import { collection, query, where, doc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/theolib-1677e.firebasestorage.app/o/logo%2Ftheolib_logo.png?alt=media";
const LOAN_DURATION_DAYS = 5;

function MyBooksContent() {
  const router = useRouter();
  const { toast } = useToast();
  const { firestore: db } = useFirebase();
  const [user, setUser] = useState<any>(null);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('theolib_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    } else {
      router.push('/');
    }
  }, [router]);

  const loansQuery = useMemoFirebase(() => {
    if (!user?.id) return null;
    return query(collection(db, "loans"), where("userId", "==", user.id));
  }, [db, user?.id]);
  const { data: loansData } = useCollection(loansQuery);

  const booksQuery = useMemoFirebase(() => collection(db, "books"), [db]);
  const { data: booksData } = useCollection(booksQuery);

  const activeBorrowedList = useMemo(() => {
    if (!loansData || !booksData) return [];
    return loansData.map(loan => {
      const book = booksData.find(b => b.id === loan.bookId);
      const issuedAt = loan.issuedAt?.toDate ? loan.issuedAt.toDate().getTime() : new Date(loan.issuedAt).getTime();
      const now = new Date().getTime();
      const diffMs = now - issuedAt;
      const daysPassed = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      const daysLeft = Math.max(0, LOAN_DURATION_DAYS - daysPassed);
      const progress = Math.min(100, (daysPassed / LOAN_DURATION_DAYS) * 100);

      return {
        ...loan,
        book,
        daysLeft,
        daysPassed,
        progress
      };
    }).filter(l => l.book);
  }, [loansData, booksData]);

  const handleReturnAction = (loan: any) => {
    if (loan.daysPassed > LOAN_DURATION_DAYS) {
      setSelectedBook(loan);
      setIsReturnDialogOpen(true);
    } else {
      // Log official return message for 48h cool-off check and audit
      addDocumentNonBlocking(collection(db, 'messages'), {
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        collegeId: user.collegeId || 'guest',
        type: 'Usage:Return',
        content: `Scholar returned manuscript: "${loan.book.title}"`,
        bookId: loan.bookId,
        bookTitle: loan.book.title,
        timestamp: serverTimestamp()
      });
      
      deleteDocumentNonBlocking(doc(db, 'loans', loan.id));
      toast({ title: "Manuscript Returned", description: "The volume has been restored to the sanctuary." });
    }
  };

  const handleFinalizeReturnRequest = () => {
    if (!selectedBook || !user) return;
    
    addDocumentNonBlocking(collection(db, 'messages'), {
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      collegeId: user.collegeId,
      type: 'OverdueReturn',
      bookId: selectedBook.bookId,
      bookTitle: selectedBook.book.title,
      loanId: selectedBook.id,
      content: `Student ${user.firstName} is requesting to return overdue manuscript: "${selectedBook.book.title}".`,
      timestamp: serverTimestamp()
    });

    toast({ title: "Finalization Requested", description: "Admin has been notified to unlock this return." });
    setIsReturnDialogOpen(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navigation />
      <main className="flex-1 container px-4 py-12 mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl font-headline font-bold text-primary mb-2">Current Loans</h1>
          <p className="text-muted-foreground">You have {activeBorrowedList.length} manuscripts active in your digital study.</p>
        </div>

        <Alert className="mb-10 bg-secondary/10 border-secondary/20">
          <Info className="h-4 w-4 text-secondary-foreground" />
          <AlertTitle className="text-secondary-foreground font-bold">Academic Restitution</AlertTitle>
          <AlertDescription className="text-secondary-foreground/80">
            Digital volumes are issued for 5 days. Overdue returns require manual Faculty/Admin authorization. 48-hour cool-off period applies to returned works.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {activeBorrowedList.map((loan) => (
            <Card key={loan.id} className="overflow-hidden border-muted shadow-sm hover:shadow-md transition-shadow bg-card">
              <div className="flex flex-col sm:flex-row h-full">
                <div className="relative w-full sm:w-1/3 aspect-[2/3] sm:aspect-auto">
                  <Image
                    src={loan.book.thumbnailUrl || LOGO_URL}
                    alt={loan.book.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <Badge variant="outline" className="text-[10px]">{loan.book.category}</Badge>
                    <div className={`flex items-center gap-1 text-xs font-bold ${loan.daysPassed >= 4 ? 'text-destructive' : 'text-primary'}`}>
                      <Clock className="h-3 w-3" />
                      {loan.daysPassed > LOAN_DURATION_DAYS ? "Overdue" : `${loan.daysLeft} Day(s) Left`}
                    </div>
                  </div>
                  <h3 className="text-xl font-headline font-bold text-primary mb-1 line-clamp-1">{loan.book.title}</h3>
                  <p className="text-xs text-muted-foreground mb-6 italic">by {loan.book.author}</p>
                  
                  <div className="mt-auto space-y-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-muted-foreground uppercase">Loan Period Elapsed</span>
                        <span className="font-bold">{Math.round(loan.progress)}%</span>
                      </div>
                      <Progress value={loan.progress} className="h-1.5" />
                    </div>
                    
                    <div className="flex gap-3">
                      <Button asChild variant="secondary" className="flex-1 font-bold">
                        <Link href={`/library/${loan.book.id}`}>
                          <BookOpen className="mr-2 h-4 w-4" />
                          Study
                        </Link>
                      </Button>
                      <Button 
                        variant={loan.daysPassed > LOAN_DURATION_DAYS ? "destructive" : "outline"} 
                        className="font-bold"
                        onClick={() => handleReturnAction(loan)}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        {loan.daysPassed > LOAN_DURATION_DAYS ? "Finalize Overdue" : "Return"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {activeBorrowedList.length === 0 && (
          <div className="text-center py-20 bg-muted/30 rounded-lg border-2 border-dashed">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
            <h3 className="text-xl font-headline font-bold text-muted-foreground">Your study table is empty</h3>
            <p className="text-sm text-muted-foreground">Visit the catalog to borrow manuscripts for your research.</p>
            <Button asChild className="mt-6 font-bold" variant="secondary">
              <Link href="/library">Browse Catalog</Link>
            </Button>
          </div>
        )}

        <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5" />
                Overdue Requisition
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <p className="text-sm">
                The loan period for <strong className="text-primary">"{selectedBook?.book.title}"</strong> has expired. 
              </p>
              <div className="p-4 bg-muted border rounded-lg">
                <p className="text-[11px] text-muted-foreground uppercase font-bold mb-1">Protocol</p>
                <p className="text-xs italic">
                  To maintain academic integrity, overdue returns must be authorized by the Faculty/Admin. 
                  Clicking "Notify Admin" will alert the Super Admin to finalize your return request.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleFinalizeReturnRequest} className="w-full font-bold" variant="destructive">
                Notify Admin to Return
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

export default function MyBooksPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
       <MyBooksContent />
    </Suspense>
  );
}
