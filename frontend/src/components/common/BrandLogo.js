import React from 'react';

/**
 * The AureonCare lockup: the A mark, the wordmark, and the tagline.
 *
 * WHY THIS IS THREE PIECES AND NOT ONE IMAGE. The header used a single 1050x350 PNG shown
 * 36px tall — a ten-fold downscale. Measured on the source, the tagline band is 37px of
 * those 350, so on screen it landed at 3.8 CSS pixels. At that size the strokes fall below
 * one pixel and the browser averages them into a grey smear. It reads as "blurred", and no
 * amount of sharpening or extra resolution can fix it: the problem is the final size, not
 * the source.
 *
 * So the tagline is no longer part of the picture. It is live text, which is drawn as
 * vectors by the browser: crisp at any size, on any display, at any zoom, and it can be
 * set at a size a person can actually read. The mark and the wordmark stay as the original
 * artwork — cut from the same PNG at full resolution — so the brand's own lettering is
 * unchanged rather than substituted with a system font that merely resembles it.
 *
 * The tagline colour is sampled from the artwork (#108050) and lightened for dark mode,
 * where the original green does not carry against a slate background.
 */

const TAGLINE = 'Health | Efficiency | Growth';

const BrandLogo = ({
  theme,
  // Height of the A mark in pixels; everything else is derived from it so the lockup
  // scales as a unit.
  size = 40,
  showTagline = true,
  className = '',
}) => {
  const dark = theme === 'dark';

  // Proportions taken from the original artwork: the wordmark is 93px tall against the
  // mark's 290, i.e. just under a third. It is set a little larger than that here, because
  // matching the original ratio exactly is what made it hard to read in a 36px bar.
  const wordmarkHeight = Math.round(size * 0.46);
  const taglineSize = Math.max(9, Math.round(size * 0.26));

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src="/assets/aureoncare-mark.png"
        alt=""
        aria-hidden="true"
        style={{ height: size }}
        className="w-auto object-contain shrink-0"
      />
      <span className="inline-flex flex-col justify-center min-w-0">
        <img
          src="/assets/aureoncare-wordmark.png"
          alt="AureonCare"
          style={{ height: wordmarkHeight }}
          className="w-auto object-contain"
        />
        {showTagline && (
          <span
            style={{
              fontSize: taglineSize,
              // The letters in the artwork are spaced apart; without this the text version
              // reads as a denser, different mark.
              letterSpacing: '0.04em',
              lineHeight: 1.35,
              color: dark ? '#5EEAD4' : '#108050',
            }}
            className="font-semibold whitespace-nowrap"
          >
            {TAGLINE}
          </span>
        )}
      </span>
    </span>
  );
};

export default BrandLogo;
