import { AuthGuard } from "@/components/auth/auth-guard";
import { Topbar } from "@/components/layout/topbar";

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#fff8f7] flex flex-col">
        <Topbar />
        <div className="flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </div>
    </AuthGuard>
  );
}
