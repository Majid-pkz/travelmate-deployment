import { useRef, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { Link, Navigate } from 'react-router-dom';
import Select from 'react-select';
import { QUERY_PROFILE, QUERY_INTEREST } from '../utils/queries';
import { UPDATE_PROFILE, UPDATE_USER } from '../utils/mutations';
import Auth from '../utils/auth';
import Upload from '../components/Upload';
import CityInput from '../components/CityInput';
import ChangePassword from '../components/ChangePassword';
import '../components/Forms.css';
import './Style/displayProfile.css';

const optionsFor = interests => (interests ?? []).filter(Boolean).map(interest => ({
  value: interest._id, label: Array.isArray(interest.label) ? interest.label.join(', ') : interest.label,
}));

export default function PersonalProfile() {
  const userId = Auth.getProfile()?.data?._id;
  const { loading, error, data, refetch } = useQuery(QUERY_PROFILE, {
    variables: { profileUser: userId }, skip: !userId, fetchPolicy: 'cache-and-network',
  });
  const { data: interestData } = useQuery(QUERY_INTEREST);
  const [updateProfile, { loading: savingProfile }] = useMutation(UPDATE_PROFILE);
  const [updateUser, { loading: savingAccount }] = useMutation(UPDATE_USER);
  const saving = savingProfile || savingAccount;
  const [draft, setDraft] = useState(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [saveError, setSaveError] = useState('');
  const [failedImage, setFailedImage] = useState(null);
  const photoButton = useRef(null);
  if (!userId) return <Navigate to="/login" replace />;
  if (loading && !data?.profile) return <main className="account-page"><output>Loading profile…</output></main>;
  if (error) return <main className="account-page"><p role="alert">Could not load your profile. Please try again.</p></main>;
  if (!data?.profile) return <Navigate to="/create-profile" replace />;
  const profile = data.profile;
  const person = profile.profileUser;
  const fullName = [person.firstname, person.lastname].filter(Boolean).join(' ');
  const initials = [person.firstname?.[0], person.lastname?.[0]].filter(Boolean).join('').toUpperCase();
  const interests = optionsFor(profile.interests);
  const trips = profile.createdTrips ?? [];
  function edit() {
    setPhotoOpen(false);
    setStatus('');
    setSaveError('');
    setDraft({ firstname: person.firstname, lastname: person.lastname, email: person.email ?? '', currentPassword: '',
      location: profile.location ?? '', age: profile.age ?? '', gender: profile.gender ?? '',
      bio: profile.bio ?? '', interests });
  }
  function change(name, value) { setDraft(current => ({ ...current, [name]: value })); }
  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaveError('');
    if (!draft.firstname.trim() || !draft.lastname.trim()) {
      setSaveError('Enter your first and last name.');
      return;
    }
    let accountSaved = false;
    let profileSaved = false;
    try {
      if (draft.firstname.trim() !== person.firstname || draft.lastname.trim() !== person.lastname || draft.email.trim().toLowerCase() !== person.email) {
        await updateUser({ variables: { id: userId, firstname: draft.firstname, lastname: draft.lastname,
          email: draft.email, ...(draft.email.trim().toLowerCase() !== person.email ? { currentPassword: draft.currentPassword } : {}) } });
        accountSaved = true;
        setDraft(current => ({ ...current, currentPassword: '' }));
      }
      await updateProfile({ variables: { id: userId, location: draft.location,
        age: draft.age === '' ? null : Number(draft.age), gender: draft.gender, bio: draft.bio,
        interests: draft.interests.map(interest => interest.value) } });
      profileSaved = true;
      await refetch();
      setDraft(null);
      setStatus('Profile updated.');
    } catch (failure) {
      setSaveError(profileSaved ? 'Your changes were saved, but the profile could not refresh. Reload the page to see them.'
        : accountSaved ? 'Your account details were saved, but traveller information could not be saved. Please retry.'
          : failure.message || 'Could not save your profile. Please try again.');
    }
  }
  return (
    <main className="account-page">
      <div className="account-page__heading"><h1>My profile</h1><p>A little about you and the adventures you enjoy.</p></div>
      {status && <output className="account-status">{status}</output>}
      <div className="profile-layout">
        <aside className="profile-identity">
          <div className="profile-avatar">
            {profile.image && failedImage !== profile.image
              ? <img src={profile.image} alt="Avatar" onError={() => setFailedImage(profile.image)} />
              : <span aria-label="Profile initials">{initials || 'T'}</span>}
          </div>
          <h2>{fullName}</h2>
          <p className="profile-email">{person.email}</p>
          <p className="profile-location">{profile.location || 'Location not added yet'}</p>
          <span className="profile-stat">{trips.length} trip{trips.length === 1 ? '' : 's'} organized</span>
          <button ref={photoButton} type="button" className="account-button account-button--secondary" disabled={Boolean(draft)}
            aria-expanded={photoOpen} aria-controls="profile-photo-panel"
            onClick={() => { setPhotoOpen(!photoOpen); setStatus(''); }}>
            {profile.image ? 'Change profile photo' : 'Add profile photo'}
          </button>
        </aside>
        <section className="form-panel profile-information" aria-labelledby="profile-information-heading">
          <div className="profile-section-heading">
            <h2 id="profile-information-heading">Traveller information</h2>
            {!draft && <button type="button" className="account-button account-button--secondary" onClick={edit}>Edit profile</button>}
          </div>
          {draft ? <form onSubmit={save}>
            <fieldset disabled={saving}>
              <div className="form-fields">
                <div className="form-field"><label htmlFor="profile-firstname">First name</label><input id="profile-firstname" name="firstname" type="text" required maxLength={50}
                  value={draft.firstname} onChange={event => change('firstname', event.target.value)} /></div>
                <div className="form-field"><label htmlFor="profile-lastname">Last name</label><input id="profile-lastname" name="lastname" type="text" required maxLength={50}
                  value={draft.lastname} onChange={event => change('lastname', event.target.value)} /></div>
                <div className="form-field form-field--wide"><label htmlFor="profile-email">Email address</label><input id="profile-email" name="email" type="email" required maxLength={254} autoComplete="email"
                  aria-describedby="profile-email-help" value={draft.email} onChange={event => change('email', event.target.value)} />
                  <span id="profile-email-help" className="form-helper">Use this email address to log in.</span></div>
                {draft.email.trim().toLowerCase() !== person.email && <div className="form-field form-field--wide"><label htmlFor="profile-current-password">Current password</label>
                  <input id="profile-current-password" name="currentPassword" type="password" required maxLength={72} autoComplete="current-password"
                    aria-describedby="profile-password-help" value={draft.currentPassword} onChange={event => change('currentPassword', event.target.value)} />
                  <span id="profile-password-help" className="form-helper">Confirm your current password to change your email address.</span></div>}
                <div className="form-field form-field--wide"><CityInput label="Location" placeholder="Location" name="location"
                  value={draft.location} onChange={value => change('location', value)} maxLength={120} /></div>
                <div className="form-field"><label htmlFor="profile-age">Age</label><input id="profile-age" name="age" type="number" min="0" max="120" step="1"
                  value={draft.age} onChange={event => change('age', event.target.value)} /></div>
                <div className="form-field"><label htmlFor="profile-gender">Gender</label><select id="profile-gender" name="gender" value={draft.gender} onChange={event => change('gender', event.target.value)}>
                  <option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                </select></div>
                <div className="form-field form-field--wide"><label htmlFor="profile-bio">About me</label><textarea id="profile-bio" name="bio" maxLength={2000}
                  value={draft.bio} onChange={event => change('bio', event.target.value)} rows={4} /></div>
                <div className="form-field form-field--wide"><label htmlFor="profile-interests">Interests</label><Select inputId="profile-interests" name="interests" isMulti
                  value={draft.interests} options={optionsFor(interestData?.interests)} onChange={value => change('interests', value ?? [])} /></div>
              </div>
              {saveError && <p role="alert" className="form-error">{saveError}</p>}
              <div className="form-actions"><button type="submit" className="account-button">{saving ? 'Saving…' : 'Save changes'}</button>
                <button type="button" className="account-button account-button--secondary" onClick={() => { setDraft(null); setSaveError(''); }}>Cancel</button></div>
            </fieldset>
          </form> : <>
            <dl className="profile-facts"><div><dt>Age</dt><dd>{profile.age ?? 'Not added'}</dd></div>
              <div><dt>Gender</dt><dd>{profile.gender || 'Not added'}</dd></div>
              <div><dt>Location</dt><dd>{profile.location || 'Not added'}</dd></div></dl>
            <div className="profile-detail"><h3>About me</h3><p>{profile.bio || 'Tell your travelmates a little about yourself.'}</p></div>
            <div className="profile-detail"><h3>Interests</h3>{interests.length ? <ul className="profile-interests">{interests.map(interest => <li key={interest.value}>{interest.label}</li>)}</ul>
              : <p>Add a few interests to help you find like-minded travelmates.</p>}</div>
            <div className="profile-detail"><h3>Trips I organize</h3>{trips.length ? <ul className="profile-trip-list">{trips.map(trip => <li key={trip._id}>{trip.title}</li>)}</ul>
              : <p>No trips created yet. <Link to="/new-trip">Plan your first trip</Link></p>}</div>
          </>}
        </section>
      </div>
      {photoOpen && <section id="profile-photo-panel" className="form-panel profile-photo-panel" aria-labelledby="photo-editor-heading">
        <h2 id="photo-editor-heading">Update your profile photo</h2>
        <Upload getUserDetails={refetch} onSaved={() => { setPhotoOpen(false); setStatus('Profile photo updated.'); photoButton.current?.focus(); }}
          onCancel={() => { setPhotoOpen(false); photoButton.current?.focus(); }} />
      </section>}
      {!draft && !photoOpen && <ChangePassword />}
    </main>
  );
}
