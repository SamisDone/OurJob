"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Callout, ErrorState, Skeleton } from "@/components/ui/feedback";
import { MultiToggle, Switch, TokenInput } from "@/components/ui/form-bits";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/input";
import { Combobox, Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { countryOptions, regionsFor, timezoneOptions } from "@/lib/geo";
import { formatAmount, parseAmountInput } from "@/lib/salary/input";
import type { SearchPreferences } from "@/lib/profile/schema";
import { usePreferences, useSavePreferences } from "@/lib/query/profile";

type Scope = "world" | "region" | "onsite";

function scopeOf(p: SearchPreferences): Scope {
  if (p.remoteScopes.onsiteCities.length > 0) return "onsite";
  if (!p.remoteScopes.worldwide) return "region";
  return "world";
}

function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="block">
        {label}
      </Label>
      {children}
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
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
      <ErrorState title="Your preferences did not load." onRetry={() => void query.refetch()}>
        {query.error.message}
      </ErrorState>
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
  const [p, setP] = useState<SearchPreferences>(() => ({
    ...initial,
    timezone: initial.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  }));
  const [scope, setScope] = useState<Scope>(scopeOf(initial));
  // What he typed ("40k", "40,000" or "40000"); parsed on every change.
  const [payText, setPayText] = useState(formatAmount(initial.minAnnualUsd));
  const payInvalid = parseAmountInput(payText) === null;
  const save = useSavePreferences();
  const countries = useMemo(() => countryOptions(), []);
  const zones = useMemo(() => timezoneOptions(), []);
  const set = <K extends keyof SearchPreferences>(k: K, v: SearchPreferences[K]) => setP((x) => ({ ...x, [k]: v }));

  const submit = () => {
    const remoteScopes = {
      worldwide: scope !== "region",
      regions: scope === "world" ? [] : regionsFor(p.country),
      countries: scope === "world" || !p.country ? [] : [p.country],
      onsiteCities: scope === "onsite" ? p.remoteScopes.onsiteCities : [],
    };
    save.mutate(
      { ...p, remoteScopes },
      {
        onSuccess: () => {
          toast("Saved your preferences.");
          onSaved?.();
        },
      },
    );
  };

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {suggested && (
        <Callout>
          Suggested from your profile. Change anything that does not fit; nothing is saved until you save.
        </Callout>
      )}

      <Field label="Job titles to search for" hint="Titles your experience supports. Each one becomes a search.">
        <TokenInput
          label="Job titles"
          values={p.targetTitles}
          onChange={(v) => set("targetTitles", v)}
          placeholder="Frontend Engineer"
        />
      </Field>
      {p.stretchTitles.length > 0 && (
        <Field label="Stretch titles" hint="Plausible, but your experience supports them less directly.">
          <TokenInput
            label="Stretch titles"
            values={p.stretchTitles}
            onChange={(v) => set("stretchTitles", v)}
            placeholder="Add a title"
          />
        </Field>
      )}
      <Field label="Skills to weight higher" hint="Up to 10, from your profile.">
        <TokenInput
          label="Core skills"
          values={p.coreSkills}
          onChange={(v) => set("coreSkills", v)}
          placeholder="TypeScript"
          max={10}
        />
      </Field>
      <Field label="Seniority">
        <MultiToggle
          label="Seniority"
          value={p.seniority}
          onChange={(v) => set("seniority", v)}
          options={[
            { value: "intern", label: "Intern" },
            { value: "junior", label: "Junior" },
            { value: "mid", label: "Mid" },
            { value: "senior", label: "Senior" },
          ]}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Where you work from">
          <Combobox
            aria-label="Country"
            value={p.country}
            onValueChange={(v) => set("country", v)}
            options={countries}
            placeholder="Choose your country"
            searchPlaceholder="Search countries"
          />
        </Field>
        <Field label="Your time zone">
          <Combobox
            aria-label="Time zone"
            value={p.timezone}
            onValueChange={(v) => set("timezone", v)}
            options={zones}
            placeholder="Choose your time zone"
            searchPlaceholder="Search time zones"
          />
        </Field>
      </div>

      <Field label="What kind of remote?">
        <Segmented
          aria-label="What kind of remote?"
          value={scope}
          onValueChange={(v) => setScope(v as Scope)}
          options={[
            { value: "world", label: "Worldwide" },
            { value: "region", label: "My region" },
            { value: "onsite", label: "Also on-site in..." },
          ]}
        />
        <FieldHint>
          {scope === "world"
            ? "Jobs open to anyone, anywhere, plus jobs open to your country or region."
            : scope === "region"
              ? `Only jobs open to ${p.country ? regionsFor(p.country).join(" or ") || "your region" : "your region"} or your country.`
              : "Remote jobs you can do from home, plus on-site or hybrid jobs in these cities."}
        </FieldHint>
        {scope === "onsite" && (
          <div className="pt-2">
            <TokenInput
              label="Cities"
              values={p.remoteScopes.onsiteCities}
              onChange={(v) => set("remoteScopes", { ...p.remoteScopes, onsiteCities: v })}
              placeholder="Dhaka"
            />
          </div>
        )}
      </Field>

      <Field label="Largest time difference you will work with">
        <Select
          aria-label="Largest time difference"
          value={p.maxTimezoneDiffHours === undefined ? "any" : String(p.maxTimezoneDiffHours)}
          onValueChange={(v) => set("maxTimezoneDiffHours", v === "any" ? undefined : Number(v))}
          options={[
            { value: "any", label: "Any" },
            { value: "2", label: "Up to 2 hours" },
            { value: "4", label: "Up to 4 hours" },
            { value: "6", label: "Up to 6 hours" },
            { value: "8", label: "Up to 8 hours" },
          ]}
          className="sm:max-w-64"
        />
      </Field>

      <div className="space-y-4">
        <Field
          label="Minimum pay, in US dollars a year"
          hint="Optional. Pay in other currencies is converted approximately."
          htmlFor="min-pay"
        >
          <Input
            id="min-pay"
            inputMode="decimal"
            className="sm:max-w-64"
            placeholder="Optional, for example 40k"
            value={payText}
            aria-invalid={payInvalid || undefined}
            aria-describedby={payInvalid ? "min-pay-error" : undefined}
            onChange={(e) => {
              setPayText(e.target.value);
              const n = parseAmountInput(e.target.value);
              if (n !== null) set("minAnnualUsd", n);
            }}
            onBlur={() => {
              const n = parseAmountInput(payText);
              if (n !== null) setPayText(formatAmount(n));
            }}
          />
          {payInvalid && <FieldError id="min-pay-error">Enter an amount like 40k, 40,000 or 40000.</FieldError>}
        </Field>
        <Switch
          label="Show jobs that do not list pay"
          checked={p.showUnlistedPay}
          onCheckedChange={(v) => set("showUnlistedPay", v)}
        />
        {p.minAnnualUsd !== undefined && (
          <Switch
            label="Hide jobs below my minimum"
            checked={p.hideBelowMinimum}
            onCheckedChange={(v) => set("hideBelowMinimum", v)}
          />
        )}
      </div>

      <Field label="Employment types">
        <MultiToggle
          label="Employment types"
          value={p.employmentTypes}
          onChange={(v) => set("employmentTypes", v)}
          options={[
            { value: "full_time", label: "Full-time" },
            { value: "contract", label: "Contract" },
            { value: "part_time", label: "Part-time" },
          ]}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Companies to leave out">
          <TokenInput
            label="Excluded companies"
            values={p.excludedCompanies}
            onChange={(v) => set("excludedCompanies", v)}
            placeholder="Company name"
          />
        </Field>
        <Field label="Words to leave out" hint="Jobs mentioning these are hidden.">
          <TokenInput
            label="Excluded keywords"
            values={p.excludedKeywords}
            onChange={(v) => set("excludedKeywords", v)}
            placeholder="clearance"
          />
        </Field>
      </div>

      <div className="space-y-4">
        <Switch
          label="Prefer lesser-known companies"
          hint="Gives a small boost to companies outside the famous few."
          checked={p.preferLesserKnown}
          onCheckedChange={(v) => set("preferLesserKnown", v)}
        />
        <Switch
          label="Show staffing agencies"
          hint="Agencies often repost the same role many times."
          checked={p.showStaffingAgencies}
          onCheckedChange={(v) => set("showStaffingAgencies", v)}
        />
      </div>

      {save.isError && <ErrorState title="Your preferences were not saved.">{save.error.message}</ErrorState>}
      <Button type="submit" disabled={save.isPending || p.targetTitles.length === 0 || payInvalid}>
        {save.isPending ? "Saving" : saveLabel}
      </Button>
      {p.targetTitles.length === 0 && <FieldHint>Add at least one job title to save.</FieldHint>}
    </form>
  );
}

function PreferencesSkeleton() {
  return (
    <div aria-busy className="space-y-8">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}
