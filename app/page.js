'use client';

import dynamic from 'next/dynamic';

const Board = dynamic(() => import('./board'), { ssr: false });

export default function Page() {
  return <Board />;
}
