import Image from "next/image";
import Link from "next/link";
import { Bell, CalendarClock, CheckCircle2, Clock, HandPlatter, Handshake, MapPin, Package, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImpactStats } from "@/components/home/impact-stats";
import { publicImpact, publicPartners } from "@/server/services/analytics.service";
import { discoverDonations } from "@/server/services/discovery.service";
import { FOOD_CATEGORY_LABELS, UNIT_LABELS } from "@/lib/constants";
import { formatDateTime, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const steps = [
  { icon: HandPlatter, title: "Post what is left", body: "Describe the food, add photos, pin the pickup point and set a deadline. Takes a few minutes." },
  { icon: Handshake, title: "A verified partner claims it", body: "Verified nonprofits and shelters see listings that match their needs. The first valid claim locks the food." },
  { icon: Truck, title: "A volunteer collects it", body: "Nearby volunteers accept the pickup, collect the food and hand it over with a 4-digit code." },
  { icon: CheckCircle2, title: "Everyone sees the result", body: "The handover is recorded on every dashboard, so donors see their impact and partners see what arrived." },
];

export default async function LandingPage() {
  const [impact, partners, featured] = await Promise.all([
    publicImpact(),
    publicPartners(8),
    discoverDonations(null, { radiusKm: 25, sort: "deadline", page: 1, pageSize: 3 }),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-12 md:grid-cols-[1.05fr_1fr] md:pb-24 md:pt-20">
          <div className="space-y-7">
            <Badge tone="sage" className="px-3 py-1 text-[13px]">
              <Sparkles className="size-3.5" aria-hidden /> Every meal matters.
            </Badge>
            <h1 className="text-4xl font-extrabold leading-[1.05] md:text-6xl">Good Food Deserves Another Chance</h1>
            <p className="max-w-xl text-lg leading-relaxed text-ink/80">
              Restaurants, hotels, cafés and event teams share surplus food with verified nonprofits and volunteers, so meals reach people before they go to waste.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/register?role=DONOR" size="lg" className="bg-coral text-deep shadow-sm hover:bg-[#dd7860]">
                Donate Surplus Food
              </ButtonLink>
              <ButtonLink href="/discover" size="lg" variant="outline">
                <MapPin /> Find Food Near Me
              </ButtonLink>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-forest" aria-hidden /> Verified partners only</li>
              <li className="flex items-center gap-2"><Bell className="size-4 text-forest" aria-hidden /> Live status updates</li>
              <li className="flex items-center gap-2"><Clock className="size-4 text-forest" aria-hidden /> Deadlines you can trust</li>
            </ul>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-sage/70" aria-hidden />
            <Image
              src="/images/hero-surplus-meals.jpg"
              alt="A wooden table set with a bowl of steamed rice, a fresh green salad, bread and a steel tiffin of vegetable curry"
              width={1408}
              height={768}
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="aspect-[4/3] w-full rounded-3xl object-cover shadow-lift md:aspect-[5/4]"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="section scroll-mt-20">
        <div className="max-w-2xl space-y-3">
          <p className="eyebrow">How it works</p>
          <h2 className="text-3xl font-extrabold md:text-4xl">From kitchen to table in four steps</h2>
          <p className="text-muted">A clear chain of responsibility: every step has an owner, a deadline and a record.</p>
        </div>
        <ol className="mt-10 grid gap-5 md:grid-cols-4">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.title} className="relative rounded-2xl border border-line bg-white p-6 shadow-card">
                <span className="flex size-11 items-center justify-center rounded-full bg-sage text-forest"><Icon className="size-5" aria-hidden /></span>
                <p className="mt-5 text-xs font-bold uppercase tracking-widest text-coral-ink">Step {i + 1}</p>
                <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Featured */}
      <section className="bg-sage-light/60">
        <div className="section">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-2xl space-y-3">
              <p className="eyebrow">Featured donations</p>
              <h2 className="text-3xl font-extrabold md:text-4xl">Available right now</h2>
              <p className="text-muted">Pickup areas are approximate to protect donor locations. Sign in as a verified recipient to see exact addresses.</p>
            </div>
            <ButtonLink href="/discover" variant="outline">See all near you</ButtonLink>
          </div>
          {featured.items.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-forest/30 bg-white p-8 text-center text-muted">
              No open listings at the moment. New surplus is posted throughout the day.
            </div>
          ) : (
            <ul className="mt-10 grid gap-5 md:grid-cols-3">
              {featured.items.map((d) => (
                <li key={d.id}>
                  <Link href={`/discover`} className="group flex h-full flex-col gap-4 rounded-2xl border border-line bg-white p-6 shadow-card transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="sage">{FOOD_CATEGORY_LABELS[d.category as keyof typeof FOOD_CATEGORY_LABELS] ?? "Surplus food"}</Badge>
                      {d.isDemo ? <Badge tone="demo">Demo listing</Badge> : null}
                    </div>
                    <h3 className="text-lg font-bold text-deep group-hover:text-forest">{d.title}</h3>
                    <dl className="mt-auto grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-muted">Quantity</dt><dd className="font-semibold">{d.quantity} {d.unit ? UNIT_LABELS[d.unit as keyof typeof UNIT_LABELS] : ""}</dd></div>
                      <div><dt className="text-muted">Pickup by</dt><dd className="font-semibold">{relativeTime(d.pickupDeadline)}</dd></div>
                      <div className="col-span-2"><dt className="text-muted">Area</dt><dd className="font-semibold">{d.pickupAreaLabel}{d.pickupCity ? `, ${d.pickupCity}` : ""}</dd></div>
                    </dl>
                    <p className="flex items-center gap-1.5 text-xs text-muted"><CalendarClock className="size-3.5" aria-hidden /> Closes {formatDateTime(d.pickupDeadline)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Impact */}
      <section id="impact" className="section scroll-mt-20">
        <div className="max-w-2xl space-y-3">
          <p className="eyebrow">Impact</p>
          <h2 className="text-3xl font-extrabold md:text-4xl">Numbers that come from real handovers</h2>
          <p className="text-muted">We only show counts recorded in the database. We do not publish estimates or invented totals.</p>
        </div>
        <div className="mt-10">
          <ImpactStats
            completedHandovers={impact.completedHandovers}
            activeListings={impact.activeListings}
            inProgress={impact.inProgress}
            verifiedPartners={impact.verifiedPartners}
            demo={impact.demo}
          />
        </div>
      </section>

      {/* Partners */}
      <section id="partners" className="scroll-mt-20 border-y border-line bg-white/70">
        <div className="section">
          <p className="eyebrow">Partners</p>
          <h2 className="mt-3 text-3xl font-extrabold md:text-4xl">Verified donors and recipients</h2>
          {partners.length === 0 ? (
            <p className="mt-6 text-muted">Our first verified partners are joining soon.</p>
          ) : (
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {partners.map((p) => (
                <li key={`${p.name}-${p.city}`} className="flex items-start gap-3 rounded-2xl border border-line bg-cream p-4">
                  <Package className="mt-0.5 size-5 shrink-0 text-forest" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-deep">{p.name}</p>
                    <p className="text-xs text-muted">{p.role === "DONOR" ? "Food donor" : "Recipient"} · {p.city}</p>
                    {p.isDemo ? <Badge tone="demo" className="mt-2">Demo account</Badge> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Roles CTA */}
      <section className="section">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { href: "/register?role=DONOR", title: "For food donors", body: "Restaurants, hotels, cafés, hostels and event teams.", cta: "Post surplus food" },
            { href: "/register?role=NGO", title: "For recipients", body: "Nonprofits, shelters and community kitchens.", cta: "Register your organization" },
            { href: "/register?role=VOLUNTEER", title: "For volunteers", body: "Pick up nearby tasks and make the last mile work.", cta: "Become a volunteer" },
          ].map((c) => (
            <Link key={c.href} href={c.href} className="group rounded-2xl border border-line bg-white p-7 shadow-card transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest">
              <h3 className="text-xl font-bold">{c.title}</h3>
              <p className="mt-2 text-sm text-muted">{c.body}</p>
              <p className="mt-6 text-sm font-semibold text-forest group-hover:underline">{c.cta} →</p>
            </Link>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-3xl bg-deep p-8 text-white md:flex-row md:items-center md:p-12">
          <div className="max-w-xl space-y-2">
            <h2 className="text-2xl font-extrabold text-white md:text-3xl">Surplus today. A meal tonight.</h2>
            <p className="text-white/80">Verification keeps the chain trustworthy. Post your first donation once your organization is approved.</p>
          </div>
          <ButtonLink href="/register?role=DONOR" size="lg" className="bg-coral text-deep hover:bg-[#dd7860]">Donate Surplus Food</ButtonLink>
        </div>
      </section>
    </>
  );
}
