import React, { useRef, useEffect, useState } from 'react';

interface WheelPickerProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  label?: string;
}

export function WheelPicker({ value, onChange, min, max, label }: WheelPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<number[]>([]);
  const ITEM_HEIGHT = 38; // px

  useEffect(() => {
    const newItems = [];
    for (let i = min; i <= max; i++) {
      newItems.push(i);
    }
    setItems(newItems);
  }, [min, max]);

  // Handle snapping manually to find which item is focused
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    // Calculate the index based on scroll position
    const activeIndex = Math.round(scrollTop / ITEM_HEIGHT);
    
    // Prevent out of bounds
    const safeIndex = Math.max(0, Math.min(activeIndex, items.length - 1));
    const selectedValue = items[safeIndex];

    if (selectedValue !== value && selectedValue !== undefined) {
      onChange(selectedValue);
    }
  };

  // Scroll to initial value on mount or when value changes externally
  useEffect(() => {
    if (!containerRef.current || items.length === 0) return;
    const index = items.findIndex(v => v === value);
    if (index !== -1) {
      containerRef.current.scrollTop = index * ITEM_HEIGHT;
    }
  }, [value, items]);

  return (
    <div className="flex flex-col items-center gap-1.5 w-full">
      <div className="relative w-full flex flex-col items-center justify-center bg-black/40 border border-white/10 rounded-2xl h-[120px] overflow-hidden group">
        
        {/* Target Marker (Center Highlight) */}
      <div className="absolute inset-y-0 w-full pointer-events-none flex flex-col justify-center z-10">
        <div className="h-[38px] border-y-2 border-emerald-500/50 bg-emerald-500/5 w-full shadow-[inset_0_0_15px_rgba(16,185,129,0.1)]" />
      </div>

      {/* Scrollable Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full h-full overflow-y-auto no-scrollbar scroll-smooth relative z-20"
        style={{
          scrollSnapType: 'y mandatory',
        }}
      >
        {/* Top Padding so the first item can center */}
        <div style={{ height: `calc(50% - ${ITEM_HEIGHT / 2}px)` }} />
        
        {items.map((item, idx) => {
          const isActive = item === value;
          return (
            <div 
              key={item}
              className={`flex items-center justify-center transition-all duration-200 cursor-pointer ${isActive ? 'opacity-100 scale-110' : 'opacity-40 hover:opacity-70'}`}
              style={{
                height: `${ITEM_HEIGHT}px`,
                scrollSnapAlign: 'center',
              }}
              onClick={() => {
                 if (containerRef.current) {
                   containerRef.current.scrollTo({ top: idx * ITEM_HEIGHT, behavior: 'smooth' });
                 }
              }}
            >
              <span className={`text-xl font-black font-mono ${isActive ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'text-gray-400'}`}>
                {item.toString().padStart(2, '0')}
              </span>
            </div>
          );
        })}

        {/* Bottom Padding so the last item can center */}
        <div style={{ height: `calc(50% - ${ITEM_HEIGHT / 2}px)` }} />
      </div>
      </div>

      {label && (
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          {label}
        </div>
      )}
    </div>
  );
}
