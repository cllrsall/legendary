import "./globals.css";

export const metadata = {
  title: "RepoDrop – Upload ke GitHub",
  description:
    "Upload file dan folder langsung ke repository GitHub. Dibangun dengan Next.js & React.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230a0a0c'/%3E%3Cpath d='M18 38l14-18 14 18H18z' fill='%23e8eef8'/%3E%3Ccircle cx='32' cy='42' r='4' fill='%2394a3b8'/%3E%3C/svg%3E",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" data-theme="dark" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        />
      </head>
      <body>
        <div className="orb o1" />
        <div className="orb o2" />
        <div className="orb o3" />
        {children}
      </body>
    </html>
  );
}
