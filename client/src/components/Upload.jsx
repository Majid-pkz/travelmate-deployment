import React, { useState } from 'react';
import axios from 'axios';
import Auth from '../utils/auth';

const Upload = ({ getUserDetails }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile || busy) return;
    if (!Auth.loggedIn()) { setMessage('Log in again before uploading.'); return; }
    if (selectedFile.size > 2 * 1024 * 1024) { setMessage('Choose an image smaller than 2 MB.'); return; }
    setBusy(true);
    setMessage('');
    const formData = new FormData();
    formData.append('image', selectedFile);
    try {
      await axios.post('/api/images', formData, {
        headers: { authorization: 'Bearer ' + Auth.getToken() },
      });
      await getUserDetails();
      setMessage('Profile photo updated.');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Upload failed. Please try again.');
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="profile-photo">Profile photo (PNG or JPEG, up to 2 MB)</label>
      <input id="profile-photo" type="file" accept="image/png,image/jpeg"
        onChange={(event) => { setSelectedFile(event.target.files[0]); setMessage(''); }} />
      <button className="btn btn-primary" type="submit" disabled={!selectedFile || busy}>
        {busy ? 'Uploading...' : 'Upload'}
      </button>
      {message && <output className="d-block">{message}</output>}
    </form>
  );
};
export default Upload;
