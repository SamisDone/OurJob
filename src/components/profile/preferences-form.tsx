"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import { useId, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Combobox } from "@/components/forms/combobox";
import { TokenInput } from "@/components/forms/token-input";
import { LoadError } from "@/components/load-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { countryOptions, regionsFor, timezoneOptions } from "@/lib/geo";
import type { SearchPreferences } from "@/lib/profile/schema";
import { usePreferenceSuggestion, usePreferences, useSavePreferences } from "@/lib/query/profile";
import { formatAmount, parseAmountInput } from "@/lib/salary/input";

type Scope = "world" | "region" | "onsite";

function scopeOf(p: SearchPreferences): Scope {
  if (p.remoteScopes.onsiteCities.length > 0) return "onsite";
  if (!p.remoteScopes.worldwide) return "region";
  return "world";
}

const SENIORITY = [
  { value: "intern", label: "Intern" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
];

const EMPLOYMENT = [
  { value: "full_time", label: "Full-time" },
  { value: "contract", label: "Contract" },
  { value: "part_time", label: "Part-time" },
];

const SCOPES = [
  { value: "world", label: "Worldwide" },
  { value: "region", label: "My region" },
  { value: "onsite", label: "Also on-site in..." },
];

const TIME_DIFF = [
  { value: "any", label: "Any" },
  { value: "2", label: "Up to 2 hours" },
  { value: "4", label: "Up to 4 hours" },
  { value: "6", label: "Up to 6 hours" },
  { value: "8", label: "Up to 8 hours" },
];

const formSchema = z.object({
  targetTitles: z.array(z.string()).min(1, "Add at least one job title to save."),
  stretchTitles: z.array(z.string()),
  coreSkills: z.array(z.string()).max(10),
  seniority: z.array(z.enum(["intern", "junior", "mid", "senior"])),
  country: z.string().optional(),
  timezone: z.string().optional(),
  scope: z.enum(["world", "region", "onsite"]),
  onsiteCities: z.array(z.string()),
  maxTimezoneDiff: z.string(),
  // What he typed ("40k", "40,000" or "40000"), parsed on save.
  pay: z.string().refine((s) => parseAmountInput(s) !== null, "Enter an amount like 40k, 40,000 or 40000."),
  showUnlistedPay: z.boolean(),
  hideBelowMinimum: z.boolean(),
  employmentTypes: z.array(z.enum(["full_time", "contract", "part_time"])),
  excludedCompanies: z.array(z.string()),
  excludedKeywords: z.array(z.string()),
  preferLesserKnown: z.boolean(),
  showStaffingAgencies: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

function toForm(p: SearchPreferences): FormValues {
  return {
    targetTitles: p.targetTitles,
    stretchTitles: p.stretchTitles,
    coreSkills: p.coreSkills,
    seniority: p.seniority,
    country: p.country,
    timezone: p.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    scope: scopeOf(p),
    onsiteCities: p.remoteScopes.onsiteCities,
    maxTimezoneDiff: p.maxTimezoneDiffHours === undefined ? "any" : String(p.maxTimezoneDiffHours),
    pay: formatAmount(p.minAnnualUsd),
    showUnlistedPay: p.showUnlistedPay,
    hideBelowMinimum: p.hideBelowMinimum,
    employmentTypes: p.employmentTypes,
    excludedCompanies: p.excludedCompanies,
    excludedKeywords: p.excludedKeywords,
    preferLesserKnown: p.preferLesserKnown,
    showStaffingAgencies: p.showStaffingAgencies,
  };
}

function fromForm(v: FormValues): SearchPreferences {
  const { scope, onsiteCities, maxTimezoneDiff, pay, ...rest } = v;
  return {
    ...rest,
    remoteScopes: {
      worldwide: scope !== "region",
      regions: scope === "world" ? [] : regionsFor(v.country),
      countries: scope === "world" || !v.country ? [] : [v.country],
      onsiteCities: scope === "onsite" ? onsiteCities : [],
    },
    maxTimezoneDiffHours: maxTimezoneDiff === "any" ? undefined : Number(maxTimezoneDiff),
    minAnnualUsd: parseAmountInput(pay) ?? undefined,
  };
}

/**
 * Search preferences (PRD F2) in plain language. Used in onboarding step 4
 * and in Settings. Pre-filled from P5 the first time.
 */
export function PreferencesForm({
  onSaved,
  saveLabel = "Save preferences",
}: {
  onSaved?: () => void;
  saveLabel?: string;
}) {
  const query = usePreferences();
  if (query.isPending) return <PreferencesSkeleton />;
  if (query.isError) {
    return (
      <LoadError title="Your preferences did not load." onRetry={() => void query.refetch()}>
        {query.error.message}
      </LoadError>
    );
  }
  return <Form initial={query.data.data} suggested={query.data.suggested} onSaved={onSaved} saveLabel={saveLabel} />;
}

function Form({
  initial,
  suggested,
  onSaved,
  saveLabel,
}: {
  initial: SearchPreferences;
  suggested: boolean;
  onSaved?: () => void;
  saveLabel: string;
}) {
  const id = useId();
  // P5 arrives later (it can take 30 s). Fields he has not touched take its values; his edits stay.
  const suggestion = usePreferenceSuggestion(suggested);
  const suggestedData = suggested ? suggestion.data?.suggestion?.data : undefined;
  const values = useMemo(() => (suggestedData ? toForm(suggestedData) : undefined), [suggestedData]);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toForm(initial),
    values,
    resetOptions: { keepDirtyValues: true },
    mode: "onChange",
  });
  const save = useSavePreferences();
  const countries = useMemo(() => countryOptions(), []);
  const zones = useMemo(() => timezoneOptions(), []);
  const [scope, country, pay] = useWatch({ control: form.control, name: ["scope", "country", "pay"] });
  const minimum = parseAmountInput(pay);
  const region = (country && regionsFor(country).join(" or ")) || "your region";

  const submit = form.handleSubmit((values) =>
    save.mutate(fromForm(values), {
      onSuccess: () => {
        toast("Saved your preferences.");
        onSaved?.();
      },
    }),
  );

  const tokens = (
    name: "targetTitles" | "stretchTitles" | "coreSkills" | "excludedCompanies" | "excludedKeywords",
    label: string,
    title: string,
    placeholder: string,
    hint?: string,
    max?: number,
  ) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={`${id}-${name}`}>{title}</FieldLabel>
          <TokenInput
            id={`${id}-${name}`}
            label={label}
            values={field.value}
            onChange={field.onChange}
            placeholder={placeholder}
            max={max}
            invalid={fieldState.invalid}
          />
          {hint && <FieldDescription>{hint}</FieldDescription>}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );

  const toggles = (
    name: "seniority" | "employmentTypes",
    title: string,
    options: { value: string; label: string }[],
  ) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field }) => (
        <Field>
          <FieldTitle id={`${id}-${name}`}>{title}</FieldTitle>
          <ToggleGroup
            type="multiple"
            variant="outline"
            aria-labelledby={`${id}-${name}`}
            value={field.value}
            onValueChange={field.onChange}
            className="flex-wrap"
          >
            {options.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value} className="max-md:h-11">
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      )}
    />
  );

  const toggle = (
    name: "showUnlistedPay" | "hideBelowMinimum" | "preferLesserKnown" | "showStaffingAgencies",
    title: string,
    hint?: string,
  ) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field }) => (
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={`${id}-${name}`}>{title}</FieldLabel>
            {hint && <FieldDescription>{hint}</FieldDescription>}
          </FieldContent>
          <Switch id={`${id}-${name}`} checked={field.value} onCheckedChange={field.onChange} />
        </Field>
      )}
    />
  );

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <FieldGroup>
        {suggested && (
          <Alert aria-live="polite">
            {suggestion.isFetching ? <Spinner /> : <Info />}
            <AlertDescription>
              {suggestion.isFetching
                ? "Filled in from your profile. Finding more job titles and skills that fit you; you can edit already."
                : suggestion.isError
                  ? "Filled in from your profile. The extra suggestions did not load; change anything that does not fit."
                  : "Suggested from your profile. Change anything that does not fit; nothing is saved until you save."}
            </AlertDescription>
          </Alert>
        )}

        {tokens(
          "targetTitles",
          "Job titles",
          "Job titles to search for",
          "Frontend Engineer",
          "Titles your experience supports. Each one becomes a search.",
        )}
        {initial.stretchTitles.length > 0 &&
          tokens(
            "stretchTitles",
            "Stretch titles",
            "Stretch titles",
            "Add a title",
            "Plausible, but your experience supports them less directly.",
          )}
        {tokens(
          "coreSkills",
          "Core skills",
          "Skills to weight higher",
          "TypeScript",
          "Up to 10, from your profile.",
          10,
        )}
        {toggles("seniority", "Seniority", SENIORITY)}

        <FieldSeparator />

        <div className="grid gap-6 sm:grid-cols-2">
          <Controller
            name="country"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor={`${id}-country`}>Where you work from</FieldLabel>
                <Combobox
                  id={`${id}-country`}
                  value={field.value}
                  onValueChange={field.onChange}
                  options={countries}
                  placeholder="Choose your country"
                  searchPlaceholder="Search countries"
                />
              </Field>
            )}
          />
          <Controller
            name="timezone"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor={`${id}-timezone`}>Your time zone</FieldLabel>
                <Combobox
                  id={`${id}-timezone`}
                  value={field.value}
                  onValueChange={field.onChange}
                  options={zones}
                  placeholder="Choose your time zone"
                  searchPlaceholder="Search time zones"
                />
              </Field>
            )}
          />
        </div>

        <Controller
          name="scope"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldTitle id={`${id}-scope`}>What kind of remote?</FieldTitle>
              <RadioGroup
                aria-labelledby={`${id}-scope`}
                value={field.value}
                onValueChange={field.onChange}
                className="flex flex-wrap gap-x-6 gap-y-3"
              >
                {SCOPES.map((s) => (
                  <Field key={s.value} orientation="horizontal" className="w-auto">
                    <RadioGroupItem value={s.value} id={`${id}-scope-${s.value}`} />
                    <FieldLabel htmlFor={`${id}-scope-${s.value}`} className="font-normal max-md:min-h-11">
                      {s.label}
                    </FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
              <FieldDescription>
                {scope === "world"
                  ? "Jobs open to anyone, anywhere, plus jobs open to your country or region."
                  : scope === "region"
                    ? `Only jobs open to ${region} or your country.`
                    : "Remote jobs you can do from home, plus on-site or hybrid jobs in these cities."}
              </FieldDescription>
            </Field>
          )}
        />
        {scope === "onsite" && (
          <Controller
            name="onsiteCities"
            control={form.control}
            render={({ field }) => (
              <TokenInput label="Cities" values={field.value} onChange={field.onChange} placeholder="Dhaka" />
            )}
          />
        )}

        <Controller
          name="maxTimezoneDiff"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={`${id}-tzdiff`}>Largest time difference you will work with</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={`${id}-tzdiff`} className="sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_DIFF.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />

        <FieldSeparator />

        <Controller
          name="pay"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="min-pay">Minimum pay, in US dollars a year</FieldLabel>
              <Input
                {...field}
                id="min-pay"
                inputMode="decimal"
                className="sm:max-w-64"
                placeholder="Optional, for example 40k"
                aria-invalid={fieldState.invalid || undefined}
                onBlur={() => {
                  const n = parseAmountInput(field.value);
                  if (n !== null) field.onChange(formatAmount(n));
                  field.onBlur();
                }}
              />
              <FieldDescription>Optional. Pay in other currencies is converted approximately.</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        {toggle("showUnlistedPay", "Show jobs that do not list pay")}
        {minimum !== null && minimum !== undefined && toggle("hideBelowMinimum", "Hide jobs below my minimum")}
        {toggles("employmentTypes", "Employment types", EMPLOYMENT)}

        <FieldSeparator />

        <div className="grid gap-6 sm:grid-cols-2">
          {tokens("excludedCompanies", "Excluded companies", "Companies to leave out", "Company name")}
          {tokens(
            "excludedKeywords",
            "Excluded keywords",
            "Words to leave out",
            "clearance",
            "Jobs mentioning these are hidden.",
          )}
        </div>
        {toggle(
          "preferLesserKnown",
          "Prefer lesser-known companies",
          "Gives a small boost to companies outside the famous few.",
        )}
        {toggle("showStaffingAgencies", "Show staffing agencies", "Agencies often repost the same role many times.")}

        {save.isError && <LoadError title="Your preferences were not saved.">{save.error.message}</LoadError>}
        <div>
          <Button type="submit" size="lg" disabled={save.isPending}>
            {save.isPending && <Spinner data-icon="inline-start" />}
            {save.isPending ? "Saving" : saveLabel}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

function PreferencesSkeleton() {
  return (
    <div aria-busy className="space-y-8">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
}
