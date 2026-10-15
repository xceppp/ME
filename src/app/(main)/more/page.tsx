import Link from "next/link";
import { PageTitle } from "@/components/shell";

const links = [
  ["/habits", "Habits"],
  ["/journal", "Journal"],
  ["/plan", "Plan my day"],
  ["/reflect", "Evening reflection"],
  ["/settings", "Settings"],
];

export default function MorePage() {
  return (
    <>
      <PageTitle title="More" text="The rest of your space, within reach." />
      <div className="grid gap-2">
        {links.map(([href, label]) => <Link key={href} className="card min-h-14 px-4 py-4" href={href!}>{label}</Link>)}
      </div>
    </>
  );
}
