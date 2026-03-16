import dynamic from 'next/dynamic';

const Board = dynamic(() => import('./board'), { ssr: false, loading: () => <p style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Carregando Board of Life...</p> });

export default function Page() {
  return <Board />;
}
