import PageHeader from "./page-header";

/**
 * A section that exists in the navigation but has nothing in it yet. Better
 * than a broken link: the menu shows where the app is going, and each stub
 * says plainly that it is not built.
 */
export default function Placeholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10">
      <PageHeader title={title} />
      <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-20 text-center">
        <p className="font-medium">Nothing here yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>
      </div>
    </main>
  );
}
