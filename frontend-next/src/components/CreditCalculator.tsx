"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { SIGNUP_BONUS_CREDITS, suggestCreditPacks } from "@/lib/pricing-catalog";

const MAX_IMAGES = 1_000_000;

export default function CreditCalculator() {
  const [imagesInput, setImagesInput] = useState("800");
  const images = Math.min(MAX_IMAGES, Math.max(0, Math.floor(Number(imagesInput) || 0)));
  const suggestion = suggestCreditPacks(images);

  let result: string;
  if (images === 0) {
    result = "Enter how many images on your site are missing alt text.";
  } else if (suggestion.creditsNeeded === 0) {
    result = `Your ${SIGNUP_BONUS_CREDITS} free sign-up credits cover all ${images.toLocaleString()} images.`;
  } else {
    const packList = suggestion.packs
      .map(({ pack, count }) => `${count > 1 ? `${count} × ` : ""}the ${pack.name} (${pack.price})`)
      .join(" and ");
    const packCount = suggestion.packs.reduce((total, { count }) => total + count, 0);
    const totalNote = packCount > 1 ? ` for $${suggestion.totalPrice} in total` : "";
    result = `Your ${SIGNUP_BONUS_CREDITS} free credits plus ${packList} cover ${images.toLocaleString()} images${totalNote}, with ${suggestion.leftover.toLocaleString()} credits to spare.`;
  }

  return (
    <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-line bg-white p-5 text-left shadow-notebook sm:p-6">
      <label htmlFor="credit-calculator-images" className="label-caps">
        How many images need alt text?
      </label>
      <Input
        id="credit-calculator-images"
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_IMAGES}
        step={1}
        value={imagesInput}
        onChange={(event) => setImagesInput(event.target.value)}
        className="mt-2 font-medium"
        aria-describedby="credit-calculator-result"
      />
      <p id="credit-calculator-result" className="mt-3 text-base text-ink" aria-live="polite">
        {result}
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        Each image uses 1 credit. Once your site is connected, the plugin&apos;s Bulk page shows the exact number of
        images missing alt text and whether your credits cover them.
      </p>
    </div>
  );
}
