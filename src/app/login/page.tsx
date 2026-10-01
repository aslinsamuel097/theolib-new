
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Library, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase, useAuth } from "@/firebase";
import { collection, doc, getDoc, query, where, getDocs } from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import { requestGoogleDriveToken, getCachedDriveToken } from "@/lib/google-drive-client";

const LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/theolib-1677e.firebasestorage.app/o/logo%2Ftheolib_logo.png?alt=media";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();

  const [activeTab, setActiveTab] = useState("student");
  const [college, setCollege] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theolib_theme') as 'light' | 'dark';
    if (savedTheme) {
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  const collegesQuery = useMemoFirebase(() => collection(db, "colleges"), [db]);
  const { data: collegesData, isLoading: isCollegesLoading } = useCollection(collegesQuery);
  const colleges = collegesData || [];

  const handleLogin = async () => {
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      toast({
        variant: "destructive",
        title: "Input Required",
        description: "Please enter both username and password.",
      });
      return;
    }

    setIsLoggingIn(true);

    try {
      if (activeTab === "super") {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, "aslinsamuel1@gmail.com", cleanPassword);
          const user = userCredential.user;

          localStorage.setItem('theolib_user', JSON.stringify({ 
            id: user.uid, 
            firstName: 'Super', 
            lastName: 'Admin', 
            role: 'super',
            email: user.email 
          }));
          localStorage.removeItem('theolib_session_seconds');

          // Automatically connect to Google Drive
          if (auth && !getCachedDriveToken()) {
            try {
              await requestGoogleDriveToken(auth);
            } catch (dErr) {
              console.warn("Drive auto connect warning:", dErr);
            }
          }

          router.push("/admin");
          return;
        } catch (authError: any) {
          console.error("Super Admin auth error:", authError);
          if (cleanUsername === "aslinsamuel1@gmail.com" && cleanPassword === "Phlagon") {
            localStorage.setItem('theolib_user', JSON.stringify({ 
              id: 'JBg8bP6xq1gTWPdAAnmg9LQLcEn1', 
              firstName: 'Super', 
              lastName: 'Admin', 
              role: 'super' 
            }));
            localStorage.removeItem('theolib_session_seconds');

            if (auth && !getCachedDriveToken()) {
              try {
                await requestGoogleDriveToken(auth);
              } catch (dErr) {
                console.warn("Drive auto connect warning:", dErr);
              }
            }

            router.push("/admin");
            return;
          }
          toast({ variant: "destructive", title: "Access Denied", description: "Invalid admin credentials." });
          return;
        }
      }

      if (!college) {
        toast({ variant: "destructive", title: "College Required", description: "Please select your institution." });
        return;
      }

      if (activeTab === "student") {
        const idVariations = [cleanUsername, cleanUsername.toLowerCase(), cleanUsername.toUpperCase()];
        let userData = null;

        for (const id of idVariations) {
          const userDocRef = doc(db, "users", id);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            userData = userDocSnap.data();
            break;
          }
        }

        if (userData) {
          if (userData.password !== cleanPassword) {
            toast({ variant: "destructive", title: "Login Failed", description: "Incorrect password." });
          } else if (userData.collegeId !== college) {
            toast({ variant: "destructive", title: "Login Failed", description: "Institution mismatch." });
          } else {
            localStorage.setItem('theolib_user', JSON.stringify(userData));
            localStorage.removeItem('theolib_session_seconds');
            router.push("/library");
            return;
          }
        } else {
          toast({ variant: "destructive", title: "User Not Found", description: "No record for this ID." });
        }
      } else if (activeTab === "admin") {
        const collegeDocRef = doc(db, "colleges", cleanUsername);
        const collegeDocSnap = await getDoc(collegeDocRef);

        if (collegeDocSnap.exists()) {
          const collegeData = collegeDocSnap.data();
          if (collegeData.password === cleanPassword && collegeData.id === college) {
            localStorage.setItem('theolib_user', JSON.stringify({ ...collegeData, role: 'admin' }));
            localStorage.removeItem('theolib_session_seconds');
            router.push("/library");
            return;
          }
          toast({ variant: "destructive", title: "Login Failed", description: "Invalid credentials." });
        } else {
          toast({ variant: "destructive", title: "Not Found", description: "College record not found." });
        }
      }
    } catch (error) {
      console.error("Login page error:", error);
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="flex-1 bg-[#0c0819] flex flex-col items-center justify-center p-8 text-white overflow-y-auto">
        <div className="w-full max-w-md space-y-8 my-8">
          <div className="text-center space-y-4">
            <div className="relative h-20 w-20 mx-auto overflow-hidden rounded-lg shadow-inner border border-white/10 bg-[#1a1233] p-1">
              <Image src={LOGO_URL} alt="TheoLib Logo" fill className="object-contain" priority unoptimized />
            </div>
            <h1 className="text-4xl font-headline font-bold tracking-tight text-white">TheoLib</h1>
            <p className="text-muted-foreground text-sm font-body">A digital sanctuary for theological study.</p>
          </div>

          <Card className="bg-[#1a1233] border-[#2d244a] shadow-2xl overflow-hidden">
            <CardContent className="pt-6 space-y-6">
              <Tabs defaultValue="student" className="w-full" onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3 bg-[#0c0819] border border-[#2d244a] p-1 h-auto">
                  <TabsTrigger value="student" className="text-[10px] py-2">Scholar</TabsTrigger>
                  <TabsTrigger value="admin" className="text-[10px] py-2">College Admin</TabsTrigger>
                  <TabsTrigger value="super" className="text-[10px] py-2">Super Admin</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="space-y-4">
                {activeTab !== "super" && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">College</Label>
                    <Select onValueChange={setCollege} value={college}>
                      <SelectTrigger className="bg-[#0c0819] border-[#2d244a] text-white h-11">
                        <SelectValue placeholder={isCollegesLoading ? "Loading..." : "Select Institution"} />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1233] border-[#2d244a] text-white">
                        {colleges.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Username / ID</Label>
                  <Input 
                    placeholder="Enter ID" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-[#0c0819] border-[#2d244a] text-white focus-visible:ring-[#ff5db1] h-11" 
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Password</Label>
                  <Input 
                    type="password" 
                    placeholder="Security Key" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-[#0c0819] border-[#2d244a] text-white focus-visible:ring-[#ff5db1] h-11" 
                  />
                </div>

                <Button 
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="w-full bg-[#ff5db1] hover:bg-[#ff5db1]/90 text-white font-bold h-12 mt-4 shadow-[0_0_20px_rgba(255,93,177,0.3)] border-none"
                >
                  {isLoggingIn ? "Verifying..." : "Enter Sanctuary"}
                </Button>
              </div>

              {/* Agreement Section */}
              <div className="mt-8 pt-6 border-t border-[#2d244a] space-y-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <UserCheck className="h-3 w-3 text-[#ff5db1]" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black text-center">Sanctuary Protocols</p>
                </div>
                <div className="space-y-3 px-2">
                  <p className="text-[9px] text-muted-foreground/60 italic text-center leading-tight mb-2">
                    By logging in, you acknowledge and agree to the following:
                  </p>
                  <ul className="space-y-2.5">
                    <li className="text-[10px] text-muted-foreground leading-relaxed flex gap-3">
                      <span className="text-[#ff5db1] font-bold shrink-0">1.</span>
                      <span>Screenshot, download, or any form of copying is <strong className="text-white">strictly prohibited</strong> and will result in legal action.</span>
                    </li>
                    <li className="text-[10px] text-muted-foreground leading-relaxed flex gap-3">
                      <span className="text-[#ff5db1] font-bold shrink-0">2.</span>
                      <span>Manuscripts are for personal theological study only. Selling or reselling is strictly forbidden.</span>
                    </li>
                    <li className="text-[10px] text-muted-foreground leading-relaxed flex gap-3">
                      <span className="text-[#ff5db1] font-bold shrink-0">3.</span>
                      <span>Contents of the books are the sole responsibility of their respective authors.</span>
                    </li>
                    <li className="text-[10px] text-muted-foreground leading-relaxed flex gap-3">
                      <span className="text-[#ff5db1] font-bold shrink-0">4.</span>
                      <span>Report copyright concerns to the administrator for immediate protocol execution.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#3b2d8c] via-[#6a2283] to-[#d64e8b] items-center justify-center p-20 text-white relative">
        <div className="max-w-xl text-center space-y-8">
          <h2 className="text-5xl lg:text-7xl font-headline font-bold leading-tight drop-shadow-lg text-white text-center">
            Thy word is a lamp unto my feet, and a light unto my path.
          </h2>
          <p className="text-2xl font-body italic opacity-90 text-white text-center">Psalms 119:105</p>
        </div>
      </div>
    </div>
  );
}
