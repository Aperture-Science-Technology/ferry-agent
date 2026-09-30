import type { ClerkAppearanceTheme } from "@clerk/shared/types";

type AuthVariant = "sign-in" | "sign-up";

/**
 * Clerk appearance aligned to Ferry design tokens and plan 05 field states.
 * No card fill/shadow — the page shell owns the layout chrome.
 */
export function clerkAuthAppearance(variant: AuthVariant): ClerkAppearanceTheme {
  const formGap = variant === "sign-in" ? "gap-5" : "gap-4";

  return {
    variables: {
      colorPrimary: "var(--primary)",
      colorPrimaryForeground: "var(--primary-foreground)",
      colorForeground: "var(--foreground)",
      colorMutedForeground: "var(--muted-foreground)",
      colorBackground: "transparent",
      colorInput: "var(--input)",
      colorInputForeground: "var(--foreground)",
      colorNeutral: "var(--muted-foreground)",
      colorBorder: "var(--border)",
      colorDanger: "var(--destructive)",
      colorRing: "var(--ring)",
      colorMuted: "var(--muted)",
      colorShadow: "transparent",
      borderRadius: "10px",
      fontFamily: "var(--font-primary)",
      fontFamilyButtons: "var(--font-primary)",
      fontSize: "14px",
    },
    elements: {
      // Clerk ships width: 25rem and padding: 2.5rem on .cl-card; plain utilities lose.
      // Important variants win specificity so the form, CTA, and badge share the 448px column.
      rootBox: "!w-full !max-w-[448px]",
      cardBox:
        "!w-full !max-w-[448px] !overflow-visible bg-transparent shadow-none ring-0",
      card: `!w-full !max-w-[448px] gap-0 border-0 bg-transparent !p-0 shadow-none ${formGap}`,
      main: formGap,
      header: "gap-2 text-left",
      headerTitle:
        "font-heading text-[30px] leading-9 font-bold tracking-tight text-foreground",
      headerSubtitle: "text-[15px] leading-snug font-normal text-muted-foreground",
      logoBox: "hidden",
      logoImage: "hidden",
      socialButtonsRoot: "hidden",
      socialButtons: "hidden",
      socialButtonsBlockButton: "hidden",
      dividerRow: "hidden",
      dividerLine: "hidden",
      dividerText: "hidden",
      form: formGap,
      formFieldRow: "gap-3.5",
      formFieldLabelRow: "mb-1.5",
      formFieldLabel: "text-sm font-medium text-foreground",
      formFieldAction:
        "text-[13px] font-medium text-muted-foreground hover:text-foreground",
      formFieldInput:
        "h-9 rounded-[10px] border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
      formFieldInputShowPasswordButton:
        "text-muted-foreground hover:text-foreground",
      formFieldErrorText: "text-[13px] text-destructive",
      formFieldSuccessText: "text-[13px] text-muted-foreground",
      formFieldHintText: "text-[13px] text-muted-foreground",
      formButtonPrimary:
        "h-9 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-none transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
      // Keep "Secured by Clerk" visible (plan requirement) but flush to the 448px column:
      // Clerk's footer injects $8 horizontal padding on children, which overflows the fields.
      footer:
        "!w-full !max-w-[448px] bg-transparent shadow-none !p-0 [&>*]:!px-0 [&>*]:!py-4",
      footerItem:
        "!w-full !max-w-[448px] !rounded-none !bg-transparent !py-4 justify-center text-xs text-muted-foreground",
      footerAction: "text-sm text-muted-foreground",
      footerActionText: "text-sm text-muted-foreground",
      footerActionLink:
        "text-sm font-semibold text-foreground underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      identityPreview: "border-border bg-muted",
      identityPreviewText: "text-sm text-foreground",
      identityPreviewEditButton: "text-muted-foreground hover:text-foreground",
      formFieldCheckbox:
        "size-4 rounded-[4px] border border-border text-primary focus-visible:ring-3 focus-visible:ring-ring/50",
      formFieldCheckboxLabel: "text-[13px] leading-snug text-muted-foreground",
      formFieldCheckboxInput:
        "size-4 rounded-[4px] border border-border accent-primary focus-visible:ring-3 focus-visible:ring-ring/50",
      checkbox: "size-4 rounded-[4px] border border-border",
      buttonArrowIcon: "hidden",
      lastAuthenticationStrategyBadge: "hidden",
      alternativeMethodsBlockButton:
        "h-9 rounded-[10px] border border-border bg-transparent text-sm text-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
      otpCodeFieldInput:
        "h-9 rounded-[10px] border border-border bg-input text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
      alert: "border-border bg-muted text-sm text-foreground",
      alertText: "text-sm text-foreground",
    },
  };
}
