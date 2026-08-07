import { Fraunces, Karla } from "next/font/google";
import "./globals.css";
import InactivityWatcher from "./InactivityWatcher";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

const body = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export const metadata = {
  title: "Project Socrates",
  description: "Make Curiosity a Habit.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-body antialiased">
        <InactivityWatcher />
        {children}
      </body>
    </html>
  );
}
