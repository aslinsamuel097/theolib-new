"use client";

// CRITICAL: Polyfill Promise.withResolvers at the very top before any other imports.
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
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Library, 
  Trash2, 
  Plus,
  Sun,
  Moon,
  LogOut,
  FileText,
  School,
  History,
  Eye,
  BookOpen,
  Clock,
  CheckCircle2,
  UploadCloud,
  Edit3,
  Star,
  Search,
  Reply,
  Ban,
  UserCheck,
  Activity,
  Download,
  Zap,
  Timer,
  ClipboardCheck,
  MonitorPlay,
  AlertCircle,
  StickyNote,
  MessageSquare,
  Inbox,
  ClipboardList,
  Loader2,
  RotateCcw,
  Globe,
  CheckSquare,
  Square,
  ShieldCheck,
  MessageCircle,
  ArrowUpDown,
  SortAsc,
  SortDesc,
  XCircle,
  ThumbsUp,
  UserCog,
  RefreshCw,
  Image as ImageIcon,
  ImagePlus,
  User,
  ShieldAlert,
  Wallet,
  AlertTriangle,
  FileDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  useFirebase,
  deleteDocumentNonBlocking,
  useMemoFirebase,
  useCollection,
  setDocumentNonBlocking,
  updateDocumentNonBlocking,
  addDocumentNonBlocking
} from "@/firebase";
import { collection, doc, query, orderBy, serverTimestamp, where, limit, getDocs, writeBatch } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { format, startOfDay } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs as ShadTabs, TabsContent as ShadTabsContent, TabsList as ShadTabsList, TabsTrigger as ShadTabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { pdfjs } from 'react-pdf';
import { uploadToGoogleDrive } from "./drive-actions";
import { requestGoogleDriveToken, getCachedDriveToken, GOOGLE_DRIVE_FOLDER_ID } from "@/lib/google-drive-client";

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs`;

const LANGUAGES = ["English", "Tamil", "Malayalam", "Hindi", "Others"];
const CATEGORIES = ["Theology", "CHRISTIAN Ethics", "Mission", "Intro to BIBLE", "CHURCH History", "Acts of Apostle", "Others"];

const formatDuration = (seconds: number) => {
  if (seconds === Infinity) return "LIVE";
  if (isNaN(seconds) || seconds < 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export default function AdminPanel() {
  const router = useRouter();
  const { toast } = useToast();
  const { firestore: db, storage, user: firebaseUser, auth } = useFirebase();
  
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [activeTab, setActiveTab] = useState("students");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [localUser, setLocalUser] = useState<any>(null);
  const [hasDriveToken, setHasDriveToken] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);

  useEffect(() => {
    if (getCachedDriveToken()) {
      setHasDriveToken(true);
    }
  }, []);

  const handleConnectDrive = async () => {
    if (!auth) return;
    setIsConnectingDrive(true);
    try {
      await requestGoogleDriveToken(auth);
      setHasDriveToken(true);
      toast({ 
        title: "Google Drive Connected", 
        description: `Manuscripts will be saved to your folder (${GOOGLE_DRIVE_FOLDER_ID}).` 
      });
    } catch (err: any) {
      console.error("Drive connection error:", err);
      toast({ variant: "destructive", title: "Connection Failed", description: err.message });
    } finally {
      setIsConnectingDrive(false);
    }
  };

  // Catalog Sorting State
  const [catalogSortField, setCatalogSortField] = useState<'title' | 'createdAt' | 'language'>('createdAt');
  const [catalogSortOrder, setCatalogSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const savedUser = localStorage.getItem('theolib_user');
    if (savedUser) {
      setLocalUser(JSON.parse(savedUser));
    } else {
      router.push("/");
    }

    const savedTheme = localStorage.getItem('theolib_theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    }
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [router]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theolib_theme', newTheme);
    if (newTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };
  
  const [selectedCollegeFilter, setSelectedCollegeFilter] = useState<string>("all");
  const [scholarSearch, setScholarSearch] = useState("");
  
  const [isAddScholarOpen, setIsAddScholarOpen] = useState(false);
  const [newScholar, setNewScholar] = useState({ 
    id: '', 
    firstName: '', 
    lastName: '', 
    password: '', 
    collegeId: '', 
    role: 'student' as 'student' | 'faculty' | 'admin' | 'super' | 'demo'
  });

  const [isAddCollegeOpen, setIsAddCollegeOpen] = useState(false);
  const [isEditCollegeOpen, setIsEditCollegeOpen] = useState(false);
  const [newCollege, setNewCollege] = useState({ id: '', name: '', password: '' });
  const [editingCollege, setEditingCollege] = useState<any>(null);

  const [isAddBookOpen, setIsAddBookOpen] = useState(false);
  const [isEditBookOpen, setIsEditBookOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  // Deletion States
  const [isDeleteCollegeConfirmOpen, setIsDeleteCollegeConfirmOpen] = useState(false);
  const [collegeToDelete, setCollegeToDelete] = useState<any>(null);
  
  const [newBook, setNewBook] = useState({ title: '', author: '', category: 'Theology', pdfUrl: '', language: 'English', isIndividualAccess: true, allowedCollegeIds: [] as string[] });
  const [selectedSingleFile, setSelectedSingleFile] = useState<File | null>(null);
  const [editingBook, setEditingBook] = useState<any>(null);
  
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkSettings, setBulkSettings] = useState({ category: 'Theology', language: 'English', isIndividualAccess: true, allowedCollegeIds: [] as string[] });
  const [uploadProgress, setUploadProgress] = useState(0);

  const [isUploading, setIsUploading] = useState(false);
  const [isUpdatingGlobal, setIsUpdatingGlobal] = useState(false);
  const [isSyncingThumbnails, setIsSyncingThumbnails] = useState(false);

  const [isRespondDialogOpen, setIsRespondDialogOpen] = useState(false);
  const [respondingToMessage, setRespondingToMessage] = useState<any>(null);
  const [adminResponseText, setAdminResponseText] = useState("");

  const [isUsageDialogOpen, setIsUsageDialogOpen] = useState(false);
  const [usageScholar, setUsageScholar] = useState<any>(null);

  const isSuperAdmin = localUser?.role === 'super';
  const isCollegeAdmin = localUser?.role === 'admin';
  const userCollegeId = localUser?.id;

  const collegesQuery = useMemoFirebase(() => firebaseUser ? query(collection(db, "colleges"), orderBy("name", "asc")) : null, [db, firebaseUser]);
  const studentsQuery = useMemoFirebase(() => {
    if (!firebaseUser) return null;
    let q = query(collection(db, "users"), where("role", "in", ["student", "faculty", "admin", "super", "demo"]));
    if (isCollegeAdmin) q = query(collection(db, "users"), where("collegeId", "==", userCollegeId));
    return q;
  }, [db, firebaseUser, isCollegeAdmin, userCollegeId]);

  const booksQuery = useMemoFirebase(() => firebaseUser ? query(collection(db, "books"), orderBy("createdAt", "desc")) : null, [db, firebaseUser]);
  const messagesQuery = useMemoFirebase(() => {
    if (!firebaseUser) return null;
    let q = query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(2000));
    if (isCollegeAdmin) q = query(collection(db, "messages"), where("collegeId", "==", userCollegeId), orderBy("timestamp", "desc"), limit(2000));
    return q;
  }, [db, firebaseUser, isCollegeAdmin, userCollegeId]);

  const { data: collegesData } = useCollection(collegesQuery);
  const { data: studentsData } = useCollection(studentsQuery);
  const { data: booksData } = useCollection(booksQuery);
  const { data: messagesData } = useCollection(messagesQuery);

  const colleges = collegesData || [];
  const students = studentsData || [];
  
  const allBooks = useMemo(() => {
    let list = booksData || [];
    if (isCollegeAdmin) {
      list = list.filter(book => book.allowedCollegeIds?.includes(userCollegeId));
    }
    return list;
  }, [booksData, isCollegeAdmin, userCollegeId]);

  const allMessages = messagesData || [];

  const unreadMessagesCount = useMemo(() => {
    return allMessages.filter(m => 
      !m.type.startsWith('Usage') && 
      m.type !== 'Note' && 
      !m.hasResponse
    ).length;
  }, [allMessages]);

  const activeScholarsToday = useMemo(() => {
    const today = startOfDay(new Date());
    return new Set(
      allMessages
        .filter(m => {
          const mDate = m.timestamp?.toDate ? m.timestamp.toDate() : (m.timestamp ? new Date(m.timestamp) : null);
          return mDate && mDate >= today;
        })
        .map(m => m.userId)
    ).size;
  }, [allMessages]);

  const livePulseScholars = useMemo(() => {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentActivity = allMessages.filter(m => {
      const mDate = m.timestamp?.toDate ? m.timestamp.toDate() : (m.timestamp ? new Date(m.timestamp) : null);
      return mDate && mDate >= tenMinsAgo;
    });
    
    const activeMap = new Map<string, any>();
    [...recentActivity].sort((a,b) => {
      const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
      const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
      return timeB - timeA;
    }).forEach(log => {
      if (!activeMap.has(log.userId)) {
        activeMap.set(log.userId, log);
      }
    });
    return Array.from(activeMap.values());
  }, [allMessages, currentTime]);

  const filteredStudents = useMemo(() => {
    let list = [...students];
    if (isSuperAdmin && selectedCollegeFilter !== "all") {
      if (selectedCollegeFilter === "individual") {
        list = list.filter(s => s.collegeId === "individual");
      } else {
        list = list.filter(s => s.collegeId === selectedCollegeFilter);
      }
    }
    if (scholarSearch.trim()) {
      const search = scholarSearch.toLowerCase();
      list = list.filter(s => (s.firstName || '').toLowerCase().includes(search) || (s.lastName || '').toLowerCase().includes(search) || (s.id || '').toLowerCase().includes(search));
    }
    return list.sort((a, b) => (b.isStarred ? 1 : 0) - (a.isStarred ? 1 : 0));
  }, [students, selectedCollegeFilter, scholarSearch, isSuperAdmin]);

  const sortedBooks = useMemo(() => {
    let list = [...allBooks];
    list.sort((a, b) => {
      if (catalogSortField === 'title') {
        const valA = (a.title || '').toLowerCase();
        const valB = (b.title || '').toLowerCase();
        return catalogSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (catalogSortField === 'createdAt') {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return catalogSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (catalogSortField === 'language') {
        const valA = (a.language || 'English').toLowerCase();
        const valB = (b.language || 'English').toLowerCase();
        return catalogSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return 0;
    });
    return list;
  }, [allBooks, catalogSortField, catalogSortOrder]);

  const generateThumbnail = async (fileOrUrl: File | string): Promise<Blob | null> => {
    try {
      const loadingTask = pdfjs.getDocument({
        url: typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl),
        withCredentials: false
      });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 0.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return null;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({ canvasContext: context, viewport }).promise;
      return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    } catch (err) {
      console.error("Thumbnail generation error:", err);
      return null;
    }
  };

  const scholarUsageStats = useMemo(() => {
    if (!usageScholar) return { total: 0, preview: 0, full: 0, login: 0, logout: 0, notes: 0, chat: 0, netPreviewTime: 0, netFullStudyTime: 0, totalSessionDuration: 0, gapTime: 0, netActiveStudyTime: 0 };
    
    const logs = [...allMessages.filter(m => m.userId === usageScholar.id)].sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
      return dateA - dateB;
    });

    const mergeRanges = (ranges: {start: number, end: number}[]) => {
      if (!ranges.length) return [];
      const sorted = [...ranges].sort((a, b) => a.start - b.start);
      const merged = [sorted[0]];
      for (let i = 1; i < sorted.length; i++) {
        const last = merged[merged.length - 1];
        const current = sorted[i];
        if (current.start <= last.end) last.end = Math.max(last.end, current.end);
        else merged.push(current);
      }
      return merged;
    };

    const previewRaw: {start: number, end: number}[] = [];
    const fullRaw: {start: number, end: number}[] = [];
    const sessionRaw: {start: number, end: number}[] = [];
    const inactiveRaw: {start: number, end: number}[] = [];

    let pS: number | null = null;
    let fS: number | null = null;
    let sS: number | null = null;
    let iS: number | null = null;

    const now = currentTime.getTime();

    logs.forEach(log => {
      const time = log.timestamp?.toDate ? log.timestamp.toDate().getTime() : (log.timestamp ? new Date(log.timestamp).getTime() : 0);
      if (!time) return;

      if (log.type === 'Usage:Login') {
        sS = time; iS = null; pS = null; fS = null;
      }
      else if (log.type === 'Usage:Logout' && sS) { 
        sessionRaw.push({start: sS, end: time}); 
        sS = null; iS = null; pS = null; fS = null; 
      }
      else if (log.type === 'Usage:InactiveIn') iS = time;
      else if (log.type === 'Usage:InactiveOut' && iS) { inactiveRaw.push({start: iS, end: time}); iS = null; }
      else if (log.type === 'Usage:PreviewIn') pS = time;
      else if (log.type === 'Usage:PreviewOut' && pS) { previewRaw.push({start: pS, end: time}); pS = null; }
      else if (log.type === 'Usage:FullIn') fS = time;
      else if (log.type === 'Usage:FullOut' && fS) { fullRaw.push({start: fS, end: time}); fS = null; }
    });

    if (sS) sessionRaw.push({start: sS, end: now});
    if (iS) inactiveRaw.push({start: iS, end: now});
    if (pS) previewRaw.push({start: pS, end: now});
    if (fS) fullRaw.push({start: fS, end: now});

    const mergedSessions = mergeRanges(sessionRaw);
    const mergedInactives = mergeRanges(inactiveRaw);
    const mergedPreviews = mergeRanges(previewRaw);
    const mergedFulls = mergeRanges(fullRaw);

    const getDuration = (ranges: {start: number, end: number}[]) => ranges.reduce((acc, r) => acc + (r.end - r.start) / 1000, 0);

    const totalSessionDuration = getDuration(mergedSessions);
    
    let totalInactiveInSession = 0;
    mergedInactives.forEach(gap => {
      mergedSessions.forEach(session => {
        const overlapStart = Math.max(gap.start, session.start);
        const overlapEnd = Math.min(gap.end, session.end);
        if (overlapStart < overlapEnd) totalInactiveInSession += (overlapEnd - overlapStart) / 1000;
      });
    });

    const netActiveStudyTime = Math.max(0, totalSessionDuration - totalInactiveInSession);
    const gapTime = totalInactiveInSession;

    return {
      total: logs.length,
      preview: logs.filter(m => m.type === 'Usage:PreviewIn').length,
      full: logs.filter(m => m.type === 'Usage:FullIn').length,
      login: logs.filter(m => m.type === 'Usage:Login').length,
      logout: logs.filter(m => m.type === 'Usage:Logout').length,
      notes: logs.filter(m => m.type === 'Note').length,
      chat: logs.filter(m => m.type === 'ChatMessage').length,
      totalSessionDuration: Math.round(totalSessionDuration),
      netPreviewTime: Math.round(getDuration(mergedPreviews)),
      netFullStudyTime: Math.round(getDuration(mergedFulls)),
      netActiveStudyTime: Math.round(netActiveStudyTime),
      gapTime: Math.round(gapTime),
    };
  }, [usageScholar, allMessages, currentTime]);

  const handleExportAudit = () => {
    if (!usageScholar) return;
    const scholarLogs = allMessages.filter(m => m.userId === usageScholar.id);
    
    const summaryData = [
      ["Scholar Activity Summary", ""],
      ["Metric", "Value"],
      ["Identity ID", usageScholar.id],
      ["Net Active Engagement", formatDuration(scholarUsageStats.netActiveStudyTime)],
      ["Inactive Gap Time", formatDuration(scholarUsageStats.gapTime)],
      ["Net Preview Duration", formatDuration(scholarUsageStats.netPreviewTime)],
      ["Net Full Study Duration", formatDuration(scholarUsageStats.netFullStudyTime)],
      ["Total Sanctuary Session Duration", formatDuration(scholarUsageStats.totalSessionDuration)],
      [],
      ["Detailed Protocol Log", "", "", "", ""],
      ["Identity", "Type", "Reference", "Message", "Timestamp"]
    ];

    const logData = scholarLogs.map(l => [
      usageScholar.id,
      l.type,
      (l.bookTitle || "System Hub").replace(/,/g, ";"),
      (l.content || "").replace(/,/g, ";"),
      l.timestamp?.toDate ? format(l.timestamp.toDate(), "yyyy-MM-dd HH:mm:ss") : ""
    ]);

    const csvContent = [...summaryData, ...logData].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_${usageScholar.id}_${format(new Date(), "yyyyMMdd")}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportGlobalAudit = () => {
    if (allMessages.length === 0) return;
    
    const headers = ["Scholar Name", "Identity ID", "Institution", "Event Type", "Detail/Reference", "Timestamp"];
    const rows = allMessages.map(msg => [
      `"${(msg.userName || 'Unknown').replace(/"/g, '""')}"`,
      `"${msg.userId}"`,
      `"${msg.collegeId || 'guest'}"`,
      `"${msg.type}"`,
      `"${(msg.content || msg.bookTitle || "-").replace(/"/g, '""')}"`,
      msg.timestamp?.toDate ? format(msg.timestamp.toDate(), "yyyy-MM-dd HH:mm:ss") : ""
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `global_audit_${format(new Date(), "yyyyMMdd")}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Global Audit Exported", description: `${allMessages.length} academic events logged.` });
  };

  const handleExportCatalog = () => {
    if (allBooks.length === 0) return;
    
    const headers = ["Title", "Author", "Category", "Language", "ID", "Individual Access", "Created At"];
    const rows = allBooks.map(book => [
      `"${book.title.replace(/"/g, '""')}"`,
      `"${book.author.replace(/"/g, '""')}"`,
      `"${book.category}"`,
      `"${book.language}"`,
      `"${book.id}"`,
      book.isIndividualAccess ? "Yes" : "No",
      book.createdAt?.toDate ? format(book.createdAt.toDate(), "yyyy-MM-dd HH:mm:ss") : ""
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `manuscript_catalog_${format(new Date(), "yyyyMMdd")}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Catalog Exported", description: `${allBooks.length} volumes indexed.` });
  };

  const handleSyncThumbnails = async () => {
    setIsSyncingThumbnails(true);
    setUploadProgress(0);
    try {
      let count = 0;
      for (const book of allBooks) {
        if (book.pdfUrl) {
          const thumbBlob = await generateThumbnail(book.pdfUrl);
          if (thumbBlob) {
            const thumbRef = ref(storage, `thumbnails/${book.id}_${Date.now()}.png`);
            await uploadBytes(thumbRef, thumbBlob);
            const thumbUrl = await getDownloadURL(thumbRef);
            updateDocumentNonBlocking(doc(db, "books", book.id), { thumbnailUrl: thumbUrl });
          }
        }
        count++;
        setUploadProgress((count / allBooks.length) * 100);
      }
      toast({ title: "Thumbnails Synchronized", description: `${count} volumes updated with visual signatures.` });
    } catch (e) {
      console.error("handleSyncThumbnails error:", e);
      toast({ variant: "destructive", title: "Sync Failed", description: "Archival transmission interrupted." });
    } finally {
      setIsSyncingThumbnails(false);
    }
  };

  const handleSyncPendingThumbnails = async () => {
    const unsynced = allBooks.filter(b => !b.thumbnailUrl);
    if (unsynced.length === 0) {
      toast({ title: "Sync Not Required", description: "All volumes currently have visual signatures." });
      return;
    }
    
    setIsSyncingThumbnails(true);
    setUploadProgress(0);
    try {
      let count = 0;
      for (const book of unsynced) {
        if (book.pdfUrl) {
          const thumbBlob = await generateThumbnail(book.pdfUrl);
          if (thumbBlob) {
            const thumbRef = ref(storage, `thumbnails/${book.id}_${Date.now()}.png`);
            await uploadBytes(thumbRef, thumbBlob);
            const thumbUrl = await getDownloadURL(thumbRef);
            updateDocumentNonBlocking(doc(db, "books", book.id), { thumbnailUrl: thumbUrl });
          }
        }
        count++;
        setUploadProgress((count / unsynced.length) * 100);
      }
      toast({ title: "Sync Complete", description: `${count} pending signatures generated.` });
    } catch (e) {
      console.error("handleSyncPendingThumbnails error:", e);
      toast({ variant: "destructive", title: "Sync Failed" });
    } finally {
      setIsSyncingThumbnails(false);
    }
  };

  const handleSingleThumbnailSync = async (book: any) => {
    if (!book.pdfUrl) return;
    setIsSyncingThumbnails(true);
    try {
      const thumbBlob = await generateThumbnail(book.pdfUrl);
      if (thumbBlob) {
        const thumbRef = ref(storage, `thumbnails/${book.id}_${Date.now()}.png`);
        await uploadBytes(thumbRef, thumbBlob);
        const thumbUrl = await getDownloadURL(thumbRef);
        updateDocumentNonBlocking(doc(db, "books", book.id), { thumbnailUrl: thumbUrl });
        toast({ title: "Signature Generated", description: `Thumbnail updated for "${book.title}".` });
      }
    } catch (e) {
      console.error("handleSingleThumbnailSync error:", e);
      toast({ variant: "destructive", title: "Sync Failed" });
    } finally {
      setIsSyncingThumbnails(false);
    }
  };

  const handleGrantAllAccess = async () => {
    setIsUpdatingGlobal(true);
    try {
      const batch = writeBatch(db);
      allBooks.forEach(book => {
        const bookRef = doc(db, "books", book.id);
        batch.update(bookRef, { allowedCollegeIds: [], isIndividualAccess: true });
      });
      await batch.commit();
      toast({ title: "Global Access Granted", description: "All volumes are now accessible across all institutions and individual scholars." });
    } catch (e) {
      console.error("handleGrantAllAccess error:", e);
      toast({ variant: "destructive", title: "Global Access Failed" });
    } finally {
      setIsUpdatingGlobal(false);
    }
  };

  const handleInitiateMonthlySuspension = async () => {
    if (!confirm("Initiate Monthly Suspension Protocol? This will restrict all Institutions and Independent Scholars until manual clearance.")) return;
    setIsUpdatingGlobal(true);
    try {
      const batch = writeBatch(db);
      
      // Suspend all colleges
      colleges.forEach(college => {
        const collegeRef = doc(db, "colleges", college.id);
        batch.update(collegeRef, { isSuspended: true });
      });

      // Suspend all individual scholars
      const individuals = students.filter(s => s.collegeId === "individual");
      individuals.forEach(ind => {
        const indRef = doc(db, "users", ind.id);
        batch.update(indRef, { isSuspended: true });
      });

      await batch.commit();
      toast({ title: "Suspension Protocol Active", description: "Monthly archival lock applied to all institutions and independent researchers." });
    } catch (e) {
      console.error("handleInitiateMonthlySuspension error:", e);
      toast({ variant: "destructive", title: "Protocol Failed", description: "Archival lock encountered an error." });
    } finally {
      setIsUpdatingGlobal(false);
    }
  };

  const handleAddScholar = () => {
    if (!newScholar.id || !newScholar.firstName || !newScholar.password) return;
    const scholarData = { 
      ...newScholar, 
      collegeId: isCollegeAdmin ? userCollegeId : newScholar.collegeId,
      isSuspended: false, 
      isStarred: false,
      canDownloadPdf: false,
      friends: [],
      createdAt: serverTimestamp() 
    };
    setDocumentNonBlocking(doc(db, "users", newScholar.id), scholarData, { merge: true });
    setIsAddScholarOpen(false);
    setNewScholar({ id: '', firstName: '', lastName: '', password: '', collegeId: '', role: 'student' });
    toast({ title: "Scholar Indexed" });
  };

  const handleDeleteUser = (userId: string) => {
    if (!confirm("Are you sure you want to permanently erase this identity? This action cannot be undone.")) return;
    deleteDocumentNonBlocking(doc(db, "users", userId));
    toast({ title: "Identity Erased" });
  };

  const handleConfirmDeleteCollege = async () => {
    if (!collegeToDelete) return;
    setIsUpdatingGlobal(true);
    try {
      const batch = writeBatch(db);
      
      // Cascading delete: find and remove all users in this college
      const q = query(collection(db, "users"), where("collegeId", "==", collegeToDelete.id));
      const usersSnap = await getDocs(q);
      usersSnap.forEach(userDoc => {
        batch.delete(doc(db, "users", userDoc.id));
      });
      
      // Delete the college record
      batch.delete(doc(db, "colleges", collegeToDelete.id));
      
      await batch.commit();
      toast({ title: "Institution Purged", description: "The college and all affiliated identities have been removed from the sanctuary." });
    } catch (e) {
      console.error("handleConfirmDeleteCollege error:", e);
      toast({ variant: "destructive", title: "Purge Failed" });
    } finally {
      setIsUpdatingGlobal(false);
      setIsDeleteCollegeConfirmOpen(false);
      setCollegeToDelete(null);
    }
  };

  const handleAddCollege = () => {
    if (!newCollege.id || !newCollege.name || !newCollege.password) return;
    setDocumentNonBlocking(doc(db, "colleges", newCollege.id), { 
      ...newCollege, 
      isSuspended: false, 
      createdAt: serverTimestamp() 
    }, { merge: true });
    setIsAddCollegeOpen(false); setNewCollege({ id: '', name: '', password: '' });
  };

  const handleEditCollege = () => {
    if (!editingCollege) return;
    updateDocumentNonBlocking(doc(db, "colleges", editingCollege.id), { 
      name: editingCollege.name, 
      password: editingCollege.password 
    });
    setIsEditCollegeOpen(false); setEditingCollege(null);
  };

  const handleAddBook = async () => {
    if (!isSuperAdmin) {
      toast({ 
        variant: "destructive", 
        title: "Access Restricted", 
        description: "Only the Super Admin can upload manuscript PDFs." 
      });
      return;
    }
    if (!newBook.title || !newBook.author) return;
    setIsUploading(true); 
    try {
      let finalPdfUrl = newBook.pdfUrl;
      let finalThumbnailUrl = "";

      if (selectedSingleFile) { 
        // 1. Upload Master PDF to Google Drive
        const formData = new FormData();
        formData.append('file', selectedSingleFile);
        formData.append('language', newBook.language);
        formData.append('category', newBook.category);
        
        let token = getCachedDriveToken();
        if (!token && auth) {
          try {
            token = await requestGoogleDriveToken(auth);
            setHasDriveToken(true);
          } catch (tokenErr) {
            console.warn("Drive token popup closed or skipped:", tokenErr);
          }
        }
        if (token) {
          formData.append('accessToken', token);
        }

        const uploadRes = await fetch('/api/drive/upload', {
          method: 'POST',
          body: formData,
        });
        const driveResult = await uploadRes.json();
        if (!uploadRes.ok || !driveResult.success) {
          throw new Error(driveResult.error || "Failed to upload manuscript to Drive");
        }
        finalPdfUrl = driveResult.url!;

        // 2. Generate and upload thumbnail to Firebase Storage
        const thumbBlob = await generateThumbnail(selectedSingleFile);
        if (thumbBlob) {
          const thumbRef = ref(storage, `thumbnails/${Date.now()}_${selectedSingleFile.name}.png`);
          await uploadBytes(thumbRef, thumbBlob);
          finalThumbnailUrl = await getDownloadURL(thumbRef);
        }
      }

      const bookId = newBook.title.toLowerCase().replace(/[^a-z0-9]/g, '-');
      setDocumentNonBlocking(doc(db, "books", bookId), { 
        ...newBook, 
        pdfUrl: finalPdfUrl, 
        thumbnailUrl: finalThumbnailUrl,
        id: bookId, 
        createdAt: serverTimestamp(), 
        updatedAt: serverTimestamp() 
      }, { merge: true });
      setIsAddBookOpen(false); setSelectedSingleFile(null);
      setNewBook({ title: '', author: '', category: 'Theology', pdfUrl: '', language: 'English', isIndividualAccess: true, allowedCollegeIds: [] });
      toast({ title: "Volume Indexed", description: "Archived in your designated Google Drive folder." });
    } catch (e: any) {
      console.error("handleAddBook error:", e);
      toast({ variant: "destructive", title: "Indexing Failed", description: e.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditBook = async () => {
    if (!editingBook) return;
    if (selectedSingleFile && !isSuperAdmin) {
      toast({ 
        variant: "destructive", 
        title: "Access Restricted", 
        description: "Only the Super Admin can upload or replace manuscript PDFs." 
      });
      return;
    }
    setIsUploading(true);
    try {
      let finalPdfUrl = editingBook.pdfUrl;
      let finalThumbnailUrl = editingBook.thumbnailUrl || "";

      if (selectedSingleFile) {
         // 1. Update Master PDF in Google Drive
         const formData = new FormData();
         formData.append('file', selectedSingleFile);
         formData.append('language', editingBook.language);
         formData.append('category', editingBook.category);
         
         let token = getCachedDriveToken();
         if (!token && auth) {
           try {
             token = await requestGoogleDriveToken(auth);
             setHasDriveToken(true);
           } catch (tokenErr) {
             console.warn("Drive token popup closed or skipped:", tokenErr);
           }
         }
         if (token) {
           formData.append('accessToken', token);
         }

         const uploadRes = await fetch('/api/drive/upload', {
           method: 'POST',
           body: formData,
         });
         const driveResult = await uploadRes.json();
         if (!uploadRes.ok || !driveResult.success) {
           throw new Error(driveResult.error || "Failed to upload manuscript to Drive");
         }
         finalPdfUrl = driveResult.url!;

         // 2. Update thumbnail in Firebase Storage
         const thumbBlob = await generateThumbnail(selectedSingleFile);
         if (thumbBlob) {
           const thumbRef = ref(storage, `thumbnails/${Date.now()}_${selectedSingleFile.name}.png`);
           await uploadBytes(thumbRef, thumbBlob);
           finalThumbnailUrl = await getDownloadURL(thumbRef);
         }
      }
      
      const { id, createdAt, ...updateData } = editingBook;
      
      updateDocumentNonBlocking(doc(db, "books", editingBook.id), { 
        ...updateData, 
        pdfUrl: finalPdfUrl, 
        thumbnailUrl: finalThumbnailUrl,
        updatedAt: serverTimestamp() 
      });
      setIsEditBookOpen(false); setEditingBook(null); setSelectedSingleFile(null);
      toast({ title: "Volume Updated" });
    } catch (e: any) {
      console.error("handleEditBook error:", e);
      toast({ variant: "destructive", title: "Update Failed", description: e.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!isSuperAdmin) {
      toast({ 
        variant: "destructive", 
        title: "Access Restricted", 
        description: "Only the Super Admin can upload manuscripts." 
      });
      return;
    }
    if (bulkFiles.length === 0) return; 
    setIsUploading(true); 
    setUploadProgress(0);
    try {
      let token = getCachedDriveToken();
      if (!token && auth) {
        try {
          token = await requestGoogleDriveToken(auth);
          setHasDriveToken(true);
        } catch (tokenErr) {
          console.warn("Drive token popup closed or skipped:", tokenErr);
        }
      }

      for (let i = 0; i < bulkFiles.length; i++) {
        const file = bulkFiles[i]; 
        
        // 1. Transmission to Google Drive
        const formData = new FormData();
        formData.append('file', file);
        formData.append('language', bulkSettings.language);
        formData.append('category', bulkSettings.category);
        if (token) {
          formData.append('accessToken', token);
        }
        
        const uploadRes = await fetch('/api/drive/upload', {
          method: 'POST',
          body: formData,
        });
        const driveResult = await uploadRes.json();
        if (!uploadRes.ok || !driveResult.success) {
          console.error("Bulk upload failed for file:", file.name, driveResult?.error);
          continue;
        }
        const pdfUrl = driveResult.url!;

        // 2. Generate and upload thumbnail for each bulk file
        let thumbnailUrl = "";
        const thumbBlob = await generateThumbnail(file);
        if (thumbBlob) {
          const thumbRef = ref(storage, `thumbnails/${Date.now()}_${file.name}.png`);
          await uploadBytes(thumbRef, thumbBlob);
          thumbnailUrl = await getDownloadURL(thumbRef);
        }

        const title = file.name.replace(/\.pdf$/i, '').replace(/_/g, ' '); 
        const bookId = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
        setDocumentNonBlocking(doc(db, "books", bookId), { 
          id: bookId, 
          title, 
          author: "System Librarian", 
          pdfUrl, 
          thumbnailUrl,
          category: bulkSettings.category, 
          language: bulkSettings.language, 
          isIndividualAccess: bulkSettings.isIndividualAccess,
          allowedCollegeIds: bulkSettings.allowedCollegeIds, 
          createdAt: serverTimestamp(), 
          updatedAt: serverTimestamp() 
        }, { merge: true });
        setUploadProgress(((i + 1) / bulkFiles.length) * 100);
      }
      setIsBulkUploadOpen(false); setBulkFiles([]);
      toast({ title: "Bulk Requisition Complete", description: "Archived into Google Drive folder." });
    } catch (e) {
      console.error("handleBulkUpload error:", e);
      toast({ variant: "destructive", title: "Bulk Requisition Partial or Failed" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendResponse = () => {
    if (!respondingToMessage || !adminResponseText.trim()) return;
    updateDocumentNonBlocking(doc(db, "messages", respondingToMessage.id), { 
      adminResponse: adminResponseText, 
      hasResponse: true, 
      isReadByAdmin: true 
    });
    setIsRespondDialogOpen(false); setAdminResponseText(""); setRespondingToMessage(null);
  };

  const handleApproveNomination = (msg: any) => {
    if (msg.bookId) {
      updateDocumentNonBlocking(doc(db, "books", msg.bookId), {
        recommendedBy: msg.userName,
        updatedAt: serverTimestamp()
      });
    }
    updateDocumentNonBlocking(doc(db, "messages", msg.id), {
      hasResponse: true,
      adminResponse: "Approved",
      isReadByAdmin: true
    });
    toast({ title: "Nomination Approved" });
  };

  const handleRejectNomination = (msg: any) => {
    updateDocumentNonBlocking(doc(db, "messages", msg.id), {
      hasResponse: true,
      adminResponse: "Rejected",
      isReadByAdmin: true
    });
    toast({ title: "Nomination Rejected" });
  };

  const handleRevokeNomination = (msg: any) => {
    if (msg.bookId) {
      updateDocumentNonBlocking(doc(db, "books", msg.bookId), {
        recommendedBy: "",
        updatedAt: serverTimestamp()
      });
    }
    updateDocumentNonBlocking(doc(db, "messages", msg.id), {
      hasResponse: false,
      adminResponse: "",
      isReadByAdmin: false
    });
    toast({ title: "Nomination Revoked", description: "The volume has been restored to standard status." });
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    updateDocumentNonBlocking(doc(db, "users", userId), { role: newRole });
    toast({ title: "Protocol Updated", description: `Identity assigned ${newRole} role.` });
  };

  const getUsageBadge = (msg: any) => {
    const type = typeof msg === 'string' ? msg : msg.type;
    if (type.includes('Login')) return <Badge variant="outline" className="border-green-500 text-green-500 gap-1 bg-green-500/5"><UserCheck className="h-3 w-3" /> Login</Badge>;
    if (type.includes('Logout')) return <Badge variant="outline" className="border-gray-500 text-gray-500 gap-1 bg-gray-500/5"><LogOut className="h-3 w-3" /> Logout</Badge>;
    if (type.includes('PreviewIn')) return <Badge variant="outline" className="border-blue-500 text-blue-500 gap-1 bg-blue-500/5"><Eye className="h-3 w-3" /> Preview</Badge>;
    if (type.includes('FullIn')) return <Badge variant="outline" className="border-purple-500 text-purple-500 gap-1 bg-purple-500/5"><BookOpen className="h-3 w-3" /> Full Text</Badge>;
    if (type === 'Note') return <Badge variant="outline" className="border-amber-500 text-amber-500 gap-1 bg-amber-500/5"><StickyNote className="h-3 w-3" /> Note</Badge>;
    if (type === 'ChatMessage') return <Badge variant="outline" className="border-purple-500 text-purple-500 gap-1 bg-purple-500/5"><MessageSquare className="h-3 w-3" /> Chat</Badge>;
    if (type === 'Usage:InactiveIn') return <Badge variant="outline" className="border-red-500 text-red-500 gap-1 bg-red-500/5"><AlertCircle className="h-3 w-3" /> Away</Badge>;
    if (type === 'Usage:InactiveOut') return <Badge variant="outline" className="border-green-500 text-green-500 gap-1 bg-green-500/5"><CheckCircle2 className="h-3 w-3" /> Returned</Badge>;
    if (type === 'Nomination') return <Badge variant="outline" className="border-indigo-500 text-indigo-500 gap-1 bg-indigo-500/5"><Star className="h-3 w-3" /> Nomination</Badge>;
    return <Badge variant="outline">{type.replace('Usage:', '')}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10 transition-colors">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4 bg-card/60 backdrop-blur-xl border border-white/5 p-8 rounded-[2.5rem] shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="p-5 bg-primary rounded-[1.5rem] shadow-2xl shadow-primary/20 animate-pulse"><Library className="h-8 w-8 text-primary-foreground" /></div>
          <div>
            <h1 className="text-4xl font-headline font-black text-primary tracking-tight">
              {isSuperAdmin ? "Super Admin Portal" : `${localUser?.firstName} Command Center`}
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.4em] font-black opacity-60">
              {isSuperAdmin ? "High Librarian command center" : "Institutional Authority Console"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isSuperAdmin && (
            <Button onClick={handleInitiateMonthlySuspension} disabled={isUpdatingGlobal} variant="outline" className="h-12 px-6 gap-2 rounded-2xl font-bold shadow-lg border-red-500/20 hover:bg-red-500/5 text-red-500">
              {isUpdatingGlobal ? <Loader2 className="animate-spin h-4 w-4" /> : <><ShieldAlert className="h-4 w-4" /> Monthly Protocol</>}
            </Button>
          )}
          <div 
            onClick={() => setActiveTab("pulse")}
            className="bg-muted/40 backdrop-blur-md border border-white/5 rounded-2xl px-6 py-3 flex items-center gap-4 shadow-inner cursor-pointer hover:bg-primary/5 transition-all group"
          >
            <Activity className="h-5 w-5 text-green-500 group-hover:scale-110 transition-transform" />
            <div className="flex flex-col"><span className="text-[9px] uppercase font-black text-muted-foreground leading-none">Pulse</span><span className="text-lg font-bold text-green-500">{activeScholarsToday}</span></div>
          </div>
          <Button variant="outline" size="icon" onClick={toggleTheme} className="rounded-2xl h-12 w-12 border-primary/10 shadow-sm">{theme === 'dark' ? <Sun className="h-5 w-5 text-yellow-500" /> : <Moon className="h-5 w-5" />}</Button>
          <Button variant="outline" onClick={() => router.push("/")} className="rounded-2xl h-12 px-6 gap-2 border-primary/20 hover:bg-primary/5 font-bold shadow-sm"><LogOut className="h-4 w-4" /> Exit</Button>
        </div>
      </div>

      <ShadTabs value={activeTab} onValueChange={setActiveTab} className="space-y-10">
        <ShadTabsList className="bg-card/40 backdrop-blur-xl border border-white/5 p-2 h-auto flex flex-wrap gap-2 rounded-[2rem] shadow-xl">
          <ShadTabsTrigger value="students" className="gap-3 rounded-2xl py-3 px-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold shadow-lg transition-all"><UserCheck className="h-4 w-4" /> Scholars</ShadTabsTrigger>
          <ShadTabsTrigger value="books" className="gap-3 rounded-2xl py-3 px-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold shadow-lg transition-all"><FileText className="h-4 w-4" /> Catalog</ShadTabsTrigger>
          {isSuperAdmin && <ShadTabsTrigger value="colleges" className="gap-3 rounded-2xl py-3 px-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold shadow-lg transition-all"><School className="h-4 w-4" /> Colleges</ShadTabsTrigger>}
          <ShadTabsTrigger value="audit" className="gap-3 rounded-2xl py-3 px-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold shadow-lg transition-all"><ClipboardList className="h-4 w-4" /> Audit</ShadTabsTrigger>
          <ShadTabsTrigger value="pulse" className="gap-3 rounded-2xl py-3 px-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold shadow-lg transition-all relative">
            <Zap className="h-4 w-4" /> Live Pulse
            {livePulseScholars.length > 0 && <Badge className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 bg-green-500 text-white border-2 border-background animate-pulse font-black text-[10px]">{livePulseScholars.length}</Badge>}
          </ShadTabsTrigger>
          {isSuperAdmin && (
            <ShadTabsTrigger value="inbox" className="gap-3 rounded-2xl py-3 px-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold shadow-lg transition-all relative">
              <Inbox className="h-4 w-4" /> Inbox
              {unreadMessagesCount > 0 && <Badge className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 bg-secondary text-white border-2 border-background animate-pulse font-black text-[10px]">{unreadMessagesCount}</Badge>}
            </ShadTabsTrigger>
          )}
        </ShadTabsList>

        <ShadTabsContent value="students" className="space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-3xl font-headline font-bold text-primary">Scholar Analytics</h2>
            <div className="flex items-center gap-4 flex-wrap">
              {isSuperAdmin && (
                <Select value={selectedCollegeFilter} onValueChange={setSelectedCollegeFilter}>
                  <SelectTrigger className="h-12 w-[200px] rounded-2xl bg-card/40 border-white/5">
                    <SelectValue placeholder="Filter Institution" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Global (All)</SelectItem>
                    <SelectItem value="individual">Independent Scholars</SelectItem>
                    {colleges.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <div className="relative group"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" /><Input placeholder="Search Scholars..." value={scholarSearch} onChange={e => setScholarSearch(e.target.value)} className="pl-12 h-12 w-[300px] rounded-2xl bg-card/40 backdrop-blur-md border-white/5 shadow-inner" /></div>
              <Button onClick={() => setIsAddScholarOpen(true)} className="h-12 px-6 gap-2 rounded-2xl font-bold shadow-2xl shadow-primary/20"><Plus className="h-4 w-4" /> New Identity</Button>
            </div>
          </div>
          <Card className="rounded-[2.5rem] border-white/5 bg-card/40 backdrop-blur-xl shadow-2xl overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-white/5">
                  <TableHead className="py-6 pl-10">Identity</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Security Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-10">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map(student => (
                  <TableRow key={student.id} className={cn("border-white/5 group hover:bg-white/5", student.isStarred && "bg-primary/5")}>
                    <TableCell className="py-6 pl-10">
                      <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" className={cn("rounded-xl", student.isStarred ? "text-yellow-500" : "opacity-20 hover:opacity-100")} onClick={() => updateDocumentNonBlocking(doc(db, "users", student.id), { isStarred: !student.isStarred })}><Star className={cn("h-4 w-4", student.isStarred && "fill-current")} /></Button>
                        <div className="flex flex-col">
                          <span className="font-bold">{student.firstName} {student.lastName}</span>
                          <span className="text-[10px] font-mono opacity-40">{student.id}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {student.collegeId === "individual" ? (
                        <Badge variant="outline" className="border-indigo-500 text-indigo-500 bg-indigo-500/5">Independent</Badge>
                      ) : (
                        <Badge variant="outline">{colleges.find(c => c.id === student.collegeId)?.name || "External"}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                            <Badge variant="outline" className="capitalize cursor-pointer hover:bg-primary/10 transition-colors flex items-center gap-1.5">
                              {student.role || 'student'}
                              <UserCog className="h-3 w-3 opacity-40" />
                            </Badge>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="rounded-2xl bg-card/95 backdrop-blur-xl border-white/10 p-2 shadow-2xl">
                          <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-40 px-2 py-1">Allocate Role</DropdownMenuLabel>
                          <DropdownMenuItem className="rounded-xl h-10 font-bold" onClick={() => handleRoleChange(student.id, 'student')}>Student</DropdownMenuItem>
                          <DropdownMenuItem className="rounded-xl h-10 font-bold" onClick={() => handleRoleChange(student.id, 'faculty')}>Faculty</DropdownMenuItem>
                          <DropdownMenuItem className="rounded-xl h-10 font-bold" onClick={() => handleRoleChange(student.id, 'demo')}>Demo</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs opacity-60">{student.password}</span>
                    </TableCell>
                    <TableCell>{student.isSuspended ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="outline" className="border-green-500 text-green-500 bg-green-500/5">Active</Badge>}</TableCell>
                    <TableCell className="text-right pr-10">
                      <div className="flex justify-end gap-3">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className={cn("rounded-xl transition-colors", student.canDownloadPdf ? "bg-green-500/20 text-green-500 border-green-500/50 hover:bg-green-500/30" : "bg-red-500/20 text-red-500 border-red-500/50 hover:bg-red-500/30")}
                          onClick={() => updateDocumentNonBlocking(doc(db, "users", student.id), { canDownloadPdf: !student.canDownloadPdf })}
                          title={student.canDownloadPdf ? "Download Active" : "Download Inactive"}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-xl font-bold" onClick={() => { setUsageScholar(student); setIsUsageDialogOpen(true); }}><History className="h-4 w-4 mr-2" /> Pulse</Button>
                        <Button variant={student.isSuspended ? "default" : "outline"} size="sm" className={cn("rounded-xl font-bold", !student.isSuspended && "text-destructive border-destructive/20")} onClick={() => updateDocumentNonBlocking(doc(db, "users", student.id), { isSuspended: !student.isSuspended })}>{student.isSuspended ? 'Restore' : 'Suspend'}</Button>
                        {isSuperAdmin && (
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(student.id)} className="text-destructive rounded-xl hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </ShadTabsContent>

        <ShadTabsContent value="books" className="space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-3xl font-headline font-bold text-primary">Sanctuary Catalog</h2>
            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={handleSyncPendingThumbnails} disabled={isSyncingThumbnails} variant="outline" className="h-12 px-6 gap-2 rounded-2xl font-bold shadow-lg border-green-500/20 hover:bg-green-500/5 text-green-500">
                {isSyncingThumbnails ? <><Loader2 className="animate-spin h-4 w-4" /> Processing...</> : <><ImagePlus className="h-4 w-4" /> Sync Pending</>}
              </Button>
              <Button onClick={handleSyncThumbnails} disabled={isSyncingThumbnails} variant="outline" className="h-12 px-6 gap-2 rounded-2xl font-bold shadow-lg border-secondary/20 hover:bg-secondary/5 text-secondary">
                {isSyncingThumbnails ? <><Loader2 className="animate-spin h-4 w-4" /> Processing...</> : <><RefreshCw className="h-4 w-4" /> Sync All</>}
              </Button>
              {isSuperAdmin && (
                <Button onClick={handleGrantAllAccess} disabled={isUpdatingGlobal} variant="outline" className="h-12 px-6 gap-2 rounded-2xl font-bold shadow-lg border-primary/20 hover:bg-primary/5 text-primary">
                  {isUpdatingGlobal ? <><Loader2 className="animate-spin h-4 w-4" /> Granting...</> : <><Globe className="h-4 w-4" /> Grant Global Access</>}
                </Button>
              )}
              <Button onClick={handleExportCatalog} variant="outline" className="h-12 px-6 gap-2 rounded-2xl font-bold shadow-lg border-primary/20 hover:bg-primary/5">
                <Download className="h-4 w-4" /> Export Titles
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-12 px-6 gap-2 rounded-2xl font-bold shadow-lg border-primary/20">
                    <ArrowUpDown className="h-4 w-4" /> Sort Archives
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="rounded-2xl bg-card/95 backdrop-blur-xl border-white/10 w-56">
                  <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-40 px-4 py-2">Criteria</DropdownMenuLabel>
                  <DropdownMenuItem className="rounded-xl mx-1" onClick={() => setCatalogSortField('title')}>
                    <FileText className="h-4 w-4 mr-2 opacity-60" /> Title {catalogSortField === 'title' && <CheckCircle2 className="h-3 w-3 ml-auto text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-xl mx-1" onClick={() => setCatalogSortField('createdAt')}>
                    <Clock className="h-4 w-4 mr-2 opacity-60" /> Date Uploaded {catalogSortField === 'createdAt' && <CheckCircle2 className="h-3 w-3 ml-auto text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-xl mx-1" onClick={() => setCatalogSortField('language')}>
                    <Globe className="h-4 w-4 mr-2 opacity-60" /> Language {catalogSortField === 'language' && <CheckCircle2 className="h-3 w-3 ml-auto text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/5" />
                  <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-40 px-4 py-2">Direction</DropdownMenuLabel>
                  <DropdownMenuItem className="rounded-xl mx-1" onClick={() => setCatalogSortOrder('asc')}>
                    <SortAsc className="h-4 w-4 mr-2 opacity-60" /> Ascending {catalogSortOrder === 'asc' && <CheckCircle2 className="h-3 w-3 ml-auto text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-xl mx-1" onClick={() => setCatalogSortOrder('desc')}>
                    <SortDesc className="h-4 w-4 mr-2 opacity-60" /> Descending {catalogSortOrder === 'desc' && <CheckCircle2 className="h-3 w-3 ml-auto text-primary" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {isSuperAdmin && (
                <>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 border border-white/10 rounded-2xl text-xs">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Drive Folder:</span>
                    <a
                      href="https://drive.google.com/drive/u/4/folders/1DyArF92Rg2FX5i7aVPgmt0_rc4Zu3wDN"
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-primary hover:underline text-xs flex items-center gap-1 font-bold"
                      title={GOOGLE_DRIVE_FOLDER_ID}
                    >
                      1DyArF92... <Globe className="h-3 w-3" />
                    </a>
                    {!hasDriveToken ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] font-bold border-primary/30 text-primary hover:bg-primary/10 ml-1 rounded-xl"
                        onClick={handleConnectDrive}
                        disabled={isConnectingDrive}
                      >
                        {isConnectingDrive ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Connect intheolib@gmail.com
                      </Button>
                    ) : (
                      <Badge variant="outline" className="border-green-500/40 text-green-500 bg-green-500/10 text-[10px] py-0.5 ml-1">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Linked (intheolib@gmail.com)
                      </Badge>
                    )}
                  </div>
                  <Button onClick={() => setIsAddBookOpen(true)} className="h-12 px-6 gap-2 rounded-2xl font-bold shadow-2xl shadow-primary/20"><Plus className="h-4 w-4" /> New Volume</Button>
                  <Button onClick={() => setIsBulkUploadOpen(true)} variant="outline" className="h-12 px-6 gap-2 rounded-2xl font-bold shadow-lg"><UploadCloud className="h-4 w-4" /> Bulk Import</Button>
                </>
              )}
            </div>
          </div>
          {isSyncingThumbnails && (
            <div className="mb-6 space-y-2 max-w-xl">
              <div className="flex justify-between text-[10px] uppercase font-black opacity-60"><span>Generating Visual Signatures...</span><span>{Math.round(uploadProgress)}%</span></div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}
          <Card className="rounded-[2.5rem] border-white/5 bg-card/40 backdrop-blur-xl shadow-2xl overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-white/5">
                  <TableHead className="py-6 pl-10">Manuscript</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead className="text-right pr-10">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBooks.map(book => (
                  <TableRow key={book.id} className="border-white/5 hover:bg-white/5">
                    <TableCell className="py-6 pl-10">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-8 bg-muted rounded overflow-hidden relative shadow-sm border border-white/5">
                          {book.thumbnailUrl ? (
                            <img src={book.thumbnailUrl} className="object-cover w-full h-full" alt="" />
                          ) : (
                            <ImageIcon className="h-4 w-4 absolute inset-0 m-auto opacity-20" />
                          )}
                        </div>
                        <div className="flex flex-col"><span className="font-bold">{book.title}</span><span className="text-[10px] opacity-40">by {book.author}</span></div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{book.category}</Badge></TableCell>
                    <TableCell><span className="text-xs">{book.language || "English"}</span></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {book.isIndividualAccess && <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/5">Individual</Badge>}
                        {(!book.allowedCollegeIds || book.allowedCollegeIds.length === 0) ? (
                          <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">Global Access</Badge>
                        ) : (
                          <Badge variant="outline" className="border-primary/20 text-primary">{book.allowedCollegeIds.length} Colleges</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-10">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleSingleThumbnailSync(book)} title="Refresh Thumbnail"><RefreshCw className={cn("h-4 w-4", isSyncingThumbnails && "animate-spin")} /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { setEditingBook(book); setIsEditBookOpen(true); }}><Edit3 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteDocumentNonBlocking(doc(db, "books", book.id))} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </ShadTabsContent>

        {isSuperAdmin && (
          <ShadTabsContent value="colleges" className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-3xl font-headline font-bold text-primary">Institutional Hub</h2>
              <Button onClick={() => setIsAddCollegeOpen(true)} className="h-12 px-6 gap-2 rounded-2xl font-bold shadow-2xl shadow-primary/20"><Plus className="h-4 w-4" /> New College</Button>
            </div>
            <Card className="rounded-[2.5rem] border-white/5 bg-card/40 backdrop-blur-xl shadow-2xl overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-white/5">
                    <TableHead className="py-6 pl-10">Institution</TableHead>
                    <TableHead>Admin Key</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-10">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colleges.map(college => (
                    <TableRow key={college.id} className="border-white/5 hover:bg-white/5">
                      <TableCell className="py-6 pl-10">
                        <div className="flex flex-col"><span className="font-bold">{college.name}</span><span className="text-[10px] font-mono opacity-40">{college.id}</span></div>
                      </TableCell>
                      <TableCell><span className="font-mono text-xs opacity-60">{college.password}</span></TableCell>
                      <TableCell>{college.isSuspended ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="outline" className="border-green-500 text-green-500 bg-green-500/5">Active</Badge>}</TableCell>
                      <TableCell className="text-right pr-10">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => { setEditingCollege(college); setIsEditCollegeOpen(true); }}><Edit3 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => updateDocumentNonBlocking(doc(db, "colleges", college.id), { isSuspended: !college.isSuspended })}>{college.isSuspended ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Ban className="h-4 w-4 text-destructive" />}</Button>
                          <Button variant="ghost" size="icon" onClick={() => { setCollegeToDelete(college); setIsDeleteCollegeConfirmOpen(true); }} className="text-destructive rounded-xl hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </ShadTabsContent>
        )}

        <ShadTabsContent value="audit" className="space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-3xl font-headline font-bold text-primary">Global Audit Stream</h2>
            <Button onClick={handleExportGlobalAudit} variant="outline" className="h-12 px-6 gap-2 rounded-2xl font-bold shadow-lg border-primary/20 hover:bg-primary/5">
              <Download className="h-4 w-4" /> Download Global Audit
            </Button>
          </div>
          <Card className="rounded-[2.5rem] border-white/5 bg-card/40 backdrop-blur-xl shadow-2xl overflow-hidden">
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader className="bg-muted/30 sticky top-0 z-10 rounded-t-2xl">
                  <TableRow className="border-white/5">
                    <TableHead className="py-6 pl-10">Event</TableHead>
                    <TableHead>Scholar</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead className="text-right pr-10">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allMessages.map(msg => (
                    <TableRow key={msg.id} className="border-white/5 hover:bg-white/5">
                      <TableCell className="py-4 pl-10">{getUsageBadge(msg)}</TableCell>
                      <TableCell><div className="flex flex-col"><span className="font-bold">{msg.userName}</span><span className="text-[9px] opacity-40">{msg.userId}</span></div></TableCell>
                      <TableCell className="max-w-xs"><span className="text-xs italic opacity-80 line-clamp-1">{msg.content || msg.bookTitle || "-"}</span></TableCell>
                      <TableCell className="text-right pr-10 text-[10px] font-mono opacity-50">{msg.timestamp?.toDate ? format(msg.timestamp.toDate(), "HH:mm:ss dd/MM/yy") : "..."}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </ShadTabsContent>

        <ShadTabsContent value="pulse" className="space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-headline font-bold text-primary">Real-Time Pulse</h2>
            <Badge className="bg-green-500 text-white animate-pulse px-4 py-1.5 rounded-full font-black text-xs">{livePulseScholars.length} Active Now</Badge>
          </div>
          <Card className="rounded-[2.5rem] border-white/5 bg-card/40 backdrop-blur-xl shadow-2xl overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-white/5">
                  <TableHead className="py-6 pl-10">Identity</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Current Activity</TableHead>
                  <TableHead className="text-right pr-10">Last Pulse</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {livePulseScholars.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-64 text-center opacity-40 italic">No real-time activity detected in the sanctuary.</TableCell>
                  </TableRow>
                ) : livePulseScholars.map(pulse => (
                  <TableRow key={pulse.userId} className="border-white/5 hover:bg-white/5 group">
                    <TableCell className="py-6 pl-10">
                      <div className="flex flex-col"><span className="font-bold">{pulse.userName}</span><span className="text-[10px] font-mono opacity-40">{pulse.userId}</span></div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{pulse.collegeId === 'individual' ? 'Independent' : pulse.collegeId}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {getUsageBadge(pulse)}
                        <span className="text-xs italic opacity-60 truncate max-w-[200px]">{pulse.bookTitle || "System Hub"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-10 text-[10px] font-mono text-green-500 animate-pulse">
                      {pulse.timestamp?.toDate ? format(pulse.timestamp.toDate(), "HH:mm:ss") : "..."}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </ShadTabsContent>

        {isSuperAdmin && (
          <ShadTabsContent value="inbox" className="space-y-8">
            <h2 className="text-3xl font-headline font-bold text-primary">Scholar Requisitions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allMessages.filter(m => !m.type.startsWith('Usage') && m.type !== 'Note').map(msg => (
                <Card key={msg.id} className={cn("rounded-[2rem] border-white/5 bg-card/40 backdrop-blur-xl overflow-hidden transition-all hover:scale-[1.02]", !msg.isReadByAdmin && "border-primary/20 shadow-primary/5")}>
                  <CardHeader className="bg-muted/20 pb-4">
                    <div className="flex justify-between items-start">
                      <Badge variant="outline" className={cn("rounded-full px-3 py-1 border-primary/20", msg.type === 'ChatMessage' ? "bg-purple-500/10 text-purple-500" : msg.type === 'Nomination' ? "bg-indigo-500/10 text-indigo-500" : "bg-primary/5 text-primary")}>
                        {msg.type === 'ChatMessage' ? "Chat" : msg.type}
                      </Badge>
                      <span className="text-[9px] font-mono opacity-40">{msg.timestamp?.toDate ? format(msg.timestamp.toDate(), "dd/MM/yy") : "..."}</span>
                    </div>
                    <CardTitle className="text-lg mt-2">{msg.userName}</CardTitle>
                    <CardDescription className="text-[10px] uppercase font-black tracking-widest">{msg.collegeId === 'individual' ? 'Independent' : msg.collegeId}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 h-32 overflow-y-auto">
                    <p className="text-sm italic opacity-80 leading-relaxed">"{msg.content}"</p>
                    {msg.adminResponse && <div className="mt-4 p-3 bg-primary/5 border-l-2 border-primary rounded-r-xl text-xs font-bold text-primary">Resp: {msg.adminResponse}</div>}
                  </CardContent>
                  <CardFooter className="bg-muted/10 pt-4 gap-2">
                    {msg.type === 'Nomination' ? (
                      <div className="flex w-full gap-2">
                        {!msg.hasResponse ? (
                          <>
                            <Button variant="secondary" className="flex-1 gap-2 font-bold text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => handleApproveNomination(msg)}><CheckCircle2 className="h-4 w-4" /> Approve</Button>
                            <Button variant="outline" className="flex-1 gap-2 font-bold text-xs border-destructive text-destructive" onClick={() => handleRejectNomination(msg)}><XCircle className="h-4 w-4" /> Reject</Button>
                          </>
                        ) : (
                          <>
                            {msg.adminResponse === "Approved" ? (
                              <Button variant="outline" className="flex-1 gap-2 font-bold text-xs border-amber-500 text-amber-500 hover:bg-amber-500/10" onClick={() => handleRevokeNomination(msg)}><RotateCcw className="h-4 w-4" /> Revoke Approval</Button>
                            ) : (
                              <Button variant="ghost" className="flex-1 gap-2 font-bold text-xs" onClick={() => { setRespondingToMessage(msg); setAdminResponseText(msg.adminResponse || ""); setIsRespondDialogOpen(true); }}><Reply className="h-4 w-4" /> Update Reply</Button>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <Button variant="ghost" className="w-full gap-2 font-bold text-xs" onClick={() => { setRespondingToMessage(msg); setAdminResponseText(msg.adminResponse || ""); setIsRespondDialogOpen(true); }}><Reply className="h-4 w-4" /> {msg.hasResponse ? "Update Reply" : "Respond"}</Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          </ShadTabsContent>
        )}
      </ShadTabs>

      <Dialog open={isUsageDialogOpen} onOpenChange={setIsUsageDialogOpen}>
        <DialogContent className="rounded-[3.5rem] border-white/10 shadow-4xl max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-3xl">
          <div className="bg-primary/10 p-10 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-6">
              <div className="p-5 bg-primary/20 rounded-[1.5rem] shadow-2xl shadow-primary/10"><History className="h-10 w-10 text-primary" /></div>
              <div>
                <DialogTitle className="text-3xl font-headline font-bold text-primary">Protocol History: {usageScholar?.firstName}</DialogTitle>
                <DialogDescription className="text-xs uppercase font-black tracking-widest opacity-40">Identity Pulse Audit | {usageScholar?.id}</DialogDescription>
              </div>
            </div>
            <Button variant="outline" className="h-12 px-6 rounded-2xl gap-3 font-bold border-primary/20 text-primary shadow-xl" onClick={handleExportAudit}><Download className="h-5 w-5" /> Export Audit</Button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-10 grid grid-cols-2 md:grid-cols-5 gap-6 bg-white/5 border-b border-white/5">
              <div className="bg-card/40 p-6 rounded-[2rem] border border-white/5 shadow-inner">
                <div className="flex items-center gap-2 mb-3 text-primary"><ClipboardCheck className="h-5 w-5" /><span className="text-[10px] uppercase font-black tracking-widest opacity-60">Net Engagement</span></div>
                <div className="text-2xl font-mono font-black">{formatDuration(scholarUsageStats.netActiveStudyTime)}</div>
                <div className="text-[10px] text-muted-foreground mt-2 font-bold uppercase text-[8px] font-black">Active Presence</div>
              </div>
              <div className="bg-card/40 p-6 rounded-[2rem] border border-white/5 shadow-inner">
                <div className="flex items-center gap-2 mb-3 text-red-500"><AlertCircle className="h-5 w-5" /><span className="text-[10px] uppercase font-black tracking-widest opacity-60">Gap Time</span></div>
                <div className="text-2xl font-mono font-black text-red-500">{formatDuration(scholarUsageStats.gapTime)}</div>
                <div className="text-[10px] text-muted-foreground mt-2 font-bold uppercase text-[8px] font-black">Inactive Period</div>
              </div>
              <div className="bg-card/40 p-6 rounded-[2rem] border border-white/5 shadow-inner">
                <div className="flex items-center gap-2 mb-3 text-blue-500"><MonitorPlay className="h-5 w-5" /><span className="text-[10px] uppercase font-black tracking-widest opacity-60">Preview</span></div>
                <div className="text-2xl font-mono font-black text-blue-500">{formatDuration(scholarUsageStats.netPreviewTime)}</div>
              </div>
              <div className="bg-card/40 p-6 rounded-[2rem] border border-white/5 shadow-inner">
                <div className="flex items-center gap-2 mb-3 text-purple-500"><BookOpen className="h-5 w-5" /><span className="text-[10px] uppercase font-black tracking-widest opacity-60">Full Study</span></div>
                <div className="text-2xl font-mono font-black text-purple-500">{formatDuration(scholarUsageStats.netFullStudyTime)}</div>
              </div>
              <div className="bg-primary/10 p-6 rounded-[2rem] border-2 border-primary/20 shadow-2xl shadow-primary/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-all"><Zap className="h-16 w-16 text-primary fill-primary" /></div>
                <div className="flex items-center gap-2 mb-3 text-primary font-black"><Zap className="h-5 w-5 fill-primary" /><span className="text-[10px] uppercase tracking-widest">In Communion</span></div>
                <div className="text-2xl font-mono font-black text-primary">LIVE</div>
              </div>
            </div>

            <ScrollArea className="flex-1 px-10 py-6">
              <Table>
                <TableHeader className="bg-muted/30 sticky top-0 z-10 rounded-t-2xl">
                  <TableRow className="border-white/5">
                    <TableHead className="py-4 font-black uppercase text-[10px] tracking-widest opacity-60">Protocol Event</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest opacity-60">Reference</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest opacity-60">Timestamp</TableHead>
                    <TableHead className="text-right pr-6 font-black uppercase text-[10px] tracking-widest opacity-60">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allMessages.filter(m => m.userId === usageScholar?.id).map(log => (
                    <TableRow key={log.id} className="border-white/5 hover:bg-white/5 transition-all group">
                      <TableCell className="py-5">{getUsageBadge(log)}</TableCell>
                      <TableCell className="max-w-[300px]">
                        <div className="flex flex-col"><span className="font-bold text-sm text-foreground/80">{log.bookTitle || "System Hub"}</span><span className="text-[10px] text-muted-foreground italic truncate group-hover:text-primary transition-colors">"{log.content}"</span></div>
                      </TableCell>
                      <TableCell className="text-[11px] font-mono opacity-60">{log.timestamp?.toDate ? format(log.timestamp.toDate(), "HH:mm dd/MM/yy") : "..."}</TableCell>
                      <TableCell className="text-right pr-6">{log.hasResponse ? <Badge className="bg-green-500 rounded-full font-black text-[8px] px-3">Replied</Badge> : <Badge variant="outline" className="opacity-40 rounded-full font-black text-[8px] px-3">Indexed</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRespondDialogOpen} onOpenChange={setIsRespondDialogOpen}>
        <DialogContent className="rounded-[2.5rem] bg-card/95 backdrop-blur-xl border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline font-bold text-primary flex items-center gap-3"><Reply className="h-6 w-6" /> Respond to Scholar</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="p-4 bg-muted/50 rounded-2xl italic text-sm opacity-60">"{respondingToMessage?.content}"</div>
            <Label className="text-[10px] uppercase font-black opacity-40">Librarian Dispatch</Label>
            <Textarea value={adminResponseText} onChange={e => setAdminResponseText(e.target.value)} placeholder="Type your response..." className="min-h-[150px] bg-background border-white/10 rounded-2xl" />
          </div>
          <DialogFooter>
            <Button onClick={handleSendResponse} className="w-full h-12 rounded-xl font-bold bg-primary shadow-xl shadow-primary/20">Send Protocol Dispatch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddScholarOpen} onOpenChange={setIsAddScholarOpen}>
        <DialogContent className="rounded-[2rem] bg-card/95 backdrop-blur-xl border-white/10">
          <DialogHeader><DialogTitle className="text-primary font-bold">New Identity Protocol</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>First Name</Label><Input value={newScholar.firstName} onChange={e => setNewScholar({...newScholar, firstName: e.target.value})} /></div>
              <div className="space-y-1"><Label>Last Name</Label><Input value={newScholar.lastName} onChange={e => setNewScholar({...newScholar, lastName: e.target.value})} /></div>
            </div>
            <div className="space-y-1"><Label>Identity ID</Label><Input value={newScholar.id} onChange={e => setNewScholar({...newScholar, id: e.target.value})} /></div>
            <div className="space-y-1"><Label>Security Key</Label><Input value={newScholar.password} onChange={e => setNewScholar({...newScholar, password: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Institution</Label>
                <Select onValueChange={v => setNewScholar({...newScholar, collegeId: v})} value={isCollegeAdmin ? userCollegeId : newScholar.collegeId} disabled={isCollegeAdmin}>
                  <SelectTrigger><SelectValue placeholder="Select College" /></SelectTrigger>
                  <SelectContent>
                    {!isCollegeAdmin && <SelectItem value="individual">Independent Scholar</SelectItem>}
                    {colleges.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select onValueChange={v => setNewScholar({...newScholar, role: v as any})} defaultValue={newScholar.role}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="faculty">Faculty</SelectItem>
                    <SelectItem value="demo">Demo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddScholar} className="w-full">Create Identity</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddCollegeOpen} onOpenChange={setIsAddCollegeOpen}>
        <DialogContent className="rounded-[2rem] bg-card/95 backdrop-blur-xl border-white/10">
          <DialogHeader><DialogTitle className="text-primary font-bold">New Institutional Hub</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1"><Label>College Name</Label><Input value={newCollege.name} onChange={e => setNewCollege({...newCollege, name: e.target.value})} /></div>
            <div className="space-y-1"><Label>College ID</Label><Input value={newCollege.id} onChange={e => setNewCollege({...newCollege, id: e.target.value})} /></div>
            <div className="space-y-1"><Label>Admin Security Key</Label><Input value={newCollege.password} onChange={e => setNewCollege({...newCollege, password: e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={handleAddCollege} className="w-full">Initialize Hub</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditCollegeOpen} onOpenChange={setIsEditCollegeOpen}>
        <DialogContent className="rounded-[2rem] bg-card/95 backdrop-blur-xl border-white/10">
          <DialogHeader><DialogTitle className="text-primary font-bold">Modify Institutional Key</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1"><Label>College Name</Label><Input value={editingCollege?.name || ""} onChange={e => setEditingCollege({...editingCollege, name: e.target.value})} /></div>
            <div className="space-y-1"><Label>Admin Security Key</Label><Input value={editingCollege?.password || ""} onChange={e => setEditingCollege({...editingCollege, password: e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={handleEditCollege} className="w-full">Update Hub</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteCollegeConfirmOpen} onOpenChange={setIsDeleteCollegeConfirmOpen}>
        <DialogContent className="rounded-[2.5rem] bg-card/95 backdrop-blur-xl border-destructive/20 shadow-4xl p-10 max-w-lg">
          <DialogHeader className="space-y-4">
            <div className="p-4 bg-destructive/10 rounded-2xl w-fit border border-destructive/20 mx-auto">
              <AlertTriangle className="h-10 w-10 text-destructive animate-pulse" />
            </div>
            <DialogTitle className="text-3xl font-headline font-bold text-destructive text-center">Irreversible Purge Protocol</DialogTitle>
            <div className="bg-destructive/5 border-l-4 border-destructive p-6 rounded-r-2xl">
              <p className="text-sm text-foreground/90 leading-relaxed font-bold italic">
                "If you delete the institute then the whole user in that college will be erased permanently from the sanctuary registry."
              </p>
            </div>
            <DialogDescription className="text-xs uppercase font-black text-center opacity-60 tracking-widest">
              Cascading Erasure: {collegeToDelete?.name}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-8 flex flex-col gap-3">
            <Button onClick={handleConfirmDeleteCollege} disabled={isUpdatingGlobal} variant="destructive" className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-destructive/30">
              {isUpdatingGlobal ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "Authorize Permanent Purge"}
            </Button>
            <Button variant="ghost" onClick={() => setIsDeleteCollegeConfirmOpen(false)} className="w-full font-bold text-muted-foreground uppercase text-[10px] tracking-widest">
              Cancel Protocol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddBookOpen} onOpenChange={setIsAddBookOpen}>
        <DialogContent className="rounded-[2rem] bg-card/95 backdrop-blur-xl border-white/10">
          <DialogHeader><DialogTitle className="text-primary font-bold">Index New Volume</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="space-y-1"><Label>Volume Title</Label><Input value={newBook.title} onChange={e => setNewBook({...newBook, title: e.target.value})} /></div>
            <div className="space-y-1"><Label>Primary Author</Label><Input value={newBook.author} onChange={e => setNewBook({...newBook, author: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Category</Label>
                <Select onValueChange={v => setNewBook({...newBook, category: v})} value={newBook.category}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Language</Label>
                <Select onValueChange={v => setNewBook({...newBook, language: v})} value={newBook.language}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
              <Checkbox 
                id="add-individual-access" 
                checked={newBook.isIndividualAccess}
                onCheckedChange={(checked) => setNewBook({...newBook, isIndividualAccess: !!checked})}
              />
              <div className="grid gap-1.5 leading-none">
                <label htmlFor="add-individual-access" className="text-sm font-bold text-indigo-400 cursor-pointer">Authorized for Individual Access</label>
                <p className="text-[10px] text-muted-foreground">Allow scholars without a college affiliation to access this volume.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Institutional Access (Optional - Leave empty for Global)</Label>
              <ScrollArea className="h-32 border border-white/10 rounded-xl p-3 bg-muted/20">
                <div className="space-y-2">
                  {colleges.map(c => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox 
                        id={`add-access-${c.id}`} 
                        checked={newBook.allowedCollegeIds.includes(c.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setNewBook({...newBook, allowedCollegeIds: [...newBook.allowedCollegeIds, c.id]});
                          else setNewBook({...newBook, allowedCollegeIds: newBook.allowedCollegeIds.filter(id => id !== c.id)});
                        }}
                      />
                      <label htmlFor={`add-access-${c.id}`} className="text-xs">{c.name}</label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div className="space-y-1">
              <Label>Manuscript File (.pdf)</Label>
              <Input type="file" accept=".pdf,application/pdf" onChange={e => setSelectedSingleFile(e.target.files?.[0] || null)} />
              <p className="text-[11px] text-muted-foreground">Will be saved to Google Drive folder: <span className="font-mono text-primary font-bold">1DyArF92...</span></p>
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddBook} disabled={isUploading} className="w-full">{isUploading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Indexing...</> : "Index Volume"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditBookOpen} onOpenChange={setIsEditBookOpen}>
        <DialogContent className="rounded-[2rem] bg-card/95 backdrop-blur-xl border-white/10">
          <DialogHeader><DialogTitle className="text-primary font-bold">Modify Volume Protocol</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="space-y-1"><Label>Volume Title</Label><Input value={editingBook?.title || ""} onChange={e => setEditingBook({...editingBook, title: e.target.value})} /></div>
            <div className="space-y-1"><Label>Primary Author</Label><Input value={editingBook?.author || ""} onChange={e => setEditingBook({...editingBook, author: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Category</Label>
                <Select onValueChange={v => setEditingBook({...editingBook, category: v})} value={editingBook?.category}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Language</Label>
                <Select onValueChange={v => setEditingBook({...editingBook, language: v})} value={editingBook?.language}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
              <Checkbox 
                id="edit-individual-access" 
                checked={editingBook?.isIndividualAccess || false}
                onCheckedChange={(checked) => setEditingBook({...editingBook, isIndividualAccess: !!checked})}
              />
              <div className="grid gap-1.5 leading-none">
                <label htmlFor="edit-individual-access" className="text-sm font-bold text-indigo-400 cursor-pointer">Authorized for Individual Access</label>
                <p className="text-[10px] text-muted-foreground">Allow independent scholars to access this volume.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Institutional Access (Optional - Empty for Global)</Label>
              <ScrollArea className="h-32 border border-white/10 rounded-xl p-3 bg-muted/20">
                <div className="space-y-2">
                  {colleges.map(c => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox 
                        id={`edit-access-${c.id}`} 
                        checked={editingBook?.allowedCollegeIds?.includes(c.id) || false}
                        onCheckedChange={(checked) => {
                          const currentIds = editingBook?.allowedCollegeIds || [];
                          if (checked) setEditingBook({...editingBook, allowedCollegeIds: [...currentIds, c.id]});
                          else setEditingBook({...editingBook, allowedCollegeIds: currentIds.filter(id => id !== c.id)});
                        }}
                      />
                      <label htmlFor={`edit-access-${c.id}`} className="text-xs">{c.name}</label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div className="space-y-1">
              <Label>Update Manuscript (Optional)</Label>
              {isSuperAdmin ? (
                <>
                  <Input type="file" accept=".pdf,application/pdf" onChange={e => setSelectedSingleFile(e.target.files?.[0] || null)} />
                  <p className="text-[11px] text-muted-foreground">New PDF will be archived in Google Drive.</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground italic p-2 bg-muted/40 rounded-lg">Only the Super Admin is authorized to upload or replace manuscript PDFs.</p>
              )}
            </div>
          </div>
          <DialogFooter><Button onClick={handleEditBook} disabled={isUploading} className="w-full">{isUploading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Updating...</> : "Update Protocol"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen}>
        <DialogContent className="rounded-[2rem] bg-card/95 backdrop-blur-xl border-white/10">
          <DialogHeader><DialogTitle className="text-primary font-bold">Bulk Requisition</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
             <div className="space-y-1">
               <Label>Select Multiple Manuscripts (.pdf)</Label>
               <Input type="file" accept=".pdf,application/pdf" multiple onChange={e => setBulkFiles(Array.from(e.target.files || []))} />
               <p className="text-[11px] text-muted-foreground">All volumes will be archived into Google Drive folder: <span className="font-mono text-primary font-bold">1DyArF92...</span></p>
             </div>
             <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Category</Label>
                <Select onValueChange={v => setBulkSettings({...bulkSettings, category: v})} value={bulkSettings.category}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Language</Label>
                <Select onValueChange={v => setBulkSettings({...bulkSettings, language: v})} value={bulkSettings.language}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
              <Checkbox 
                id="bulk-individual-access" 
                checked={bulkSettings.isIndividualAccess}
                onCheckedChange={(checked) => setBulkSettings({...bulkSettings, isIndividualAccess: !!checked})}
              />
              <div className="grid gap-1.5 leading-none">
                <label htmlFor="bulk-individual-access" className="text-sm font-bold text-indigo-400 cursor-pointer">Authorized for Individual Access</label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Institutional Access for Batch</Label>
              <ScrollArea className="h-32 border border-white/10 rounded-xl p-3 bg-muted/20">
                <div className="space-y-2">
                  {colleges.map(c => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox 
                        id={`bulk-access-${c.id}`} 
                        checked={bulkSettings.allowedCollegeIds.includes(c.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setBulkSettings({...bulkSettings, allowedCollegeIds: [...bulkSettings.allowedCollegeIds, c.id]});
                          else setBulkSettings({...bulkSettings, allowedCollegeIds: bulkSettings.allowedCollegeIds.filter(id => id !== c.id)});
                        }}
                      />
                      <label htmlFor={`bulk-access-${c.id}`} className="text-xs">{c.name}</label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            {isUploading && <div className="space-y-2"><Progress value={uploadProgress} /><p className="text-[10px] text-center font-bold">Transmitting Volumes: {Math.round(uploadProgress)}%</p></div>}
          </div>
          <DialogFooter><Button onClick={handleBulkUpload} disabled={isUploading || bulkFiles.length === 0} className="w-full">{isUploading ? "Transmitting..." : `Import ${bulkFiles.length} Volumes`}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
