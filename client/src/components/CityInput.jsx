import { useEffect, useId, useState } from 'react';
import { apiUrl } from '../utils/api.mjs';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import './CityInput.css';

export default function CityInput({ value = '', onChange, onBlur, label, error, ...inputProps }) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState([]);
  const [highlighted, setHighlighted] = useState(null);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [resultTerm, setResultTerm] = useState('');
  const current = value.trim();
  const options = resultTerm === current ? results : [];

  useEffect(() => {
    if (!focused || current.length < 3 || selected?.name === value) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus('Finding cities…');
      try {
        const response = await fetch(apiUrl('/api/locations?q=' + encodeURIComponent(current)), { signal: controller.signal });
        if (!response.ok) throw new Error('Location lookup unavailable');
        const data = await response.json();
        if (controller.signal.aborted) return;
        setResults(data.locations ?? []);
        setResultTerm(current);
        setHighlighted(null);
        setStatus(data.locations?.length ? '' : 'No suggestions found. You can enter your location.');
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setResultTerm(current);
          setStatus('Suggestions are unavailable. You can still enter a location.');
        }
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [current, focused, selected, value]);

  function choose(place) {
    if (!place || typeof place === 'string') return;
    onChange(place.name);
    setSelected(place);
    setResults([]);
    setHighlighted(null);
    setStatus('');
  }
  return (
    <div className="city-input">
      {label && <label htmlFor={id}>{label}</label>}
      <Autocomplete id={id} freeSolo disablePortal options={options} inputValue={value}
        value={selected ?? value} filterOptions={items => items} getOptionLabel={place => typeof place === 'string' ? place : place.name}
        isOptionEqualToValue={(left, right) => left.id === right?.id}
        onChange={(event, place) => choose(place)} onHighlightChange={(event, place) => setHighlighted(place)}
        onInputChange={(event, next, reason) => {
          if (reason === 'input' || reason === 'clear') { onChange(next); setSelected(null); setStatus(''); setHighlighted(null); }
        }}
        onKeyDown={event => {
          // Let a normal form submission proceed when no suggestion is highlighted.
          if (event.key === 'Enter' && !highlighted && !event.nativeEvent.isComposing) event.defaultMuiPrevented = true;
        }}
        renderOption={(props, place) => <li {...props} key={place.id}>
          <div><strong>{place.name}</strong><span className="city-input__region">{[place.region, place.country].filter(Boolean).join(', ')}</span></div>
        </li>}
        renderInput={params => <TextField {...params} error={Boolean(error)}
          inputProps={{ ...params.inputProps, ...inputProps, maxLength: inputProps.maxLength ?? 120,
            'aria-describedby': error ? `${id}-error` : `${id}-hint` }}
          onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); onBlur?.(); }} />} />
      <small id={`${id}-hint`} className="city-input__hint">
        {selected?.name === value ? [selected.region, selected.country].filter(Boolean).join(', ')
          : focused && current.length >= 3 ? status : 'Type 3 or more letters for city suggestions, or enter a location.'}
      </small>
      {(inputProps.required || error) && <small id={`${id}-error`} className={`form-feedback${error ? ' form-error' : ''}`}>{error || ' '}</small>}
    </div>
  );
}
