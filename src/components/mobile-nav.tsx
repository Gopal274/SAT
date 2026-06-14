
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutDashboard, ShoppingCart, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useUser();

  if (!user) return null;

  const navItems = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Stats', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Orders', href: '/orders', icon: ShoppingCart },
    { label: 'Logistics', href: '/goods-sending', icon: Truck },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t h-16 md:hidden no-print">
      <div className="grid h-full grid-cols-4 mx-auto font-medium">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center px-5 hover:bg-muted transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5 mb-1", isActive && "stroke-[2.5px]")} />
              <span className="text-[10px] uppercase font-bold tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
