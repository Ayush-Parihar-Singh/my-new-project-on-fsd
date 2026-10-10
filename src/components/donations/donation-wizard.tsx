"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Save, Send, Sparkles, Trash2, X, Info, MapPin, LocateFixed } from "lucide-react";
import { Field, Input, Select, Textarea, Checkbox, describedBy } from "@/components/ui/form";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationPicker } from "@/components/maps/location-picker";
import { donationFormSchema, toDonationPayload, DONATION_LIMITS, FOOD_CATEGORY_VALUES, UNIT_VALUES, type DonationFormValues } from "@/validation/donation";
import { DIETARY_TAG_VALUES, ALLERGEN_VALUES } from "@/validation/profile";
import { ALLERGEN_LABELS, DIETARY_LABELS, FOOD_CATEGORY_LABELS, UNIT_LABELS } from "@/lib/constants";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

export interface WizardPhoto {
  id: string;
  url: string;
}

interface Props {
  mode: "create" | "edit";
  donationId?: string;
  initialValues: DonationFormValues;
  initialPhotos: WizardPhoto[];
  initialStatus?: string;
  defaultCenter: [number, number];
}

const STEP_FIELDS: FieldPath<DonationFormValues>[][] = [
  ["title", "description", "category", "quantity", "unit", "preparedAt", "dietaryTags", "allergens", "allergenNotes"],
  ["pickupAddressLine", "pickupCity", "pickupLatitude", "pickupLongitude", "pickupAreaLabel", "availableFrom", "availableUntil", "pickupDeadline", "storageInstructions", "handlingInstructions"],
];

/** Which wizard step holds a given field, so error links take the donor to the right place. */
function stepForField(name: string): number {
  return STEP_FIELDS.findIndex((fields) => fields.includes(name as FieldPath<DonationFormValues>)) === 1 ? 1 : 0;
}

const STEPS = [
  { key: "food", title: "The food" },
  { key: "pickup", title: "Pickup" },
  { key: "review", title: "Review & publish" },
];

