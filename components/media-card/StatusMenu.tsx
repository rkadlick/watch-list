import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface StatusMenuProps<T extends string> {
	value: T;
	options: { value: T; label: string; accent: string }[];
	onChange: (value: T) => void;
	showArrow?: boolean;
	disabled?: boolean;
  }

export function StatusMenu<T extends string>({ value, options, onChange, showArrow = true, disabled = false }: StatusMenuProps<T>) {
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement | null>(null);
  
	useEffect(() => {
	  const handleClick = (event: MouseEvent) => {
		if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
		  setOpen(false);
		}
	  };
	  const handleEscape = (event: KeyboardEvent) => {
		if (event.key === "Escape") {
		  setOpen(false);
		}
	  };
	  document.addEventListener("mousedown", handleClick);
	  document.addEventListener("keyup", handleEscape);
	  return () => {
		document.removeEventListener("mousedown", handleClick);
		document.removeEventListener("keyup", handleEscape);
	  };
	}, []);
  
	const active = options.find((opt) => opt.value === value);
  
  
	return (
	  <div 
		className="relative inline-block" 
		ref={containerRef}
		onClick={(e) => e.stopPropagation()}
		onMouseDown={(e) => e.stopPropagation()}
	  >
		<button
		  className={`rounded-full border px-2 py-0.5 text-xs font-medium transition-colors flex items-center gap-1 ${active?.accent} cursor-pointer`}
		  onClick={(e) => {
			e.stopPropagation();
			setOpen((prev) => !prev);
		  }}
		  onMouseDown={(e) => e.stopPropagation()}
		  disabled={disabled}
		>
		  <span>{active?.label ?? "Status"}</span>
		  <ChevronDown className="h-3 w-3" />
		</button>
		{open && (
		  <div className="absolute z-[100] mt-2 w-40 rounded-lg border bg-card shadow-lg">
			<ul className="py-1 text-sm">
			  {options.map((opt) => (
				<li key={opt.value}>
				  <button
					className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/60 cursor-pointer ${
					  opt.value === value ? "text-primary font-semibold" : ""
					}`}
					onClick={(e) => {
					  e.stopPropagation();
					  onChange(opt.value);
					  setOpen(false);
					}}
				  >
					<span>{opt.label}</span>
					{opt.value === value && <span className="text-xs">•</span>}
				  </button>
				</li>
			  ))}
			</ul>
		  </div>
		)}
	  </div>
	);
  }