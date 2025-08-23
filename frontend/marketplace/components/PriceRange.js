// frontend/components/PriceRange.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

const GREEN = '#4CAF50';
const TRACK = '#E0E0E0';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Web-only input range with proper styling via a <style> block */
const WebRange = ({
  value,
  min = 0,
  max = 1000,
  step = 10,
  onChange,
  onComplete,
  zIndex = 1,
  isMin = false,
}) => {
  return (
    <>
      {/* inject CSS (safe to duplicate) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          input.greener-range {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 28px;      /* overall input box height */
            background: transparent;
            outline: none;
            margin: 0;
            padding: 0;
          }
          input.greener-range::-webkit-slider-runnable-track {
            height: 4px;
            background: transparent; /* we draw the track ourselves */
            border-radius: 2px;
          }
          input.greener-range::-webkit-slider-thumb {
            -webkit-appearance: none;
            height: 16px;
            width: 16px;
            border-radius: 50%;
            background: ${GREEN};
            border: 2px solid #fff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.25);
            margin-top: -6px; /* centers thumb on 4px track */
            cursor: pointer;
          }
          /* Firefox */
          input.greener-range::-moz-range-track {
            height: 4px;
            background: transparent;
            border: none;
            border-radius: 2px;
          }
          input.greener-range::-moz-range-thumb {
            height: 16px;
            width: 16px;
            border-radius: 50%;
            background: ${GREEN};
            border: 2px solid #fff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.25);
            cursor: pointer;
          }
        `,
        }}
      />
      <input
        className="greener-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange?.(Number(e.target.value))}
        onMouseUp={() => onComplete?.()}
        onTouchEnd={() => onComplete?.()}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zIndex,
        }}
        // Accessibility
        aria-label={isMin ? 'Minimum price' : 'Maximum price'}
      />
    </>
  );
};

/**
 * Compact, slider-only PriceRange.
 * Web: dual-thumb slider with highlighted active range.
 * Native: returns null (use your modal Min/Max inputs).
 */
const PriceRange = ({
  initialMin = 0,
  initialMax = 1000,
  onPriceChange,
  style,
  hideTitle = true,
  max = 1000,
  step = 10,
}) => {
  const [minValue, setMinValue] = useState(
    Number.isFinite(Number(initialMin)) ? Number(initialMin) : 0
  );
  const [maxValue, setMaxValue] = useState(
    Number.isFinite(Number(initialMax)) ? Number(initialMax) : max
  );

  useEffect(() => {
    const safeMin = Number.isFinite(Number(initialMin)) ? Number(initialMin) : 0;
    const safeMax = Number.isFinite(Number(initialMax)) ? Number(initialMax) : max;
    setMinValue(clamp(safeMin, 0, max));
    setMaxValue(clamp(safeMax, 0, max));
  }, [initialMin, initialMax, max]);

  const percent = (v) => (max > 0 ? (v / max) * 100 : 0);
  const leftPct = useMemo(() => percent(minValue), [minValue, max]);
  const rightPct = useMemo(() => percent(maxValue), [maxValue, max]);

  const handleMin = (v) => {
    const next = clamp(v, 0, maxValue);
    setMinValue(next);
    onPriceChange?.([next, maxValue]);
  };
  const handleMax = (v) => {
    const next = clamp(v, minValue, max);
    setMaxValue(next);
    onPriceChange?.([minValue, next]);
  };
  const handleComplete = () => onPriceChange?.([minValue, maxValue]);

  // Native: keep the UI clean; you already have Min/Max inputs in the modal
  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {!hideTitle && <Text style={styles.title}>Price</Text>}

      <View style={styles.sliderWrap}>
        {/* Base track */}
        <View style={styles.track} />

        {/* Active range highlight */}
        <View
          style={[
            styles.active,
            {
              left: `${leftPct}%`,
              width: `${Math.max(0, rightPct - leftPct)}%`,
            },
          ]}
        />

        {/* Sliders (stacked) */}
        <WebRange
          value={minValue}
          min={0}
          max={max}
          step={step}
          onChange={(v) => handleMin(v)}
          onComplete={handleComplete}
          zIndex={rightPct - leftPct < 3 ? 4 : 2} // keep min handle on top when close
          isMin
        />
        <WebRange
          value={maxValue}
          min={0}
          max={max}
          step={step}
          onChange={(v) => handleMax(v)}
          onComplete={handleComplete}
          zIndex={3}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 0,          // keep it tight (modal already has padding)
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  sliderWrap: {
    position: 'relative',
    height: 28,          // compact!
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: TRACK,
  },
  active: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: GREEN,
  },
});

export default PriceRange;
