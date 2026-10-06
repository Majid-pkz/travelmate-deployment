import { useState } from 'react';
import axios from 'axios';
import Auth from '../utils/auth';
import TripPhotoPicker from './TripPhotoPicker';
import { photoValidationError } from '../utils/tripPhotos';
import './Forms.css';

export default function Upload({ getUserDetails, onSaved, onCancel }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const invalid = photoValidationError(file);
  async function submit(event) {
    event.preventDefault();
    if (!file || invalid || busy) return;
    if (!Auth.loggedIn()) { setMessage('Log in again before uploading.'); return; }
    setBusy(true);
    setMessage('');
    const body = new FormData();
    body.append('image', file);
    try {
      await axios.post('/api/images', body, { headers: { authorization: 'Bearer ' + Auth.getToken() } });
      await getUserDetails?.();
      setFile(null);
      setMessage('Profile photo updated.');
      onSaved?.();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Upload failed. Please try again.');
    } finally { setBusy(false); }
  }
  return (
    <form className="profile-photo-editor" onSubmit={submit} aria-label="Edit profile photo">
      <TripPhotoPicker file={file} disabled={busy} onChange={value => { setFile(value); setMessage(''); }}
        label="Profile photo (PNG or JPEG, up to 2 MB)" previewAlt="Selected profile preview" />
      {invalid && <p className="form-error" role="alert">{invalid}</p>}
      <div className="form-actions">
        <button className="account-button" type="submit" disabled={!file || Boolean(invalid) || busy}>
          {busy ? 'Uploading…' : 'Upload photo'}
        </button>
        {onCancel && <button type="button" className="account-button account-button--secondary" disabled={busy} onClick={onCancel}>Cancel</button>}
      </div>
      {message && <output className="form-helper">{message}</output>}
    </form>
  );
}
