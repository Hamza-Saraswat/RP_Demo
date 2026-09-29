import { Console } from "@/components/console";
import { teams, DEFAULT_TEAM } from "@/lib/teams";

export const dynamic = "force-dynamic";

export default function Home() {
  const list = [...teams().values()]
    .map(({ slug, name, description, samples }) => ({ slug, name, description, samples }))
    .sort((a, b) => Number(b.slug === DEFAULT_TEAM) - Number(a.slug === DEFAULT_TEAM));
  return <Console teams={list} />;
}
