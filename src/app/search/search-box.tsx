/** The search box on the Search screen: everything, not just invoices. */
import SearchForm from "@/components/search-form";

export default function Search({ value }: { value: string }) {
  return (
    <SearchForm
      action="/search"
      name="q"
      label="Search for anything"
      placeholder="Client, material, postcode, date, invoice number"
      value={value}
    />
  );
}
