// frontend/components/PriceRange.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

const GREEN = '#4CAF50';
const TRACK = '#E0E0E0';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Web-only input range with proper styling injected once per mount */
const WebRange = ({ value, min = 0, max = 1000, step = 10, onChange, onComplete, ariaLabel }) => {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          input.greener-range {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 28px;
            background: transparent;
            outline: none;
            margin: 0;
            padding: 0;
          }
          input.greener-range::-webkit-slider-runnable-track {
            height: 4px;
            background: transparent;
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
            margin-top: -6px; /* center on 4px track */
            cursor: pointer;
          }
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
        aria-label={ariaLabel}
        style={{ width: '100%', height: '100%' }}
      />
    </>
  );
};

/**
 * Compact, slider-only PriceRange
 * Web: dual-thumb slider with separate hit areas (left=min, right=max)
 * Native: returns null (you already have Min/Max inputs in the modal)
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

  const toPct = (v) => (max > 0 ? (v / max) * 100 : 0);
  const leftPct = useMemo(() => toPct(minValue), [minValue, max]);
  const rightPct = useMemo(() => toPct(maxValue), [maxValue, max]);

  const handleMin = (v) => {
    const next = clamp(Math.round(v / step) * step, 0, maxValue);
    setMinValue(next);
    onPriceChange?.([next, maxValue]);
  };
  const handleMax = (v) => {
    const next = clamp(Math.round(v / step) * step, minValue, max);
    setMaxValue(next);
    onPriceChange?.([minValue, next]);
  };
  const handleComplete = () => onPriceChange?.([minValue, maxValue]);

  if (Platform.OS !== 'web') {
    return null; // keep native UI clean (you have inputs in the modal)
  }

  return (
    <View style={[styles.container, style]}>
      {!hideTitle && <Text style={styles.title}>Price</Text>}

      <View style={styles.sliderWrap}>
        {/* Base track */}
        <View style={styles.track} />

        {/* Active range */}
        <View
          style={[
            styles.active,
            { left: `${leftPct}%`, width: `${Math.max(0, rightPct - leftPct)}%` },
          ]}
        />

        {/* Min slider hit area: left side up to current max */}
        <View style={[styles.hitBox, { left: 0, right: `${100 - rightPct}%`, zIndex: 5 }]}>
          <WebRange
            value={minValue}
            min={0}
            max={max}
            step={step}
            onChange={handleMin}
            onComplete={handleComplete}
            ariaLabel="Minimum price"
          />
        </View>

        {/* Max slider hit area: right side from current min */}
        <View style={[styles.hitBox, { left: `${leftPct}%`, right: 0, zIndex: 6 }]}>
          <WebRange
            value={maxValue}
            min={0}
            max={max}
            step={step}
            onChange={handleMax}
            onComplete={handleComplete}
            ariaLabel="Maximum price"
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 0, backgroundColor: 'transparent' },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  sliderWrap: {
    position: 'relative',
    height: 28, // compact
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
  hitBox: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
});

export default PriceRange;
