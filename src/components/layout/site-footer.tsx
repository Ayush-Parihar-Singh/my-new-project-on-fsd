import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white/70">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm text-muted">Good food deserves another chance. We connect surplus food with the people and organizations who can use it, safely and on time.</p>
        </div>
        <nav aria-label="Platform" className="space-y-3 text-sm">
          <p className="font-semibold text-deep">Platform</p>
          <ul className="space-y-2 text-muted">
            <li><Link className="hover:text-forest" href="/#how-it-works">How it works</Link></li>
            <li><Link className="hover:text-forest" href="/discover">Find food near me</Link></li>
            <li><Link className="hover:text-forest" href="/#impact">Impact</Link></li>
          </ul>
        </nav>
        <nav aria-label="Get involved" className="space-y-3 text-sm">
          <p className="font-semibold text-deep">Get involved</p>
          <ul className="space-y-2 text-muted">
            <li><Link className="hover:text-forest" href="/register?role=DONOR">Donate surplus food</Link></li>
            <li><Link className="hover:text-forest" href="/register?role=NGO">Register as a recipient</Link></li>
            <li><Link className="hover:text-forest" href="/register?role=VOLUNTEER">Volunteer to deliver</Link></li>
          </ul>
        </nav>
        <div className="space-y-3 text-sm">
          <p className="font-semibold text-deep">Good to know</p>
          <p className="text-muted">LastPlate does not judge food safety from photos or descriptions. Check food before you serve or transport it.</p>
          <p className="text-xs text-muted">© {new Date().getFullYear()} LastPlate. Demo data is labelled wherever it appears.</p>
        </div>
      </div>
    </footer>
  );
}
