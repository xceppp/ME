import { OnboardingForm } from "@/components/client-forms";
import { PageTitle } from "@/components/shell";

export default function OnboardingPage() {
  return (
    <>
      <PageTitle title="Welcome in." text="A short setup so the first day is useful, not empty." />
      <OnboardingForm />
    </>
  );
}
