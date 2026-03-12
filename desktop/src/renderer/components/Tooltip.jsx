import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';

const Tooltip = ({ children, text, delay = 300, position = 'bottom', className = '' }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const timerRef = useRef(null);
    const targetRef = useRef(null);

    const handleMouseEnter = () => {
        timerRef.current = setTimeout(() => {
            if (targetRef.current) {
                const rect = targetRef.current.getBoundingClientRect();
                let x = rect.left + rect.width / 2;
                let y = rect.bottom + 8;

                if (position === 'top') {
                    y = rect.top - 8;
                } else if (position === 'left') {
                    x = rect.left - 8;
                    y = rect.top + rect.height / 2;
                } else if (position === 'right') {
                    x = rect.right + 8;
                    y = rect.top + rect.height / 2;
                }

                setCoords({ x, y });
                setIsVisible(true);
            }
        }, delay);
    };

    const handleMouseLeave = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setIsVisible(false);
    };

    return (
        <div
            ref={targetRef}
            className={clsx("inline-block", className)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}
            {isVisible && text && (
                <div
                    className={clsx(
                        "fixed z-[1000] px-3 py-1.5 bg-white/90 backdrop-blur-md border border-slate-200/60 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] text-[11px] font-bold text-slate-700 italic whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-200",
                        position === 'bottom' && "-translate-x-1/2 mt-2",
                        position === 'top' && "-translate-x-1/2 -translate-y-full mb-2",
                        position === 'left' && "-translate-x-full -translate-y-1/2 mr-2",
                        position === 'right' && "-translate-y-1/2 ml-2"
                    )}
                    style={{
                        left: `${coords.x}px`,
                        top: `${coords.y}px`
                    }}
                >
                    {text}
                    {/* Subtle point/arrow could be added here if needed */}
                </div>
            )}
        </div>
    );
};

export default Tooltip;
