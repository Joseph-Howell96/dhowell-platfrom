export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          dhowell-platfrom
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          A Next.js site built with TypeScript and Tailwind CSS. Edit{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-base dark:bg-gray-800">
            src/app/page.tsx
          </code>{" "}
          to change this page.
        </p>
      </div>
    </main>
  );
}
