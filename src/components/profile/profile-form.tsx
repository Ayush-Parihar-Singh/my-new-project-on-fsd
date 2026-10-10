"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { Field, Input, Select, Textarea, describedBy } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationPicker } from "@/components/maps/location-picker";
import { organizationProfileSchema, volunteerProfileSchema, DIETARY_TAG_VALUES, ALLERGEN_VALUES } from "@/validation/profile";
import { ALLERGEN_LABELS, DIETARY_LABELS, DONOR_ORG_TYPES, RECIPIENT_ORG_TYPES, ORG_TYPE_LABELS, VEHICLE_LABELS } from "@/lib/constants";
import { api } from "@/lib/client/api";

type OrgValues = {
  kind: "ORGANIZATION";
  name: string;
  type: string;
  registrationNumber?: string | null;
  addressLine: string;
  city: string;
  latitude: number;
  longitude: number;
  phone: string;
  description?: string | null;
  operatingHours?: string | null;
  receivingStartHour?: number | null;
  receivingEndHour?: number | null;
  serviceRadiusKm: number;
  dailyBeneficiaries?: number | null;
  maxPickupQuantity?: number | null;
  dietaryNeeds: string[];
  avoidAllergens: string[];
  applicantNote?: string | null;
};

type VolValues = {
  kind: "VOLUNTEER";
  city: string;
  latitude: number;
  longitude: number;
  vehicleType: string;
  availability: string;
  serviceRadiusKm: number;
  phone: string;
  isAvailable: boolean;
  applicantNote?: string | null;
};

