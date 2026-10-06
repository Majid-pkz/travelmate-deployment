import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { JOIN_TRIP } from '../utils/mutations';
import Auth from '../utils/auth';
import { defaultTripPhoto, showDefaultTripPhoto } from '../utils/tripPhotos';
import TripPhotoUpload from './TripPhotoUpload';
import './TripCard.css';

const dateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});

function dateLabel(value) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? dateFormatter.format(date) : 'Date to be confirmed';
}

function Organizer({ creator, image }) {
  const [failedImage, setFailedImage] = useState(null);
  const name = [creator?.firstname, creator?.lastname].filter(Boolean).join(' ') || 'Traveller';
  const initials = [creator?.firstname?.[0], creator?.lastname?.[0]].filter(Boolean).join('').toUpperCase() || 'T';
  return (
    <div className="trip-card__organizer">
      <span className="trip-card__avatar">
        {image && failedImage !== image
          ? <img src={image} alt={`${name}'s profile`} onError={() => setFailedImage(image)} />
          : <span aria-hidden="true">{initials}</span>}
      </span>
      <div><span className="trip-card__label">Organized by</span><span className="trip-card__name">{name}</span></div>
    </div>
  );
}

export default function TripCard({ trip, view = 'browse', onPhotoUploaded }) {
  const titleId = useId();
  const userId = Auth.getProfile()?.data?._id;
  const organizing = Boolean(userId && trip.creator?._id === userId);
  const members = (trip.travelmates ?? []).filter(member => member._id !== trip.creator?._id);
  const member = Boolean(userId && members.some(person => person._id === userId));
  const [justJoined, setJustJoined] = useState(false);
  const joined = !organizing && (member || justJoined);
  const state = organizing ? 'organizing' : joined ? 'joined' : 'open';
  const [joinTrip, { loading: joining }] = useMutation(JOIN_TRIP);
  const [joinError, setJoinError] = useState('');
  const description = trip.description || 'More trip details are coming soon.';

  async function handleJoin() {
    if (organizing || joined || joining) return;
    setJoinError('');
    if (!Auth.loggedIn()) { setJoinError('Log in to join this trip.'); return; }
    try {
      await joinTrip({ variables: { joinTripId: trip._id, userJoining: userId } });
      setJustJoined(true);
    } catch (error) {
      setJoinError(error.message || 'Could not join this trip. Please try again.');
    }
  }

  return (
    <article className={`trip-card trip-card--${state}`} aria-labelledby={titleId}>
      <div className="trip-card__cover">
        <img className="trip-card__photo" src={trip.image || defaultTripPhoto} alt={trip.title}
          onError={showDefaultTripPhoto} />
        <span className={`trip-card__badge trip-card__badge--${state}`}>
          {organizing ? 'Organizing' : joined ? 'Joined' : 'Open trip'}
        </span>
      </div>
      <div className="trip-card__body">
        <h2 id={titleId} className="trip-card__title">{trip.title}</h2>
        <Organizer creator={trip.creator} image={trip.creatorProfileImage} />
        <dl className="trip-card__route">
          <div><dt>From</dt><dd>{trip.departureLocation}</dd></div>
          <div><dt>To</dt><dd>{trip.destination}</dd></div>
        </dl>
        <div className="trip-card__dates">
          <span className="trip-card__label">Travel dates</span>
          <span><time dateTime={trip.startDate || undefined}>{dateLabel(trip.startDate)}</time>
            {trip.endDate && trip.endDate !== trip.startDate && <> – <time dateTime={trip.endDate}>{dateLabel(trip.endDate)}</time></>}
          </span>
        </div>
        <p className="trip-card__description">{description}</p>
        <details className="trip-card__details">
          <summary>Trip details{view === 'mine' ? ` · ${members.length} travelmate${members.length === 1 ? '' : 's'}` : ''}</summary>
          <div className="trip-card__detail-content">
            <h3>About this trip</h3>
            <p>{description}</p>
            {trip.meetupPoint && <p><strong>Meetup point:</strong> {trip.meetupPoint}</p>}
            {view === 'mine' && <>
              <h3>Travelmates</h3>
              {members.length ? <ul>{members.map(person => <li key={person._id}>
                <span>{person.firstname}</span>
                {person.email && <a href={`mailto:${person.email}`}>{person.email}</a>}
              </li>)}</ul> : <p>No travelmates yet. Your trip is ready for others to join.</p>}
            </>}
          </div>
        </details>
      </div>
      <div className="trip-card__actions">
        {view === 'mine' ? (
          organizing ? <TripPhotoUpload trip={trip} onUploaded={onPhotoUploaded} />
            : <span className="trip-card__status">You're on the list. See you on the trip!</span>
        ) : <>
          {organizing || joined ? <>
            <span className="trip-card__status"><span aria-hidden="true">{joined ? '✓ ' : ''}</span>
              {organizing ? 'Your trip' : "You're on the list"}</span>
            <Link className="trip-card__button trip-card__button--secondary" to="/my-upcoming-trips">View your trips</Link>
          </> : <>
            <span className="trip-card__availability">Find your travelmates</span>
            <button className="trip-card__button" type="button" disabled={joining} onClick={handleJoin}>
              {joining ? 'Joining…' : 'Join Trip'}
            </button>
          </>}
        </>}
      </div>
      {joinError && <p className="trip-card__error" role="alert">{joinError}
        {!userId && <> <Link to="/login">Log in</Link></>}
      </p>}
    </article>
  );
}