/** Local "YYYY-MM-DDTHH:mm" for datetime-local inputs, from an ISO string. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DonationWizard({ mode, donationId, initialValues, initialPhotos, initialStatus, defaultCenter }: Props) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [draftId, setDraftId] = React.useState<string | undefined>(donationId);
  const [photos, setPhotos] = React.useState<WizardPhoto[]>(initialPhotos);
  const [busy, setBusy] = React.useState<null | "draft" | "publish" | "photo" | "ai">(null);
  const [notice, setNotice] = React.useState<{ tone: "success" | "error" | "info" | "warning"; text: string } | null>(null);
  const [duplicate, setDuplicate] = React.useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = React.useState<Record<string, string[]>>({});
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState<number | undefined>(undefined);

  const form = useForm<DonationFormValues>({
    resolver: zodResolver(donationFormSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });
  const { register, handleSubmit, getValues, setValue, trigger, watch, formState: { errors } } = form;
  const lat = watch("pickupLatitude");
  const lng = watch("pickupLongitude");
  const isPublished = !!initialStatus && initialStatus !== "DRAFT";

  const errFor = (name: keyof DonationFormValues) => {
    const msgs = (errors[name]?.message ? [errors[name]!.message as string] : undefined) ?? serverFieldErrors[name as string];
    return msgs?.length ? msgs : undefined;
  };

  /** Saves the current values. Creates a draft on first save, otherwise updates it. */
  async function saveDraft(silent = false): Promise<string | null> {
    setBusy("draft");
    if (!silent) setNotice(null);
    const payload = toDonationPayload(getValues());
    const res = draftId
      ? await api<{ donation: { id: string; version: number } }>("PATCH", `/api/donations/${draftId}`, { ...payload, expectedVersion: version })
      : await api<{ donation: { id: string; version: number } }>("POST", "/api/donations", payload);
    setBusy(null);
    if (!res.ok) {
      setNotice({ tone: "error", text: res.message });
      if (res.fieldErrors) setServerFieldErrors(res.fieldErrors);
      return null;
    }
    const id = res.data.donation.id;
    setVersion(res.data.donation.version);
    if (!draftId) {
      setDraftId(id);
      // Keep the URL in step with the saved record without remounting the form.
      window.history.replaceState(null, "", `/donations/${id}/edit`);
    }
    setSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }));
    if (!silent) setNotice({ tone: "success", text: "Draft saved. You can come back to it any time from My donations." });
    return id;
  }

  async function goNext() {
    const ok = await trigger(STEP_FIELDS[step]);
    if (!ok) {
      setNotice({ tone: "warning", text: "Check the highlighted fields before continuing." });
      return;
    }
    setNotice(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function publish(acknowledgeDuplicate: boolean) {
    setBusy("publish");
    setNotice(null);
    setServerFieldErrors({});
    const id = await saveDraft(true);
    if (!id) {
      setBusy(null);
      return;
    }
    const res = await api<{ donation: { id: string }; warnings: string[] }>("POST", `/api/donations/${id}/publish`, { acknowledgeDuplicate });
    setBusy(null);
    if (!res.ok) {
      if (res.code === "DUPLICATE_SUSPECTED") {
        setDuplicate(res.message);
        setNotice({ tone: "warning", text: "This looks like a repost. Review it, or publish anyway if it is genuinely new food." });
        return;
      }
      if (res.fieldErrors) {
        setServerFieldErrors(res.fieldErrors);
        setStep(0);
      }
      setNotice({ tone: "error", text: res.message });
      return;
    }
    router.replace(`/donations/${id}?published=1`);
    router.refresh();
  }

  async function uploadPhoto(file: File) {
    setBusy("photo");
    setNotice(null);
    const id = draftId ?? (await saveDraft(true));
    if (!id) {
      setBusy(null);
      return;
    }
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch(`/api/donations/${id}/photos`, { method: "POST", body, credentials: "same-origin" });
      const json = (await res.json().catch(() => null)) as { photo?: { id: string }; error?: { message: string } } | null;
      if (!res.ok || !json?.photo) {
        setNotice({ tone: "error", text: json?.error?.message ?? "We could not add that photo. Use a JPEG, PNG or WebP under 5 MB." });
      } else {
        setPhotos((p) => [...p, { id: json.photo!.id, url: `/api/files/photos/${json.photo!.id}` }]);
        setNotice({ tone: "success", text: "Photo added. It stays private until a partner is confirmed." });
      }
    } catch {
      setNotice({ tone: "error", text: "The upload did not finish. Check your connection and try again." });
    }
    setBusy(null);
  }

  async function removePhoto(photoId: string) {
    const res = await api("DELETE", `/api/files/photos/${photoId}`);
    if (res.ok) setPhotos((p) => p.filter((x) => x.id !== photoId));
    else setNotice({ tone: "error", text: res.message });
  }

  // AI listing assistant: suggestions only, applied only when the donor chooses.
  const [aiText, setAiText] = React.useState("");
  const [aiResult, setAiResult] = React.useState<{ source: string; message: string; disclaimer: string; suggestion: null | { title: string; category: string; description: string; dietaryTags: string[]; allergensToCheck: string[] } } | null>(null);
  async function suggest() {
    setBusy("ai");
    const res = await api<NonNullable<typeof aiResult>>("POST", "/api/ai/listing-assist", { text: aiText, photoIds: photos.map((p) => p.id).slice(0, 3) });
    setBusy(null);
    if (!res.ok) return setNotice({ tone: "error", text: res.message });
    setAiResult(res.data);
  }
  function applySuggestion() {
    const s = aiResult?.suggestion;
    if (!s) return;
    setValue("title", s.title, { shouldValidate: true });
    setValue("description", s.description, { shouldValidate: true });
    setValue("category", s.category as DonationFormValues["category"], { shouldValidate: true });
    setValue("dietaryTags", s.dietaryTags as DonationFormValues["dietaryTags"]);
    setNotice({ tone: "info", text: "Suggestion applied. Check each field and change anything that is not right." });
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setNotice({ tone: "warning", text: "Your browser cannot share its location. Pin the point on the map instead." });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue("pickupLatitude", Number(pos.coords.latitude.toFixed(6)), { shouldValidate: true });
        setValue("pickupLongitude", Number(pos.coords.longitude.toFixed(6)), { shouldValidate: true });
      },
      () => setNotice({ tone: "warning", text: "Location permission was declined. Pin the point on the map instead." }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const values = watch();
  const reviewRows: { label: string; value: React.ReactNode }[] = [
    { label: "Food", value: `${values.title || "—"} · ${FOOD_CATEGORY_LABELS[values.category as keyof typeof FOOD_CATEGORY_LABELS] ?? "No category"}` },
    { label: "Quantity", value: `${values.quantity ?? "—"} ${values.unit ? UNIT_LABELS[values.unit] : ""}` },
    { label: "Dietary", value: values.dietaryTags?.length ? values.dietaryTags.map((t) => DIETARY_LABELS[t]).join(", ") : "None stated" },
    { label: "Allergens", value: values.allergens?.length ? values.allergens.map((t) => ALLERGEN_LABELS[t]).join(", ") : "None stated" },
    { label: "Public area", value: values.pickupAreaLabel || "—" },
    { label: "Exact pickup", value: values.pickupAddressLine ? `${values.pickupAddressLine}, ${values.pickupCity}` : "—" },
    { label: "Pickup window", value: values.availableFrom && values.availableUntil ? `${new Date(values.availableFrom).toLocaleString("en-IN")} to ${new Date(values.availableUntil).toLocaleString("en-IN")}` : "—" },
    { label: "Pickup deadline", value: values.pickupDeadline ? new Date(values.pickupDeadline).toLocaleString("en-IN") : "—" },
  ];

  return (
    <div className="space-y-8">
      {/* Progress */}
      <nav aria-label="Donation steps">
        <ol className="grid grid-cols-3 gap-2">
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => (i <= step ? setStep(i) : undefined)}
                  aria-current={current ? "step" : undefined}
                  className={cn("flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors", current ? "border-forest bg-forest-50" : "border-line bg-white", i > step && "cursor-not-allowed opacity-60")}
                  disabled={i > step}
                >
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", done ? "bg-forest text-white" : current ? "bg-coral text-deep" : "bg-sage text-deep")}>
                    {done ? <Check className="size-4" aria-hidden /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs text-muted">Step {i + 1}</span>
                    <span className="block truncate text-sm font-semibold text-deep">{s.title}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {isPublished ? (
        <Alert tone="info">This donation is already published. Edits are allowed until a recipient claims it, and cancellations until pickup starts.</Alert>
      ) : null}
      {notice ? <Alert tone={notice.tone === "warning" ? "warning" : notice.tone === "error" ? "error" : notice.tone === "success" ? "success" : "info"}>{notice.text}</Alert> : null}
      {duplicate ? (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-amber-950">{duplicate}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDuplicate(null)}>Edit listing</Button>
              <Button size="sm" variant="coral" loading={busy === "publish"} onClick={() => publish(true)}>Publish anyway</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <form noValidate onSubmit={handleSubmit(() => publish(false))} className="space-y-8">
        {/* Step 1: food */}
        <section hidden={step !== 0} aria-labelledby="step-food" className="space-y-8">
          <h2 id="step-food" className="sr-only">The food</h2>
          <Card>
            <CardHeader>
              <CardTitle as="h3">What is it?</CardTitle>
              <CardDescription>Describe the food honestly, including how it was prepared and packed.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <Field id="title" label="Food name" required className="md:col-span-2" error={errFor("title")} hint="For example: Vegetable biryani, 20 portions">
                <Input id="title" maxLength={DONATION_LIMITS.title.max} invalid={!!errFor("title")} describedBy={describedBy("title", "t", errFor("title"))} {...register("title")} />
              </Field>
              <Field id="description" label="Description" required className="md:col-span-2" error={errFor("description")} hint="Ingredients, packaging and anything a recipient should know.">
                <Textarea id="description" rows={4} maxLength={DONATION_LIMITS.description.max} invalid={!!errFor("description")} describedBy={describedBy("description", "d", errFor("description"))} {...register("description")} />
              </Field>
              <Field id="category" label="Category" required error={errFor("category")}>
                <Select id="category" invalid={!!errFor("category")} describedBy={describedBy("category", undefined, errFor("category"))} {...register("category")}>
                  <option value="">Choose a category</option>
                  {FOOD_CATEGORY_VALUES.map((c) => <option key={c} value={c}>{FOOD_CATEGORY_LABELS[c]}</option>)}
                </Select>
              </Field>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <Field id="quantity" label="Quantity" required error={errFor("quantity")}>
                  <Input id="quantity" type="number" inputMode="decimal" step="any" min={0} invalid={!!errFor("quantity")} describedBy={describedBy("quantity", undefined, errFor("quantity"))} {...register("quantity", { valueAsNumber: true })} />
                </Field>
                <Field id="unit" label="Unit" required error={errFor("unit")}>
                  <Select id="unit" className="w-36" invalid={!!errFor("unit")} describedBy={describedBy("unit", undefined, errFor("unit"))} {...register("unit")}>
                    <option value="">Unit</option>
                    {UNIT_VALUES.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
                  </Select>
                </Field>
              </div>
              <Field id="preparedAt" label="Prepared at" error={errFor("preparedAt")} hint="Optional. Helps recipients plan.">
                <Input id="preparedAt" type="datetime-local" {...register("preparedAt")} />
              </Field>
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-deep">Dietary details</legend>
                <div className="grid grid-cols-2 gap-2">
                  {DIETARY_TAG_VALUES.map((t) => (
                    <label key={t} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm hover:border-forest/40">
                      <input type="checkbox" value={t} className="size-4 accent-forest" {...register("dietaryTags")} />
                      {DIETARY_LABELS[t]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-deep">Allergens present</legend>
                <div className="grid grid-cols-2 gap-2">
                  {ALLERGEN_VALUES.map((a) => (
                    <label key={a} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm hover:border-forest/40">
                      <input type="checkbox" value={a} className="size-4 accent-forest" {...register("allergens")} />
                      {ALLERGEN_LABELS[a]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field id="allergenNotes" label="Allergen notes" className="md:col-span-2" error={errFor("allergenNotes")}>
                <Input id="allergenNotes" maxLength={DONATION_LIMITS.notes} {...register("allergenNotes")} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h3" className="flex items-center gap-2"><ImagePlus className="size-5 text-forest" aria-hidden /> Photos</CardTitle>
              <CardDescription>Up to {DONATION_LIMITS.maxPhotos} photos. JPEG, PNG or WebP, 5 MB each. Photos are private: only you, and confirmed partners, can see them.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {photos.length ? (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((p) => (
                    <li key={p.id} className="relative overflow-hidden rounded-xl border border-line bg-cream">
                      <img src={p.url} alt="Uploaded photo of the donation" className="aspect-square w-full object-cover" />
                      <button type="button" onClick={() => removePhoto(p.id)} className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-white/95 text-destructive shadow hover:bg-white" aria-label="Remove photo">
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {photos.length < DONATION_LIMITS.maxPhotos ? (
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-forest/30 bg-cream/60 px-6 py-8 text-center hover:border-forest/60">
                  <ImagePlus className="size-7 text-forest" aria-hidden />
                  <span className="text-sm font-semibold text-deep">{busy === "photo" ? "Uploading…" : "Choose a photo"}</span>
                  <span className="text-xs text-muted">Photos show the food and packaging. They do not confirm safety.</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={busy === "photo"}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) uploadPhoto(f);
                    }}
                  />
                </label>
              ) : (
                <p className="text-sm text-muted">You have reached the photo limit.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-forest/20 bg-sage-light/60">
            <CardHeader>
              <CardTitle as="h3" className="flex items-center gap-2"><Sparkles className="size-5 text-forest" aria-hidden /> Listing assistant</CardTitle>
              <CardDescription>Describe the food in your own words and get a draft to edit. Suggestions never judge whether food is safe, fresh or edible. You make that call.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field id="aiText" label="Describe the food" hint="Up to 1000 characters">
                <Textarea id="aiText" rows={3} maxLength={1000} value={aiText} onChange={(e) => setAiText(e.target.value)} />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={suggest} loading={busy === "ai"} disabled={aiText.trim().length < 3 && photos.length === 0}>
                  <Sparkles /> Suggest details
                </Button>
                <span className="text-xs text-muted">{photos.length ? `${photos.length} photo(s) included as context` : "Add photos above for a stronger draft"}</span>
              </div>
              {aiResult ? (
                <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={aiResult.source === "AI" ? "forest" : "neutral"}>{aiResult.source === "AI" ? "AI draft" : aiResult.source === "RULES" ? "Guided draft" : "No draft"}</Badge>
                    <p className="text-sm text-ink">{aiResult.message}</p>
                  </div>
                  {aiResult.suggestion ? (
                    <div className="space-y-2 text-sm">
                      <p><span className="font-semibold">{aiResult.suggestion.title}</span> · {FOOD_CATEGORY_LABELS[aiResult.suggestion.category as keyof typeof FOOD_CATEGORY_LABELS]}</p>
                      <p className="text-muted">{aiResult.suggestion.description}</p>
                      {aiResult.suggestion.allergensToCheck.length ? (
                        <p className="text-xs text-coral-ink">Please check allergens: {aiResult.suggestion.allergensToCheck.map((a) => ALLERGEN_LABELS[a]).join(", ")}</p>
                      ) : null}
                      <Button size="sm" onClick={applySuggestion}><Check /> Use this draft</Button>
                    </div>
                  ) : null}
                  <p className="flex items-start gap-1.5 text-xs text-muted"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {aiResult.disclaimer}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        {/* Step 2: pickup */}
        <section hidden={step !== 1} aria-labelledby="step-pickup" className="space-y-8">
          <h2 id="step-pickup" className="sr-only">Pickup</h2>
          <Card>
            <CardHeader>
              <CardTitle as="h3">Where and when</CardTitle>
              <CardDescription>The exact address is shared only with a confirmed recipient and the volunteer collecting it. The public sees your area label and a point that is moved up to about 350 m.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <Field id="pickupAddressLine" label="Pickup address" required className="md:col-span-2" error={errFor("pickupAddressLine")}>
                <Input id="pickupAddressLine" autoComplete="street-address" invalid={!!errFor("pickupAddressLine")} describedBy={describedBy("pickupAddressLine", undefined, errFor("pickupAddressLine"))} {...register("pickupAddressLine")} />
              </Field>
              <Field id="pickupCity" label="City" required error={errFor("pickupCity")}>
                <Input id="pickupCity" autoComplete="address-level2" invalid={!!errFor("pickupCity")} describedBy={describedBy("pickupCity", undefined, errFor("pickupCity"))} {...register("pickupCity")} />
              </Field>
              <Field id="pickupAreaLabel" label="Public area label" required error={errFor("pickupAreaLabel")} hint="A neighbourhood name, for example “Indiranagar”. Do not include a street.">
                <Input id="pickupAreaLabel" invalid={!!errFor("pickupAreaLabel")} describedBy={describedBy("pickupAreaLabel", "a", errFor("pickupAreaLabel"))} {...register("pickupAreaLabel")} />
              </Field>
              <div className="space-y-3 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-deep">Pin the pickup point <span className="text-coral-ink" aria-hidden>*</span></p>
                  <Button variant="outline" size="sm" onClick={useMyLocation} type="button"><LocateFixed /> Use my location</Button>
                </div>
                <LocationPicker
                  value={lat != null && lng != null ? { lat, lng } : null}
                  fallback={defaultCenter}
                  onPick={(la, ln) => {
                    setValue("pickupLatitude", la, { shouldValidate: true });
                    setValue("pickupLongitude", ln, { shouldValidate: true });
                  }}
                />
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <MapPin className="size-3.5" aria-hidden />
                  {lat != null && lng != null ? `Pinned at ${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Click the map to place the pin. Your organization’s address is the starting view."}
                </p>
                {errFor("pickupLatitude") ? <p className="text-xs font-medium text-destructive">{errFor("pickupLatitude")![0]}</p> : null}
                <input type="hidden" {...register("pickupLatitude", { valueAsNumber: true })} />
                <input type="hidden" {...register("pickupLongitude", { valueAsNumber: true })} />
              </div>
              <Field id="availableFrom" label="Pickup can start" required error={errFor("availableFrom")}>
                <Input id="availableFrom" type="datetime-local" invalid={!!errFor("availableFrom")} describedBy={describedBy("availableFrom", undefined, errFor("availableFrom"))} {...register("availableFrom")} />
              </Field>
              <Field id="availableUntil" label="Pickup window closes" required error={errFor("availableUntil")}>
                <Input id="availableUntil" type="datetime-local" invalid={!!errFor("availableUntil")} describedBy={describedBy("availableUntil", undefined, errFor("availableUntil"))} {...register("availableUntil")} />
              </Field>
              <Field id="pickupDeadline" label="Latest pickup time" required error={errFor("pickupDeadline")} hint="Must be at least an hour from now when you publish.">
                <Input id="pickupDeadline" type="datetime-local" invalid={!!errFor("pickupDeadline")} describedBy={describedBy("pickupDeadline", "p", errFor("pickupDeadline"))} {...register("pickupDeadline")} />
              </Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle as="h3">Handling</CardTitle>
              <CardDescription>Storage and handover instructions help the volunteer and recipient.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <Field id="storageInstructions" label="Storage" error={errFor("storageInstructions")} hint="For example: keep hot until collection, refrigerated containers">
                <Textarea id="storageInstructions" rows={3} maxLength={DONATION_LIMITS.notes} {...register("storageInstructions")} />
              </Field>
              <Field id="handlingInstructions" label="Handover instructions" error={errFor("handlingInstructions")} hint="For example: ask for the kitchen door, bell 2">
                <Textarea id="handlingInstructions" rows={3} maxLength={DONATION_LIMITS.notes} {...register("handlingInstructions")} />
              </Field>
            </CardContent>
          </Card>
        </section>

        {/* Step 3: review */}
        <section hidden={step !== 2} aria-labelledby="step-review" className="space-y-6">
          <h2 id="step-review" className="sr-only">Review and publish</h2>
          <Card>
            <CardHeader>
              <CardTitle as="h3">Check before you publish</CardTitle>
              <CardDescription>Once published, recipients see the public area and the food details. Your exact address stays private until a confirmed handover.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-line">
                {reviewRows.map((r) => (
                  <div key={r.label} className="grid gap-1 py-3 md:grid-cols-[180px_1fr]">
                    <dt className="text-sm text-muted">{r.label}</dt>
                    <dd className="text-sm font-medium text-deep">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          {Object.keys(errors).length || Object.keys(serverFieldErrors).length ? (
            <Alert tone="error" title="Fix these before publishing">
              <ul className="list-disc space-y-1 pl-5">
                {[...Object.entries(errors).map(([k, v]) => [k, (v as { message?: string })?.message ?? "Check this field"] as const), ...Object.entries(serverFieldErrors).map(([k, v]) => [k, v[0]] as const)].map(([k, m]) => (
                  <li key={k}>
                    <button type="button" className="text-left underline underline-offset-2" onClick={() => setStep(stepForField(k))}>
                      {String(m)}
                    </button>
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}
        </section>

        {/* Navigation */}
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white/95 p-3 shadow-lift backdrop-blur">
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <Button variant="ghost" type="button" onClick={() => setStep((s) => s - 1)}><ArrowLeft /> Back</Button>
            ) : (
              <ButtonLink href={draftId ? `/donations/${draftId}` : "/donations"} variant="ghost"><X /> Cancel</ButtonLink>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {savedAt ? <span className="text-xs text-muted" aria-live="polite">Saved {savedAt}</span> : null}
            <Button variant="outline" type="button" onClick={() => saveDraft()} loading={busy === "draft"} disabled={busy === "publish"}>
              <Save /> {isPublished ? "Save changes" : "Save draft"}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={goNext}>Continue <ArrowRight /></Button>
            ) : (
              <Button type="submit" variant="coral" loading={busy === "publish"} disabled={busy === "draft"}>
                <Send /> {isPublished ? "Update listing" : "Publish donation"}
              </Button>
            )}
          </div>
        </div>
      </form>
      {mode === "edit" && !draftId ? <Link href="/donations" className="text-sm text-forest underline">Back to my donations</Link> : null}
    </div>
  );
}
