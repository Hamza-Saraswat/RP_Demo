// The company map, browsable. Read straight from the markdown files in knowledge/.
import Link from "next/link";
import { bundle, offeringsIn, type Entity } from "@/lib/okf";

export const dynamic = "force-dynamic";
export const metadata = { title: "Company map · Frontdoor" };

function Card({ entity, children }: { entity: Entity; children?: React.ReactNode }) {
  return (
    <article id={entity.id} className="scroll-mt-24 rounded-lg border border-line bg-raised/50 p-4 target:border-accent">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[15px] font-medium text-text">{entity.title}</h3>
        <span className="label">{entity.type}</span>
        {entity.illustrative && <span className="label !text-amber">illustrative</span>}
        {entity.needsVerification && <span className="label !text-red">needs a check</span>}
      </div>
      {entity.role && <p className="mt-0.5 text-[12.5px] text-cyan">{entity.role}</p>}
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{entity.description}</p>
      {entity.formerly.length > 0 && (
        <p className="mt-2 text-[12.5px] text-muted">
          <span className="label mr-1.5">Came from</span>
          {entity.formerly.join(", ")}
        </p>
      )}
      {entity.familySource === "jev" && (
        <p className="mt-2 font-mono text-[11px] text-faint">
          family chosen by jev, {Math.round((entity.familyConfidence ?? 0) * 100)}% sure
        </p>
      )}
      {children}
      {entity.resource && (
        <a href={entity.resource} target="_blank" rel="noreferrer" className="mt-2.5 block truncate font-mono text-[11px] text-faint hover:text-cyan">
          {entity.resource.replace("https://www.", "")}
        </a>
      )}
    </article>
  );
}

export default function Atlas() {
  const b = bundle();
  const families = b.byType("Family");
  const count = (type: Parameters<typeof b.byType>[0]) => b.byType(type).length;
  const stats: [string, number][] = [
    ["families", families.length],
    ["products", count("Product")],
    ["agents", count("Agent")],
    ["earlier names", count("Acquisition")],
    ["customers", count("Customer")],
    ["people", count("Person")],
  ];

  return (
    <div className="ruled min-h-full">
      <header className="sticky top-0 z-10 flex items-center gap-5 border-b border-line bg-ink/90 px-6 py-3 backdrop-blur">
        <Link href="/" className="font-display text-[30px] leading-none text-text">
          Frontdoor
        </Link>
        <span className="text-[12.5px] text-muted">Company map</span>
        <nav className="ml-auto flex gap-4 text-[13px] text-muted">
          <Link href="/" className="hover:text-text">Ask</Link>
          <Link href="/evals" className="hover:text-text">Evals</Link>
        </nav>
      </header>

      <div className="mx-auto max-w-[1180px] px-6 py-10">
        <p className="label mb-3">{b.entities.size} markdown files · links are the graph</p>
        <h1 className="font-display text-[48px] leading-[1.03] text-text">RealPage, from the outside.</h1>
        <p className="mt-3 max-w-[640px] text-[14.5px] leading-relaxed text-muted">
          Structure comes from the site&apos;s own menu. Descriptions are written in our own words, each with its source.
          An earlier name is kept only when the page itself says it.
        </p>
        <dl className="mt-7 flex flex-wrap gap-x-9 gap-y-3">
          {stats.map(([label, n]) => (
            <div key={label}>
              <dt className="label">{label}</dt>
              <dd className="font-display text-[34px] leading-none text-text">{n}</dd>
            </div>
          ))}
        </dl>

        {families.map((family) => {
          const slug = family.id.replace("families/", "");
          const members = offeringsIn(slug, b);
          return (
            <section key={family.id} id={family.id} className="mt-12 scroll-mt-24">
              <div className="mb-4 border-b border-line pb-3">
                <h2 className="font-display text-[30px] leading-tight text-text">{family.title}</h2>
                <p className="mt-1 max-w-[760px] text-[13.5px] leading-relaxed text-muted">{family.description}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {members.map((e) => (
                  <Card key={e.id} entity={e} />
                ))}
              </div>
            </section>
          );
        })}

        {(
          [
            ["Earlier names and acquisitions", "Acquisition"],
            ["Leadership", "Person"],
            ["Customers with a published case study", "Customer"],
            ["Owners", "Queue"],
            ["Platforms", "Platform"],
          ] as const
        ).map(([title, type]) => (
          <section key={type} className="mt-12">
            <h2 className="mb-4 border-b border-line pb-3 font-display text-[30px] leading-tight text-text">{title}</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {b.byType(type).map((e) => (
                <Card key={e.id} entity={e} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
