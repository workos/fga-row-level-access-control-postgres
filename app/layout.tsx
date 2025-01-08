import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Row-Level Security Demo with WorkOS FGA',
  description: 'A demo application showing row-level security implementation using WorkOS FGA and Postgres',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-gray-50">
      <body className="h-full">
        {children}
      </body>
    </html>
  );
}
