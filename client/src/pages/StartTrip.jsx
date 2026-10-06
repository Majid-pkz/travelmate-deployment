import { useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { CREATE_TRIP } from '../utils/mutations';
import Auth from '../utils/auth';
import CityInput from '../components/CityInput';
import TripPhotoPicker from '../components/TripPhotoPicker';
import { photoValidationError, photoUploadError, uploadTripPhoto } from '../utils/tripPhotos';
import '../components/Forms.css';

function todayValue() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export default function StartTrip() {
  const userId = Auth.getProfile()?.data?._id;
  const form = useRef(null);
  const [values, setValues] = useState({ title: '', description: '', departureLocation: '', destination: '', startDate: '', endDate: '' });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [createTrip, { error }] = useMutation(CREATE_TRIP);
  const [createdTrip, setCreatedTrip] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [photoSaved, setPhotoSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const errors = {};
  for (const [key, label] of Object.entries({ title: 'Title', description: 'Description', departureLocation: 'Departure location', destination: 'Destination', startDate: 'Start date', endDate: 'End date' })) {
    if (!values[key].trim()) errors[key] = label + ' is required.';
  }
  if (values.startDate && values.startDate < todayValue()) errors.startDate = 'Choose today or a future date.';
  if (values.startDate && values.endDate && values.endDate < values.startDate) errors.endDate = 'End date must be on or after the start date.';
  const visibleError = name => (submitted || touched[name]) ? errors[name] : undefined;
  const touch = name => setTouched(current => ({ ...current, [name]: true }));
  const change = (name, value) => setValues(current => ({ ...current, [name]: value }));
  function choosePhoto(file) { setPhoto(file); setPhotoError(photoValidationError(file)); }
  async function savePhoto(tripId) {
    if (!photo) return;
    try { await uploadTripPhoto(tripId, photo); setPhotoSaved(true); setPhotoError(''); }
    catch (failure) { setPhotoError(photoUploadError(failure)); }
  }
  async function retryPhoto() {
    if (saving || !photo || photoValidationError(photo)) return;
    setSaving(true);
    try { await savePhoto(createdTrip._id); } finally { setSaving(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (saving || createdTrip) return;
    setSubmitted(true);
    if (Object.keys(errors).length || photoValidationError(photo)) {
      form.current?.elements.namedItem(Object.keys(errors)[0])?.focus();
      return;
    }
    setSaving(true);
    try {
      const result = await createTrip({ variables: { ...values, creator: userId } });
      setCreatedTrip(result.data.createTrip);
      await savePhoto(result.data.createTrip._id);
    } catch { /* Apollo supplies the error below. */ }
    finally { setSaving(false); }
  }
  function textField(name, label, maxLength, multiline = false) {
    const id = 'trip-' + name;
    const attrs = { id, name, placeholder: label, value: values[name], maxLength, required: true,
      onChange: event => change(name, event.target.value), onBlur: () => touch(name),
      'aria-invalid': Boolean(visibleError(name)), 'aria-describedby': visibleError(name) ? id + '-error' : undefined };
    return <div className="form-field form-field--wide"><label htmlFor={id}>{label}</label>
      {multiline ? <textarea {...attrs} rows={4} /> : <input {...attrs} type="text" />}
      {visibleError(name) && <small id={id + '-error'} className="form-error">{visibleError(name)}</small>}
    </div>;
  }
  if (!userId) return <Navigate to="/login" replace />;
  return (
    <main className="account-page account-page--narrow">
      <div className="account-page__heading"><h1>Start a trip</h1><p>Share your plans and find people to explore with. All fields are required except the photo.</p></div>
      {createdTrip ? <section className="form-panel">
        <h2>Trip created</h2>
        {saving ? <output>Saving your trip photo…</output> : <>
          <p>Your adventure is ready for travelmates to join.</p>
          {photoSaved && <output className="account-status">Trip photo saved.</output>}
          {photo && !photoSaved && <>
            <p>Your trip is saved. Retry its photo here or add one from My trips.</p>
            <TripPhotoPicker file={photo} onChange={choosePhoto} />
            {photoError && <p role="alert" className="form-error">{photoError}</p>}
            <button type="button" className="account-button" onClick={retryPhoto} disabled={Boolean(photoValidationError(photo))}>Retry photo</button>
          </>}
          <div className="form-actions"><Link className="account-button" to="/my-upcoming-trips">View your trips</Link><Link className="account-button account-button--secondary" to="/">Back to home</Link></div>
        </>}
      </section> : <form className="form-panel" ref={form} onSubmit={submit} noValidate>
        <fieldset disabled={saving}>
          <div className="form-fields">
            {textField('title', 'Title', 120)}
            {textField('description', 'Description', 3000, true)}
            <div className="form-field"><CityInput label="Departure location" placeholder="Departure Location" name="departureLocation" required maxLength={120}
              value={values.departureLocation} onChange={value => change('departureLocation', value)} onBlur={() => touch('departureLocation')} error={visibleError('departureLocation')} /></div>
            <div className="form-field"><CityInput label="Destination" placeholder="Destination" name="destination" required maxLength={120}
              value={values.destination} onChange={value => change('destination', value)} onBlur={() => touch('destination')} error={visibleError('destination')} /></div>
            {['startDate', 'endDate'].map(name => <div key={name} className="form-field">
              <label htmlFor={'trip-' + name}>{name === 'startDate' ? 'Start date' : 'End date'}</label>
              <input id={'trip-' + name} type="date" name={name} placeholder={name === 'startDate' ? 'Start Date' : 'End Date'} required
                min={name === 'endDate' ? values.startDate || todayValue() : todayValue()} value={values[name]}
                onChange={event => change(name, event.target.value)} onBlur={() => touch(name)} aria-invalid={Boolean(visibleError(name))}
                aria-describedby={visibleError(name) ? name + '-error' : undefined} />
              {visibleError(name) && <small id={name + '-error'} className="form-error">{visibleError(name)}</small>}
            </div>)}
            <div className="form-field form-field--wide"><TripPhotoPicker label="Trip photo (optional)" file={photo} onChange={choosePhoto} disabled={saving} />
              {photoError && <p className="form-error" role="alert">{photoError}</p>}</div>
          </div>
          {error && <p role="alert" className="form-error">{error.message}</p>}
          <div className="form-actions"><button type="submit" className="account-button" disabled={saving || Boolean(photoValidationError(photo))}>{saving ? 'Saving…' : 'Create trip'}</button></div>
        </fieldset>
      </form>}
    </main>
  );
}
