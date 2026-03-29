import Sidebar from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { AuthGuard } from "@/components/auth/auth-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="relative flex w-full min-h-screen bg-[#fff8f7]">
        {/* Fixed Sidebar */}
        <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-64">
          <Sidebar />
        </aside>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col md:ml-64">
          <Topbar />
          <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
