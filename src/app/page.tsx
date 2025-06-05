import { AppHeader } from '@/components/layout/app-header';
import { NERPageContent } from '@/components/ner/ner-page-content';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-grow flex flex-col">
        <NERPageContent />
      </main>
    </div>
  );
}
