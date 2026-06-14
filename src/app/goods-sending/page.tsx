import AppHeader from '@/components/app-header';
import ClientGoodsSendingPage from '@/components/client-goods-sending-page';

export default function GoodsSendingPage() {
    return (
        <div className="flex flex-col min-h-screen bg-background">
          <AppHeader />
          <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            <ClientGoodsSendingPage />
          </main>
        </div>
      );
}
