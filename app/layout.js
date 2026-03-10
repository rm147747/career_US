export const metadata = {
  title: 'Mentoria Multiagente EUA',
  description: 'Rodadas fixas de mentoria com 6 LLMs para transição médica aos EUA.'
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
