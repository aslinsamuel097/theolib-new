
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ShieldAlert, UserCheck, School, User, Loader2, Sparkles, BookOpen, ShieldCheck, CreditCard, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs as ShadTabs, TabsContent as ShadTabsContent, TabsList as ShadTabsList, TabsTrigger as ShadTabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  useFirebase, 
  addDocumentNonBlocking,
  useAuth,
  useMemoFirebase,
  useCollection
} from "@/firebase";
import { collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { requestGoogleDriveToken, getCachedDriveToken, SUPER_ADMIN_DRIVE_EMAIL } from "@/lib/google-drive-client";

const LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/theolib-1677e.firebasestorage.app/o/logo%2Ftheolib_logo.png?alt=media";
const ADMIN_WHATSAPP = "+918015517427";

export default function RootLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { firestore: db } = useFirebase();
  const auth = useAuth();
  
  const [activeTab, setActiveTab] = useState("student");
  const [college, setCollege] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [isSuspendedMode, setIsSuspendedMode] = useState(false);
  const [isPaymentMode, setIsPaymentMode] = useState(false);
  const [suspendedAppealId, setSuspendedAppealId] = useState("");
  const [appealMessage, setAppealMessage] = useState("");
  const [isSendingAppeal, setIsSendingAppeal] = useState(false);

  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [regData, setRegData] = useState({ fullName: "", email: "", whatsapp: "", collegeName: "" });
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  const collegesQuery = useMemoFirebase(() => collection(db, "colleges"), [db]);
  const { data: collegesData } = useCollection(collegesQuery);
  const colleges = collegesData || [];

  const handleManualLogin = async () => {
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      toast({ variant: "destructive", title: "Input Required", description: "Please enter both credentials." });
      return;
    }

    if (activeTab === "student" && !college) {
      toast({ variant: "destructive", title: "College Required", description: "Please select your institution." });
      return;
    }

    setIsLoggingIn(true);

    try {
      try {
        if (!auth.currentUser) await signInAnonymously(auth);
      } catch (authErr) {
        console.error("Anonymous auth error:", authErr);
      }

      if (activeTab === "super") {
        if (cleanUsername === "aslinsamuel1@gmail.com" && cleanPassword === "Phlagon") {
          localStorage.removeItem('theolib_session_seconds');
          localStorage.removeItem('theolib_borrowed_ids');
          localStorage.setItem('theolib_user', JSON.stringify({ 
            id: 'JBg8bP6xq1gTWPdAAnmg9LQLcEn1', 
            firstName: 'Super', 
            lastName: 'Admin', 
            role: 'super', 
            email: 'aslinsamuel1@gmail.com' 
          }));

          // Automatically establish Google Drive connection for intheolib@gmail.com
          if (auth && !getCachedDriveToken()) {
            try {
              await requestGoogleDriveToken(auth);
            } catch (driveErr: any) {
              console.warn("Auto drive connection during login:", driveErr?.message || driveErr);
            }
          }

          router.push("/admin"); return;
        } else {
          toast({ variant: "destructive", title: "Access Denied", description: "Invalid admin credentials." });
          setIsLoggingIn(false); return;
        }
      }

      if (activeTab === "admin") {
        const collegeDocRef = doc(db, "colleges", cleanUsername);
        const collegeDocSnap = await getDoc(collegeDocRef);
        const collegeData = collegeDocSnap.exists() ? collegeDocSnap.data() : null;

        if (collegeData?.isSuspended) {
          setIsPaymentMode(true);
          setIsLoggingIn(false); return;
        }

        if (collegeData && collegeData.password === cleanPassword && collegeData.id === cleanUsername) {
          localStorage.removeItem('theolib_session_seconds');
          localStorage.setItem('theolib_user', JSON.stringify({ 
            ...collegeData, 
            role: 'admin',
            firstName: collegeData.name,
            lastName: 'Administrator'
          }));
          router.push("/admin"); return;
        } else {
          toast({ variant: "destructive", title: "Login Failed", description: "Incorrect credentials for this institution." });
          setIsLoggingIn(false); return;
        }
      }

      // Individual and College Scholar login
      const userDocRef = doc(db, "users", cleanUsername);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        
        // Check if individual is suspended
        if (userData.collegeId === "individual" && userData.isSuspended) {
          setIsPaymentMode(true);
          setIsLoggingIn(false); return;
        }

        // Check if institutional scholar's college is suspended
        if (userData.collegeId !== "individual") {
          const collegeDocRef = doc(db, "colleges", userData.collegeId);
          const collegeDocSnap = await getDoc(collegeDocRef);
          if (collegeDocSnap.exists() && collegeDocSnap.data()?.isSuspended) {
            setIsPaymentMode(true);
            setIsLoggingIn(false); return;
          }
        }

        if (userData.isSuspended) {
          setIsSuspendedMode(true); setSuspendedAppealId(cleanUsername);
          toast({ variant: "destructive", title: "Account Suspended", description: "Use the appeal box below." });
          setIsLoggingIn(false); return;
        }

        if (activeTab === "individual") {
          if (userData.collegeId !== "individual") {
            toast({ variant: "destructive", title: "Login Failed", description: "Your identity is bound to an institution. Use the Scholar tab." });
            setIsLoggingIn(false); return;
          }
        } else {
          if (userData.collegeId !== college) {
            toast({ variant: "destructive", title: "Login Failed", description: "Institution mismatch." });
            setIsLoggingIn(false); return;
          }
        }

        if (userData.password === cleanPassword) {
          localStorage.removeItem('theolib_session_seconds');
          localStorage.removeItem('theolib_borrowed_ids');
          localStorage.setItem('theolib_user', JSON.stringify(userData));
          addDocumentNonBlocking(collection(db, 'messages'), { 
            userId: userData.id, 
            userName: `${userData.firstName} ${userData.lastName}`, 
            collegeId: userData.collegeId, 
            type: 'Usage:Login', 
            content: format(new Date(), "HH:mm:ss dd/MM/yyyy"), 
            timestamp: serverTimestamp() 
          });
          router.push("/library"); return;
        } else {
          toast({ variant: "destructive", title: "Login Failed", description: "Incorrect password." });
          setIsLoggingIn(false); return;
        }
      } else {
        toast({ variant: "destructive", title: "Not Found", description: "No scholar record found." });
        setIsLoggingIn(false); return;
      }
    } catch (error: any) {
      console.error("Login protocol error:", error);
      toast({ variant: "destructive", title: "Login Protocol Error", description: error.message });
      setIsLoggingIn(false);
    }
  };

  const handleSendAppeal = async () => {
    if (!appealMessage.trim()) return;
    setIsSendingAppeal(true);
    addDocumentNonBlocking(collection(db, 'messages'), { 
      userId: suspendedAppealId, 
      userName: "Suspended Scholar", 
      collegeId: "Unknown", 
      type: "Appeal", 
      content: appealMessage, 
      timestamp: serverTimestamp() 
    });
    toast({ title: "Appeal Transmitted", description: "The Super Admin has been notified." });
    setAppealMessage(""); setIsSuspendedMode(false); setIsSendingAppeal(false);
  };

  const handleRegisterInquiry = async () => {
    if (!regData.fullName || !regData.email || !regData.whatsapp || !regData.collegeName) {
      toast({ variant: "destructive", title: "Missing Info", description: "Please fill all fields." });
      return;
    }
    setIsSubmittingReg(true);
    
    try {
      if (!auth.currentUser) await signInAnonymously(auth);
    } catch (e) {
      console.error("Anonymous sign-in inquiry error:", e);
    }

    addDocumentNonBlocking(collection(db, 'messages'), { 
      userId: "new_inquiry_" + Date.now(), 
      userName: regData.fullName, 
      collegeId: regData.collegeName, 
      type: "RegistrationInquiry", 
      content: `Registration Request: Email: ${regData.email}, WhatsApp: ${regData.whatsapp}, College: ${regData.collegeName}`, 
      timestamp: serverTimestamp() 
    });
    toast({ title: "Request Sent", description: "An admin will contact you shortly." });
    setIsRegisterDialogOpen(false); setRegData({ fullName: "", email: "", whatsapp: "", collegeName: "" }); setIsSubmittingReg(false);
  };

  const openWhatsApp = () => {
    window.open(`https://wa.me/918015517427?text=Regarding%20TheosLib%20Payment`, "_blank");
  };

  return (
    <div className="flex min-h-screen bg-slate-950 selection:bg-indigo-500/30">
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-y-auto">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full"></div>
        </div>

        <div className="w-full max-w-md space-y-10 z-10 my-12 text-center">
          <div className="space-y-6">
            <div className="relative h-28 w-28 mx-auto overflow-hidden rounded-[2rem] shadow-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-3 transform transition-transform hover:scale-105 duration-500">
              <Image src={LOGO_URL} alt="TheoLib Logo" fill className="object-contain p-3" priority unoptimized />
            </div>
            <div className="space-y-3">
              <h1 className="text-5xl font-headline font-black tracking-tight text-white drop-shadow-sm">TheoLib</h1>
              <div className="flex items-center justify-center gap-2">
                <span className="h-px w-8 bg-indigo-500/30"></span>
                <p className="text-slate-400 text-xs uppercase font-black tracking-[0.4em] font-body">Digital Sanctuary</p>
                <span className="h-px w-8 bg-indigo-500/30"></span>
              </div>
            </div>
          </div>

          {isPaymentMode ? (
            <Card className="bg-slate-900/60 backdrop-blur-3xl border-indigo-500/30 shadow-4xl overflow-hidden animate-in zoom-in duration-500 text-left rounded-[2.5rem]">
              <CardContent className="pt-12 p-10 space-y-8 text-center">
                <div className="p-6 bg-indigo-500/10 rounded-3xl border border-indigo-500/20 w-fit mx-auto mb-2">
                  <CreditCard className="h-14 w-14 text-indigo-400" />
                </div>
                <div className="space-y-4">
                  <h3 className="text-3xl font-headline font-bold text-white">Academic Restitution Required</h3>
                  <p className="text-sm text-slate-300 leading-relaxed font-medium">
                    Sanctuary access has been restricted for this identity.
                  </p>
                  <div className="bg-slate-950/50 border border-white/5 p-6 rounded-2xl space-y-4">
                    <p className="text-xs text-indigo-200 leading-relaxed italic">
                      "Please contact the administrator as you do the payment or send the screenshot to WhatsApp number: ‪+91 80155 17427‬"
                    </p>
                    <Button 
                      onClick={openWhatsApp}
                      className="w-full bg-green-600 hover:bg-green-500 text-white gap-3 h-12 rounded-xl font-bold shadow-xl shadow-green-600/20"
                    >
                      <MessageCircle className="h-5 w-5" /> Contact via WhatsApp
                    </Button>
                  </div>
                </div>
                <Button variant="ghost" onClick={() => setIsPaymentMode(false)} className="text-slate-500 text-[10px] uppercase font-black tracking-widest hover:text-white">
                  Back to Entrance
                </Button>
              </CardContent>
            </Card>
          ) : !isSuspendedMode ? (
            <Card className="bg-slate-900/40 backdrop-blur-2xl border-white/5 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden text-left rounded-[2.5rem] transition-all duration-500">
              <CardContent className="pt-8 space-y-8 p-10">
                <ShadTabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <ShadTabsList className="grid w-full grid-cols-4 bg-slate-950/50 border border-white/5 p-1.5 h-auto rounded-2xl">
                    <ShadTabsTrigger value="individual" className="text-[9px] py-2.5 font-black uppercase tracking-tighter rounded-xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">Individual</ShadTabsTrigger>
                    <ShadTabsTrigger value="student" className="text-[9px] py-2.5 font-black uppercase tracking-tighter rounded-xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">Scholar</ShadTabsTrigger>
                    <ShadTabsTrigger value="admin" className="text-[9px] py-2.5 font-black uppercase tracking-tighter rounded-xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">Admin</ShadTabsTrigger>
                    <ShadTabsTrigger value="super" className="text-[9px] py-2.5 font-black uppercase tracking-tighter rounded-xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">Super</ShadTabsTrigger>
                  </ShadTabsList>
                  
                  <div className="mt-8 space-y-6">
                    {activeTab === "student" && (
                      <div className="space-y-3">
                        <Label className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black pl-1">Institutional Hub</Label>
                        <Select onValueChange={setCollege} value={college}>
                          <SelectTrigger className="bg-slate-950/50 border-white/10 text-white h-14 rounded-2xl focus:ring-indigo-500/30 transition-all"><SelectValue placeholder="Select Institution" /></SelectTrigger>
                          <SelectContent className="bg-slate-900 border-white/10 text-white rounded-2xl shadow-3xl">
                            {colleges.map((c) => <SelectItem key={c.id} value={c.id} className="rounded-xl my-1">{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      <Label className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black pl-1">
                        {activeTab === 'admin' ? 'College ID' : activeTab === 'individual' ? 'Independent ID' : 'Scholar Identity'}
                      </Label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                        <Input placeholder="Enter ID" value={username} onChange={(e) => setUsername(e.target.value)} className="bg-slate-950/50 border-white/10 text-white h-14 pl-12 rounded-2xl focus:ring-indigo-500/30 transition-all" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black pl-1">Security Key</Label>
                      <div className="relative group">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                        <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-slate-950/50 border-white/10 text-white h-14 pl-12 rounded-2xl focus:ring-indigo-500/30 transition-all" />
                      </div>
                    </div>

                    <Button onClick={handleManualLogin} disabled={isLoggingIn} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest h-14 mt-4 rounded-2xl shadow-2xl shadow-indigo-600/20 transition-all active:scale-[0.98]">
                      {isLoggingIn ? <><Loader2 className="animate-spin mr-3 h-4 w-4" /> Verifying</> : "Enter Sanctuary"}
                    </Button>
                  </div>
                </ShadTabs>
                
                <div className="text-center pt-4 border-t border-white/5">
                  <Button variant="link" className="text-indigo-400 text-[11px] font-black uppercase tracking-widest hover:text-indigo-300 transition-colors" onClick={() => setIsRegisterDialogOpen(true)}>
                    New to the sanctuary? Inquire here
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-900/40 backdrop-blur-2xl border-red-500/20 shadow-4xl overflow-hidden animate-in zoom-in duration-500 text-left rounded-[2.5rem]">
              <CardContent className="pt-10 space-y-8 p-10">
                <div className="flex flex-col items-center gap-5 text-center">
                  <div className="p-5 bg-red-500/10 rounded-3xl border border-red-500/20"><ShieldAlert className="h-12 w-12 text-red-500" /></div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white">Identity Locked</h3>
                    <p className="text-xs text-slate-400 leading-relaxed px-4">Your scholar identity ({suspendedAppealId}) has been restricted. Transmit an appeal to the High Librarian below.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest pl-1">Appeal Protocol</Label>
                  <Textarea placeholder="Explain your situation..." value={appealMessage} onChange={(e) => setAppealMessage(e.target.value)} className="bg-slate-950/50 border-white/10 text-white min-h-[140px] rounded-2xl p-4 focus:ring-red-500/20 transition-all" />
                  <Button onClick={handleSendAppeal} disabled={isSendingAppeal} className="w-full bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-widest h-14 rounded-2xl shadow-xl shadow-red-600/10 transition-all">
                    {isSendingAppeal ? "Transmitting..." : "Send Appeal"}
                  </Button>
                  <Button variant="ghost" onClick={() => setIsSuspendedMode(false)} className="w-full text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Back to Entrance</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mt-12 pt-10 border-t border-white/5 space-y-6 text-left">
            <div className="flex items-center justify-center gap-3 mb-2">
              <ShieldCheck className="h-4 w-4 text-indigo-400" />
              <p className="text-[10px] text-indigo-400/80 uppercase tracking-[0.4em] font-black text-center">Sanctuary Protocols</p>
            </div>
            <ul className="space-y-4 px-2">
              <li className="text-[10px] text-slate-400 leading-relaxed flex gap-4 items-start"><span className="text-indigo-500 font-black shrink-0 h-5 w-5 rounded-full bg-indigo-500/10 flex items-center justify-center">1</span><span>Copying or digital duplication is <strong className="text-slate-200">strictly prohibited</strong> and monitored via pulse logs.</span></li>
              <li className="text-[10px] text-slate-400 leading-relaxed flex gap-4 items-start"><span className="text-indigo-500 font-black shrink-0 h-5 w-5 rounded-full bg-indigo-500/10 flex items-center justify-center">2</span><span>Manuscripts are for personal theological research only. Resale is an violation of sanctuary law.</span></li>
              <li className="text-[10px] text-slate-400 leading-relaxed flex gap-4 items-start"><span className="text-indigo-500 font-black shrink-0 h-5 w-5 rounded-full bg-indigo-500/10 flex items-center justify-center">3</span><span>Protocol dispatches are strictly reviewed by institutional faculty.</span></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 items-center justify-center p-24 text-white relative overflow-hidden border-l border-white/5">
        <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/libbg/1920/1080')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
        <div className="max-w-xl text-center space-y-12 relative z-10">
          <div className="space-y-6">
            <Sparkles className="h-12 w-12 text-indigo-400 mx-auto animate-pulse" />
            <h2 className="text-6xl font-headline font-bold leading-tight drop-shadow-2xl text-white">Thy word is a lamp unto my feet, and a light unto my path.</h2>
            <div className="flex items-center justify-center gap-4">
              <div className="h-px w-12 bg-indigo-500/30"></div>
              <p className="text-3xl font-body italic text-indigo-200/80">Psalms 119:105</p>
              <div className="h-px w-12 bg-indigo-500/30"></div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-12 pt-8">
            <div className="text-center space-y-2">
              <div className="text-4xl font-headline font-bold text-white">2.5k+</div>
              <div className="text-[10px] uppercase font-black tracking-widest text-indigo-400">Manuscripts</div>
            </div>
            <div className="h-10 w-px bg-white/10"></div>
            <div className="text-center space-y-2">
              <div className="text-4xl font-headline font-bold text-white">12</div>
              <div className="text-[10px] uppercase font-black tracking-widest text-indigo-400">Institutions</div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
        <DialogContent className="bg-slate-900 border-white/10 text-white rounded-[2.5rem] p-10 max-w-lg shadow-4xl backdrop-blur-3xl">
          <DialogHeader className="space-y-4">
            <div className="p-4 bg-indigo-500/10 rounded-2xl w-fit border border-indigo-500/20"><BookOpen className="h-8 w-8 text-indigo-400" /></div>
            <DialogTitle className="text-3xl font-headline font-bold text-white">Sanctuary Inquiry</DialogTitle>
            <p className="text-xs text-slate-400 leading-relaxed">Submit your credentials for review by the High Librarian. Access is granted to verified theological scholars only.</p>
          </DialogHeader>
          <div className="space-y-6 py-8">
            <div className="space-y-2.5">
              <Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest pl-1">Full Identity Name</Label>
              <Input placeholder="Enter your full name" value={regData.fullName} onChange={e => setRegData({...regData, fullName: e.target.value})} className="bg-slate-950/50 border-white/10 h-14 rounded-2xl focus:ring-indigo-500/20 transition-all" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2.5">
                <Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest pl-1">Email Protocol</Label>
                <Input placeholder="scholar@mail.edu" value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})} className="bg-slate-950/50 border-white/10 h-14 rounded-2xl focus:ring-indigo-500/20 transition-all" />
              </div>
              <div className="space-y-2.5">
                <Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest pl-1">WhatsApp Relay</Label>
                <Input placeholder="+1234567890" value={regData.whatsapp} onChange={e => setRegData({...regData, email: e.target.value})} className="bg-slate-950/50 border-white/10 h-14 rounded-2xl focus:ring-indigo-500/20 transition-all" />
              </div>
            </div>
            <div className="space-y-2.5">
              <Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest pl-1">Institutional Name</Label>
              <Input placeholder="Bible College / Seminary" value={regData.collegeName} onChange={e => setRegData({...regData, collegeName: e.target.value})} className="bg-slate-950/50 border-white/10 h-14 rounded-2xl focus:ring-indigo-500/20 transition-all" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleRegisterInquiry} disabled={isSubmittingReg} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest h-14 rounded-2xl shadow-2xl shadow-indigo-600/20 transition-all">
              {isSubmittingReg ? <Loader2 className="animate-spin" /> : "Submit Requisition"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
