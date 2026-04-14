import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const dates = ["Mon 24", "Tue 25", "Wed 26", "Thu 27", "Fri 28", "Sat 29", "Sun 30"];
const types = [
  { name: "Royal Suite", row: ["$850 · 4", "$850 · 3", "$850 · 0", "$890 · 2", "$890 · 1", "$920 · 0", "$920 · 2"] },
  { name: "Executive Deluxe", row: ["$410 · 12", "$410 · 8", "$410 · 0", "$430 · 6", "$430 · 4", "$430 · 2", "$430 · 5"] },
  { name: "Panoramic King", row: ["$295 · 18", "$295 · 14", "$295 · 3", "$310 · 10", "$310 · 7", "$310 · 4", "$310 · 9"] },
];

export default function AvailabilityPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white [font-family:var(--font-outfit),system-ui,sans-serif]">
            Availability & inventory
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Nightly availability by room type for the selected horizon.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary">Oct 24 – Oct 30, 2023</Button>
          <Button variant="secondary">Room types</Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="overflow-x-auto xl:col-span-2">
          <CardHeader>
            <CardTitle>Inventory grid</CardTitle>
            <CardDescription>Green = rooms left · Red = sold out.</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full min-w-[720px] text-center text-xs">
              <thead>
                <tr className="border-b border-border text-zinc-500">
                  <th className="pb-3 text-left">Room type</th>
                  {dates.map((d, i) => (
                    <th
                      key={d}
                      className={`pb-3 ${i === 2 ? "rounded-t bg-gold/15 text-gold" : ""}`}
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {types.map((t) => (
                  <tr key={t.name} className="border-b border-border/40">
                    <td className="py-3 text-left font-medium text-white">{t.name}</td>
                    {t.row.map((cell, i) => {
                      const sold = cell.includes("· 0");
                      return (
                        <td
                          key={i}
                          className={`py-3 ${i === 2 ? "bg-gold/10" : ""} ${
                            sold ? "text-red-400" : "text-emerald-400"
                          }`}
                        >
                          {cell}
                          {sold ? (
                            <span className="block text-[9px] text-red-400/80">Full</span>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick reservation</CardTitle>
            <CardDescription>Hold or confirm from availability.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Guest lookup</label>
              <Input placeholder="Name, email, or ID" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Check-in</label>
                <Input type="text" defaultValue="Oct 24" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Check-out</label>
                <Input type="text" defaultValue="Oct 27" />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface/50 p-3 text-sm">
              <p className="font-medium text-white">Royal Suite 204</p>
              <p className="text-xs text-zinc-500">3 nights · 2 adults</p>
            </div>
            <div className="space-y-1 text-sm text-zinc-400">
              <div className="flex justify-between">
                <span>Nightly (avg)</span>
                <span>$850.00</span>
              </div>
              <div className="flex justify-between">
                <span>Resort fees</span>
                <span>$120.00</span>
              </div>
              <div className="flex justify-between">
                <span>Taxes</span>
                <span>$98.50</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-lg font-semibold text-gold">
                <span>Total</span>
                <span>$3,155.80</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1">
                Draft hold
              </Button>
              <Button className="flex-1">Confirm booking</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Occupancy forecast</CardTitle>
            <CardDescription>Wednesday peaks driven by regional conference demand.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-32 items-end gap-1">
              {[30, 45, 55, 70, 65, 80, 75].map((h, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-t ${i === 3 ? "bg-gold/80" : "bg-zinc-700/60"}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Average daily rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-white">
              $482.50{" "}
              <span className="text-base font-normal text-emerald-400">+12.4%</span>
            </p>
            <div className="mt-4 space-y-2 text-sm text-zinc-400">
              <div className="flex justify-between">
                <span>Standard</span>
                <span>$295</span>
              </div>
              <div className="flex justify-between">
                <span>Deluxe</span>
                <span>$510</span>
              </div>
              <div className="flex justify-between">
                <span>Suites</span>
                <span>$890</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
