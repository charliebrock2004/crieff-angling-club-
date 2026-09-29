"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { startCheckoutAction } from "@/app/(site)/book/actions";
import type { BookingRule, DayBeatOption, DayPermitOption, DayWaterOption } from "@/lib/booking/public";
import { rulesForBooking } from "@/lib/booking/engine";
import { formatDate, formatMoney } from "@/lib/format";
import { Alert } from "../ui/alert";
import { cn } from "../ui/cn";
import { DatePicker } from "./date-picker";

interface Preselect {
  date?: string | null;
  water?: string | null;
  beat?: string | null;
  permit?: string | null;
}

interface Contact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
}

const EMPTY_CONTACT: Contact = { firstName: "", lastName: "", email: "", phone: "", addressLine1: "", addressLine2: "", town: "", postcode: "" };

function Step({ n, title, done, children, id, summary }: { n: number; title: string; done?: boolean; children: React.ReactNode; id: string; summary?: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t border-line py-8 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-4">
        <span className={cn("mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-semibold", done ? "bg-good text-white" : "bg-peat text-bone")} aria-hidden="true">
          {done ? "✓" : n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="font-display text-2xl leading-tight sm:text-[1.7rem]">
            <span className="sr-only">Step {n}: </span>
            {title}
          </h2>
          {summary && <p className="mt-1 text-sm text-stone">{summary}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </section>
  );
}

function Choice({ selected, disabled, onClick, children, className }: { selected: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition sm:p-5",
        selected ? "border-peat bg-peat text-bone shadow-md" : "border-line bg-white hover:border-peat/60",
        disabled && "cursor-not-allowed border-dashed bg-mist/40 text-stone opacity-80 hover:border-line",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Availability({ remaining, capacity, inverted }: { remaining: number; capacity: number; inverted?: boolean }) {
  const pct = capacity ? Math.round(((capacity - remaining) / capacity) * 100) : 100;
  return (
    <div className="mt-3">
      <div className={cn("h-1.5 overflow-hidden rounded-full", inverted ? "bg-white/15" : "bg-mist")}>
        <div className={cn("h-full rounded-full", remaining === 0 ? "bg-bad" : remaining <= 1 ? "bg-bracken" : "bg-good")} style={{ width: `${pct}%` }} />
      </div>
      <p className={cn("mt-1.5 text-xs font-medium", inverted ? "text-bone/75" : "text-stone")}>
        {remaining === 0 ? "Full" : `${remaining} of ${capacity} permits left`}
      </p>
    </div>
  );
}

export function BookingWizard({ preselect, initialMonth }: { preselect: Preselect; initialMonth: string }) {
  const [date, setDate] = useState<string | null>(preselect.date ?? null);
  const [options, setOptions] = useState<{ waters: DayWaterOption[]; rules: BookingRule[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [waterId, setWaterId] = useState<string | null>(null);
  const [beatId, setBeatId] = useState<string | null>(null);
  const [permitId, setPermitId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [anglers, setAnglers] = useState([{ firstName: "", lastName: "" }]);
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT);
  const [ack, setAck] = useState(false);
  const [juniorOk, setJuniorOk] = useState(false);
  const [filter, setFilter] = useState({ water: preselect.water ?? null, beat: preselect.beat ?? null, permit: preselect.permit ?? null });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [refreshKey, setRefreshKey] = useState(0);
  const applied = useRef(false);

  // Load live options for the chosen date.
  useEffect(() => {
    if (!date) return;
    const ctrl = new AbortController();
    const reqKey = `${date}|${refreshKey}`;
    fetch(`/api/availability/day?date=${date}`, { signal: ctrl.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Could not load availability");
        setOptions(j);
        setLoadError(null);
      })
      .catch((e) => e.name !== "AbortError" && setLoadError(e.message))
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadedKey(reqKey);
      });
    return () => ctrl.abort();
  }, [date, refreshKey]);
  const loading = !!date && loadedKey !== `${date}|${refreshKey}`;

  const water = options?.waters.find((w) => w.id === waterId) ?? null;
  const beat = water?.beats.find((b) => b.id === beatId) ?? null;
  const permit = beat?.permits.find((p) => p.id === permitId) ?? null;

  // Apply URL preselection / auto-select single options once data arrives.
  useEffect(() => {
    if (!options) return;
    const match = <T extends { id: string; slug: string }>(list: T[], v?: string | null) => (v ? list.find((x) => x.slug === v || x.id === v) : undefined);
    let w = options.waters.find((x) => x.id === waterId);
    let b: DayBeatOption | undefined;
    let p: DayPermitOption | undefined;
    if (!applied.current) {
      applied.current = true;
      const preBeat = options.waters.flatMap((x) => x.beats.map((bb) => ({ w: x, b: bb }))).find((x) => x.b.slug === filter.beat || x.b.id === filter.beat);
      w = preBeat?.w ?? match(options.waters, filter.water);
      b = preBeat?.b;
      p = b ? match(b.permits, filter.permit) : undefined;
    } else {
      b = w?.beats.find((x) => x.id === beatId);
      p = b?.permits.find((x) => x.id === permitId);
    }
    if (!w) w = options.waters.filter((x) => x.sellable).length === 1 ? options.waters.find((x) => x.sellable) : undefined;
    if (w && !w.sellable) w = undefined;
    if (w && !b) b = w.beats.filter((x) => x.sellable).length === 1 ? w.beats.find((x) => x.sellable) : undefined;
    if (b && !b.sellable) b = undefined;
    if (b && !p) p = b.permits.filter((x) => x.sellable).length === 1 ? b.permits.find((x) => x.sellable) : undefined;
    if (p && !p.sellable) p = undefined;
    setWaterId(w?.id ?? null);
    setBeatId(b?.id ?? null);
    setPermitId(p?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  const maxQ = permit?.sellable ? permit.maxQuantity : 0;
  useEffect(() => {
    if (maxQ && quantity > maxQ) setQuantity(maxQ);
  }, [maxQ, quantity]);
  useEffect(() => {
    setAnglers((prev) => Array.from({ length: quantity }, (_, i) => prev[i] ?? { firstName: "", lastName: "" }));
  }, [quantity]);

  const rules = useMemo(() => {
    if (!options || !water || !beat || !permit) return [];
    return rulesForBooking(options.rules, { waterId: water.id, beatId: beat.id, speciesIds: permit.speciesIds, requiresBoat: permit.requiresBoat });
  }, [options, water, beat, permit]);

  const total = permit?.pricePence != null ? permit.pricePence * quantity + (permit.requiresBoat ? permit.boatFeePence : 0) : null;
  const readyForDetails = !!(date && permit?.sellable);

  const scrollTo = (id: string) => setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);

  const chooseDate = (d: string) => {
    setDate(d);
    setSubmitError(null);
    scrollTo("step-water");
  };

  const setField = (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement>) => setContact((c) => ({ ...c, [k]: e.target.value }));
  const err = (k: string) => errors[k];

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!date || !beat || !permit) return;
      setSubmitError(null);
      setErrors({});
      const acknowledgedRuleIds = ack ? rules.filter((r) => r.requiresAcknowledgement).map((r) => r.id) : [];
      startTransition(async () => {
        const res = await startCheckoutAction({
          date,
          beatId: beat.id,
          permitTypeId: permit.id,
          quantity,
          anglers,
          contact,
          acknowledgedRuleIds,
          juniorConfirmed: juniorOk,
          website: (document.getElementById("website") as HTMLInputElement | null)?.value ?? "",
        });
        if (res.ok) {
          window.location.assign(res.url);
          return;
        }
        setSubmitError(res.error);
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
          const first = Object.keys(res.fieldErrors)[0];
          const el = document.querySelector<HTMLElement>(`[data-field="${first}"]`);
          el?.focus();
        }
        if (res.code && ["full", "insufficient_availability", "no_boats", "blocked", "same_day_closed", "past"].includes(res.code)) {
          setRefreshKey((k) => k + 1);
        }
      });
    },
    [date, beat, permit, quantity, anglers, contact, ack, juniorOk, rules],
  );

  const input = (name: keyof Contact, label: string, opts: { type?: string; autoComplete?: string; required?: boolean; inputMode?: "tel" | "email" | "text"; className?: string } = {}) => {
    const key = `contact.${name}`;
    return (
      <div className={opts.className}>
        <label htmlFor={key} className="field-label">
          {label}
          {opts.required !== false && <span className="text-bracken" aria-hidden="true"> *</span>}
        </label>
        <input
          id={key}
          data-field={key}
          type={opts.type ?? "text"}
          autoComplete={opts.autoComplete}
          inputMode={opts.inputMode}
          required={opts.required !== false}
          value={contact[name]}
          onChange={setField(name)}
          aria-invalid={!!err(key) || undefined}
          aria-describedby={err(key) ? `${key}-error` : undefined}
          className="input"
        />
        {err(key) && <p id={`${key}-error`} className="field-error">{err(key)}</p>}
      </div>
    );
  };

  const filterLabel = [filter.beat, filter.permit, !filter.beat && filter.water].filter(Boolean).join(" · ");

  return (
    <form onSubmit={submit} noValidate className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
      <div className="min-w-0 pb-28 lg:pb-0">
        <Step n={1} id="step-date" title="Choose a date" done={!!date} summary={date ? formatDate(date, "full") : "Days with permits available are highlighted."}>
          {filterLabel && (
            <p className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-mist px-3 py-1 capitalize">Showing dates for {filterLabel.replace(/-/g, " ")}</span>
              <button type="button" className="link-underline text-stone" onClick={() => setFilter({ water: null, beat: null, permit: null })}>
                Show all waters
              </button>
            </p>
          )}
          <DatePicker value={date} onChange={chooseDate} filter={filter} initialMonth={date ? date.slice(0, 7) : initialMonth} />
        </Step>

        {date && (
          <>
            <Step n={2} id="step-water" title="Choose a water" done={!!water}>
              {loadError && <Alert tone="bad" title="Couldn't load availability">{loadError}</Alert>}
              {loading && !options && <p className="text-stone">Checking live availability…</p>}
              {options && (
                <div className="grid gap-3 sm:grid-cols-2" aria-busy={loading}>
                  {options.waters.map((w) => (
                    <Choice
                      key={w.id}
                      selected={waterId === w.id}
                      disabled={!w.sellable}
                      onClick={() => {
                        setWaterId(w.id);
                        const sellableBeats = w.beats.filter((b) => b.sellable);
                        setBeatId(sellableBeats.length === 1 ? sellableBeats[0].id : null);
                        setPermitId(null);
                        scrollTo(sellableBeats.length === 1 ? "step-permit" : "step-beat");
                      }}
                    >
                      <span className="block font-display text-xl">{w.name}</span>
                      <span className={cn("mt-1 block text-sm", waterId === w.id ? "text-bone/75" : "text-stone")}>
                        {w.sellable ? (w.kind === "loch" ? "Boat fishing · fly only" : `${w.beats.filter((b) => b.sellable).length} beat${w.beats.filter((b) => b.sellable).length === 1 ? "" : "s"} available`) : "Nothing available on this date"}
                      </span>
                    </Choice>
                  ))}
                </div>
              )}
            </Step>

            {water && water.beats.length > 1 && (
              <Step n={3} id="step-beat" title="Choose a beat" done={!!beat}>
                <div className="grid gap-3 sm:grid-cols-3">
                  {water.beats.map((b) => {
                    const why = b.permits.find((p) => !p.sellable)?.message;
                    return (
                      <Choice
                        key={b.id}
                        selected={beatId === b.id}
                        disabled={!b.sellable}
                        onClick={() => {
                          setBeatId(b.id);
                          const sp = b.permits.filter((p) => p.sellable);
                          setPermitId(sp.length === 1 ? sp[0].id : permit && sp.some((p) => p.slug === permit.slug) ? sp.find((p) => p.slug === permit.slug)!.id : null);
                          scrollTo("step-permit");
                        }}
                      >
                        <span className="block font-display text-xl">{b.name}</span>
                        {b.sellable ? <Availability remaining={b.remaining} capacity={b.capacity} inverted={beatId === b.id} /> : <span className="mt-2 block text-sm">{b.remaining === 0 ? "Fully booked" : why ?? "Not available"}</span>}
                      </Choice>
                    );
                  })}
                </div>
                <p className="mt-3 text-sm text-stone">
                  Not sure which beat? <Link href="/river-earn" target="_blank" className="link-underline">Compare the beats</Link>
                </p>
              </Step>
            )}

            {beat && (
              <Step n={water && water.beats.length > 1 ? 4 : 3} id="step-permit" title="Choose a permit" done={!!permit}>
                <div className="grid gap-3">
                  {beat.permits.map((p) => (
                    <Choice
                      key={p.id}
                      selected={permitId === p.id}
                      disabled={!p.sellable}
                      onClick={() => {
                        setPermitId(p.id);
                        scrollTo("step-anglers");
                      }}
                    >
                      <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="font-display text-xl">{p.name}</span>
                        {p.pricePence !== null && (
                          <span className="font-display text-2xl">
                            {formatMoney(p.pricePence)}
                            <span className={cn("text-sm font-sans", permitId === p.id ? "text-bone/70" : "text-stone")}> per angler</span>
                          </span>
                        )}
                      </span>
                      <span className={cn("mt-1 block text-sm", permitId === p.id ? "text-bone/75" : "text-stone")}>
                        {p.sellable ? (
                          <>
                            {p.speciesNames.join(" & ")}
                            {p.priceLabel ? ` · ${p.priceLabel}` : ""}
                            {p.requiresBoat && p.boatsFree !== null ? ` · ${p.boatsFree} of ${p.boatsTotal} boats free` : ` · ${p.remaining} left`}
                          </>
                        ) : (
                          p.message
                        )}
                      </span>
                    </Choice>
                  ))}
                </div>
              </Step>
            )}

            {readyForDetails && permit && beat && water && (
              <>
                <Step n={water.beats.length > 1 ? 5 : 4} id="step-anglers" title="Who's fishing?" done={anglers.every((a) => a.firstName && a.lastName)}>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-sm font-medium" id="qty-label">Number of anglers</span>
                    <div className="inline-flex items-center rounded-full border border-line bg-white" role="group" aria-labelledby="qty-label">
                      <button type="button" className="h-11 w-11 rounded-full text-xl hover:bg-mist disabled:opacity-30" disabled={quantity <= 1} onClick={() => setQuantity((q) => q - 1)} aria-label="One fewer angler">−</button>
                      <output className="w-10 text-center text-lg font-semibold" aria-live="polite">{quantity}</output>
                      <button type="button" className="h-11 w-11 rounded-full text-xl hover:bg-mist disabled:opacity-30" disabled={quantity >= maxQ} onClick={() => setQuantity((q) => q + 1)} aria-label="One more angler">+</button>
                    </div>
                    <span className="text-sm text-stone">
                      Up to {maxQ} on this booking{permit.requiresBoat ? " (one boat)" : ""}
                    </span>
                  </div>
                  <div className="mt-5 space-y-4">
                    {anglers.map((a, i) => (
                      <fieldset key={i} className="grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-2">
                        <legend className="px-1 text-sm font-semibold">Angler {i + 1}{i === 0 ? " (name on permit)" : ""}</legend>
                        {(["firstName", "lastName"] as const).map((k) => {
                          const key = `anglers.${i}.${k}`;
                          return (
                            <div key={k}>
                              <label htmlFor={key} className="field-label">{k === "firstName" ? "First name" : "Surname"}</label>
                              <input
                                id={key}
                                data-field={key}
                                className="input"
                                required
                                autoComplete={i === 0 ? (k === "firstName" ? "given-name" : "family-name") : "off"}
                                value={a[k]}
                                aria-invalid={!!err(key) || undefined}
                                onChange={(e) => setAnglers((list) => list.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                              />
                              {err(key) && <p className="field-error">{err(key)}</p>}
                            </div>
                          );
                        })}
                      </fieldset>
                    ))}
                  </div>
                  {permit.isJunior && (
                    <label className="mt-4 flex gap-3 rounded-2xl bg-warn-bg p-4 text-sm">
                      <input type="checkbox" className="mt-0.5 h-5 w-5 flex-none accent-peat" checked={juniorOk} onChange={(e) => setJuniorOk(e.target.checked)} />
                      <span>I confirm every angler on this booking qualifies for a junior permit, and that a responsible adult will accompany them where required.</span>
                    </label>
                  )}
                </Step>

                <Step n={water.beats.length > 1 ? 6 : 5} id="step-details" title="Your details" summary="We'll send the permit and receipt to this email address.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {input("firstName", "First name", { autoComplete: "given-name" })}
                    {input("lastName", "Surname", { autoComplete: "family-name" })}
                    {input("email", "Email", { type: "email", autoComplete: "email", inputMode: "email" })}
                    {input("phone", "Phone", { type: "tel", autoComplete: "tel", inputMode: "tel" })}
                    {input("addressLine1", "Address", { autoComplete: "address-line1", className: "sm:col-span-2" })}
                    {input("addressLine2", "Address line 2", { autoComplete: "address-line2", required: false, className: "sm:col-span-2" })}
                    {input("town", "Town", { autoComplete: "address-level2" })}
                    {input("postcode", "Postcode", { autoComplete: "postal-code" })}
                  </div>
                  <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                    <label htmlFor="website">Website</label>
                    <input id="website" name="website" tabIndex={-1} autoComplete="off" />
                  </div>
                </Step>

                <Step n={water.beats.length > 1 ? 7 : 6} id="step-rules" title="Rules for this permit" done={ack}>
                  <ul className="space-y-3">
                    {permit.conditions && (
                      <li className="rounded-2xl border border-bracken/30 bg-bracken/5 p-4">
                        <p className="font-semibold">Permit conditions</p>
                        <p className="mt-1 whitespace-pre-line text-sm text-peat/80">{permit.conditions}</p>
                      </li>
                    )}
                    {rules.map((r) => (
                      <li key={r.id} className="rounded-2xl border border-line bg-white p-4">
                        <p className="font-semibold">{r.title}</p>
                        <p className="mt-1 text-sm text-peat/80">{r.body}</p>
                      </li>
                    ))}
                  </ul>
                  <label className="mt-5 flex gap-3 text-sm">
                    <input type="checkbox" required className="mt-0.5 h-5 w-5 flex-none accent-peat" checked={ack} onChange={(e) => setAck(e.target.checked)} data-field="acknowledgedRuleIds" />
                    <span>
                      I have read these rules and the <Link href="/rules" target="_blank" className="link-underline">club rules</Link>, and every angler on this booking will follow them. I accept the{" "}
                      <Link href="/terms" target="_blank" className="link-underline">terms</Link> and <Link href="/cancellation-policy" target="_blank" className="link-underline">cancellation policy</Link>.
                    </span>
                  </label>
                </Step>
              </>
            )}
          </>
        )}
      </div>

      {/* Summary: sidebar on desktop, sticky bar on mobile */}
      <aside aria-label="Booking summary" className="lg:sticky lg:top-24 lg:self-start">
        <div className="card hidden p-6 lg:block">
          <p className="eyebrow">Your booking</p>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ["Date", date ? formatDate(date, "long") : "—"],
              ["Water", water?.name ?? "—"],
              ...(water && water.beats.length > 1 ? [["Beat", beat?.name ?? "—"]] : []),
              ["Permit", permit?.name ?? "—"],
              ["Anglers", permit ? String(quantity) : "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-line pb-3">
                <dt className="text-stone">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {permit?.requiresBoat && permit.boatFeePence > 0 && <p className="mt-3 text-sm text-stone">Includes boat hire {formatMoney(permit.boatFeePence)}</p>}
          <p className="mt-5 flex items-baseline justify-between">
            <span className="text-stone">Total</span>
            <span className="font-display text-4xl">{total !== null && readyForDetails ? formatMoney(total) : "—"}</span>
          </p>
          {submitError && <Alert tone="bad" className="mt-5">{submitError}</Alert>}
          <button type="submit" disabled={!readyForDetails || !ack || pending || (permit?.isJunior && !juniorOk)} className="mt-6 flex h-14 w-full items-center justify-center rounded-full bg-bracken font-semibold text-bone transition hover:bg-bracken-dark disabled:cursor-not-allowed disabled:opacity-40">
            {pending ? "Securing your permits…" : "Continue to secure payment"}
          </button>
          <p className="mt-3 text-center text-xs text-stone">Permits are held for 30 minutes while you pay. Payment by card via Stripe.</p>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bone/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-12px_rgb(20_34_29/0.25)] backdrop-blur lg:hidden">
          {submitError && <p role="alert" className="mb-2 text-sm font-medium text-bad">{submitError}</p>}
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-medium">{permit ? `${quantity} × ${permit.name}` : date ? formatDate(date, "short") : "Choose a date"}</p>
              <p className="truncate text-stone">{beat ? `${beat.name}${date ? ` · ${formatDate(date, "short")}` : ""}` : water?.name ?? "Live availability"}</p>
            </div>
            {readyForDetails ? (
              <button type="submit" disabled={!ack || pending || (permit?.isJunior && !juniorOk)} className="h-12 flex-none rounded-full bg-bracken px-5 font-semibold text-bone disabled:opacity-40">
                {pending ? "Please wait…" : total !== null ? `Pay ${formatMoney(total)}` : "Pay"}
              </button>
            ) : null}
          </div>
          {readyForDetails && !ack && <p className="mt-1.5 text-xs text-stone">Accept the rules above to continue.</p>}
        </div>
      </aside>
    </form>
  );
}
