import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * A select wearing the same chrome as the code multi-selects — closed box and
 * open list alike.
 *
 * The native popup cannot be styled: `color-scheme` is the only lever CSS has
 * over it, and that follows the OS on some platforms rather than the app's own
 * theme toggle, so a dark app could still drop a white list. The list is drawn
 * here instead, matching the multi-select's dropdown.
 *
 * A real <select> stays mounted behind the control, carrying `required` so
 * native form validation still fires, and keeping the value in the form's own
 * submission. `onChange` is called with an event-shaped object, so callers
 * reading `e.target.value` need no change.
 *
 * Props pass through, so it drops in wherever a <select> was. Options are
 * plain <option> children; <optgroup> is not supported.
 */

// Most callers pass the app's theme prop. A few screens style themselves with
// Tailwind's `dark:` variants and have no theme in scope; omitting the prop
// falls back to those, so the select still matches its neighbours.
const PALETTE = {
  dark: {
    box: 'bg-slate-800 border-slate-600 text-white',
    chevron: 'text-slate-400',
    menu: 'bg-slate-800 border-slate-600',
    option: 'text-slate-200',
    activeBg: 'bg-slate-700',
    selected: 'text-cyan-400',
    placeholder: 'text-slate-500',
  },
  light: {
    box: 'bg-white border-gray-300 text-gray-900',
    chevron: 'text-gray-500',
    menu: 'bg-white border-gray-300',
    option: 'text-gray-700',
    activeBg: 'bg-gray-100',
    selected: 'text-blue-600',
    placeholder: 'text-gray-400',
  },
  auto: {
    box: 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white',
    chevron: 'text-gray-500 dark:text-slate-400',
    menu: 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600',
    option: 'text-gray-700 dark:text-slate-200',
    activeBg: 'bg-gray-100 dark:bg-slate-700',
    selected: 'text-blue-600 dark:text-cyan-400',
    placeholder: 'text-gray-400 dark:text-slate-500',
  },
};

const optionText = (node) => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(optionText).join('');
  if (React.isValidElement(node)) return optionText(node.props.children);
  return '';
};

const collectOptions = (children) => {
  const out = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === 'option') {
      const label = optionText(child.props.children);
      out.push({
        value: child.props.value !== undefined ? String(child.props.value) : label,
        label,
        disabled: Boolean(child.props.disabled),
      });
      return;
    }
    // Arrays and fragments — the usual result of mapping over data.
    if (child.props && child.props.children) out.push(...collectOptions(child.props.children));
  });
  return out;
};

let idSeq = 0;

