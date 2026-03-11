export const metadata = {
  title: 'Board of Life',
  description: 'Seus 6 conselheiros de IA para qualquer decisão importante.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'Inter, Arial, sans-serif', background: '#f7f7fb' }}>
        {children}
      </body>
    </html>
  );
}
