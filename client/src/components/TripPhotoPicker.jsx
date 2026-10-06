import { useEffect, useId, useRef, useState } from 'react';
import { photoValidationError } from '../utils/tripPhotos';

export default function TripPhotoPicker({ file, onChange, disabled, label = 'Trip photo' }) {
  const id = useId();
  const input = useRef(null);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!file || photoValidationError(file)) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <input id={id} ref={input} type="file" accept="image/png,image/jpeg"
        disabled={disabled} aria-describedby={id + '-help'} className="form-control"
        onChange={event => onChange(event.target.files[0] || null)} />
      <p id={id + '-help'}>PNG or JPEG, up to 2 MB.</p>
      {preview && <img src={preview} alt="Selected trip preview"
        style={{ width: '100%', maxHeight: 240, objectFit: 'contain' }} />}
      {file && <button type="button" className="btn btn-link" disabled={disabled}
        onClick={() => { onChange(null); input.current.value = ''; }}>Remove photo</button>}
    </div>
  );
}
