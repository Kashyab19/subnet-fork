import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export function Header() {
  return (
    <header className="border-b bg-white">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.png" alt="SubNet" width={40} height={40} />
          <span className="text-foreground text-2xl font-bold">SubNet</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/discover">
            <Button variant="ghost" className="cursor-pointer">
              Discover
            </Button>
          </Link>
          <Link href="/create">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer">
              Create Agent
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
