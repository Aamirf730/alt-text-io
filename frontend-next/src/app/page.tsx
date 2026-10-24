import JsonLd from "@/components/JsonLd";
import { HOME_FAQS } from "@/lib/home-faqs";
import LandingPageClient from "./LandingPageClient";

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: HOME_FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={faqStructuredData} />
      <LandingPageClient />
    </>
  );
}
