import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Evals · Frontdoor" };

export default function Evals() {
  return (
    <div className="ruled min-h-full px-6 py-10">
      <Link href="/" className="font-display text-[30px] text-text">Frontdoor</Link>
      <p className="mt-6 text-muted">No eval run yet. Run `pnpm eval`.</p>
    </div>
  );
}
