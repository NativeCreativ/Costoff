import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b1727] p-5 text-white">
      <h1 className="mb-2.5 text-5xl font-extrabold">404</h1>
      <p className="mb-5 text-xl text-[#94a3b8]">Page Not Found</p>
      <Link href="/" className="rounded-md bg-[#2563eb] px-5 py-2.5 font-semibold text-white no-underline">
        Return to Org Overview Dashboard
      </Link>
    </div>
  );
}
