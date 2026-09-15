import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          dhowell-platfrom
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Waste management admin.
        </p>
        <Link
          href="/customers"
          className="mt-8 inline-block rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
        >
          Customers
        </Link>
      </div>
    </main>
  );
}
