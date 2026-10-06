import { useState } from 'react';
import TripPhotoPicker from './TripPhotoPicker';
import { photoValidationError, photoUploadError, uploadTripPhoto } from '../utils/tripPhotos';

export default function TripPhotoUpload({ trip, onUploaded }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const invalid = photoValidationError(file);
  async function submit(event) {
    event.preventDefault();
    if (!file || invalid || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await uploadTripPhoto(trip._id, file);
      await onUploaded();
      setFile(null);
      setOpen(false);
      setMessage('Trip photo updated.');
    } catch (error) { setMessage(photoUploadError(error)); }
    finally { setBusy(false); }
  }
  return (
    <div className="trip-photo-upload">
      <button type="button" className="btn btn-outline-primary" disabled={busy}
        aria-expanded={open} onClick={() => { setOpen(!open); setMessage(''); }}>
        {trip.image ? 'Change trip photo' : 'Add trip photo'}
      </button>
      {open && <form onSubmit={submit}>
        <TripPhotoPicker file={file} disabled={busy} onChange={value => { setFile(value); setMessage(''); }} />
        {invalid && <p role="alert">{invalid}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy || !file || Boolean(invalid)}>
          {busy ? 'Uploading…' : 'Upload trip photo'}
        </button>
      </form>}
      {message && <output className="d-block">{message}</output>}
    </div>
  );
}