export interface ProfileFormProps {
  role: "DONOR" | "NGO" | "VOLUNTEER";
  initialOrg?: Partial<OrgValues> | null;
  initialVolunteer?: Partial<VolValues> | null;
  defaultCenter: [number, number];
  welcome: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function ProfileForm({ role, initialOrg, initialVolunteer, defaultCenter, welcome }: ProfileFormProps) {
  const router = useRouter();
  const isVolunteer = role === "VOLUNTEER";
  const [notice, setNotice] = React.useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [serverErrors, setServerErrors] = React.useState<Record<string, string[]>>({});

  const orgDefaults: OrgValues = {
    kind: "ORGANIZATION",
    name: "",
    type: role === "NGO" ? "NGO" : "RESTAURANT",
    registrationNumber: "",
    addressLine: "",
    city: "",
    latitude: defaultCenter[0],
    longitude: defaultCenter[1],
    phone: "",
    description: "",
    operatingHours: "",
    receivingStartHour: null,
    receivingEndHour: null,
    serviceRadiusKm: 15,
    dailyBeneficiaries: null,
    maxPickupQuantity: null,
    dietaryNeeds: [],
    avoidAllergens: [],
    applicantNote: "",
    ...initialOrg,
  };
  const volDefaults: VolValues = {
    kind: "VOLUNTEER",
    city: "",
    latitude: defaultCenter[0],
    longitude: defaultCenter[1],
    vehicleType: "TWO_WHEELER",
    availability: "",
    serviceRadiusKm: 8,
    phone: "",
    isAvailable: true,
    applicantNote: "",
    ...initialVolunteer,
  };

  const org = useForm<OrgValues>({
    resolver: zodResolver(organizationProfileSchema) as never,
    defaultValues: orgDefaults,
  });
  const vol = useForm<VolValues>({
    resolver: zodResolver(volunteerProfileSchema) as never,
    defaultValues: volDefaults,
  });

  const form = isVolunteer ? vol : org;
  const { register, handleSubmit, setValue, watch, formState } = form as unknown as ReturnType<typeof useForm<OrgValues>>;
  const errors = formState.errors as Record<string, { message?: string }>;
  const lat = watch("latitude" as never) as unknown as number | undefined;
  const lng = watch("longitude" as never) as unknown as number | undefined;
  const errFor = (k: string) => {
    const m = errors[k]?.message;
    const list = m ? [m] : serverErrors[k];
    return list?.length ? list : undefined;
  };

  async function onSubmit(values: OrgValues | VolValues) {
    setSaving(true);
    setNotice(null);
    setServerErrors({});
    const res = await api<{ profile: unknown }>("PUT", "/api/profile", values);
    setSaving(false);
    if (!res.ok) {
      if (res.fieldErrors) setServerErrors(res.fieldErrors);
      return setNotice({ tone: "error", text: res.message });
    }
    setNotice({ tone: "success", text: welcome ? "Thanks. Your details were sent for review. You can explore the dashboard while we verify." : "Profile saved." });
    router.replace("/profile");
    router.refresh();
  }

  const types = role === "DONOR" ? DONOR_ORG_TYPES : RECIPIENT_ORG_TYPES;

  const location = (
    <div className="space-y-3 md:col-span-2">
      <p className="text-sm font-semibold text-deep">Base location</p>
      <p className="text-xs text-muted">Click the map to place your base. We only use it for matching and distance. Other users see it only as an approximate area.</p>
      <LocationPicker value={lat != null && lng != null ? { lat, lng } : null} fallback={defaultCenter} onPick={(la, ln) => {
        setValue("latitude" as never, la as never, { shouldValidate: true });
        setValue("longitude" as never, ln as never, { shouldValidate: true });
      }} />
      <input type="hidden" {...register("latitude" as never, { valueAsNumber: true })} />
      <input type="hidden" {...register("longitude" as never, { valueAsNumber: true })} />
      {errFor("latitude") ? <p className="text-xs font-medium text-destructive">{errFor("latitude")![0]}</p> : null}
    </div>
  );

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit as never)} className="space-y-6">
      <input type="hidden" {...register("kind" as never)} />
      {notice ? <Alert tone={notice.tone === "error" ? "error" : "success"}>{notice.text}</Alert> : null}

      {isVolunteer ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">Volunteer details</CardTitle>
            <CardDescription>We match you with pickups within your radius. Your phone number is shared only with a donor or recipient once you accept a task.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <Field id="city" label="City" required error={errFor("city")}>
              <Input id="city" autoComplete="address-level2" invalid={!!errFor("city")} describedBy={describedBy("city", undefined, errFor("city"))} {...register("city" as never)} />
            </Field>
            <Field id="phone" label="Phone" required error={errFor("phone")}>
              <Input id="phone" type="tel" autoComplete="tel" invalid={!!errFor("phone")} describedBy={describedBy("phone", undefined, errFor("phone"))} {...register("phone" as never)} />
            </Field>
            <Field id="vehicleType" label="How do you travel?" required error={errFor("vehicleType")}>
              <Select id="vehicleType" invalid={!!errFor("vehicleType")} {...register("vehicleType" as never)}>
                {Object.entries(VEHICLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field id="serviceRadiusKm" label="Service radius (km)" required error={errFor("serviceRadiusKm")} hint="How far you will travel for a pickup">
              <Input id="serviceRadiusKm" type="number" min={1} max={50} invalid={!!errFor("serviceRadiusKm")} {...register("serviceRadiusKm" as never, { valueAsNumber: true })} />
            </Field>
            <Field id="availability" label="When are you usually free?" required className="md:col-span-2" error={errFor("availability")} hint="For example: weekday evenings, weekend mornings">
              <Input id="availability" invalid={!!errFor("availability")} describedBy={describedBy("availability", "av", errFor("availability"))} {...register("availability" as never)} />
            </Field>
            <label className="flex items-start gap-3 rounded-xl border border-line p-4 md:col-span-2">
              <input type="checkbox" className="mt-1 size-4 accent-forest" {...register("isAvailable" as never)} />
              <span><span className="block text-sm font-semibold text-deep">Available for new tasks</span><span className="text-xs text-muted">Turn this off when you are away. No new tasks will be offered.</span></span>
            </label>
            {location}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle as="h2">{role === "DONOR" ? "Your business or organization" : "Your organization"}</CardTitle>
              <CardDescription>{role === "DONOR" ? "Restaurants, hotels, cafes, hostels and event organizers. An admin verifies this before you can publish." : "Nonprofits, shelters and community kitchens. An admin verifies this before you can claim food."}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <Field id="name" label="Name" required error={errFor("name")}>
                <Input id="name" autoComplete="organization" invalid={!!errFor("name")} describedBy={describedBy("name", undefined, errFor("name"))} {...register("name" as never)} />
              </Field>
              <Field id="type" label="Type" required error={errFor("type")}>
                <Select id="type" invalid={!!errFor("type")} {...register("type" as never)}>
                  {types.map((t) => <option key={t} value={t}>{ORG_TYPE_LABELS[t]}</option>)}
                </Select>
              </Field>
              <Field id="registrationNumber" label="Registration number" error={errFor("registrationNumber")} hint="Optional, but it speeds up verification">
                <Input id="registrationNumber" {...register("registrationNumber" as never)} />
              </Field>
              <Field id="phone" label="Contact phone" required error={errFor("phone")}>
                <Input id="phone" type="tel" autoComplete="tel" invalid={!!errFor("phone")} describedBy={describedBy("phone", undefined, errFor("phone"))} {...register("phone" as never)} />
              </Field>
              <Field id="addressLine" label="Address" required className="md:col-span-2" error={errFor("addressLine")} hint="Used for matching and verification. Only confirmed partners see the exact address.">
                <Input id="addressLine" autoComplete="street-address" invalid={!!errFor("addressLine")} describedBy={describedBy("addressLine", "ad", errFor("addressLine"))} {...register("addressLine" as never)} />
              </Field>
              <Field id="city" label="City" required error={errFor("city")}>
                <Input id="city" autoComplete="address-level2" invalid={!!errFor("city")} describedBy={describedBy("city", undefined, errFor("city"))} {...register("city" as never)} />
              </Field>
              <Field id="serviceRadiusKm" label="Service radius (km)" required error={errFor("serviceRadiusKm")}>
                <Input id="serviceRadiusKm" type="number" min={1} max={100} invalid={!!errFor("serviceRadiusKm")} {...register("serviceRadiusKm" as never, { valueAsNumber: true })} />
              </Field>
              <Field id="description" label="About" className="md:col-span-2" error={errFor("description")}>
                <Textarea id="description" rows={3} maxLength={500} {...register("description" as never)} />
              </Field>
              {location}
            </CardContent>
          </Card>

          {role === "NGO" ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Receiving details</CardTitle>
                <CardDescription>These help us rank donations for you: hours, capacity and food you cannot accept.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-2">
                <Field id="receivingStartHour" label="Receive from" error={errFor("receivingStartHour")}>
                  <Select id="receivingStartHour" {...register("receivingStartHour" as never, { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })}>
                    <option value="">Not set</option>
                    {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                  </Select>
                </Field>
                <Field id="receivingEndHour" label="Until" error={errFor("receivingEndHour")} hint="Set both hours, or leave both empty">
                  <Select id="receivingEndHour" invalid={!!errFor("receivingEndHour")} {...register("receivingEndHour" as never, { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })}>
                    <option value="">Not set</option>
                    {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                  </Select>
                </Field>
                <Field id="operatingHours" label="Opening hours (text)" className="md:col-span-2" error={errFor("operatingHours")}>
                  <Input id="operatingHours" {...register("operatingHours" as never)} />
                </Field>
                <Field id="dailyBeneficiaries" label="People served per day" error={errFor("dailyBeneficiaries")}>
                  <Input id="dailyBeneficiaries" type="number" min={0} {...register("dailyBeneficiaries" as never, { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })} />
                </Field>
                <Field id="maxPickupQuantity" label="Largest pickup you can take (approx. units)" error={errFor("maxPickupQuantity")}>
                  <Input id="maxPickupQuantity" type="number" min={0} step="any" {...register("maxPickupQuantity" as never, { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })} />
                </Field>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-deep">Dietary needs</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {DIETARY_TAG_VALUES.map((t) => (
                      <label key={t} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm"><input type="checkbox" value={t} className="size-4 accent-forest" {...register("dietaryNeeds" as never)} />{DIETARY_LABELS[t]}</label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-deep">Allergens to avoid</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {ALLERGEN_VALUES.map((a) => (
                      <label key={a} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm"><input type="checkbox" value={a} className="size-4 accent-forest" {...register("avoidAllergens" as never)} />{ALLERGEN_LABELS[a]}</label>
                    ))}
                  </div>
                </fieldset>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      <Field id="applicantNote" label="Note for the reviewer (optional)" hint="Anything that helps us verify you quickly" error={errFor("applicantNote")}>
        <Textarea id="applicantNote" rows={2} maxLength={500} {...register("applicantNote" as never)} />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" loading={saving}><Save /> {welcome ? "Save and continue" : "Save profile"}</Button>
      </div>
    </form>
  );
}