const ThemedSelect = ({
  theme,
  // Each form keeps its own focus accent — pass the same focus classes the
  // form's text inputs use, so the two still read as one set of controls.
  focusClass = 'focus:border-blue-500',
  className = '',
  children,
  disabled,
  value,
  onChange,
  required,
  name,
  id,
  style,
  ...props
}) => {
  const mode = theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : 'auto';
  const palette = PALETTE[mode];

  const options = useMemo(() => collectOptions(children), [children]);
  const current = String(value ?? '');
  const selectedIndex = options.findIndex((o) => o.value === current);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropUp, setDropUp] = useState(false);

  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const typeahead = useRef({ text: '', at: 0 });
  const listId = useRef(`themed-select-${(idSeq += 1)}`);

  const commit = useCallback(
    (option) => {
      if (!option || option.disabled) return;
      // Callers read e.target.value; give them the shape they expect.
      const target = { value: option.value, name: name || '' };
      if (onChange) onChange({ target, currentTarget: target });
    },
    [name, onChange]
  );

  const openList = useCallback(
    (index) => {
      if (disabled) return;
      const rect = buttonRef.current?.getBoundingClientRect();
      // Flip above when there is not enough room below for the menu.
      if (rect) setDropUp(window.innerHeight - rect.bottom < 260 && rect.top > 260);
      setActiveIndex(index ?? (selectedIndex >= 0 ? selectedIndex : 0));
      setOpen(true);
    },
    [disabled, selectedIndex]
  );

  // Close on any click that lands outside the control.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep the highlighted row in view as the arrows move it.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const row = listRef.current.children[activeIndex];
    if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const step = (from, delta) => {
    let i = from;
    for (let n = 0; n < options.length; n += 1) {
      i = (i + delta + options.length) % options.length;
      if (!options[i].disabled) return i;
    }
    return from;
  };

  const handleKeyDown = (event) => {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) openList();
        else setActiveIndex((i) => step(i, 1));
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (!open) openList();
        else setActiveIndex((i) => step(i, -1));
        return;
      case 'Home':
        if (open) { event.preventDefault(); setActiveIndex(step(options.length - 1, 1)); }
        return;
      case 'End':
        if (open) { event.preventDefault(); setActiveIndex(step(0, -1)); }
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!open) openList();
        else { commit(options[activeIndex]); setOpen(false); }
        return;
      case 'Escape':
        if (open) { event.preventDefault(); setOpen(false); }
        return;
      case 'Tab':
        setOpen(false);
        return;
      default:
        break;
    }

    // Type-ahead: jump to the next option starting with what was typed.
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now();
      const text = now - typeahead.current.at < 800 ? typeahead.current.text + event.key : event.key;
      typeahead.current = { text, at: now };
      const needle = text.toLowerCase();
      const from = open ? activeIndex : selectedIndex;
      for (let n = 1; n <= options.length; n += 1) {
        const i = (Math.max(from, 0) + n) % options.length;
        if (!options[i].disabled && options[i].label.toLowerCase().startsWith(needle)) {
          if (open) setActiveIndex(i);
          else commit(options[i]);
          return;
        }
      }
    }
  };

  const label = selected ? selected.label : '';
  const isPlaceholder = !selected || selected.value === '';

  return (
    <div className="relative" ref={rootRef}>
      <button
        {...props}
        type="button"
        ref={buttonRef}
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId.current : undefined}
        aria-activedescendant={open ? `${listId.current}-${activeIndex}` : undefined}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        style={style}
        className={`w-full min-h-[42px] flex items-center justify-between gap-2 border rounded-lg pl-3 pr-3 py-2 text-left outline-none transition-colors ${
          palette.box
        } ${focusClass} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      >
        <span className={`truncate ${isPlaceholder ? palette.placeholder : ''}`}>{label}</span>
        <ChevronDown aria-hidden="true" className={`w-4 h-4 flex-shrink-0 ${palette.chevron}`} />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId.current}
          role="listbox"
          className={`absolute z-50 w-full max-h-60 overflow-auto rounded-lg border shadow-lg py-1 ${
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
          } ${palette.menu}`}
        >
          {options.map((option, index) => {
            const isSelected = option.value === current;
            return (
              /* eslint-disable-next-line jsx-a11y/click-events-have-key-events */
              <li
                key={`${option.value}-${index}`}
                id={`${listId.current}-${index}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (option.disabled) return;
                  commit(option);
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                /* Precedence decided here rather than left to CSS order:
                   selected beats the hover highlight for the text colour, and
                   the highlight only ever supplies a background. */
                className={`px-3 py-2 text-sm truncate transition-colors ${
                  option.disabled
                    ? `${palette.placeholder} cursor-not-allowed`
                    : `cursor-pointer ${index === activeIndex ? palette.activeBg : ''} ${
                        isSelected ? `font-medium ${palette.selected}` : palette.option
                      }`
                }`}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      )}

      {/* Real control, kept for `required` validation and form submission. It
          sits under the button so the browser's validation bubble points here. */}
      <select
        aria-hidden="true"
        tabIndex={-1}
        name={name}
        required={required}
        disabled={disabled}
        value={current}
        onChange={() => {}}
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
      >
        {children}
      </select>
    </div>
  );
};

export default ThemedSelect;
